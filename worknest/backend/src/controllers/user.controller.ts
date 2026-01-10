import { Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { User } from "../models/index.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../utils/AppError.js";

/**
 * User Controller
 * Handles all user-related operations
 */
class UserController {
  /**
   * Get all users in organization
   * @route GET /api/users
   */
  async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { status, role, search } = req.query;

    const query: Record<string, unknown> = {
      organizationId: req.user.organizationId,
    };

    if (status) {
      query.status = status;
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("name email role status avatar lastSeenAt createdAt")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastSeenAt: user.lastSeenAt,
        isOnline: this.isUserOnline(user.lastSeenAt),
      })),
    });
  }

  /**
   * Get user by ID
   * @route GET /api/users/:id
   */
  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { id } = req.params;

    const user = await User.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    }).select("name email role status avatar lastSeenAt createdAt");

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastSeenAt: user.lastSeenAt,
        isOnline: this.isUserOnline(user.lastSeenAt),
      },
    });
  }

  /**
   * Update user
   * @route PUT /api/users/:id
   */
  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { id } = req.params;
    const { name, avatar, role, status } = req.body;

    // Only allow self-update or admin
    if (id !== req.user.userId && req.user.role !== "ADMIN") {
      throw new ForbiddenError("Permission denied.");
    }

    const user = await User.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    // Update allowed fields
    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;

    // Only admin can update role and status
    if (req.user.role === "ADMIN") {
      if (role) user.role = role;
      if (status) user.status = status;
    }

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
      },
      message: "User updated successfully.",
    });
  }

  /**
   * Delete/block user
   * @route DELETE /api/users/:id
   */
  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can delete users.");
    }

    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.userId) {
      throw new BadRequestError("You cannot delete yourself.");
    }

    const user = await User.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    // Soft delete by blocking
    user.status = "BLOCKED";
    await user.save();

    res.json({
      success: true,
      message: "User blocked successfully.",
    });
  }

  /**
   * Helper function to check if user is online
   */
  private isUserOnline(lastSeenAt: Date): boolean {
    if (!lastSeenAt) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastSeenAt) > fiveMinutesAgo;
  }
}

// Export singleton instance
export const userController = new UserController();
export default UserController;

import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { User } from "../models/index.js";

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users in organization
 * @access  Private
 */
router.get(
  "/",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
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
          isOnline: isUserOnline(user.lastSeenAt),
        })),
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ success: false, error: "Failed to get users." });
    }
  }
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
  "/:id",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { id } = req.params;

      const user = await User.findOne({
        _id: id,
        organizationId: req.user.organizationId,
      }).select("name email role status avatar lastSeenAt createdAt");

      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
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
          isOnline: isUserOnline(user.lastSeenAt),
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ success: false, error: "Failed to get user." });
    }
  }
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (self or admin)
 */
router.put(
  "/:id",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { id } = req.params;
      const { name, avatar, role, status } = req.body;

      // Only allow self-update or admin
      if (id !== req.user.userId && req.user.role !== "ADMIN") {
        res.status(403).json({ success: false, error: "Permission denied." });
        return;
      }

      const user = await User.findOne({
        _id: id,
        organizationId: req.user.organizationId,
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
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
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ success: false, error: "Failed to update user." });
    }
  }
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete/block user
 * @access  Private (admin only)
 */
router.delete(
  "/:id",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        res
          .status(403)
          .json({ success: false, error: "Only admins can delete users." });
        return;
      }

      const { id } = req.params;

      // Prevent self-deletion
      if (id === req.user.userId) {
        res
          .status(400)
          .json({ success: false, error: "You cannot delete yourself." });
        return;
      }

      const user = await User.findOne({
        _id: id,
        organizationId: req.user.organizationId,
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      // Soft delete by blocking
      user.status = "BLOCKED";
      await user.save();

      res.json({
        success: true,
        message: "User blocked successfully.",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ success: false, error: "Failed to delete user." });
    }
  }
);

// Helper function to check if user is online
function isUserOnline(lastSeenAt: Date): boolean {
  if (!lastSeenAt) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(lastSeenAt) > fiveMinutesAgo;
}

export default router;

import { Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { Channel, ChannelMember, User, Message } from "../models/index.js";
import { io } from "../server.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../utils/AppError.js";
import xss from "xss";

/**
 * Channel Controller
 * Handles all channel-related operations
 */
class ChannelController {
  /**
   * Get all channels for the user
   * @route GET /api/channels
   */
  async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    // Get user's channel memberships
    const memberships = await ChannelMember.find({
      organizationId: req.user.organizationId,
      userId: req.user.userId,
    }).populate({
      path: "channelId",
      select: "name description type createdBy lastMessageAt dmParticipants",
    });

    // Format channels
    const channels = await Promise.all(
      memberships.map(async (membership) => {
        const channel =
          membership.channelId as unknown as typeof Channel.prototype;

        // For DM channels, get the other participant's info
        let dmUser = null;
        if (channel.type === "DM" && channel.dmParticipants) {
          const otherUserId = channel.dmParticipants.find(
            (id: { toString: () => string }) =>
              id.toString() !== req.user!.userId
          );
          if (otherUserId) {
            dmUser = await User.findById(otherUserId).select(
              "name email avatar status lastSeenAt"
            );
          }
        }

        // Get member count
        const memberCount = await ChannelMember.countDocuments({
          channelId: channel._id,
        });

        // Get last message
        const lastMessage = await Message.findOne({
          channelId: channel._id,
          isDeleted: false,
        })
          .sort({ createdAt: -1 })
          .populate("senderId", "name")
          .select("content contentType createdAt senderId");

        return {
          id: channel._id,
          name:
            channel.type === "DM"
              ? dmUser?.name || "Direct Message"
              : channel.name,
          description: channel.description,
          type: channel.type,
          memberCount,
          unreadCount: membership.unreadCount,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                senderName: (
                  lastMessage.senderId as unknown as { name: string }
                )?.name,
                createdAt: lastMessage.createdAt,
              }
            : null,
          dmUser: dmUser
            ? {
                id: dmUser._id,
                name: dmUser.name,
                avatar: dmUser.avatar,
                status: dmUser.status,
                lastSeenAt: dmUser.lastSeenAt,
              }
            : null,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
    );

    res.json({
      success: true,
      data: channels,
    });
  }

  /**
   * Create a new channel
   * @route POST /api/channels
   */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { name, description, type = "PUBLIC", members = [] } = req.body;

    // Validate admin for non-DM channels
    if (type !== "DM" && req.user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can create channels.");
    }

    if (!name && type !== "DM") {
      throw new BadRequestError("Channel name is required.");
    }

    // Check for duplicate channel name
    if (type !== "DM") {
      const existing = await Channel.findOne({
        organizationId: req.user.organizationId,
        name: name.toLowerCase(),
        type: { $ne: "DM" },
      });
      if (existing) {
        throw new ConflictError("Channel with this name already exists.");
      }
    }

    // Create channel
    const channel = await Channel.create({
      organizationId: req.user.organizationId,
      name: type === "DM" ? "Direct Message" : xss(name),
      description: description ? xss(description) : "",
      type,
      createdBy: req.user.userId,
      dmParticipants: type === "DM" ? members : undefined,
    });

    // Add creator as admin member
    await ChannelMember.create({
      organizationId: req.user.organizationId,
      channelId: channel._id,
      userId: req.user.userId,
      role: "ADMIN",
    });

    // Add other members
    if (members.length > 0) {
      for (const memberId of members) {
        if (memberId !== req.user.userId) {
          await ChannelMember.create({
            organizationId: req.user.organizationId,
            channelId: channel._id,
            userId: memberId,
            role: "MEMBER",
          });
        }
      }
    }

    // For public channels, add all org users
    if (type === "PUBLIC") {
      const orgUsers = await User.find({
        organizationId: req.user.organizationId,
        status: "ACTIVE",
        _id: { $ne: req.user.userId },
      });

      for (const user of orgUsers) {
        await ChannelMember.create({
          organizationId: req.user.organizationId,
          channelId: channel._id,
          userId: user._id,
          role: "MEMBER",
        });
      }
    }

    // Create system message
    await Message.create({
      organizationId: req.user.organizationId,
      channelId: channel._id,
      senderId: req.user.userId,
      content: `Channel "${channel.name}" was created`,
      contentType: "SYSTEM",
    });

    res.status(201).json({
      success: true,
      data: {
        id: channel._id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
      },
      message: "Channel created successfully.",
    });
  }

  /**
   * Get channel details
   * @route GET /api/channels/:id
   */
  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { id } = req.params;

    // Check membership
    const membership = await ChannelMember.findOne({
      channelId: id,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    const channel = await Channel.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!channel) {
      throw new NotFoundError("Channel not found.");
    }

    // Get members
    const members = await ChannelMember.find({ channelId: id })
      .populate("userId", "name email avatar status lastSeenAt")
      .select("role joinedAt userId");

    res.json({
      success: true,
      data: {
        id: channel._id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        createdAt: channel.createdAt,
        members: members.map((m) => ({
          user: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
    });
  }

  /**
   * Add member to channel
   * @route POST /api/channels/:id/members
   */
  async addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can add members.");
    }

    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      throw new BadRequestError("User ID is required.");
    }

    // Verify channel exists and belongs to org
    const channel = await Channel.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!channel) {
      throw new NotFoundError("Channel not found.");
    }

    // Verify user exists and belongs to org
    const user = await User.findOne({
      _id: userId,
      organizationId: req.user.organizationId,
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    // Check if already a member
    const existing = await ChannelMember.findOne({ channelId: id, userId });
    if (existing) {
      throw new ConflictError("User is already a member.");
    }

    // Add member
    await ChannelMember.create({
      organizationId: req.user.organizationId,
      channelId: id,
      userId,
      role: "MEMBER",
    });

    // Create system message
    const systemMessage = await Message.create({
      organizationId: req.user.organizationId,
      channelId: id,
      senderId: req.user.userId,
      content: `${user.name} was added to the channel`,
      contentType: "SYSTEM",
    });

    // Populate sender for system message
    await systemMessage.populate("senderId", "name avatar");

    const messageData = {
      id: systemMessage._id,
      content: systemMessage.content,
      contentType: systemMessage.contentType,
      sender: systemMessage.senderId,
      channelId: id,
      createdAt: systemMessage.createdAt,
    };

    // Broadcast system message to channel
    io.to(`channel:${id}`).emit("receive-message", messageData);

    // Prepare member data for other users
    const newMemberData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        lastSeenAt: user.lastSeenAt,
      },
      role: "MEMBER",
      joinedAt: new Date(),
    };

    // Notify existing channel members
    io.to(`channel:${id}`).emit("member-added", {
      channelId: id,
      member: newMemberData,
    });

    // Notify the added user with the full channel info
    // We can use the same logic as getAll but for a single channel
    const lastMsg = await Message.findOne({
      channelId: channel._id,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .populate("senderId", "name")
      .select("content contentType createdAt senderId");

    const channelData = {
      id: channel._id,
      name: channel.name,
      description: channel.description,
      type: channel.type,
      memberCount: await ChannelMember.countDocuments({ channelId: id }),
      unreadCount: 0,
      lastMessage: lastMsg
        ? {
            content: lastMsg.content,
            senderName: (lastMsg.senderId as any)?.name,
            createdAt: lastMsg.createdAt,
          }
        : null,
      role: "MEMBER",
      joinedAt: newMemberData.joinedAt,
    };

    io.to(`user:${userId}`).emit("channel-added", channelData);

    res.json({
      success: true,
      message: "Member added successfully.",
    });
  }

  /**
   * Remove member from channel
   * @route DELETE /api/channels/:id/members/:userId
   */
  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can remove members.");
    }

    const { id, userId } = req.params;

    await ChannelMember.deleteOne({
      channelId: id,
      userId,
      organizationId: req.user.organizationId,
    });

    res.json({
      success: true,
      message: "Member removed successfully.",
    });
  }

  /**
   * Delete channel
   * @route DELETE /api/channels/:id
   */
  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "ADMIN") {
      throw new ForbiddenError("Only admins can delete channels.");
    }

    const { id } = req.params;

    const channel = await Channel.findOne({
      _id: id,
      organizationId: req.user.organizationId,
    });

    if (!channel) {
      throw new NotFoundError("Channel not found.");
    }

    // Delete all related data
    await ChannelMember.deleteMany({ channelId: id });
    await Message.deleteMany({ channelId: id });
    await Channel.deleteOne({ _id: id });

    res.json({
      success: true,
      message: "Channel deleted successfully.",
    });
  }

  /**
   * Create or get DM channel
   * @route POST /api/channels/dm
   */
  async createDM(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      throw new BadRequestError("Target user ID is required.");
    }

    // Verify target user exists in org
    const targetUser = await User.findOne({
      _id: targetUserId,
      organizationId: req.user.organizationId,
    });

    if (!targetUser) {
      throw new NotFoundError("User not found.");
    }

    // Find or create DM channel
    const channel = await Channel.findOrCreateDM(req.user.organizationId, [
      req.user.userId,
      targetUserId,
    ]);

    // Ensure both users are members
    for (const participantId of [req.user.userId, targetUserId]) {
      const existing = await ChannelMember.findOne({
        channelId: channel._id,
        userId: participantId,
      });

      if (!existing) {
        await ChannelMember.create({
          organizationId: req.user.organizationId,
          channelId: channel._id,
          userId: participantId,
          role: "MEMBER",
        });
      }
    }

    res.json({
      success: true,
      data: {
        id: channel._id,
        name: targetUser.name,
        type: "DM",
        dmUser: {
          id: targetUser._id,
          name: targetUser.name,
          avatar: targetUser.avatar,
          status: targetUser.status,
        },
      },
    });
  }
}

// Export singleton instance
export const channelController = new ChannelController();
export default ChannelController;

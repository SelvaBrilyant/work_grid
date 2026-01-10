import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { Channel, ChannelMember, User, Message } from "../models/index.js";
import xss from "xss";

const router = Router();

/**
 * @route   GET /api/channels
 * @desc    Get all channels for the user
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
    } catch (error) {
      console.error("Get channels error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to get channels." });
    }
  }
);

/**
 * @route   POST /api/channels
 * @desc    Create a new channel
 * @access  Private (Admin for PUBLIC/PRIVATE, all for DM)
 */
router.post(
  "/",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { name, description, type = "PUBLIC", members = [] } = req.body;

      // Validate admin for non-DM channels
      if (type !== "DM" && req.user.role !== "ADMIN") {
        res.status(403).json({
          success: false,
          error: "Only admins can create channels.",
        });
        return;
      }

      if (!name && type !== "DM") {
        res
          .status(400)
          .json({ success: false, error: "Channel name is required." });
        return;
      }

      // Check for duplicate channel name
      if (type !== "DM") {
        const existing = await Channel.findOne({
          organizationId: req.user.organizationId,
          name: name.toLowerCase(),
          type: { $ne: "DM" },
        });
        if (existing) {
          res
            .status(400)
            .json({
              success: false,
              error: "Channel with this name already exists.",
            });
          return;
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
    } catch (error) {
      console.error("Create channel error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create channel." });
    }
  }
);

/**
 * @route   GET /api/channels/:id
 * @desc    Get channel details
 * @access  Private (member only)
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

      // Check membership
      const membership = await ChannelMember.findOne({
        channelId: id,
        userId: req.user.userId,
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: "You are not a member of this channel.",
        });
        return;
      }

      const channel = await Channel.findOne({
        _id: id,
        organizationId: req.user.organizationId,
      });

      if (!channel) {
        res.status(404).json({ success: false, error: "Channel not found." });
        return;
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
    } catch (error) {
      console.error("Get channel error:", error);
      res.status(500).json({ success: false, error: "Failed to get channel." });
    }
  }
);

/**
 * @route   POST /api/channels/:id/members
 * @desc    Add member to channel
 * @access  Private (Admin only)
 */
router.post(
  "/:id/members",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        res
          .status(403)
          .json({ success: false, error: "Only admins can add members." });
        return;
      }

      const { id } = req.params;
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ success: false, error: "User ID is required." });
        return;
      }

      // Verify channel exists and belongs to org
      const channel = await Channel.findOne({
        _id: id,
        organizationId: req.user.organizationId,
      });

      if (!channel) {
        res.status(404).json({ success: false, error: "Channel not found." });
        return;
      }

      // Verify user exists and belongs to org
      const user = await User.findOne({
        _id: userId,
        organizationId: req.user.organizationId,
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }

      // Check if already a member
      const existing = await ChannelMember.findOne({ channelId: id, userId });
      if (existing) {
        res
          .status(400)
          .json({ success: false, error: "User is already a member." });
        return;
      }

      // Add member
      await ChannelMember.create({
        organizationId: req.user.organizationId,
        channelId: id,
        userId,
        role: "MEMBER",
      });

      // Create system message
      await Message.create({
        organizationId: req.user.organizationId,
        channelId: id,
        senderId: req.user.userId,
        content: `${user.name} was added to the channel`,
        contentType: "SYSTEM",
      });

      res.json({
        success: true,
        message: "Member added successfully.",
      });
    } catch (error) {
      console.error("Add member error:", error);
      res.status(500).json({ success: false, error: "Failed to add member." });
    }
  }
);

/**
 * @route   DELETE /api/channels/:id/members/:userId
 * @desc    Remove member from channel
 * @access  Private (Admin only)
 */
router.delete(
  "/:id/members/:userId",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        res
          .status(403)
          .json({ success: false, error: "Only admins can remove members." });
        return;
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
    } catch (error) {
      console.error("Remove member error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to remove member." });
    }
  }
);

/**
 * @route   DELETE /api/channels/:id
 * @desc    Delete channel
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "ADMIN") {
        res
          .status(403)
          .json({ success: false, error: "Only admins can delete channels." });
        return;
      }

      const { id } = req.params;

      const channel = await Channel.findOne({
        _id: id,
        organizationId: req.user.organizationId,
      });

      if (!channel) {
        res.status(404).json({ success: false, error: "Channel not found." });
        return;
      }

      // Delete all related data
      await ChannelMember.deleteMany({ channelId: id });
      await Message.deleteMany({ channelId: id });
      await Channel.deleteOne({ _id: id });

      res.json({
        success: true,
        message: "Channel deleted successfully.",
      });
    } catch (error) {
      console.error("Delete channel error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete channel." });
    }
  }
);

/**
 * @route   POST /api/channels/dm
 * @desc    Create or get DM channel
 * @access  Private
 */
router.post(
  "/dm",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { userId: targetUserId } = req.body;

      if (!targetUserId) {
        res
          .status(400)
          .json({ success: false, error: "Target user ID is required." });
        return;
      }

      // Verify target user exists in org
      const targetUser = await User.findOne({
        _id: targetUserId,
        organizationId: req.user.organizationId,
      });

      if (!targetUser) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
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
    } catch (error) {
      console.error("Create DM error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create DM channel." });
    }
  }
);

export default router;

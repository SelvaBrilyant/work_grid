import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { Message, ChannelMember, Channel } from "../models/index.js";
import xss from "xss";

const router = Router();

/**
 * @route   GET /api/messages/:channelId
 * @desc    Get messages for a channel
 * @access  Private (member only)
 */
router.get(
  "/:channelId",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { channelId } = req.params;
      const { limit = "50", before, after } = req.query;

      // Verify membership
      const membership = await ChannelMember.findOne({
        channelId,
        userId: req.user.userId,
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: "You are not a member of this channel.",
        });
        return;
      }

      // Build query
      const query: Record<string, unknown> = {
        channelId,
        organizationId: req.user.organizationId,
        isDeleted: false,
      };

      if (before) {
        query.createdAt = { $lt: new Date(before as string) };
      } else if (after) {
        query.createdAt = { $gt: new Date(after as string) };
      }

      const messages = await Message.find(query)
        .populate("senderId", "name email avatar")
        .populate({
          path: "replyTo",
          populate: { path: "senderId", select: "name" },
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string));

      // Mark as read
      membership.lastReadAt = new Date();
      membership.unreadCount = 0;
      await membership.save();

      res.json({
        success: true,
        data: messages.reverse().map((msg) => ({
          id: msg._id,
          content: msg.content,
          contentType: msg.contentType,
          sender: msg.senderId,
          attachments: msg.attachments,
          replyTo: msg.replyTo
            ? {
                id: (msg.replyTo as unknown as { _id: string })._id,
                content: (msg.replyTo as unknown as { content: string })
                  .content,
                sender: (
                  msg.replyTo as unknown as { senderId: { name: string } }
                ).senderId,
              }
            : null,
          isEdited: msg.isEdited,
          reactions: msg.reactions,
          createdAt: msg.createdAt,
        })),
      });
    } catch (error) {
      console.error("Get messages error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to get messages." });
    }
  }
);

/**
 * @route   POST /api/messages/:channelId
 * @desc    Send a message
 * @access  Private (member only)
 */
router.post(
  "/:channelId",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { channelId } = req.params;
      const { content, contentType = "TEXT", replyTo, attachments } = req.body;

      if (!content || content.trim().length === 0) {
        res
          .status(400)
          .json({ success: false, error: "Message content is required." });
        return;
      }

      // Verify membership
      const membership = await ChannelMember.findOne({
        channelId,
        userId: req.user.userId,
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: "You are not a member of this channel.",
        });
        return;
      }

      // Create message
      const message = await Message.create({
        organizationId: req.user.organizationId,
        channelId,
        senderId: req.user.userId,
        content: xss(content.trim()),
        contentType,
        replyTo: replyTo || null,
        attachments: attachments || [],
      });

      // Update channel's last message time
      await Channel.updateOne(
        { _id: channelId },
        { lastMessageAt: new Date() }
      );

      // Increment unread count for other members
      await ChannelMember.updateMany(
        { channelId, userId: { $ne: req.user.userId } },
        { $inc: { unreadCount: 1 } }
      );

      // Populate sender info
      await message.populate("senderId", "name email avatar");

      res.status(201).json({
        success: true,
        data: {
          id: message._id,
          content: message.content,
          contentType: message.contentType,
          sender: message.senderId,
          attachments: message.attachments,
          createdAt: message.createdAt,
        },
      });
    } catch (error) {
      console.error("Send message error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to send message." });
    }
  }
);

/**
 * @route   PUT /api/messages/:id
 * @desc    Edit a message
 * @access  Private (sender only)
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
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        res
          .status(400)
          .json({ success: false, error: "Message content is required." });
        return;
      }

      const message = await Message.findOne({
        _id: id,
        senderId: req.user.userId,
        organizationId: req.user.organizationId,
        isDeleted: false,
      });

      if (!message) {
        res
          .status(404)
          .json({
            success: false,
            error: "Message not found or you cannot edit it.",
          });
        return;
      }

      message.content = xss(content.trim());
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      await message.populate("senderId", "name email avatar");

      res.json({
        success: true,
        data: {
          id: message._id,
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          sender: message.senderId,
        },
      });
    } catch (error) {
      console.error("Edit message error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to edit message." });
    }
  }
);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete a message (soft delete)
 * @access  Private (sender or admin)
 */
router.delete(
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

      const query: Record<string, unknown> = {
        _id: id,
        organizationId: req.user.organizationId,
        isDeleted: false,
      };

      // Only allow sender or admin to delete
      if (req.user.role !== "ADMIN") {
        query.senderId = req.user.userId;
      }

      const message = await Message.findOne(query);

      if (!message) {
        res
          .status(404)
          .json({
            success: false,
            error: "Message not found or you cannot delete it.",
          });
        return;
      }

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = "This message has been deleted";
      await message.save();

      res.json({
        success: true,
        message: "Message deleted successfully.",
      });
    } catch (error) {
      console.error("Delete message error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete message." });
    }
  }
);

/**
 * @route   POST /api/messages/:id/reactions
 * @desc    Add/toggle reaction to message
 * @access  Private (member only)
 */
router.post(
  "/:id/reactions",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required." });
        return;
      }

      const { id } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        res.status(400).json({ success: false, error: "Emoji is required." });
        return;
      }

      const message = await Message.findOne({
        _id: id,
        organizationId: req.user.organizationId,
        isDeleted: false,
      });

      if (!message) {
        res.status(404).json({ success: false, error: "Message not found." });
        return;
      }

      // Verify membership
      const membership = await ChannelMember.findOne({
        channelId: message.channelId,
        userId: req.user.userId,
      });

      if (!membership) {
        res
          .status(403)
          .json({
            success: false,
            error: "You are not a member of this channel.",
          });
        return;
      }

      // Initialize reactions map if needed
      if (!message.reactions) {
        message.reactions = new Map();
      }

      const userObjectId = req.user
        .userId as unknown as import("mongoose").Types.ObjectId;
      const currentReactions = message.reactions.get(emoji) || [];
      const userIndex = currentReactions.findIndex(
        (id) => id.toString() === req.user!.userId
      );

      if (userIndex > -1) {
        // Remove reaction
        currentReactions.splice(userIndex, 1);
      } else {
        // Add reaction
        currentReactions.push(userObjectId);
      }

      if (currentReactions.length === 0) {
        message.reactions.delete(emoji);
      } else {
        message.reactions.set(emoji, currentReactions);
      }

      await message.save();

      res.json({
        success: true,
        data: { reactions: Object.fromEntries(message.reactions) },
      });
    } catch (error) {
      console.error("Reaction error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to update reaction." });
    }
  }
);

export default router;

import { Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { Message, ChannelMember, Channel } from "../models/index.js";
import { io } from "../server.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../utils/AppError.js";
import xss from "xss";

/**
 * Message Controller
 * Handles all message-related operations
 */
class MessageController {
  /**
   * Get messages for a channel
   * @route GET /api/messages/:channelId
   */
  async getByChannel(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { channelId } = req.params;
    const { limit = "50", before, after } = req.query;

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
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

    // === DEBUG LOGGING FOR MESSAGES WITH REPLY-TO ===
    const messagesWithReply = messages.filter((m) => m.replyTo);
    if (messagesWithReply.length > 0) {
      console.log("\n========== GET MESSAGES DEBUG ==========");
      console.log(
        `📋 Found ${messagesWithReply.length} messages with replyTo:`
      );
      messagesWithReply.forEach((m) => {
        console.log(`   - Message ID: ${m._id}`);
        console.log(`     replyTo raw: ${m.replyTo}`);
        console.log(`     replyTo._id: ${(m.replyTo as any)?._id}`);
        console.log(
          `     replyTo.content: ${(m.replyTo as any)?.content?.substring(
            0,
            30
          )}`
        );
      });
      console.log("========== END GET DEBUG ==========\n");
    }

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
              id: (msg.replyTo as any).id || (msg.replyTo as any)._id,
              content: (msg.replyTo as any).content,
              sender: (msg.replyTo as any).senderId,
            }
          : null,
        isEdited: msg.isEdited,
        reactions: msg.reactions,
        readBy: msg.readBy,
        createdAt: msg.createdAt,
      })),
    });
  }

  /**
   * Send a message
   * @route POST /api/messages/:channelId
   */
  async send(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { channelId } = req.params;
    const { content, contentType = "TEXT", replyTo, attachments } = req.body;

    if (!content || content.trim().length === 0) {
      throw new BadRequestError("Message content is required.");
    }

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
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
    await Channel.updateOne({ _id: channelId }, { lastMessageAt: new Date() });

    // Increment unread count for other members
    await ChannelMember.updateMany(
      { channelId, userId: { $ne: req.user.userId } },
      { $inc: { unreadCount: 1 } }
    );

    // Populate sender and replyTo info
    await message.populate([
      { path: "senderId", select: "name email avatar" },
      {
        path: "replyTo",
        populate: { path: "senderId", select: "name" },
      },
    ]);

    const messageData = {
      id: message._id,
      content: message.content,
      contentType: message.contentType,
      sender: message.senderId,
      replyTo: message.replyTo
        ? {
            id: (message.replyTo as any).id || (message.replyTo as any)._id,
            content: (message.replyTo as any).content,
            sender: (message.replyTo as any).senderId,
          }
        : null,
      attachments: message.attachments || [],
      createdAt: message.createdAt,
    };

    // Broadcast new message
    io.to(`channel:${channelId}`).emit("receive-message", messageData);

    res.status(201).json({
      success: true,
      data: messageData,
    });
  }

  /**
   * Edit a message
   * @route PUT /api/messages/:id
   */
  async edit(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      throw new BadRequestError("Message content is required.");
    }

    const message = await Message.findOne({
      _id: id,
      senderId: req.user.userId,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!message) {
      throw new NotFoundError("Message not found or you cannot edit it.");
    }

    message.content = xss(content.trim());
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    await message.populate("senderId", "name email avatar");

    const updatedData = {
      id: message._id,
      channelId: message.channelId,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      sender: message.senderId,
    };

    // Broadcast update
    io.to(`channel:${message.channelId}`).emit("message-updated", updatedData);

    res.json({
      success: true,
      data: updatedData,
    });
  }

  /**
   * Delete a message (soft delete)
   * @route DELETE /api/messages/:id
   */
  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
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
      throw new NotFoundError("Message not found or you cannot delete it.");
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    // Do NOT overwrite content in DB if you want to keep history but hide it
    // Or do overwrite it if you want privacy. The user asked for "This message is deleted"
    message.content = "This message has been deleted";
    await message.save();

    // Broadcast deletion
    io.to(`channel:${message.channelId}`).emit("message-deleted", {
      id: message._id,
      channelId: message.channelId,
      content: message.content,
      isDeleted: true,
    });

    res.json({
      success: true,
      message: "Message deleted successfully.",
    });
  }

  /**
   * Add/toggle reaction to message
   * @route POST /api/messages/:id/reactions
   */
  async toggleReaction(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      throw new BadRequestError("Emoji is required.");
    }

    const message = await Message.findOne({
      _id: id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!message) {
      throw new NotFoundError("Message not found.");
    }

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId: message.channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    // Initialize reactions map if needed
    if (!message.reactions) {
      message.reactions = new Map();
    }

    const userObjectId = req.user
      .userId as unknown as import("mongoose").Types.ObjectId;
    const currentReactions = message.reactions.get(emoji) || [];
    const userIndex = currentReactions.findIndex(
      (reactId) => reactId.toString() === req.user!.userId
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
  }

  /**
   * Mark messages in a channel as read
   * @route POST /api/messages/:channelId/read
   */
  async markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { channelId } = req.params;

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    // Update unread count for member
    membership.lastReadAt = new Date();
    membership.unreadCount = 0;
    await membership.save();

    // Mark messages as read by this user
    // Only mark messages sent before or at current time
    await Message.updateMany(
      {
        channelId,
        organizationId: req.user.organizationId,
        "readBy.userId": { $ne: req.user.userId },
        isDeleted: false,
      },
      {
        $push: {
          readBy: {
            userId: req.user.userId,
            readAt: new Date(),
          },
        },
      }
    );

    res.json({
      success: true,
      message: "Messages marked as read.",
    });
  }

  /**
   * Toggle pin status of a message
   * @route POST /api/messages/:id/pin
   */
  async togglePin(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { id } = req.params;

    const message = await Message.findOne({
      _id: id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!message) {
      throw new NotFoundError("Message not found.");
    }

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId: message.channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    message.isPinned = !message.isPinned;
    if (message.isPinned) {
      message.pinnedAt = new Date();
      message.pinnedBy = req.user.userId as any;
    } else {
      message.pinnedAt = undefined;
      message.pinnedBy = undefined;
    }

    await message.save();

    // Broadcast pin update
    io.to(`channel:${message.channelId}`).emit("message-pinned", {
      id: message._id,
      channelId: message.channelId,
      isPinned: message.isPinned,
      pinnedAt: message.pinnedAt,
      pinnedBy: req.user.userId,
    });

    res.json({
      success: true,
      data: {
        isPinned: message.isPinned,
        pinnedAt: message.pinnedAt,
      },
    });
  }

  /**
   * Get pinned messages for a channel
   * @route GET /api/messages/:channelId/pinned
   */
  async getPinned(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { channelId } = req.params;

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    const messages = await Message.find({
      channelId,
      organizationId: req.user.organizationId,
      isPinned: true,
      isDeleted: false,
    })
      .populate("senderId", "name email avatar")
      .sort({ pinnedAt: -1 });

    res.json({
      success: true,
      data: messages.map((msg) => ({
        id: msg._id,
        content: msg.content,
        sender: msg.senderId,
        isPinned: msg.isPinned,
        pinnedAt: msg.pinnedAt,
        createdAt: msg.createdAt,
      })),
    });
  }

  /**
   * Search messages in a channel
   * @route GET /api/messages/:channelId/search
   */
  async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { channelId } = req.params;
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      throw new BadRequestError("Search query is required.");
    }

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    const messages = await Message.find({
      channelId,
      organizationId: req.user.organizationId,
      content: { $regex: q, $options: "i" },
      isDeleted: false,
    })
      .populate("senderId", "name email avatar")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: messages.map((msg) => ({
        id: msg._id,
        content: msg.content,
        sender: msg.senderId,
        createdAt: msg.createdAt,
      })),
    });
  }

  /**
   * Get thread replies for a message
   * @route GET /api/messages/:messageId/thread
   */
  async getThread(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { messageId } = req.params;
    const { limit = "50", before } = req.query;

    // Get the parent message
    const parentMessage = await Message.findById(messageId).populate(
      "senderId",
      "name email avatar"
    );

    if (!parentMessage) {
      throw new NotFoundError("Message not found.");
    }

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId: parentMessage.channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    // Build query for thread replies
    const query: Record<string, unknown> = {
      parentMessageId: messageId,
      isDeleted: false,
    };

    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const replies = await Message.find(query)
      .populate("senderId", "name email avatar")
      .sort({ createdAt: 1 }) // Oldest first for threads
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: {
        parent: {
          id: parentMessage._id,
          content: parentMessage.content,
          sender: parentMessage.senderId,
          attachments: parentMessage.attachments,
          createdAt: parentMessage.createdAt,
          threadCount: parentMessage.threadCount,
        },
        replies: replies.map((msg) => ({
          id: msg._id,
          content: msg.content,
          sender: msg.senderId,
          attachments: msg.attachments,
          createdAt: msg.createdAt,
          isEdited: msg.isEdited,
        })),
        hasMore: replies.length === parseInt(limit as string),
      },
    });
  }

  /**
   * Send a reply to a thread
   * @route POST /api/messages/:messageId/thread
   */
  async replyToThread(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const { messageId } = req.params;
    const { content, attachments = [] } = req.body;

    if (!content || content.trim().length === 0) {
      throw new BadRequestError("Message content is required.");
    }

    // Get the parent message
    const parentMessage = await Message.findById(messageId);

    if (!parentMessage) {
      throw new NotFoundError("Parent message not found.");
    }

    // Don't allow replying to a thread reply (only one level deep)
    if (parentMessage.parentMessageId) {
      throw new BadRequestError(
        "Cannot reply to a thread reply. Reply to the original message instead."
      );
    }

    // Verify membership
    const membership = await ChannelMember.findOne({
      channelId: parentMessage.channelId,
      userId: req.user.userId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this channel.");
    }

    // Create thread reply
    const threadReply = await Message.create({
      organizationId: req.user.organizationId,
      channelId: parentMessage.channelId,
      senderId: req.user.userId,
      content: xss(content.trim()),
      contentType: attachments.length > 0 ? "FILE" : "TEXT",
      attachments,
      parentMessageId: messageId,
    });

    // Update parent message thread count and last reply time
    await Message.findByIdAndUpdate(messageId, {
      $inc: { threadCount: 1 },
      lastThreadReplyAt: new Date(),
    });

    // Populate sender
    await threadReply.populate("senderId", "name email avatar");

    const replyData = {
      id: threadReply._id,
      content: threadReply.content,
      sender: threadReply.senderId,
      attachments: threadReply.attachments,
      parentMessageId: messageId,
      createdAt: threadReply.createdAt,
    };

    // Broadcast thread reply to channel
    io.to(`channel:${parentMessage.channelId}`).emit("thread-reply", {
      parentMessageId: messageId,
      reply: replyData,
      threadCount: parentMessage.threadCount + 1,
    });

    res.status(201).json({
      success: true,
      data: replyData,
    });
  }
}

// Export singleton instance
export const messageController = new MessageController();
export default MessageController;

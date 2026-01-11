import { Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { Message, ChannelMember, Channel } from "../models/index.js";
import { UnauthorizedError, BadRequestError } from "../utils/AppError.js";

/**
 * Search Controller
 * Handles global search across messages and files
 */
class SearchController {
  /**
   * Global search across all accessible channels
   * @route GET /api/search
   */
  async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const {
      q = "",
      channelId,
      userId,
      startDate,
      endDate,
      type = "all", // all, messages, files
      page = "1",
      limit = "20",
    } = req.query;

    if (!q || (q as string).trim().length < 2) {
      throw new BadRequestError("Search query must be at least 2 characters.");
    }

    const searchQuery = (q as string).trim();
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Get all channels the user is a member of
    const userMemberships = await ChannelMember.find({
      userId: req.user.userId,
      organizationId: req.user.organizationId,
    }).select("channelId");

    const accessibleChannelIds = userMemberships.map((m) => m.channelId);

    if (accessibleChannelIds.length === 0) {
      res.json({
        success: true,
        data: {
          messages: [],
          files: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
        },
      });
      return;
    }

    // Build search query
    const baseQuery: Record<string, unknown> = {
      organizationId: req.user.organizationId,
      channelId: channelId ? channelId : { $in: accessibleChannelIds },
      isDeleted: false,
    };

    // Filter by user if specified
    if (userId) {
      baseQuery.senderId = userId;
    }

    // Filter by date range
    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) {
        (baseQuery.createdAt as Record<string, unknown>).$gte = new Date(
          startDate as string
        );
      }
      if (endDate) {
        (baseQuery.createdAt as Record<string, unknown>).$lte = new Date(
          endDate as string
        );
      }
    }

    let messages: unknown[] = [];
    let files: unknown[] = [];
    let totalMessages = 0;
    let totalFiles = 0;

    // Search messages
    if (type === "all" || type === "messages") {
      const messageQuery = {
        ...baseQuery,
        content: { $regex: searchQuery, $options: "i" },
        parentMessageId: null, // Only search main messages, not thread replies
      };

      [messages, totalMessages] = await Promise.all([
        Message.find(messageQuery)
          .populate("senderId", "name email avatar")
          .populate("channelId", "name type")
          .sort({ createdAt: -1 })
          .skip(type === "messages" ? skip : 0)
          .limit(type === "messages" ? limitNum : 10),
        Message.countDocuments(messageQuery),
      ]);
    }

    // Search files (attachments)
    if (type === "all" || type === "files") {
      const fileQuery = {
        ...baseQuery,
        "attachments.0": { $exists: true }, // Has at least one attachment
        $or: [
          { "attachments.name": { $regex: searchQuery, $options: "i" } },
          { content: { $regex: searchQuery, $options: "i" } },
        ],
      };

      const fileMessages = await Message.find(fileQuery)
        .populate("senderId", "name email avatar")
        .populate("channelId", "name type")
        .sort({ createdAt: -1 })
        .skip(type === "files" ? skip : 0)
        .limit(type === "files" ? limitNum : 10);

      // Extract individual files from messages
      files = fileMessages.flatMap((msg) =>
        (msg.attachments || []).map((att) => ({
          id: `${msg._id}-${att.name}`,
          messageId: msg._id,
          channelId: msg.channelId,
          sender: msg.senderId,
          file: att,
          createdAt: msg.createdAt,
        }))
      );

      totalFiles = await Message.countDocuments(fileQuery);
    }

    // Get channel info for context
    const channelIds = [
      ...new Set([
        ...messages.map((m: any) => m.channelId?._id?.toString()),
        ...files.map((f: any) => f.channelId?._id?.toString()),
      ]),
    ].filter(Boolean);

    const channels = await Channel.find({
      _id: { $in: channelIds },
    }).select("name type");

    const channelMap = new Map(
      channels.map((c) => [c._id.toString(), { name: c.name, type: c.type }])
    );

    // Format results
    const formattedMessages = messages.map((msg: any) => ({
      id: msg._id,
      content: msg.content,
      contentType: msg.contentType,
      sender: msg.senderId,
      channel: {
        id: msg.channelId?._id || msg.channelId,
        name:
          msg.channelId?.name ||
          channelMap.get(msg.channelId?.toString())?.name,
        type:
          msg.channelId?.type ||
          channelMap.get(msg.channelId?.toString())?.type,
      },
      attachments: msg.attachments,
      createdAt: msg.createdAt,
      threadCount: msg.threadCount,
    }));

    const formattedFiles = files.map((f: any) => ({
      id: f.id,
      messageId: f.messageId,
      channel: {
        id: f.channelId?._id || f.channelId,
        name:
          f.channelId?.name || channelMap.get(f.channelId?.toString())?.name,
        type:
          f.channelId?.type || channelMap.get(f.channelId?.toString())?.type,
      },
      sender: f.sender,
      file: f.file,
      createdAt: f.createdAt,
    }));

    const total =
      type === "messages"
        ? totalMessages
        : type === "files"
        ? totalFiles
        : totalMessages + totalFiles;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        messages: formattedMessages,
        files: formattedFiles,
        total,
        totalMessages,
        totalFiles,
        page: pageNum,
        totalPages,
        query: searchQuery,
      },
    });
  }

  /**
   * Get recent search history for the user
   * @route GET /api/search/history
   */
  async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    // For now, return empty - could be stored in Redis or user preferences
    res.json({
      success: true,
      data: {
        recentSearches: [],
      },
    });
  }
}

export const searchController = new SearchController();
export default SearchController;

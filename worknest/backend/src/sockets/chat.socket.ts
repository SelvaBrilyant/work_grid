import { Server } from "socket.io";
import { AuthenticatedSocket } from "../config/socket.js";
import { Message, ChannelMember, Channel, User } from "../models/index.js";
import xss from "xss";

// Online users tracking (in production, use Redis)
const onlineUsers = new Map<string, Set<string>>(); // organizationId -> Set of userIds
const userSockets = new Map<string, string>(); // socketId -> { odiv, orgId }
const typingUsers = new Map<string, Map<string, NodeJS.Timeout>>(); // channelId -> userId -> timeout

export const initializeChatSocket = (io: Server): void => {
  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    const organizationId = socket.organizationId;

    if (!userId || !organizationId) {
      socket.disconnect();
      return;
    }

    console.log(`✅ User ${userId} connected from org ${organizationId}`);

    // Track online status
    if (!onlineUsers.has(organizationId)) {
      onlineUsers.set(organizationId, new Set());
    }
    onlineUsers.get(organizationId)!.add(userId);
    userSockets.set(socket.id, userId);

    // Join organization and private user room
    socket.join(`org:${organizationId}`);
    socket.join(`user:${userId}`);

    // Broadcast user online status
    socket.to(`org:${organizationId}`).emit("user-online", {
      userId,
      timestamp: new Date(),
    });

    // Send current online users to the connecting user
    const orgOnlineUsers = Array.from(onlineUsers.get(organizationId) || []);
    socket.emit("online-users", { users: orgOnlineUsers });

    // Update last seen
    await User.updateOne({ _id: userId }, { lastSeenAt: new Date() });

    // === JOIN CHANNEL ===
    socket.on("join-channel", async (data: { channelId: string }) => {
      try {
        const { channelId } = data;

        // Verify membership
        const membership = await ChannelMember.findOne({
          channelId,
          userId,
          organizationId,
        });

        if (!membership) {
          socket.emit("error", { message: "Not a member of this channel" });
          return;
        }

        // Join channel room
        socket.join(`channel:${channelId}`);
        console.log(`User ${userId} joined channel ${channelId}`);

        // Get channel members who are online
        const channelMembers = await ChannelMember.find({ channelId }).select(
          "userId"
        );
        const memberIds = channelMembers.map((m) => m.userId.toString());
        const onlineMemberIds = memberIds.filter((id) =>
          onlineUsers.get(organizationId)?.has(id)
        );

        socket.emit("channel-joined", {
          channelId,
          onlineMembers: onlineMemberIds,
        });
      } catch (error) {
        console.error("Join channel error:", error);
        socket.emit("error", { message: "Failed to join channel" });
      }
    });

    // === LEAVE CHANNEL ===
    socket.on("leave-channel", (data: { channelId: string }) => {
      const { channelId } = data;
      socket.leave(`channel:${channelId}`);
      console.log(`User ${userId} left channel ${channelId}`);
    });

    // === SEND MESSAGE ===
    socket.on(
      "send-message",
      async (data: {
        channelId: string;
        content: string;
        contentType?: string;
        replyTo?: string;
        attachments?: any[];
      }) => {
        try {
          const {
            channelId,
            content,
            contentType = "TEXT",
            replyTo,
            attachments = [],
          } = data;

          // === DETAILED LOGGING FOR REPLY-TO DEBUGGING ===
          console.log("\n========== SEND MESSAGE DEBUG ==========");
          console.log("📩 Raw data received:", JSON.stringify(data, null, 2));
          console.log("🔍 Extracted values:");
          console.log("   - channelId:", channelId);
          console.log("   - content:", content?.substring(0, 50));
          console.log("   - replyTo (raw):", replyTo);
          console.log("   - replyTo type:", typeof replyTo);
          console.log("   - replyTo truthy:", !!replyTo);
          console.log("   - replyTo length:", replyTo?.length);
          console.log("   - userId (sender):", userId);
          console.log("   - attachments count:", attachments?.length || 0);

          if (!content || content.trim().length === 0) {
            socket.emit("error", { message: "Message content is required" });
            return;
          }

          // Verify membership
          const membership = await ChannelMember.findOne({
            channelId,
            userId,
            organizationId,
          });

          if (!membership) {
            socket.emit("error", { message: "Not a member of this channel" });
            return;
          }

          // Process replyTo - handle undefined, null, empty string, and "undefined" string
          const processedReplyTo =
            replyTo &&
            replyTo.length > 0 &&
            replyTo !== "undefined" &&
            replyTo !== "null"
              ? replyTo
              : null;

          console.log("🔗 Processed replyTo:", processedReplyTo);

          // Create message
          const message = await Message.create({
            organizationId,
            channelId,
            senderId: userId,
            content: xss(content.trim()),
            contentType,
            replyTo: processedReplyTo,
            attachments: attachments || [],
          });

          console.log("💾 Message saved with ID:", message._id);
          console.log(
            "💾 Message replyTo field (before populate):",
            message.replyTo
          );

          // Populate sender and replyTo
          await message.populate([
            { path: "senderId", select: "name email avatar" },
            {
              path: "replyTo",
              populate: { path: "senderId", select: "name" },
            },
          ]);

          console.log(
            "📎 After populate - replyTo:",
            message.replyTo
              ? {
                  id: (message.replyTo as any)?._id,
                  content: (message.replyTo as any)?.content?.substring(0, 30),
                  sender: (message.replyTo as any)?.senderId?.name,
                }
              : null
          );

          // Update channel
          await Channel.updateOne(
            { _id: channelId },
            { lastMessageAt: new Date() }
          );

          // Increment unread for other members
          await ChannelMember.updateMany(
            { channelId, userId: { $ne: userId } },
            { $inc: { unreadCount: 1 } }
          );

          // Clear typing indicator
          clearTyping(channelId, userId);

          const messageData = {
            id: message._id,
            content: message.content,
            contentType: message.contentType,
            sender: message.senderId,
            replyTo: message.replyTo
              ? {
                  id: (message.replyTo as any)._id,
                  content: (message.replyTo as any).content,
                  sender: (message.replyTo as any).senderId,
                }
              : null,
            attachments: message.attachments || [],
            channelId,
            createdAt: message.createdAt,
            readBy: message.readBy || [],
          };

          console.log(
            "📤 Broadcasting messageData.replyTo:",
            messageData.replyTo
          );
          console.log("========== END DEBUG ==========\n");

          // Broadcast to channel room
          io.to(`channel:${channelId}`).emit("receive-message", messageData);

          // Also send notification to org room for sidebar updates
          socket.to(`org:${organizationId}`).emit("new-message-notification", {
            channelId,
            message: messageData,
          });
        } catch (error) {
          console.error("Send message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    // === TYPING INDICATOR ===
    socket.on("typing", async (data: { channelId: string }) => {
      const { channelId } = data;

      // Get user name
      const user = await User.findById(userId).select("name");
      if (!user) return;

      // Set/reset typing timeout
      if (!typingUsers.has(channelId)) {
        typingUsers.set(channelId, new Map());
      }

      const channelTyping = typingUsers.get(channelId)!;

      // Clear existing timeout
      if (channelTyping.has(userId)) {
        clearTimeout(channelTyping.get(userId)!);
      }

      // Set new timeout (3 seconds)
      const timeout = setTimeout(() => {
        clearTyping(channelId, userId);
        socket.to(`channel:${channelId}`).emit("stop-typing", {
          channelId,
          userId,
        });
      }, 3000);

      channelTyping.set(userId, timeout);

      // Broadcast typing
      socket.to(`channel:${channelId}`).emit("typing", {
        channelId,
        userId,
        userName: user.name,
      });
    });

    // === STOP TYPING ===
    socket.on("stop-typing", (data: { channelId: string }) => {
      const { channelId } = data;
      clearTyping(channelId, userId);
      socket.to(`channel:${channelId}`).emit("stop-typing", {
        channelId,
        userId,
      });
    });

    // === MARK AS READ ===
    socket.on("mark-read", async (data: { channelId: string }) => {
      try {
        const { channelId } = data;

        // Update member unread status
        await ChannelMember.updateOne(
          { channelId, userId, organizationId },
          { lastReadAt: new Date(), unreadCount: 0 }
        );

        // Update specific messages
        await Message.updateMany(
          {
            channelId,
            organizationId,
            "readBy.userId": { $ne: userId },
            isDeleted: false,
          },
          {
            $push: {
              readBy: {
                userId,
                readAt: new Date(),
              },
            },
          }
        );

        // Broadcast that messages were read in this channel
        // In a real app, you might want to send specific message IDs,
        // but for now we'll just notify the channel room to refresh seen status
        io.to(`channel:${channelId}`).emit("messages-read", {
          channelId,
          userId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error("Mark as read error:", error);
      }
    });

    // === MESSAGE REACTION ===
    socket.on("react", async (data: { messageId: string; emoji: string }) => {
      try {
        const { messageId, emoji } = data;

        const message = await Message.findOne({
          _id: messageId,
          organizationId,
          isDeleted: false,
        });

        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        // Verify membership
        const membership = await ChannelMember.findOne({
          channelId: message.channelId,
          userId,
        });

        if (!membership) {
          socket.emit("error", { message: "Not a member of this channel" });
          return;
        }

        // Toggle reaction
        if (!message.reactions) {
          message.reactions = new Map();
        }

        const userObjectId =
          userId as unknown as import("mongoose").Types.ObjectId;
        const currentReactions = message.reactions.get(emoji) || [];
        const userIndex = currentReactions.findIndex(
          (id) => id.toString() === userId
        );

        if (userIndex > -1) {
          currentReactions.splice(userIndex, 1);
        } else {
          currentReactions.push(userObjectId);
        }

        if (currentReactions.length === 0) {
          message.reactions.delete(emoji);
        } else {
          message.reactions.set(emoji, currentReactions);
        }

        await message.save();

        // Broadcast reaction update
        io.to(`channel:${message.channelId}`).emit("reaction-updated", {
          messageId,
          reactions: Object.fromEntries(message.reactions),
        });
      } catch (error) {
        console.error("Reaction error:", error);
        socket.emit("error", { message: "Failed to update reaction" });
      }
    });

    // === DISCONNECT ===
    socket.on("disconnect", async () => {
      console.log(`❌ User ${userId} disconnected`);

      // Remove from online users
      onlineUsers.get(organizationId)?.delete(userId);
      userSockets.delete(socket.id);

      // Clear all typing indicators for this user
      typingUsers.forEach((channelMap, channelId) => {
        if (channelMap.has(userId)) {
          clearTimeout(channelMap.get(userId)!);
          channelMap.delete(userId);
          io.to(`channel:${channelId}`).emit("stop-typing", {
            channelId,
            userId,
          });
        }
      });

      // Update last seen
      await User.updateOne({ _id: userId }, { lastSeenAt: new Date() });

      // Broadcast user offline
      socket.to(`org:${organizationId}`).emit("user-offline", {
        userId,
        timestamp: new Date(),
      });
    });
  });
};

function clearTyping(channelId: string, odiv: string): void {
  const channelTyping = typingUsers.get(channelId);
  if (channelTyping?.has(odiv)) {
    clearTimeout(channelTyping.get(odiv)!);
    channelTyping.delete(odiv);
  }
}

export default { initializeChatSocket };

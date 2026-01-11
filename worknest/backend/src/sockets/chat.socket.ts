import { Server } from "socket.io";
import { AuthenticatedSocket } from "../config/socket.js";
import { Message, ChannelMember, Channel, User } from "../models/index.js";
import xss from "xss";

// Online users tracking (in production, use Redis)
const onlineUsers = new Map<string, Set<string>>(); // organizationId -> Set of userIds
const userSockets = new Map<string, string>(); // socketId -> { odiv, orgId }
const typingUsers = new Map<string, Map<string, NodeJS.Timeout>>(); // channelId -> userId -> timeout
const activeHuddles = new Map<string, Set<string>>(); // channelId -> Set of userIds (who are in huddle)
const canvasCursors = new Map<string, Map<string, any>>(); // channelId -> userId -> cursor data

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
          console.log("🔗 Attachments type:", typeof attachments);
          console.log("🔗 Is array:", Array.isArray(attachments));
          console.log("🔗 Attachments content:", attachments);

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

          // === GRANULAR NOTIFICATION LOGIC ===
          const members = await ChannelMember.find({ channelId }).populate(
            "userId"
          );

          for (const member of members) {
            // Skip sender
            if (member.userId._id.toString() === userId) continue;

            const targetUser = member.userId as any;
            const channelSettings = member.notifications;
            const globalSettings = targetUser.settings?.notifications;

            let shouldAlert = false;
            let alertReason = "NORMAL";

            // 1. Check Keywords
            if (globalSettings?.keywords?.length > 0) {
              const matchedKeyword = globalSettings.keywords.find(
                (keyword: string) => {
                  const regex = new RegExp(
                    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                    "i"
                  );
                  return regex.test(content);
                }
              );
              if (matchedKeyword) {
                shouldAlert = true;
                alertReason = "KEYWORD";
              }
            }

            // 2. Check Direct Mentions (@Name)
            if (!shouldAlert) {
              const nameRegex = new RegExp(
                `@${targetUser.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                "i"
              );
              if (nameRegex.test(content)) {
                shouldAlert = true;
                alertReason = "MENTION";
              }
            }

            // 3. Check Special Mentions (@channel, @here, @online)
            if (!shouldAlert) {
              const hasSpecialMention = /@(channel|here|online)\b/i.test(
                content
              );
              if (hasSpecialMention) {
                // Determine if special mention applies to this user
                if (content.toLowerCase().includes("@channel")) {
                  shouldAlert = true;
                  alertReason = "MENTION";
                } else if (
                  content.toLowerCase().includes("@here") ||
                  content.toLowerCase().includes("@online")
                ) {
                  // Only alert if user is online
                  const isOnline = onlineUsers
                    .get(organizationId)
                    ?.has(targetUser._id.toString());
                  if (isOnline) {
                    shouldAlert = true;
                    alertReason = "MENTION";
                  }
                }
              }
            }

            // 4. Check Level-based notifications (ALL/MENTIONS/NONE)
            if (!shouldAlert) {
              if (channelSettings?.notifyOn === "ALL") {
                shouldAlert = true;
                alertReason = "NORMAL";
              } else if (channelSettings?.notifyOn === "MENTIONS") {
                // Handled above
              } else {
                // NONE - skip unless matched keywords or mentioned
              }
            }

            // 5. Check DND (Do Not Disturb) suppression
            if (shouldAlert && globalSettings?.dnd?.enabled) {
              if (
                isWithinDND(
                  globalSettings.dnd.start,
                  globalSettings.dnd.end,
                  targetUser.profile?.timezone
                )
              ) {
                shouldAlert = false; // Suppress alert but still send unread notification
              }
            }

            // 6. Check Mute Override
            if (
              shouldAlert &&
              channelSettings?.muteUntil &&
              new Date(channelSettings.muteUntil) > new Date()
            ) {
              shouldAlert = false;
            }

            // 7. Check User Global Mute (if messages: false)
            if (shouldAlert && globalSettings?.messages === false) {
              shouldAlert = false;
            }

            // 8. Check Desktop Notification setting
            if (shouldAlert && globalSettings?.desktop === false) {
              shouldAlert = false;
            }

            // Send notification to user specifically
            io.to(`user:${targetUser._id}`).emit("new-message-notification", {
              channelId,
              message: messageData,
              shouldAlert,
              alertReason,
              sound: shouldAlert
                ? channelSettings?.sound ||
                  globalSettings?.soundName ||
                  "default"
                : null,
            });
          }
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

    // === HUDDLE EVENTS ===
    socket.on("huddle:join", async (data: { channelId: string }) => {
      const { channelId } = data;
      console.log(`User ${userId} joining huddle in ${channelId}`);

      if (!activeHuddles.has(channelId)) {
        activeHuddles.set(channelId, new Set());
      }
      activeHuddles.get(channelId)!.add(userId);

      socket.join(`huddle:${channelId}`);

      // Notify others in the huddle that a new user joined
      socket.to(`huddle:${channelId}`).emit("huddle:user-joined", {
        userId,
        peerId: socket.id, // We'll use socket.id as peer identifier for simplicity
      });

      // Send list of current participants to the joining user
      const participants = Array.from(activeHuddles.get(channelId) || []);
      socket.emit("huddle:participants", {
        participants: participants.filter((id) => id !== userId),
      });
    });

    socket.on("huddle:leave", (data: { channelId: string }) => {
      const { channelId } = data;
      console.log(`User ${userId} leaving huddle in ${channelId}`);

      if (activeHuddles.has(channelId)) {
        activeHuddles.get(channelId)!.delete(userId);
        if (activeHuddles.get(channelId)!.size === 0) {
          activeHuddles.delete(channelId);
        }
      }

      socket.leave(`huddle:${channelId}`);
      socket.to(`huddle:${channelId}`).emit("huddle:user-left", { userId });
    });

    socket.on(
      "huddle:signal",
      (data: { to: string; from: string; signal: any; channelId: string }) => {
        // Relay WebRTC signaling data
        socket.to(`user:${data.to}`).emit("huddle:signal", {
          from: userId,
          signal: data.signal,
          channelId: data.channelId,
        });
      }
    );

    socket.on(
      "huddle:toggle-media",
      (data: { channelId: string; audio: boolean; video: boolean }) => {
        socket.to(`huddle:${data.channelId}`).emit("huddle:media-state", {
          userId,
          audio: data.audio,
          video: data.video,
        });
      }
    );

    // === CANVAS EVENTS ===
    socket.on("canvas:join", (data: { channelId: string }) => {
      const { channelId } = data;
      socket.join(`canvas:${channelId}`);
    });

    socket.on("canvas:leave", (data: { channelId: string }) => {
      const { channelId } = data;
      socket.leave(`canvas:${channelId}`);

      // Cleanup cursor
      if (canvasCursors.has(channelId)) {
        canvasCursors.get(channelId)!.delete(userId);
        socket.to(`canvas:${channelId}`).emit("canvas:cursor-update", {
          userId,
          cursor: null,
        });
      }
    });

    socket.on(
      "canvas:cursor-move",
      (data: { channelId: string; x: number; y: number; name: string }) => {
        const { channelId, x, y, name } = data;

        if (!canvasCursors.has(channelId)) {
          canvasCursors.set(channelId, new Map());
        }

        const cursorData = { x, y, name, updatedAt: Date.now() };
        canvasCursors.get(channelId)!.set(userId, cursorData);

        socket.to(`canvas:${channelId}`).emit("canvas:cursor-update", {
          userId,
          cursor: cursorData,
        });
      }
    );

    socket.on(
      "canvas:element-update",
      (data: { channelId: string; elements: any[] }) => {
        const { channelId, elements } = data;
        // Broadcast to others in the same canvas
        socket.to(`canvas:${channelId}`).emit("canvas:elements-received", {
          elements,
          senderId: userId,
        });
      }
    );

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

/**
 * Helper to check if current time is within DND range
 * @param start "HH:mm"
 * @param end "HH:mm"
 * @param timezone User's timezone
 */
function isWithinDND(
  start: string,
  end: string,
  timezone: string = "UTC"
): boolean {
  if (!start || !end) return false;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    });

    const parts = formatter.formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    const m = Number(parts.find((p) => p.type === "minute")?.value);

    const currentMinutes = h * 60 + m;

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overlap midnight (e.g., 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  } catch (error) {
    console.error("DND check error:", error);
    // Fallback to UTC/System if timezone is invalid
    return false;
  }
}

export default { initializeChatSocket };

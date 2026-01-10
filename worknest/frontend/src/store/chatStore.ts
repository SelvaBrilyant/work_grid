import { create } from "zustand";
import { channelsApi, messagesApi, usersApi, uploadsApi } from "@/lib/api";
import {
  getSocket,
  MessagePayload,
  TypingPayload,
  PresencePayload,
  ReactionPayload,
} from "@/lib/socket";

export interface Message {
  id: string;
  content: string;
  contentType: string;
  sender: User;
  channelId?: string;
  replyTo?: {
    id: string;
    content: string;
    sender: { name: string };
  } | null;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  attachments?: {
    url: string;
    name: string;
    type: string;
    size: number;
  }[];
  reactions?: Record<string, string[]>;
  readBy: {
    userId: string;
    readAt: string;
  }[];
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: "PUBLIC" | "PRIVATE" | "DM";
  memberCount?: number;
  unreadCount?: number;
  lastMessage?: {
    content: string;
    senderName: string;
    createdAt: string;
  } | null;
  dmUser?: {
    id: string;
    name: string;
    avatar?: string;
    status?: string;
    lastSeenAt?: string;
  } | null;
  role?: string;
  joinedAt?: string;
  members?: {
    user: User;
    role: string;
    joinedAt: string;
  }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  avatar?: string;
  lastSeenAt?: string;
  isOnline?: boolean;
  _id?: string; // Add for backend compatibility
}

interface ChatState {
  // Channels
  channels: Channel[];
  activeChannel: Channel | null;
  isLoadingChannels: boolean;

  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  pinnedMessages: Message[];
  searchResults: Message[];

  // Users
  users: User[];
  onlineUsers: string[];
  typingUsers: Map<string, { userId: string; userName: string }>;

  // UI State
  isSidebarOpen: boolean;
  replyTo: Message | null;
  detailsPanel: {
    isOpen: boolean;
    type: "CHANNEL" | "USER" | null;
    id: string | null;
  };

  // Actions
  fetchChannels: () => Promise<void>;
  setActiveChannel: (channel: Channel | null) => void;
  createChannel: (data: {
    name: string;
    description?: string;
    type: string;
    members?: string[];
  }) => Promise<void>;
  deleteChannel: (id: string) => Promise<void>;
  addMemberToChannel: (channelId: string, userId: string) => Promise<void>;
  createDM: (userId: string) => Promise<Channel>;

  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string, replyToId?: string) => void;
  addMessage: (message: UnifiedMessage) => void;
  updateMessageReactions: (
    messageId: string,
    reactions: Record<string, string[]>
  ) => void;
  editMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  fetchPinnedMessages: (channelId: string) => Promise<void>;
  searchMessages: (channelId: string, query: string) => Promise<void>;
  uploadFile: (
    file: File
  ) => Promise<{ url: string; name: string; type: string; size: number }>;

  fetchUsers: () => Promise<void>;
  setOnlineUsers: (users: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;

  setTyping: (channelId: string, userId: string, userName: string) => void;
  removeTyping: (channelId: string, userId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;

  setReplyTo: (message: Message | null) => void;
  toggleSidebar: () => void;
  openDetails: (type: "CHANNEL" | "USER", id: string) => void;
  closeDetails: () => void;
  markAsRead: (channelId: string) => Promise<void>;

  // Socket event handlers
  initSocketEvents: () => void;
}

// Types for backend responses
type BackendUser = User | (Omit<User, "id"> & { _id: string });
type BackendChannel = Channel | (Omit<Channel, "id"> & { _id: string });
type RawMessage = Omit<Message, "id" | "sender"> & {
  _id: string;
  sender: BackendUser;
};
type UnifiedMessage = Message | RawMessage | MessagePayload;

// Helper to map backend _id to id
const mapUser = (user: BackendUser): User => {
  if (!user) return user as User;
  const id = "id" in user ? user.id : user._id;
  const _id = "_id" in user ? user._id : user.id;
  return {
    ...user,
    id,
    _id,
  } as User;
};

const mapChannel = (channel: BackendChannel): Channel => {
  if (!channel) return channel as Channel;
  return {
    ...channel,
    id: "id" in channel ? channel.id : channel._id,
    dmUser: channel.dmUser ? mapUser(channel.dmUser as BackendUser) : null,
    members: channel.members?.map((m) => ({
      ...m,
      user: mapUser(m.user as BackendUser),
    })),
  } as Channel;
};

export const useChatStore = create<ChatState>((set, get) => {
  return {
    channels: [],
    activeChannel: null,
    isLoadingChannels: false,
    messages: [],
    isLoadingMessages: false,
    hasMoreMessages: true,
    users: [],
    onlineUsers: [],
    typingUsers: new Map(),
    pinnedMessages: [],
    searchResults: [],
    isSidebarOpen: true,
    replyTo: null,
    detailsPanel: {
      isOpen: false,
      type: null,
      id: null,
    },

    fetchChannels: async () => {
      set({ isLoadingChannels: true });
      try {
        const { data } = await channelsApi.getAll();
        if (data.success) {
          set({
            channels: data.data.map(mapChannel),
            isLoadingChannels: false,
          });
        }
      } catch (error) {
        console.error("Failed to fetch channels:", error);
        set({ isLoadingChannels: false });
      }
    },

    setActiveChannel: (channel) => {
      const socket = getSocket();
      const prevChannel = get().activeChannel;

      // Leave previous channel
      if (prevChannel && socket) {
        socket.emit("leave-channel", { channelId: prevChannel.id });
      }

      set({
        activeChannel: channel,
        messages: [],
        hasMoreMessages: true,
        replyTo: null,
        typingUsers: new Map(),
      });

      // Join new channel
      if (channel && socket) {
        socket.emit("join-channel", { channelId: channel.id });
      }
    },

    createChannel: async (data) => {
      try {
        const { data: response } = await channelsApi.create(data);
        if (response.success) {
          await get().fetchChannels();
        }
      } catch (error) {
        console.error("Failed to create channel:", error);
        throw error;
      }
    },

    deleteChannel: async (id) => {
      try {
        await channelsApi.delete(id);
        set((state) => ({
          channels: state.channels.filter((c) => c.id !== id),
          activeChannel:
            state.activeChannel?.id === id ? null : state.activeChannel,
        }));
      } catch (error) {
        console.error("Failed to delete channel:", error);
        throw error;
      }
    },

    addMemberToChannel: async (channelId, userId) => {
      try {
        const { data: response } = await channelsApi.addMember(
          channelId,
          userId
        );
        if (response.success) {
          // Refresh channels to update member counts
          await get().fetchChannels();
          // If current channel is the one we added a member to, refresh it
          if (get().activeChannel?.id === channelId) {
            const { data: activeResp } = await channelsApi.getById(channelId);
            if (activeResp.success) {
              set({ activeChannel: mapChannel(activeResp.data) });
            }
          }
        }
      } catch (error) {
        console.error("Failed to add member to channel:", error);
        throw error;
      }
    },

    createDM: async (userId) => {
      try {
        const { data: response } = await channelsApi.createDM(userId);
        if (response.success) {
          await get().fetchChannels();
          return mapChannel(response.data);
        }
        throw new Error("Failed to create DM");
      } catch (error) {
        console.error("Failed to create DM:", error);
        throw error;
      }
    },

    fetchMessages: async (channelId) => {
      set({ isLoadingMessages: true, messages: [], hasMoreMessages: true });
      try {
        const { data } = await messagesApi.getByChannel(channelId);
        if (data.success) {
          // Debug: Log raw data from backend
          console.log("📋 Raw messages from API:", data.data.slice(0, 2));

          const formattedMessages = data.data.map(
            (
              msg: Partial<Message> & {
                _id?: string;
                id?: string;
                sender: BackendUser;
              }
            ) => {
              // Handle both 'id' and '_id' from backend responses
              const messageId = msg.id || msg._id;
              console.log(
                `📋 Message mapping: id=${msg.id}, _id=${msg._id}, final=${messageId}`
              );

              return {
                ...msg,
                id: messageId,
                sender: mapUser(msg.sender),
              };
            }
          );

          set({
            messages: formattedMessages,
            isLoadingMessages: false,
            hasMoreMessages: data.data.length >= 50,
          });

          // Mark as read when fetching initial messages
          await get().markAsRead(channelId);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        set({ isLoadingMessages: false });
      }
    },

    loadMoreMessages: async () => {
      const { activeChannel, messages, hasMoreMessages } = get();
      if (!activeChannel || !hasMoreMessages || messages.length === 0) return;

      try {
        const oldestMessage = messages[0];
        const { data } = await messagesApi.getByChannel(activeChannel.id, {
          before: oldestMessage.createdAt,
        });
        if (data.success) {
          const formattedMessages = data.data.map(
            (
              msg: Partial<Message> & {
                _id?: string;
                id?: string;
                sender: BackendUser;
              }
            ) => {
              // Handle both 'id' and '_id' from backend responses
              const messageId = msg.id || msg._id;
              return {
                ...msg,
                id: messageId,
                sender: mapUser(msg.sender),
              };
            }
          );
          set((state) => ({
            messages: [...formattedMessages, ...state.messages],
            hasMoreMessages: data.data.length >= 50,
          }));
        }
      } catch (error) {
        console.error("Failed to load more messages:", error);
      }
    },

    sendMessage: (content, replyToId) => {
      const socket = getSocket();
      const { activeChannel, replyTo } = get();

      if (!socket || !activeChannel) return;

      socket.emit("send-message", {
        channelId: activeChannel.id,
        content,
        replyTo: replyToId || replyTo?.id,
      });

      set({ replyTo: null });
    },

    addMessage: (payload) => {
      // === DEBUG LOGGING FOR RECEIVED MESSAGES ===
      console.log("\n========== RECEIVED MESSAGE DEBUG ==========");
      console.log("📥 Raw payload received:", payload);
      console.log("📥 payload.replyTo:", payload.replyTo);

      // Map the message if needed (especially sender)
      const formattedMessage: Message = {
        ...payload,
        id: "id" in payload ? payload.id : payload._id,
        sender: mapUser(payload.sender as BackendUser),
        readBy: payload.readBy || [], // Ensure readBy is an array
        replyTo: payload.replyTo || null, // Explicitly preserve replyTo
      } as Message;

      console.log("📥 Formatted message replyTo:", formattedMessage.replyTo);
      console.log("========== END RECEIVED DEBUG ==========\n");

      set((state) => {
        // Check if message already exists
        if (state.messages.some((m) => m.id === formattedMessage.id)) {
          return state;
        }
        return { messages: [...state.messages, formattedMessage] };
      });
    },

    updateMessageReactions: (messageId, reactions) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      }));
    },

    editMessage: async (id, content) => {
      try {
        await messagesApi.update(id, content);
      } catch (error) {
        console.error("Failed to edit message:", error);
        throw error;
      }
    },

    deleteMessage: async (id) => {
      try {
        await messagesApi.delete(id);
      } catch (error) {
        console.error("Failed to delete message:", error);
        throw error;
      }
    },

    togglePin: async (id) => {
      try {
        await messagesApi.togglePin(id);
      } catch (error) {
        console.error("Failed to toggle pin:", error);
        throw error;
      }
    },

    fetchPinnedMessages: async (channelId) => {
      try {
        const { data } = await messagesApi.getPinned(channelId);
        if (data.success) {
          set({ pinnedMessages: data.data });
        }
      } catch (error) {
        console.error("Failed to fetch pinned messages:", error);
      }
    },

    searchMessages: async (channelId, query) => {
      if (!query.trim()) {
        set({ searchResults: [] });
        return;
      }
      try {
        const { data } = await messagesApi.search(channelId, query);
        if (data.success) {
          set({ searchResults: data.data });
        }
      } catch (error) {
        console.error("Failed to search messages:", error);
      }
    },

    uploadFile: async (file) => {
      try {
        const { data } = await uploadsApi.uploadFile(file);
        if (data.success) {
          return data.data;
        }
        throw new Error("Upload failed");
      } catch (error) {
        console.error("Failed to upload file:", error);
        throw error;
      }
    },

    fetchUsers: async () => {
      try {
        const { data } = await usersApi.getAll({ status: "ACTIVE" });
        if (data.success) {
          set({ users: data.data.map(mapUser) });
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    },

    setOnlineUsers: (users) => set({ onlineUsers: users }),

    addOnlineUser: (userId) => {
      set((state) => {
        if (state.onlineUsers.includes(userId)) return state;
        return { onlineUsers: [...state.onlineUsers, userId] };
      });
    },

    removeOnlineUser: (userId) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== userId),
      }));
    },

    setTyping: (channelId, userId, userName) => {
      const { activeChannel } = get();
      if (activeChannel?.id !== channelId) return;

      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        newTypingUsers.set(userId, { userId, userName });
        return { typingUsers: newTypingUsers };
      });
    },

    removeTyping: (channelId, userId) => {
      const { activeChannel } = get();
      if (activeChannel?.id !== channelId) return;

      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        newTypingUsers.delete(userId);
        return { typingUsers: newTypingUsers };
      });
    },

    startTyping: () => {
      const socket = getSocket();
      const { activeChannel } = get();
      if (!socket || !activeChannel) return;

      socket.emit("typing", { channelId: activeChannel.id });
    },

    stopTyping: () => {
      const socket = getSocket();
      const { activeChannel } = get();
      if (!socket || !activeChannel) return;

      socket.emit("stop-typing", { channelId: activeChannel.id });
    },

    setReplyTo: (message) => set({ replyTo: message }),

    toggleSidebar: () =>
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    openDetails: async (type, id) => {
      set({
        detailsPanel: {
          isOpen: true,
          type,
          id,
        },
      });

      if (type === "CHANNEL") {
        try {
          const { data } = await channelsApi.getById(id);
          if (data.success) {
            const detailChannel = mapChannel(data.data);
            set((state) => ({
              channels: state.channels.map((c) =>
                c.id === id ? { ...c, ...detailChannel } : c
              ),
              activeChannel:
                state.activeChannel?.id === id
                  ? { ...state.activeChannel, ...detailChannel }
                  : state.activeChannel,
            }));
          }
        } catch (error) {
          console.error("Failed to fetch channel details:", error);
        }
      }
    },

    closeDetails: () =>
      set({
        detailsPanel: {
          isOpen: false,
          type: null,
          id: null,
        },
      }),

    markAsRead: async (channelId) => {
      try {
        await messagesApi.markRead(channelId);
        // Update local unread count for the channel
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId ? { ...c, unreadCount: 0 } : c
          ),
        }));

        // Also emit socket event for real-time seen status
        const socket = getSocket();
        if (socket) {
          socket.emit("mark-read", { channelId });
        }
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    },

    initSocketEvents: () => {
      const socket = getSocket();
      if (!socket) return;

      socket.on("receive-message", (data: MessagePayload) => {
        get().addMessage(data);
        // If we are in the channel, mark it as read immediately
        if (get().activeChannel?.id === data.channelId) {
          get().markAsRead(data.channelId);
        }
      });

      socket.on("typing", (data: TypingPayload) => {
        get().setTyping(data.channelId, data.userId, data.userName);
      });

      socket.on(
        "stop-typing",
        (data: { channelId: string; userId: string }) => {
          get().removeTyping(data.channelId, data.userId);
        }
      );

      socket.on("online-users", (data: { users: string[] }) => {
        get().setOnlineUsers(data.users);
      });

      socket.on("user-online", (data: PresencePayload) => {
        get().addOnlineUser(data.userId);
      });

      socket.on("user-offline", (data: PresencePayload) => {
        get().removeOnlineUser(data.userId);
      });

      socket.on("reaction-updated", (data: ReactionPayload) => {
        get().updateMessageReactions(data.messageId, data.reactions);
      });

      socket.on("message-updated", (data: UnifiedMessage) => {
        const id = "id" in data ? data.id : (data as RawMessage)._id;
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? ({ ...m, ...data, id } as Message) : m
          ),
        }));
      });

      socket.on(
        "message-deleted",
        (data: {
          id: string;
          channelId: string;
          content: string;
          isDeleted: boolean;
        }) => {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === data.id
                ? { ...m, ...data, content: "This message has been deleted" }
                : m
            ),
          }));
        }
      );

      socket.on(
        "messages-read",
        (data: { channelId: string; userId: string; readAt: string }) => {
          const { channelId, userId, readAt } = data;
          const { activeChannel } = get();

          if (activeChannel?.id === channelId) {
            set((state) => ({
              messages: state.messages.map((m) => {
                const alreadyRead = m.readBy.some(
                  (r) => r.userId.toString() === userId.toString()
                );
                if (alreadyRead) return m;

                return {
                  ...m,
                  readBy: [...m.readBy, { userId, readAt }],
                };
              }),
            }));
          }
        }
      );

      socket.on(
        "member-added",
        (data: {
          channelId: string;
          member: { user: BackendUser; role: string; joinedAt: string };
        }) => {
          const { channelId, member } = data;
          const formattedMember = {
            ...member,
            user: mapUser(member.user),
          };

          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === channelId
                ? { ...c, memberCount: (c.memberCount || 0) + 1 }
                : c
            ),
            activeChannel:
              state.activeChannel?.id === channelId
                ? {
                    ...state.activeChannel,
                    memberCount: (state.activeChannel.memberCount || 0) + 1,
                    members: state.activeChannel.members
                      ? [...state.activeChannel.members, formattedMember]
                      : [formattedMember],
                  }
                : state.activeChannel,
          }));
        }
      );

      socket.on("channel-added", (data: BackendChannel) => {
        const formattedChannel = mapChannel(data);
        set((state) => {
          if (state.channels.some((c) => c.id === formattedChannel.id))
            return state;
          return {
            channels: [...state.channels, formattedChannel],
          };
        });
      });

      socket.on(
        "new-message-notification",
        (data: { channelId: string; message: MessagePayload }) => {
          // Update unread count for the channel
          set((state) => ({
            channels: state.channels.map((c) =>
              c.id === data.channelId && c.id !== state.activeChannel?.id
                ? {
                    ...c,
                    unreadCount: (c.unreadCount || 0) + 1,
                    lastMessage: {
                      content: data.message.content,
                      senderName: data.message.sender.name,
                      senderId: data.message.sender._id,
                      createdAt: data.message.createdAt,
                    },
                  }
                : c
            ),
          }));
        }
      );
    },
  };
});

export default useChatStore;

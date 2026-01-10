import { create } from "zustand";
import { channelsApi, messagesApi, usersApi } from "@/lib/api";
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
  sender: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  channelId?: string;
  replyTo?: {
    id: string;
    content: string;
    sender: { name: string };
  } | null;
  isEdited?: boolean;
  reactions?: Record<string, string[]>;
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar?: string;
  lastSeenAt?: string;
  isOnline?: boolean;
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

  // Users
  users: User[];
  onlineUsers: string[];
  typingUsers: Map<string, { userId: string; userName: string }>;

  // UI State
  isSidebarOpen: boolean;
  replyTo: Message | null;

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
  createDM: (userId: string) => Promise<Channel>;

  fetchMessages: (channelId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (content: string, replyToId?: string) => void;
  addMessage: (message: Message) => void;
  updateMessageReactions: (
    messageId: string,
    reactions: Record<string, string[]>
  ) => void;

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

  // Socket event handlers
  initSocketEvents: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannel: null,
  isLoadingChannels: false,
  messages: [],
  isLoadingMessages: false,
  hasMoreMessages: true,
  users: [],
  onlineUsers: [],
  typingUsers: new Map(),
  isSidebarOpen: true,
  replyTo: null,

  fetchChannels: async () => {
    set({ isLoadingChannels: true });
    try {
      const { data } = await channelsApi.getAll();
      if (data.success) {
        set({ channels: data.data, isLoadingChannels: false });
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

  createDM: async (userId) => {
    try {
      const { data: response } = await channelsApi.createDM(userId);
      if (response.success) {
        await get().fetchChannels();
        return response.data;
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
        set({
          messages: data.data,
          isLoadingMessages: false,
          hasMoreMessages: data.data.length >= 50,
        });
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
        set((state) => ({
          messages: [...data.data, ...state.messages],
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

  addMessage: (message) => {
    set((state) => {
      // Check if message already exists
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    });
  },

  updateMessageReactions: (messageId, reactions) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      ),
    }));
  },

  fetchUsers: async () => {
    try {
      const { data } = await usersApi.getAll({ status: "ACTIVE" });
      if (data.success) {
        set({ users: data.data });
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

  initSocketEvents: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("receive-message", (data: MessagePayload) => {
      get().addMessage(data);
    });

    socket.on("typing", (data: TypingPayload) => {
      get().setTyping(data.channelId, data.userId, data.userName);
    });

    socket.on("stop-typing", (data: { channelId: string; userId: string }) => {
      get().removeTyping(data.channelId, data.userId);
    });

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
                    createdAt: data.message.createdAt,
                  },
                }
              : c
          ),
        }));
      }
    );
  },
}));

export default useChatStore;

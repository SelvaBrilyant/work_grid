import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;
let isInitializing = false;

export const initSocket = (token: string): Socket => {
  // Return existing socket if it exists (connected, connecting, or reconnecting)
  if (socket) {
    // If socket exists but disconnected, reconnect with same instance
    if (socket.disconnected && !isInitializing) {
      socket.auth = { token };
      socket.connect();
    }
    return socket;
  }

  // Prevent multiple simultaneous initializations
  if (isInitializing && socket) {
    // Return existing socket being initialized
    return socket;
  }

  isInitializing = true;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket?.id);
    isInitializing = false;
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
    // Don't reset socket on disconnect - allow reconnection
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
    isInitializing = false;
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    isInitializing = false;
  }
};

// Socket event types
export interface MessagePayload {
  id: string;
  content: string;
  contentType: string;
  sender: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  channelId: string;
  readBy: {
    userId: string;
    readAt: string;
  }[];
  attachments?: {
    url: string;
    name: string;
    type: string;
    size: number;
    public_id?: string;
  }[];
  createdAt: string;
  replyTo?: {
    id: string;
    content: string;
    sender: { name: string };
  } | null;
}

export interface TypingPayload {
  channelId: string;
  userId: string;
  userName: string;
}

export interface PresencePayload {
  userId: string;
  timestamp: string;
}

export interface ReactionPayload {
  messageId: string;
  reactions: Record<string, string[]>;
}

export default { initSocket, getSocket, disconnectSocket };

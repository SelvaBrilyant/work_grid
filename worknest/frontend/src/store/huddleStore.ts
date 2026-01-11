import { create } from "zustand";
import Peer from "simple-peer";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { useChatStore, useAuthStore } from "@/store";

interface HuddleState {
  isInHuddle: boolean;
  activeChannelId: string | null;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>; // userId -> stream
  participants: Map<string, { audio: boolean; video: boolean }>; // userId -> state
  peers: Map<string, Peer.Instance>; // userId -> peer
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  activeHuddlesIds: Map<string, string[]>; // channelId -> userIds

  joinHuddle: (channelId: string) => Promise<void>;
  leaveHuddle: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  initSocketListeners: () => void;
  listenForGlobalHuddles: () => void;
}

export const useHuddleStore = create<HuddleState>((set, get) => ({
  isInHuddle: false,
  activeChannelId: null,
  localStream: null,
  remoteStreams: new Map(),
  participants: new Map(),
  peers: new Map(),
  isAudioMuted: false,
  isVideoMuted: true, // Default video off
  activeHuddlesIds: new Map(),

  listenForGlobalHuddles: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("channel-joined", ({ channelId, activeHuddle }) => {
      set((state) => {
        const newActiveHuddles = new Map(state.activeHuddlesIds);
        if (activeHuddle) {
          newActiveHuddles.set(channelId, activeHuddle);
        } else {
          newActiveHuddles.delete(channelId);
        }
        return { activeHuddlesIds: newActiveHuddles };
      });
    });

    socket.on("huddle:status", ({ channelId, participants, startedBy }) => {
      set((state) => {
        const isNewHuddle =
          !state.activeHuddlesIds.has(channelId) && participants.length > 0;

        if (isNewHuddle && startedBy) {
          const { user } = useAuthStore.getState();
          const { channels } = useChatStore.getState();
          const channel = channels.find((c) => c.id === channelId);
          if (
            channel &&
            channelId !== state.activeChannelId &&
            startedBy !== user?.id
          ) {
            const displayName =
              channel.type === "DM" ? channel.dmUser?.name : `#${channel.name}`;
            toast.info(`Huddle started in ${displayName}`, {
              description: "Join the conversation now!",
              action: {
                label: "Join",
                onClick: () => get().joinHuddle(channelId),
              },
            });
          }
        }

        const newActiveHuddles = new Map(state.activeHuddlesIds);
        if (participants && participants.length > 0) {
          newActiveHuddles.set(channelId, participants);
        } else {
          newActiveHuddles.delete(channelId);
        }
        return { activeHuddlesIds: newActiveHuddles };
      });
    });
  },

  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("huddle:user-joined", ({ userId }) => {
      const { localStream, activeChannelId } = get();
      if (!localStream || !activeChannelId) return;

      console.log(`User ${userId} joined huddle, initiating peer connection`);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      peer.on("signal", (data) => {
        socket.emit("huddle:signal", {
          to: userId,
          signal: data,
          channelId: activeChannelId,
        });
      });

      peer.on("stream", (stream) => {
        console.log(`Received remote stream from ${userId}`);
        set((state) => {
          const newRemoteStreams = new Map(state.remoteStreams);
          newRemoteStreams.set(userId, stream);
          return { remoteStreams: newRemoteStreams };
        });
      });

      peer.on("error", (err) => {
        console.error(`Peer error with user ${userId}:`, err);
      });

      get().peers.set(userId, peer);
    });

    socket.on("huddle:signal", ({ from, signal }) => {
      const { peers, localStream, activeChannelId } = get();
      let peer = peers.get(from);

      if (!peer) {
        console.log(`Responding to signal from ${from}`);
        peer = new Peer({
          initiator: false,
          trickle: false,
          stream: localStream || undefined,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          },
        });

        peer.on("signal", (data) => {
          socket.emit("huddle:signal", {
            to: from,
            signal: data,
            channelId: activeChannelId,
          });
        });

        peer.on("stream", (stream) => {
          console.log(`Received remote stream from ${from} (as responder)`);
          set((state) => {
            const newRemoteStreams = new Map(state.remoteStreams);
            newRemoteStreams.set(from, stream);
            return { remoteStreams: newRemoteStreams };
          });
        });

        peer.on("error", (err) => {
          console.error(`Peer error with user ${from}:`, err);
        });

        peers.set(from, peer);
      }

      peer.signal(signal);
    });

    socket.on("huddle:participants", ({ participants }) => {
      console.log("Existing huddle participants:", participants);
      // Logic handled via signaling mostly
    });

    socket.on("huddle:user-left", ({ userId }) => {
      const { peers, remoteStreams } = get();
      const peer = peers.get(userId);
      if (peer) {
        peer.destroy();
        peers.delete(userId);
      }
      remoteStreams.delete(userId);
      set({
        peers: new Map(peers),
        remoteStreams: new Map(remoteStreams),
      });
    });

    socket.on("huddle:media-state", ({ userId, audio, video }) => {
      set((state) => {
        const newParticipants = new Map(state.participants);
        newParticipants.set(userId, { audio, video });
        return { participants: newParticipants };
      });
    });
  },

  joinHuddle: async (channelId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      // Initially disable video if that's our default
      stream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !get().isVideoMuted));
      stream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !get().isAudioMuted));

      set({
        isInHuddle: true,
        activeChannelId: channelId,
        localStream: stream,
      });

      get().initSocketListeners();
      getSocket()?.emit("huddle:join", { channelId });
    } catch (error) {
      console.error("Error joining huddle:", error);
      throw error;
    }
  },

  leaveHuddle: () => {
    const { localStream, peers, activeChannelId } = get();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    peers.forEach((peer) => peer.destroy());

    if (activeChannelId) {
      getSocket()?.emit("huddle:leave", { channelId: activeChannelId });
    }

    set({
      isInHuddle: false,
      activeChannelId: null,
      localStream: null,
      remoteStreams: new Map(),
      peers: new Map(),
      participants: new Map(),
    });

    // Cleanup listeners
    const socket = getSocket();
    if (socket) {
      socket.off("huddle:user-joined");
      socket.off("huddle:signal");
      socket.off("huddle:participants");
      socket.off("huddle:user-left");
      socket.off("huddle:media-state");
    }
  },

  toggleAudio: () => {
    const { localStream, isAudioMuted, activeChannelId } = get();
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isAudioMuted;
        set({ isAudioMuted: !isAudioMuted });

        if (activeChannelId) {
          getSocket()?.emit("huddle:toggle-media", {
            channelId: activeChannelId,
            audio: !isAudioMuted,
            video: !get().isVideoMuted,
          });
        }
      }
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoMuted, activeChannelId } = get();
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoMuted;
        set({ isVideoMuted: !isVideoMuted });

        if (activeChannelId) {
          getSocket()?.emit("huddle:toggle-media", {
            channelId: activeChannelId,
            audio: !get().isAudioMuted,
            video: !isVideoMuted,
          });
        }
      }
    }
  },
}));

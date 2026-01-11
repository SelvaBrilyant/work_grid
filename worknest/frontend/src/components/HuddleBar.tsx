import React, { useEffect, useRef } from "react";
import { useHuddleStore } from "@/store/huddleStore";
import { useChatStore } from "@/store/chatStore";
import { Button } from "@/components/ui/button";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    Maximize2,
    Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/utils";

export function HuddleBar() {
    const {
        isInHuddle,
        isAudioMuted,
        isVideoMuted,
        leaveHuddle,
        toggleAudio,
        toggleVideo,
        localStream,
        remoteStreams,
        participants,
    } = useHuddleStore();

    const { users } = useChatStore();
    const [isExpanded, setIsExpanded] = React.useState(false);

    if (!isInHuddle) return null;

    return (
        <div
            className={cn(
                "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
                isExpanded ? "w-[90vw] h-[70vh] bottom-4" : "w-auto"
            )}
        >
            <div className="bg-card border shadow-2xl rounded-2xl overflow-hidden flex flex-col h-full animate-slide-in">
                {/* Participants Grid (Expanded) */}
                {isExpanded && (
                    <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-auto bg-muted/30">
                        {/* Local Stream */}
                        <HuddleVideoItem
                            stream={localStream}
                            isLocal
                            isMuted={isAudioMuted}
                            isVideoOff={isVideoMuted}
                            name="You"
                        />
                        {/* Remote Streams */}
                        {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
                            const user = users.find((u) => (u.id || u._id) === userId);
                            const state = participants.get(userId);
                            return (
                                <HuddleVideoItem
                                    key={userId}
                                    stream={stream}
                                    isMuted={!state?.audio}
                                    isVideoOff={!state?.video}
                                    name={user?.name || "Participant"}
                                    avatar={user?.avatar}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Controls Bar */}
                <div className="p-3 flex items-center justify-between gap-4 bg-card px-6">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            <Avatar className="h-8 w-8 border-2 border-background">
                                <AvatarFallback>You</AvatarFallback>
                            </Avatar>
                            {Array.from(participants.keys()).slice(0, 3).map((userId) => {
                                const user = users.find((u) => (u.id || u._id) === userId);
                                return (
                                    <Avatar key={userId} className="h-8 w-8 border-2 border-background">
                                        <AvatarImage src={user?.avatar} />
                                        <AvatarFallback className={cn("text-[10px]", getAvatarColor(user?.name || ""))}>
                                            {getInitials(user?.name || "?")}
                                        </AvatarFallback>
                                    </Avatar>
                                );
                            })}
                            {participants.size > 3 && (
                                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">
                                    +{participants.size - 3}
                                </div>
                            )}
                        </div>
                        <div className="hidden md:block">
                            <p className="text-sm font-medium">
                                {participants.size + 1} participant{participants.size !== 0 ? "s" : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground animate-pulse text-green-500 font-bold uppercase tracking-wider">
                                Live Huddle
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant={isAudioMuted ? "destructive" : "secondary"}
                            size="icon"
                            className="rounded-full h-10 w-10"
                            onClick={toggleAudio}
                        >
                            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </Button>
                        <Button
                            variant={isVideoMuted ? "destructive" : "secondary"}
                            size="icon"
                            className="rounded-full h-10 w-10"
                            onClick={toggleVideo}
                        >
                            {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                        </Button>
                        <Button
                            variant="destructive"
                            size="icon"
                            className="rounded-full h-10 w-10 ml-2"
                            onClick={leaveHuddle}
                        >
                            <PhoneOff className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HuddleVideoItem({
    stream,
    isLocal,
    isMuted,
    isVideoOff,
    name,
    avatar,
}: {
    stream: MediaStream | null;
    isLocal?: boolean;
    isMuted: boolean;
    isVideoOff: boolean;
    name: string;
    avatar?: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border/50 group shadow-lg">
            {(!stream || (isVideoOff && !isLocal)) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/20 backdrop-blur-sm z-10">
                    <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-background shadow-xl">
                        <AvatarImage src={avatar} />
                        <AvatarFallback className={cn("text-xl", getAvatarColor(name))}>
                            {getInitials(name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1 rounded-full border shadow-sm">
                        <VideoOff className="h-3 w-3 text-destructive" />
                        <span className="text-xs font-medium">{name}</span>
                    </div>
                </div>
            )}

            {stream && (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={isLocal}
                        className={cn(
                            "w-full h-full object-cover",
                            isLocal && "scale-x-[-1]",
                            isVideoOff && "opacity-0 invisible"
                        )}
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 z-20">
                        <span className="text-[10px] font-medium text-white">{name}</span>
                        {isMuted && <MicOff className="h-3 w-3 text-destructive" />}
                    </div>
                </>
            )}
        </div>
    );
}

import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceMessageProps {
    url: string;
    waveform?: number[];
    duration?: number;
    isMe?: boolean;
}

export function VoiceMessage({ url, waveform = [], duration = 0, isMe = false }: VoiceMessageProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            setCurrentTime(audio.currentTime);
            setProgress((audio.currentTime / audio.duration) * 100);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            setProgress(0);
        };

        audio.addEventListener("timeupdate", updateProgress);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", updateProgress);
            audio.removeEventListener("ended", handleEnded);
        };
    }, []);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Generate a dummy waveform if none provided
    const visualWaveform = useMemo(() => {
        if (waveform.length > 0) return waveform;
        // Deterministic dummy waveform using sin wave for a natural look
        return Array.from({ length: 40 }, (_, i) => 0.4 + Math.sin(i * 0.5) * 0.3);
    }, [waveform]);

    return (
        <div className={cn(
            "flex items-center gap-2.5 p-2 rounded-2xl min-w-[280px] w-fit shadow-md transition-all duration-300",
            isMe
                ? "bg-primary text-primary-foreground shadow-primary/20"
                : "bg-muted/80 backdrop-blur-md border border-border/50 text-foreground"
        )}>
            <audio ref={audioRef} src={url.startsWith('http') ? url : `http://localhost:5000${url}`} />

            <Button
                size="icon"
                variant="ghost"
                className={cn(
                    "h-9 w-9 rounded-xl shrink-0 transition-all active:scale-95 shadow-sm",
                    isMe
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-primary/10 hover:bg-primary/20 text-primary"
                )}
                onClick={togglePlay}
            >
                {isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                ) : (
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                )}
            </Button>

            <div className="flex-1 space-y-1 min-w-[150px]">
                <div className="flex items-end gap-[1.5px] h-8 px-1">
                    {visualWaveform.map((p, i) => {
                        const barProgress = (i / visualWaveform.length) * 100;
                        const isActive = barProgress <= progress;

                        return (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-all duration-300",
                                    isActive
                                        ? (isMe ? "bg-white" : "bg-primary")
                                        : (isMe ? "bg-white/20" : "bg-primary/10")
                                )}
                                style={{
                                    height: `${Math.max(25, p * 100)}%`,
                                }}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between items-center px-1">
                    <span className={cn(
                        "text-[9px] font-bold tracking-tight opacity-70 tabular-nums",
                        isMe ? "text-white" : "text-foreground"
                    )}>
                        {formatTime(currentTime)}
                    </span>
                    <span className={cn(
                        "text-[9px] font-bold tracking-tight opacity-70 tabular-nums",
                        isMe ? "text-white" : "text-foreground"
                    )}>
                        {duration ? formatTime(duration) : "0:00"}
                    </span>
                </div>
            </div>

            <div className={cn(
                "p-1.5 rounded-lg opacity-40",
                isMe ? "bg-white/10" : "bg-primary/5"
            )}>
                <Volume2 className="h-3.5 w-3.5" />
            </div>
        </div>
    );
}

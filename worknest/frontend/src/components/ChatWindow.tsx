import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Paperclip, X, Smile, AtSign, Video, Mic, StopCircle, Trash } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useChatStore } from '@/store';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KanbanBoard, WikiView, CanvasView, MessageBubble } from '@/components';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

function TypingIndicator({ users }: { users: Map<string, { userName: string }> }) {
    if (users.size === 0) return null;

    const names = Array.from(users.values()).map((u) => u.userName);
    let text = '';
    if (names.length === 1) {
        text = `${names[0]} is typing`;
    } else if (names.length === 2) {
        text = `${names[0]} and ${names[1]} are typing`;
    } else {
        text = `${names[0]} and ${names.length - 1} others are typing`;
    }

    return (
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground animate-fade-in">
            <div className="flex gap-1">
                <span className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
                <span className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
                <span className="typing-dot w-2 h-2 bg-muted-foreground rounded-full" />
            </div>
            <span>{text}</span>
        </div>
    );
}

export function ChatWindow() {
    const {
        activeChannel,
        messages,
        isLoadingMessages,
        typingUsers,
        replyTo,
        users,
        fetchMessages,
        fetchUsers,
        setReplyTo,
        startTyping,
        stopTyping,
        loadMoreMessages,
        hasMoreMessages,
        activeView
    } = useChatStore();

    const [inputValue, setInputValue] = useState('');
    const [pendingAttachments, setPendingAttachments] = useState<{ url: string, name: string, type: string, size: number }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string, name: string, isSpecial?: boolean, description?: string }[]>([]);
    const [mentionPosition, setMentionPosition] = useState<{ top: number, left: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef(false);
    const [showChannelConfirm, setShowChannelConfirm] = useState(false);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [waveform, setWaveform] = useState<number[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Fetch messages when channel changes
    useEffect(() => {
        if (activeChannel) {
            fetchMessages(activeChannel.id);
        }
    }, [activeChannel, fetchMessages]);

    // Fetch users for mentions
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Focus input when channel changes
    useEffect(() => {
        if (activeChannel && inputRef.current) {
            inputRef.current.focus();
        }
    }, [activeChannel]);

    const executeSend = useCallback((overrideConfirm = false) => {
        if ((!inputValue.trim() && pendingAttachments.length === 0) || !activeChannel) return;

        // Check for @channel mention
        const hasChannelMention = inputValue.toLowerCase().includes('@channel');

        if (hasChannelMention && !overrideConfirm && activeChannel.type !== 'DM') {
            setShowChannelConfirm(true);
            return;
        }

        const socket = getSocket();
        if (socket) {
            const messagePayload = {
                channelId: activeChannel.id,
                content: inputValue.trim() || (pendingAttachments.length > 0 ? `Sent ${pendingAttachments.length} file(s)` : ""),
                replyTo: replyTo?.id || null,
                attachments: pendingAttachments,
                contentType: pendingAttachments.length > 0 ? "FILE" : "TEXT"
            };

            socket.emit("send-message", messagePayload);
        }

        setInputValue('');
        setPendingAttachments([]);
        setMentionSuggestions([]);
        setMentionPosition(null);
        stopTyping();
        setReplyTo(null);
        setShowChannelConfirm(false);
        isTypingRef.current = false;

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
    }, [inputValue, activeChannel, pendingAttachments, replyTo, stopTyping, setReplyTo]);

    const handleSendMessage = () => {
        executeSend(false);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const uploadPromises = Array.from(files).map(file => useChatStore.getState().uploadFile(file));
            const results = await Promise.all(uploadPromises);
            setPendingAttachments(prev => [...prev, ...results]);
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index: number) => {
        setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const selectionStart = e.target.selectionStart;
        setInputValue(value);

        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;

        // Mention detection
        const cursorPosition = selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : '';
            const isValidTrigger = lastAtIndex === 0 || /\s/.test(charBeforeAt) || /[.,!?;:([<{]/.test(charBeforeAt);

            if (isValidTrigger) {
                const query = textBeforeCursor.substring(lastAtIndex + 1);
                const hasSpaceInQuery = /\s/.test(query);

                if (!hasSpaceInQuery) {
                    // Fallback fetch if users are not loaded
                    if (users.length === 0) {
                        fetchUsers();
                    }

                    // Special system mentions
                    const specialMentions = [
                        { id: 'channel', name: 'channel', isSpecial: true, description: 'Notify all members' },
                        { id: 'here', name: 'here', isSpecial: true, description: 'Notify online members' },
                        { id: 'online', name: 'online', isSpecial: true, description: 'Notify online members' },
                    ];

                    // Filter user mentions
                    const userMentions = users
                        .filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
                        .map(u => ({ id: u.id, name: u.name, isSpecial: false }));

                    // Filter special mentions
                    const matchingSpecial = specialMentions
                        .filter(m => m.name.toLowerCase().startsWith(query.toLowerCase()))
                        .map(m => ({ id: m.id, name: m.name, isSpecial: true, description: m.description }));

                    // Combine with special mentions first
                    const combined = [...matchingSpecial, ...userMentions].slice(0, 8);

                    // Only show suggestions if there are actual suggestions
                    if (combined.length > 0) {
                        setMentionSuggestions(combined);
                        setMentionPosition({ top: 0, left: 16 });
                    } else {
                        setMentionSuggestions([]);
                        setMentionPosition(null);
                    }
                } else {
                    setMentionSuggestions([]);
                    setMentionPosition(null);
                }
            } else {
                setMentionSuggestions([]);
                setMentionPosition(null);
            }
        } else {
            setMentionSuggestions([]);
            setMentionPosition(null);
        }

        // Handle typing indicator
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            startTyping();
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            stopTyping();
            isTypingRef.current = false;
        }, 3000);
    };

    const handleMentionSelect = (userName: string) => {
        if (!inputRef.current) return;
        const selectionStart = inputRef.current.selectionStart;
        const lastAtIndex = inputValue.lastIndexOf('@', selectionStart - 1);

        const newValue =
            inputValue.substring(0, lastAtIndex) +
            `@${userName} ` +
            inputValue.substring(selectionStart);

        setInputValue(newValue);
        setMentionSuggestions([]);
        setMentionPosition(null);

        // Small delay to ensure state update doesn't fight with focus
        setTimeout(() => {
            inputRef.current?.focus();
            const newPos = lastAtIndex + userName.length + 2;
            inputRef.current?.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleReply = (message: typeof messages[0]) => {
        console.log('\n========== REPLY SELECTED ==========');
        console.log('📝 Selected message for reply:', {
            id: message.id,
            content: message.content?.substring(0, 50),
            sender: message.sender,
            fullMessage: message
        });
        console.log('========== END REPLY SELECTED ==========\n');
        setReplyTo(message);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    };

    const scrollToMessage = (messageId: string) => {
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-primary/10');
            setTimeout(() => {
                element.classList.remove('bg-primary/10');
            }, 2000);
        }
    };

    const handleReact = (messageId: string, emoji: string) => {
        const socket = getSocket();
        if (socket) {
            socket.emit('react', { messageId, emoji });
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop } = e.currentTarget;
        if (scrollTop === 0 && hasMoreMessages && !isLoadingMessages) {
            loadMoreMessages();
        }
    };

    // Voice Recording Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Setup audio analyzer for waveform
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const peaks: number[] = [];
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateWaveform = () => {
                if (!isRecordingRef.current) return;
                analyser.getByteTimeDomainData(dataArray);

                // Get peak for this frame
                let max = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = Math.abs(dataArray[i] - 128);
                    if (v > max) max = v;
                }

                // Normalize and push
                const normalized = Math.min(1, max / 64);
                peaks.push(normalized);

                // Keep only most recent peaks for visual display
                setWaveform([...peaks.slice(-40)]);

                animationFrameRef.current = requestAnimationFrame(updateWaveform);
            };

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                // Final full waveform (sampled to 50 points)
                const finalWaveform = sampleWaveform(peaks, 50);
                setWaveform(finalWaveform);

                stream.getTracks().forEach(track => track.stop());
                audioContext.close();
            };

            const isRecordingRef = { current: true };
            setIsRecording(true);
            setRecordingTime(0);
            setWaveform([]);
            mediaRecorder.start();
            updateWaveform();

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            return () => { isRecordingRef.current = false; };
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            audioChunksRef.current = [];
        }
        setIsRecording(false);
        setAudioBlob(null);
        setWaveform([]);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

    const sendVoiceMessage = async () => {
        if (!audioBlob || !activeChannel) return;

        setIsUploading(true);
        try {
            const file = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
            const uploadResult = await useChatStore.getState().uploadFile(file);

            const socket = getSocket();
            if (socket) {
                socket.emit("send-message", {
                    channelId: activeChannel.id,
                    content: "Voice Message",
                    contentType: "AUDIO",
                    attachments: [{
                        ...uploadResult,
                        waveform: waveform,
                        duration: recordingTime
                    }]
                });
            }
            setAudioBlob(null);
            setWaveform([]);
            setRecordingTime(0);
        } catch (error) {
            console.error("Failed to send voice message:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const sampleWaveform = (peaks: number[], count: number) => {
        if (peaks.length === 0) return Array(count).fill(0.1);
        const step = peaks.length / count;
        const result = [];
        for (let i = 0; i < count; i++) {
            const start = Math.floor(i * step);
            const end = Math.floor((i + 1) * step);
            const slice = peaks.slice(start, end);
            const avg = slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
            result.push(Math.max(0.1, avg)); // Min 0.1 for visibility
        }
        return result;
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Check if messages should be grouped
    const shouldGroup = (current: typeof messages[0], prev: typeof messages[0] | undefined) => {
        if (!prev) return false;
        if (current.sender._id !== prev.sender._id) return false;
        if (current.contentType === 'SYSTEM' || prev.contentType === 'SYSTEM') return false;
        const timeDiff = new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime();
        return timeDiff < 60000; // 1 minute
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setInputValue((prev) => prev + emojiData.emoji);
        inputRef.current?.focus();
    };

    if (!activeChannel) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10">
                <div className="text-center space-y-4 max-w-md px-4">
                    <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                        <svg
                            className="h-12 w-12 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold">Welcome to WorkNest</h2>
                        <p className="text-muted-foreground">
                            Select a channel or start a direct message to begin chatting with your team.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
            {activeView === 'tasks' ? (
                <div className="flex-1 min-w-0 overflow-hidden">
                    <KanbanBoard />
                </div>
            ) : activeView === 'wiki' ? (
                <div className="flex-1 min-w-0 overflow-hidden">
                    <WikiView />
                </div>
            ) : activeView === 'canvas' ? (
                <div className="flex-1 min-w-0 overflow-hidden">
                    <CanvasView />
                </div>
            ) : (
                <>
                    {/* Messages Area */}
                    <ScrollArea className="flex-1" onScroll={handleScroll} ref={scrollAreaRef}>
                        <div className="min-h-full flex flex-col justify-end py-4">
                            {/* Loading indicator */}
                            {isLoadingMessages && (
                                <div className="flex justify-center py-4">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                                        <span className="text-sm">Loading messages...</span>
                                    </div>
                                </div>
                            )}

                            {/* Load more indicator */}
                            {hasMoreMessages && !isLoadingMessages && messages.length > 0 && (
                                <div className="flex justify-center py-4">
                                    <Button variant="ghost" size="sm" onClick={loadMoreMessages}>
                                        Load more messages
                                    </Button>
                                </div>
                            )}

                            {/* Messages */}
                            {messages.map((message, index) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isGrouped={shouldGroup(message, messages[index - 1])}
                                    onReply={handleReply}
                                    onReact={handleReact}
                                    onScrollToMessage={scrollToMessage}
                                />
                            ))}

                            {/* Typing Indicator */}
                            <TypingIndicator users={typingUsers} />

                            {/* Scroll anchor */}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>
                </>
            )}

            {/* Message Input (only shown in messages view) */}
            {activeView === 'messages' && (
                <div className="p-4 border-t border-border relative">
                    {/* Reply Preview */}
                    {replyTo && (
                        <div className="flex items-center justify-between mb-2 p-2 bg-muted/50 rounded-lg animate-slide-in">
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-1 h-8 bg-primary rounded-full" />
                                <div>
                                    <span className="text-muted-foreground">Replying to </span>
                                    <span className="font-medium text-primary">
                                        {(replyTo.sender as { name?: string })?.name || 'Someone'}
                                    </span>
                                    <p className="text-muted-foreground truncate max-w-md">{replyTo.content}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setReplyTo(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Pending Attachments */}
                    {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {pendingAttachments.map((file, i) => (
                                <div key={i} className="relative group/att">
                                    {file.type.startsWith('image/') ? (
                                        <div className="h-20 w-20 rounded-lg overflow-hidden border bg-muted">
                                            <img
                                                src={file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : file.type.startsWith('video/') ? (
                                        <div className="h-20 w-20 rounded-lg border bg-muted flex flex-col items-center justify-center p-2 text-center">
                                            <Video className="h-6 w-6 text-muted-foreground mb-1" />
                                            <span className="text-[10px] truncate w-full px-1">{file.name}</span>
                                        </div>
                                    ) : (
                                        <div className="h-20 w-20 rounded-lg border bg-muted flex flex-col items-center justify-center p-2 text-center">
                                            <Paperclip className="h-6 w-6 text-muted-foreground mb-1" />
                                            <span className="text-[10px] truncate w-full px-1">{file.name}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeAttachment(i)}
                                        className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5 shadow-sm hover:text-destructive transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {isUploading && (
                                <div className="h-20 w-20 rounded-lg border border-dashed flex items-center justify-center">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mention Suggestions */}
                    {mentionPosition && mentionSuggestions.length > 0 && (
                        <div
                            className="absolute z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[240px] overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                            style={{ bottom: '100%', left: '16px', marginBottom: '8px' }}
                        >
                            {/* Special mentions section */}
                            {mentionSuggestions.some(s => s.isSpecial) && (
                                <>
                                    <div className="p-2 border-b border-border bg-muted/30">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Special</span>
                                    </div>
                                    <div className="py-1">
                                        {mentionSuggestions.filter(s => s.isSpecial).map((mention) => (
                                            <button
                                                key={mention.id}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                                onClick={() => handleMentionSelect(mention.name)}
                                            >
                                                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                                                    <AtSign className="h-4 w-4 text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium">@{mention.name}</div>
                                                    <div className="text-xs text-muted-foreground">{mention.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                            {/* User mentions section */}
                            {mentionSuggestions.some(s => !s.isSpecial) && (
                                <>
                                    <div className="p-2 border-b border-border bg-muted/30">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">People</span>
                                    </div>
                                    <ScrollArea className="max-h-[200px]">
                                        {mentionSuggestions.filter(s => !s.isSpecial).map((user) => (
                                            <button
                                                key={user.id}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                                                onClick={() => handleMentionSelect(user.name)}
                                            >
                                                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span>{user.name}</span>
                                            </button>
                                        ))}
                                    </ScrollArea>
                                </>
                            )}
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="flex items-end gap-2 relative">
                        <div className="flex-1 relative">
                            <div
                                className={cn(
                                    'flex items-end gap-2 rounded-xl border border-input bg-background',
                                    'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                                    'transition-all'
                                )}
                            >
                                {/* Attachment Button */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    multiple
                                    onChange={handleFileSelect}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                                >
                                    <Paperclip className={cn("h-5 w-5", isUploading && "animate-pulse")} />
                                </Button>

                                {/* Input */}
                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder={`Message #${activeChannel.type === 'DM' ? activeChannel.dmUser?.name || 'user' : activeChannel.name}`}
                                    className={cn(
                                        'flex-1 resize-none bg-transparent py-3 text-sm max-h-[150px]',
                                        'placeholder:text-muted-foreground focus:outline-none'
                                    )}
                                    rows={1}
                                />

                                {/* Emoji Button */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                                        >
                                            <Smile className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent side="top" align="end" className="p-0 border-none bg-transparent">
                                        <EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} />
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Mention Button */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        const pos = inputRef.current?.selectionStart || 0;
                                        const before = inputValue.substring(0, pos);
                                        const after = inputValue.substring(pos);
                                        const triggerChar = before.length === 0 || /\s/.test(before[before.length - 1]) ? '@' : ' @';
                                        setInputValue(before + triggerChar + after);
                                        inputRef.current?.focus();
                                        // Trigger mention detection
                                        const newPos = before.length + triggerChar.length;
                                        setTimeout(() => {
                                            if (inputRef.current) {
                                                inputRef.current.setSelectionRange(newPos, newPos);
                                                handleInputChange({ target: inputRef.current } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
                                            }
                                        }, 0);
                                    }}
                                >
                                    <AtSign className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Voice Recording / Send Button */}
                        {isRecording ? (
                            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 h-12 animate-in slide-in-from-right-2">
                                <div className="flex items-center gap-2 mr-4">
                                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                                    <span className="text-sm font-mono min-w-[40px]">{formatDuration(recordingTime)}</span>
                                </div>
                                <div className="flex items-end gap-1 h-6 mr-4 min-w-[120px]">
                                    {waveform.map((p, i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-primary rounded-full"
                                            style={{ height: `${p * 100}%` }}
                                        />
                                    ))}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={cancelRecording}
                                >
                                    <Trash className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    className="h-10 w-10 rounded-full bg-primary"
                                    onClick={stopRecording}
                                >
                                    <StopCircle className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : audioBlob ? (
                            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 h-12 animate-in slide-in-from-right-2">
                                <span className="text-sm font-medium mr-2">Voice Message</span>
                                <span className="text-xs text-muted-foreground mr-4">{formatDuration(recordingTime)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => { setAudioBlob(null); setWaveform([]); }}
                                >
                                    <Trash className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    className="h-10 w-10 rounded-full bg-primary"
                                    onClick={sendVoiceMessage}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-12 w-12 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5"
                                    onClick={startRecording}
                                >
                                    <Mic className="h-6 w-6" />
                                </Button>
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() && pendingAttachments.length === 0}
                                    size="icon"
                                    className={cn(
                                        'h-12 w-12 rounded-xl shrink-0 transition-all',
                                        (inputValue.trim() || pendingAttachments.length > 0)
                                            ? 'bg-primary hover:bg-primary/90'
                                            : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    <Send className="h-5 w-5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Keyboard hint */}
                    <p className="text-xs text-muted-foreground mt-2 ml-2">
                        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send,{' '}
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd> for new line
                    </p>
                </div>
            )}

            {/* @channel Confirmation Dialog */}
            <Dialog open={showChannelConfirm} onOpenChange={setShowChannelConfirm}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Notify everyone in #{activeChannel.name}?</DialogTitle>
                        <DialogDescription className="pt-2">
                            You are about to notify <strong>{activeChannel.memberCount || 0} people</strong>.
                            This will send a notification to every member of this channel, even those who are offline or have muted non-urgent alerts.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button variant="ghost" onClick={() => setShowChannelConfirm(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-primary hover:bg-primary/90"
                            onClick={() => executeSend(true)}
                        >
                            Notify Everyone
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ChatWindow;

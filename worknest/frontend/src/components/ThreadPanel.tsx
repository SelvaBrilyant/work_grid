import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Paperclip, MessageSquare } from 'lucide-react';
import { useChatStore } from '@/store';
import { messagesApi } from '@/lib/api';
import { cn, getInitials, getAvatarColor, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface ThreadMessage {
    id: string;
    content: string;
    sender: {
        name: string;
        email: string;
        avatar?: string;
        _id?: string;
    };
    attachments?: { url: string; name: string; type: string; size: number }[];
    createdAt: string;
    isEdited?: boolean;
}

interface ThreadData {
    parent: ThreadMessage & { threadCount: number };
    replies: ThreadMessage[];
    hasMore: boolean;
}

export function ThreadPanel() {
    const { threadPanel, closeThread } = useChatStore();
    const { isOpen, parentMessage } = threadPanel;

    const [threadData, setThreadData] = useState<ThreadData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const fetchThread = useCallback(async () => {
        if (!parentMessage?.id) return;
        setIsLoading(true);
        try {
            const { data } = await messagesApi.getThread(parentMessage.id);
            if (data.success) {
                setThreadData(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch thread:', error);
            toast.error('Failed to load thread');
        } finally {
            setIsLoading(false);
        }
    }, [parentMessage?.id]);

    // Fetch thread data when opened
    useEffect(() => {
        if (isOpen && parentMessage?.id) {
            fetchThread();
        }
    }, [isOpen, parentMessage?.id, fetchThread]);

    // Scroll to bottom on new replies
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [threadData?.replies.length]);

    const handleSendReply = async () => {
        if (!inputValue.trim() || !parentMessage?.id || isSending) return;

        setIsSending(true);
        try {
            const { data } = await messagesApi.replyToThread(parentMessage.id, {
                content: inputValue.trim(),
            });
            if (data.success) {
                // Add reply to local state
                setThreadData((prev) => prev ? {
                    ...prev,
                    replies: [...prev.replies, data.data],
                    parent: { ...prev.parent, threadCount: prev.parent.threadCount + 1 },
                } : null);
                setInputValue('');
                if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                }
            }
        } catch (error) {
            console.error('Failed to send reply:', error);
            toast.error('Failed to send reply');
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendReply();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    };

    if (!isOpen || !parentMessage) return null;

    return (
        <div className="w-96 border-l border-border bg-background h-full flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold text-lg">Thread</h2>
                    {threadData && (
                        <span className="text-xs text-muted-foreground">
                            {threadData.parent.threadCount} {threadData.parent.threadCount === 1 ? 'reply' : 'replies'}
                        </span>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={closeThread}>
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : threadData ? (
                <>
                    {/* Thread content */}
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-4">
                            {/* Parent message */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                                <div className="flex items-start gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={threadData.parent.sender.avatar} />
                                        <AvatarFallback className={getAvatarColor(threadData.parent.sender.name)}>
                                            {getInitials(threadData.parent.sender.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{threadData.parent.sender.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatTime(threadData.parent.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm mt-1 whitespace-pre-wrap">{threadData.parent.content}</p>
                                        {threadData.parent.attachments && threadData.parent.attachments.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {threadData.parent.attachments.map((att, i) => (
                                                    <a
                                                        key={i}
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <Paperclip className="h-3 w-3" />
                                                        {att.name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Replies count */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{threadData.replies.length} {threadData.replies.length === 1 ? 'reply' : 'replies'}</span>
                            </div>

                            {/* Thread replies */}
                            {threadData.replies.map((reply, index) => (
                                <div
                                    key={reply.id}
                                    className={cn(
                                        "flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-muted/30",
                                        index === threadData.replies.length - 1 && "animate-in fade-in slide-in-from-bottom-2"
                                    )}
                                >
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={reply.sender.avatar} />
                                        <AvatarFallback className={cn("text-xs", getAvatarColor(reply.sender.name))}>
                                            {getInitials(reply.sender.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{reply.sender.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatTime(reply.createdAt)}
                                            </span>
                                            {reply.isEdited && (
                                                <span className="text-xs text-muted-foreground italic">(edited)</span>
                                            )}
                                        </div>
                                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{reply.content}</p>
                                        {reply.attachments && reply.attachments.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {reply.attachments.map((att, i) => (
                                                    <a
                                                        key={i}
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <Paperclip className="h-3 w-3" />
                                                        {att.name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Reply input */}
                    <div className="p-4 border-t">
                        <div className="flex items-end gap-2">
                            <div className="flex-1 relative">
                                <textarea
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Reply to thread..."
                                    className={cn(
                                        "w-full min-h-[42px] max-h-[120px] px-4 py-2.5 rounded-lg border border-input",
                                        "bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring",
                                        "text-sm placeholder:text-muted-foreground"
                                    )}
                                    rows={1}
                                />
                            </div>
                            <Button
                                size="icon"
                                className="h-[42px] w-[42px] rounded-lg"
                                onClick={handleSendReply}
                                disabled={!inputValue.trim() || isSending}
                            >
                                <Send className={cn("h-4 w-4", isSending && "animate-pulse")} />
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Failed to load thread</p>
                </div>
            )}
        </div>
    );
}

export default ThreadPanel;

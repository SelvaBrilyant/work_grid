import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Paperclip, X, Smile, AtSign } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useChatStore } from '@/store';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/MessageBubble';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    } = useChatStore();

    const [inputValue, setInputValue] = useState('');
    const [pendingAttachments, setPendingAttachments] = useState<{ url: string, name: string, type: string, size: number }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string, name: string }[]>([]);
    const [mentionPosition, setMentionPosition] = useState<{ top: number, left: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef(false);

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

    const handleSendMessage = useCallback(() => {
        if ((!inputValue.trim() && pendingAttachments.length === 0) || !activeChannel) return;

        const socket = getSocket();
        if (socket) {
            // === DETAILED DEBUG LOGGING FOR REPLY-TO ===
            console.log('\n========== FRONTEND SEND MESSAGE DEBUG ==========');
            console.log('📤 replyTo state object:', replyTo);
            console.log('📤 replyTo?.id:', replyTo?.id);
            console.log('📤 replyTo type:', typeof replyTo);
            console.log('📤 replyTo?.id type:', typeof replyTo?.id);

            const messagePayload = {
                channelId: activeChannel.id,
                content: inputValue.trim() || (pendingAttachments.length > 0 ? `Sent ${pendingAttachments.length} file(s)` : ""),
                replyTo: replyTo?.id || null, // Explicitly set to null if undefined
                attachments: pendingAttachments,
                contentType: pendingAttachments.length > 0 ? "FILE" : "TEXT"
            };

            console.log('📤 Full message payload:', JSON.stringify(messagePayload, null, 2));
            console.log('========== END FRONTEND DEBUG ==========\n');

            socket.emit("send-message", messagePayload);
        }

        setInputValue('');
        setPendingAttachments([]);
        setMentionSuggestions([]);
        setMentionPosition(null);
        stopTyping();
        setReplyTo(null);
        isTypingRef.current = false;

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
    }, [inputValue, activeChannel, pendingAttachments, replyTo, stopTyping, setReplyTo]);

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

                    const filtered = users
                        .filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
                        .map(u => ({ id: u.id, name: u.name }));

                    // Only show suggestions if there are actual suggestions
                    if (filtered.length > 0) {
                        setMentionSuggestions(filtered);
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
        <div className="flex-1 flex flex-col bg-background">
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

            {/* Message Input */}
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
                        className="absolute z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[200px] overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                        style={{ bottom: '100%', left: '16px', marginBottom: '8px' }}
                    >
                        <div className="p-2 border-b border-border bg-muted/30">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">People</span>
                        </div>
                        <ScrollArea className="max-h-[200px]">
                            {mentionSuggestions.map((user) => (
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

                    {/* Send Button */}
                    <Button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim()}
                        size="icon"
                        className={cn(
                            'h-12 w-12 rounded-xl shrink-0 transition-all',
                            inputValue.trim()
                                ? 'bg-primary hover:bg-primary/90'
                                : 'bg-muted text-muted-foreground'
                        )}
                    >
                        <Send className="h-5 w-5" />
                    </Button>
                </div>

                {/* Keyboard hint */}
                <p className="text-xs text-muted-foreground mt-2 ml-2">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send,{' '}
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd> for new line
                </p>
            </div>
        </div >
    );
}

export default ChatWindow;

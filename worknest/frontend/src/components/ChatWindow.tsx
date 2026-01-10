import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Paperclip, X, Smile, AtSign } from 'lucide-react';
import { useChatStore } from '@/store';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/MessageBubble';

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
        fetchMessages,
        sendMessage,
        setReplyTo,
        startTyping,
        stopTyping,
        loadMoreMessages,
        hasMoreMessages,
    } = useChatStore();

    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
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

    // Focus input when channel changes
    useEffect(() => {
        if (activeChannel && inputRef.current) {
            inputRef.current.focus();
        }
    }, [activeChannel]);

    const handleSendMessage = useCallback(() => {
        if (!inputValue.trim() || !activeChannel) return;

        sendMessage(inputValue.trim());
        setInputValue('');
        stopTyping();
        isTypingRef.current = false;

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
    }, [inputValue, activeChannel, sendMessage, stopTyping]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputValue(value);

        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;

        // Typing indicator
        if (value.length > 0 && !isTypingRef.current) {
            startTyping();
            isTypingRef.current = true;
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout
        typingTimeoutRef.current = setTimeout(() => {
            if (value.length > 0) {
                startTyping(); // Keep refreshing
            } else {
                stopTyping();
                isTypingRef.current = false;
            }
        }, 2000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleReply = (message: typeof messages[0]) => {
        setReplyTo(message);
        inputRef.current?.focus();
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
                        />
                    ))}

                    {/* Typing Indicator */}
                    <TypingIndicator users={typingUsers} />

                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
                {/* Reply Preview */}
                {replyTo && (
                    <div className="flex items-center justify-between mb-2 p-2 bg-muted/50 rounded-lg animate-slide-in">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-1 h-8 bg-primary rounded-full" />
                            <div>
                                <span className="text-muted-foreground">Replying to </span>
                                <span className="font-medium">{replyTo.sender.name}</span>
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

                {/* Input Area */}
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <div
                            className={cn(
                                'flex items-end gap-2 rounded-xl border border-input bg-background',
                                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                                'transition-all'
                            )}
                        >
                            {/* Attachment Button */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                            >
                                <Paperclip className="h-5 w-5" />
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
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                            >
                                <Smile className="h-5 w-5" />
                            </Button>

                            {/* Mention Button */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
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
        </div>
    );
}

export default ChatWindow;

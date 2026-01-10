import { memo } from 'react';
import { Reply, Smile, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn, formatTime, getInitials, getAvatarColor } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Message } from '@/store/chatStore';
import { useAuthStore } from '@/store';

interface MessageBubbleProps {
    message: Message;
    isGrouped?: boolean;
    onReply?: (message: Message) => void;
    onReact?: (messageId: string, emoji: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'];

export const MessageBubble = memo(function MessageBubble({
    message,
    isGrouped = false,
    onReply,
    onReact,
}: MessageBubbleProps) {
    const { user } = useAuthStore();
    const isOwn = message.sender._id === user?.id;
    const isSystem = message.contentType === 'SYSTEM';

    if (isSystem) {
        return (
            <div className="flex justify-center my-4">
                <div className="bg-muted px-3 py-1.5 rounded-full">
                    <span className="text-xs text-muted-foreground">{message.content}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'group flex gap-3 px-4 py-0.5 hover:bg-muted/50 transition-colors message-enter',
                isGrouped ? 'pt-0' : 'pt-2'
            )}
        >
            {/* Avatar */}
            <div className="w-10 flex-shrink-0">
                {!isGrouped && (
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={message.sender.avatar} />
                        <AvatarFallback className={getAvatarColor(message.sender.name)}>
                            {getInitials(message.sender.name)}
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {!isGrouped && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-sm hover:underline cursor-pointer">
                            {message.sender.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {formatTime(message.createdAt)}
                        </span>
                        {message.isEdited && (
                            <span className="text-xs text-muted-foreground italic">(edited)</span>
                        )}
                    </div>
                )}

                {/* Reply Preview */}
                {message.replyTo && (
                    <div className="flex items-center gap-2 mb-1 pl-3 border-l-2 border-primary/30">
                        <span className="text-xs text-muted-foreground">
                            Replying to <strong>{message.replyTo.sender?.name}</strong>
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {message.replyTo.content}
                        </span>
                    </div>
                )}

                {/* Message Content */}
                <p
                    className={cn(
                        'text-sm leading-relaxed break-words',
                        isGrouped && 'ml-0'
                    )}
                >
                    {message.content}
                </p>

                {/* Reactions */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(message.reactions).map(([emoji, users]) => (
                            <button
                                key={emoji}
                                onClick={() => onReact?.(message.id, emoji)}
                                className={cn(
                                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all',
                                    'bg-muted hover:bg-muted/80',
                                    (users as string[]).includes(user?.id || '') && 'bg-primary/20 border border-primary/30'
                                )}
                            >
                                <span>{emoji}</span>
                                <span className="font-medium">{(users as string[]).length}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions (visible on hover) */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-0.5 -mt-1">
                {/* Quick Reactions */}
                <div className="flex items-center bg-background border rounded-md shadow-sm">
                    {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
                        <Tooltip key={emoji}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => onReact?.(message.id, emoji)}
                                >
                                    <span className="text-sm">{emoji}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>React with {emoji}</TooltipContent>
                        </Tooltip>
                    ))}

                    {/* More Emojis */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Smile className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <div className="flex flex-wrap gap-1 p-2 max-w-[200px]">
                                {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => onReact?.(message.id, emoji)}
                                        className="text-xl p-1 hover:bg-muted rounded"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Reply */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onReply?.(message)}
                            >
                                <Reply className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply</TooltipContent>
                    </Tooltip>

                    {/* More Options */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isOwn && (
                                <>
                                    <DropdownMenuItem>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Message
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Message
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!isOwn && (
                                <DropdownMenuItem>
                                    <Reply className="mr-2 h-4 w-4" />
                                    Reply
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
});

export default MessageBubble;

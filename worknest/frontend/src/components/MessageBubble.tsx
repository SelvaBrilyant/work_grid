import { memo, useState } from 'react';
import { Reply, Smile, MoreHorizontal, Pencil, Trash2, Check, CheckCheck, Pin, PinOff, Download, FileIcon, MessageSquare } from 'lucide-react';
import { cn, formatTime, getInitials, getAvatarColor } from '@/lib/utils';
import { VoiceMessage } from './VoiceMessage';
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
import { useAuthStore, useChatStore } from '@/store';

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface MessageBubbleProps {
    message: Message;
    isGrouped?: boolean;
    onReply?: (message: Message) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onScrollToMessage?: (messageId: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'];

export const MessageBubble = memo(function MessageBubble({
    message,
    isGrouped = false,
    onReply,
    onReact,
    onScrollToMessage,
}: MessageBubbleProps) {
    const { user } = useAuthStore();
    const { editMessage, deleteMessage, openDetails, users, activeChannel, openThread } = useChatStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(message.content);
    const isMe = (message.sender?._id === user?.id) || (message.sender?.id === user?.id);
    const isOwn = isMe;
    const isSystem = message.contentType === 'SYSTEM';

    if (isSystem) {
        return (
            <div
                id={`message-${message.id}`}
                className="flex justify-center my-4">
                <div className="bg-muted px-3 py-1.5 rounded-full">
                    <span className="text-xs text-muted-foreground">{message.content}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            id={`message-${message.id}`}
            className={cn(
                'group flex gap-3 px-4 py-0.5 hover:bg-muted/50 transition-colors message-enter',
                isGrouped ? 'pt-0' : 'pt-2'
            )}
        >
            {/* Avatar */}
            <div className="w-10 flex-shrink-0">
                {!isGrouped && (
                    <Avatar
                        className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => openDetails('USER', message.sender?._id || message.sender?.id || '')}
                    >
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
                        <span
                            className="font-semibold text-sm hover:underline cursor-pointer"
                            onClick={() => openDetails('USER', message.sender?._id || message.sender?.id || '')}
                        >
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
                    <div
                        className="flex items-center gap-2 mb-1 pl-3 border-l-2 border-primary/30 cursor-pointer hover:border-primary transition-colors group/reply"
                        onClick={() => message.replyTo && onScrollToMessage?.(message.replyTo.id)}
                    >
                        <span className="text-xs text-muted-foreground group-hover/reply:text-primary transition-colors">
                            Replying to <strong>{message.replyTo.sender?.name || 'Someone'}</strong>
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] opacity-70">
                            {message.replyTo.content}
                        </span>
                    </div>
                )}

                {/* Message Content (Voice or Text) */}
                {message.contentType === 'AUDIO' && message.attachments && message.attachments[0] ? (
                    <div className="mt-2">
                        <VoiceMessage
                            url={message.attachments[0].url}
                            waveform={message.attachments[0].waveform}
                            duration={message.attachments[0].duration}
                            isMe={isMe}
                        />
                    </div>
                ) : (
                    <div
                        className={cn(
                            'text-sm leading-relaxed break-words',
                            isGrouped && 'ml-0',
                            message.isDeleted && 'text-muted-foreground italic'
                        )}
                    >
                        {isEditing ? (
                            <div className="space-y-2 mt-1">
                                <textarea
                                    className="w-full p-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-none"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditValue(message.content);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            if (editValue.trim() && editValue !== message.content) {
                                                await editMessage(message.id, editValue);
                                            }
                                            setIsEditing(false);
                                        }}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {message.isDeleted ? (
                                    "This message has been deleted"
                                ) : (
                                    (() => {
                                        // Improved mention regex logic...
                                        const content = message.content;
                                        const renderedParts: (string | React.ReactNode)[] = [];
                                        const specialMentions = ['@channel', '@here', '@online'];
                                        const mentions: { start: number, end: number, userId?: string, name: string, isSpecial: boolean }[] = [];

                                        specialMentions.forEach(mention => {
                                            const regex = new RegExp(mention + '\\b', 'gi');
                                            let match;
                                            while ((match = regex.exec(content)) !== null) {
                                                mentions.push({
                                                    start: match.index,
                                                    end: match.index + match[0].length,
                                                    name: mention.substring(1),
                                                    isSpecial: true
                                                });
                                            }
                                        });

                                        const sortedUsers = [...users].sort((a, b) => b.name.length - a.name.length);
                                        sortedUsers.forEach(user => {
                                            const mentionText = `@${user.name}`;
                                            let pos = content.indexOf(mentionText);
                                            while (pos !== -1) {
                                                const overlapsSpecial = mentions.some(m =>
                                                    m.isSpecial &&
                                                    ((pos >= m.start && pos < m.end) || (pos + mentionText.length > m.start && pos + mentionText.length <= m.end))
                                                );
                                                if (!overlapsSpecial) {
                                                    mentions.push({
                                                        start: pos,
                                                        end: pos + mentionText.length,
                                                        userId: user.id,
                                                        name: user.name,
                                                        isSpecial: false
                                                    });
                                                }
                                                pos = content.indexOf(mentionText, pos + mentionText.length);
                                            }
                                        });

                                        mentions.sort((a, b) => {
                                            if (a.start !== b.start) return a.start - b.start;
                                            return b.end - a.end;
                                        });

                                        let currentPos = 0;
                                        mentions.forEach((mention, idx) => {
                                            if (mention.start >= currentPos) {
                                                if (mention.start > currentPos) {
                                                    renderedParts.push(content.substring(currentPos, mention.start));
                                                }
                                                if (mention.isSpecial) {
                                                    renderedParts.push(
                                                        <span
                                                            key={`special-mention-${idx}`}
                                                            className="font-bold text-white bg-gradient-to-r from-primary to-purple-600 px-1.5 py-0.5 rounded cursor-default inline-block text-sm"
                                                        >
                                                            @{mention.name}
                                                        </span>
                                                    );
                                                } else {
                                                    renderedParts.push(
                                                        <span
                                                            key={`mention-${idx}`}
                                                            className="font-bold text-primary bg-primary/10 px-1 rounded cursor-pointer hover:bg-primary/20 transition-colors inline-block"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDetails('USER', mention.userId!);
                                                            }}
                                                        >
                                                            @{mention.name}
                                                        </span>
                                                    );
                                                }
                                                currentPos = mention.end;
                                            }
                                        });

                                        if (currentPos < content.length) {
                                            renderedParts.push(content.substring(currentPos));
                                        }

                                        return renderedParts.length > 0 ? renderedParts : [content];
                                    })()
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Attachments (Non-Audio or Multiple) */}
                {message.attachments && message.attachments.length > (message.contentType === 'AUDIO' ? 1 : 0) && (
                    <div className="mt-2 space-y-2">
                        {message.attachments.map((file, i) => {
                            if (message.contentType === 'AUDIO' && i === 0) return null;
                            return (
                                <div key={i} className="w-fit max-w-[85%]">
                                    {file.type.startsWith('image/') ? (
                                        <div className="relative group/img rounded-2xl overflow-hidden bg-black/5 ring-1 ring-border shadow-sm hover:shadow-md transition-all">
                                            <img
                                                src={file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`}
                                                alt={file.name}
                                                className="max-h-[400px] w-auto max-w-full object-contain hover:scale-[1.01] transition-transform cursor-pointer"
                                                onClick={() => window.open(file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`, '_blank')}
                                            />
                                            <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-md rounded-lg"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`, '_blank');
                                                    }}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : file.type.startsWith('video/') ? (
                                        <div className="relative rounded-2xl overflow-hidden shadow-sm border bg-black">
                                            <video
                                                src={file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`}
                                                controls
                                                className="max-h-[400px] w-full"
                                            />
                                        </div>
                                    ) : (
                                        <a
                                            href={file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-4 p-3.5 rounded-2xl border bg-muted/40 hover:bg-muted/60 transition-all group/file hover:border-primary/20 shadow-sm"
                                        >
                                            <div className="h-11 w-11 flex-shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                                <FileIcon className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">{file.name}</p>
                                                <p className="text-[11px] text-muted-foreground font-medium">{formatFileSize(file.size)}</p>
                                            </div>
                                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted/50 group-hover/file:bg-primary/20 group-hover/file:text-primary transition-colors">
                                                <Download className="h-4 w-4" />
                                            </div>
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pinned Indicator */}
                {message.isPinned && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-primary font-medium">
                        <Pin className="h-3 w-3 fill-current" />
                        <span>Pinned</span>
                    </div>
                )}

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

                {/* Seen Indicator */}
                {!isSystem && isOwn && (
                    <div className="flex justify-end mt-1 px-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-default">
                                    {message.readBy && message.readBy.filter(r => r.userId !== user?.id).length > 0 ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-primary font-medium mr-0.5">Seen</span>
                                            <CheckCheck className="h-3 w-3 text-primary" />
                                            {activeChannel?.type !== 'DM' && (
                                                <span className="text-[10px] text-primary font-medium ml-0.5">
                                                    {message.readBy.filter(r => r.userId !== user?.id).length}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-muted-foreground/60 font-medium mr-0.5">Sent</span>
                                            <Check className="h-3 w-3 text-muted-foreground/60" />
                                        </div>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                <div className="text-xs space-y-1">
                                    <p className="font-bold border-b pb-1 mb-1">Seen by</p>
                                    {message.readBy && message.readBy.length > 0 ? (
                                        message.readBy
                                            .filter(r => r.userId !== user?.id)
                                            .map(r => {
                                                const reader = useChatStore.getState().users.find(u =>
                                                    (u.id === r.userId) || (u._id === r.userId)
                                                );
                                                return (
                                                    <div key={r.userId} className="flex justify-between gap-4">
                                                        <span className="font-medium">{reader?.name || 'Someone'}</span>
                                                        <span className="text-muted-foreground">{formatTime(r.readAt)}</span>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <p className="italic text-muted-foreground text-[10px]">No one yet</p>
                                    )}
                                </div>
                            </TooltipContent>
                        </Tooltip>
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

                    {/* Start Thread */}
                    {!message.parentMessageId && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 relative"
                                    onClick={() => openThread({
                                        id: message.id,
                                        content: message.content,
                                        sender: message.sender,
                                    })}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    {message.threadCount && message.threadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                                            {message.threadCount > 9 ? '9+' : message.threadCount}
                                        </span>
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {message.threadCount ? `${message.threadCount} replies` : 'Start Thread'}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {/* More Options */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isOwn && !message.isDeleted && (
                                <>
                                    <DropdownMenuItem onClick={() => {
                                        setIsEditing(true);
                                        setEditValue(message.content); // Ensure editValue is current
                                    }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Message
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => deleteMessage(message.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Message
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!message.isDeleted && (
                                <DropdownMenuItem onClick={() => useChatStore.getState().togglePin(message.id)}>
                                    {message.isPinned ? (
                                        <>
                                            <PinOff className="mr-2 h-4 w-4" />
                                            Unpin Message
                                        </>
                                    ) : (
                                        <>
                                            <Pin className="mr-2 h-4 w-4" />
                                            Pin Message
                                        </>
                                    )}
                                </DropdownMenuItem>
                            )}
                            {!message.isDeleted && (
                                <DropdownMenuItem onClick={() => onReply?.(message)}>
                                    <Reply className="mr-2 h-4 w-4" />
                                    Reply
                                </DropdownMenuItem>
                            )}
                            {!message.isDeleted && !message.parentMessageId && (
                                <DropdownMenuItem onClick={() => openThread({
                                    id: message.id,
                                    content: message.content,
                                    sender: message.sender,
                                })}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    {message.threadCount ? 'View Thread' : 'Start Thread'}
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

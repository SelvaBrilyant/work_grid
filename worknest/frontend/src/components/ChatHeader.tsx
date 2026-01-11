import { useState, useEffect, useRef } from 'react';
import { Hash, Lock, MoreVertical, Phone, Video, Users, Info, Trash2, Search, X, Headphones } from 'lucide-react';
import { useChatStore, useAuthStore } from '@/store';
import { useHuddleStore } from '@/store/huddleStore';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatHeaderProps {
    onOpenGlobalSearch?: () => void;
}

export function ChatHeader({ onOpenGlobalSearch }: ChatHeaderProps) {
    const { activeChannel, onlineUsers, deleteChannel, setActiveChannel, openDetails, searchMessages, searchResults, activeView, setActiveView } = useChatStore();
    const { isInHuddle, activeChannelId, joinHuddle, leaveHuddle } = useHuddleStore();
    const { user } = useAuthStore();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLDivElement>(null);

    const handleDeleteChannel = async () => {
        if (!activeChannel || !window.confirm('Are you sure you want to delete this channel?')) return;
        try {
            await deleteChannel(activeChannel.id);
            setActiveChannel(null);
        } catch (error) {
            console.error('Failed to delete channel:', error);
        }
    };

    useEffect(() => {
        if (searchQuery.trim() && activeChannel) {
            const timer = setTimeout(() => {
                searchMessages(activeChannel.id, searchQuery);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [searchQuery, activeChannel, searchMessages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!activeChannel) {
        return (
            <div className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" />
        );
    }

    const isOnline = activeChannel ? (activeChannel.dmUser && onlineUsers.includes(activeChannel.dmUser.id)) : false;
    const isAdmin = activeChannel ? (user?.role === 'ADMIN') : false;

    return (
        <div className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
            {/* Channel Info */}
            <div
                className="flex items-center gap-3 cursor-pointer group/header"
                onClick={() => {
                    if (activeChannel.type === 'DM' && activeChannel.dmUser) {
                        openDetails('USER', activeChannel.dmUser.id);
                    } else {
                        openDetails('CHANNEL', activeChannel.id);
                    }
                }}
            >
                {activeChannel.type === 'DM' ? (
                    <div className="relative">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={activeChannel.dmUser?.avatar} />
                            <AvatarFallback className={getAvatarColor(activeChannel.dmUser?.name || 'U')}>
                                {getInitials(activeChannel.dmUser?.name || 'User')}
                            </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background online-pulse" />
                        )}
                    </div>
                ) : (
                    <div
                        className={cn(
                            'h-8 w-8 rounded-lg flex items-center justify-center',
                            'bg-gradient-to-br from-primary/20 to-primary/10'
                        )}
                    >
                        {activeChannel.type === 'PRIVATE' ? (
                            <Lock className="h-4 w-4 text-primary" />
                        ) : (
                            <Hash className="h-4 w-4 text-primary" />
                        )}
                    </div>
                )}

                <div>
                    <h1 className="font-semibold text-base group-hover/header:text-primary transition-colors">
                        {activeChannel.type === 'DM'
                            ? activeChannel.dmUser?.name || 'Direct Message'
                            : activeChannel.name}
                    </h1>
                    <div className="flex items-center gap-2">
                        {activeChannel.type !== 'DM' ? (
                            <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveView('messages');
                                    }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                                        activeView === 'messages'
                                            ? "bg-background shadow-sm text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Messages
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveView('tasks');
                                    }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                                        activeView === 'tasks'
                                            ? "bg-background shadow-sm text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Tasks
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveView('wiki');
                                    }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                                        activeView === 'wiki'
                                            ? "bg-background shadow-sm text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Docs
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveView('canvas');
                                    }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                                        activeView === 'canvas'
                                            ? "bg-background shadow-sm text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Canvas
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {isOnline ? (
                                    <span className="text-green-500 font-medium">● Online</span>
                                ) : (
                                    'Offline'
                                )}
                            </p>
                        )}
                        {activeChannel.type !== 'DM' && (
                            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 ml-1 h-5">
                                <Users className="h-2.5 w-2.5" />
                                {activeChannel.memberCount || 0}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                {/* Huddle Toggle */}
                {activeChannel.type !== 'DM' && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={isInHuddle && activeChannelId === activeChannel.id ? "default" : "ghost"}
                                size="icon"
                                className={cn(
                                    "h-8 w-8 rounded-full transition-all duration-300",
                                    isInHuddle && activeChannelId === activeChannel.id
                                        ? "bg-primary text-white hover:bg-primary/90 shadow-lg scale-110"
                                        : "hover:bg-muted"
                                )}
                                onClick={() => {
                                    if (isInHuddle && activeChannelId === activeChannel.id) {
                                        leaveHuddle();
                                    } else {
                                        joinHuddle(activeChannel.id);
                                    }
                                }}
                            >
                                <Headphones className={cn(
                                    "h-4 w-4",
                                    isInHuddle && activeChannelId === activeChannel.id && "animate-pulse"
                                )} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isInHuddle && activeChannelId === activeChannel.id ? "Leave Huddle" : "Start Huddle"}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* DM Call Buttons */}
                {activeChannel.type === 'DM' && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Phone className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Call</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Video className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Video Call</TooltipContent>
                        </Tooltip>
                    </>
                )}

                {/* Global Search */}
                {!isSearchOpen && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={onOpenGlobalSearch}
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="flex flex-col items-center gap-1">
                                <span>Global Search</span>
                                <span className="text-[10px] opacity-70">⌘K / Ctrl+K</span>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Search */}
                <div className="relative flex items-center" ref={searchRef}>
                    {isSearchOpen ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="relative flex items-center">
                                <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search messages..."
                                    className="h-8 w-[200px] lg:w-[300px] pl-9 pr-9"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 h-8 w-8 hover:bg-transparent"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    setIsSearchOpen(false);
                                    setSearchQuery('');
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setIsSearchOpen(true)}
                                >
                                    <Search className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Search in channel</TooltipContent>
                        </Tooltip>
                    )}

                    {/* Search Results Overlay */}
                    {isSearchOpen && searchQuery.trim() && (
                        <div className="absolute top-full right-0 mt-2 w-[350px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50">
                            <div className="p-2 border-b border-border bg-muted/30">
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Search Results</span>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className="p-3 hover:bg-muted cursor-pointer transition-colors border-b border-border last:border-0 group"
                                            onClick={() => {
                                                // TODO: Scroll to message
                                                setIsSearchOpen(false);
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-sm text-primary">{msg.sender.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{new Date(msg.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm line-clamp-2 group-hover:text-foreground transition-colors">{msg.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm italic">
                                        No messages found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {activeChannel.type !== 'DM' && (
                            <>
                                <DropdownMenuItem onClick={() => openDetails('CHANNEL', activeChannel.id)}>
                                    <Info className="mr-2 h-4 w-4" />
                                    Channel Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDetails('CHANNEL', activeChannel.id)}>
                                    <Users className="mr-2 h-4 w-4" />
                                    View Members
                                </DropdownMenuItem>
                            </>
                        )}
                        {isAdmin && activeChannel.type !== 'DM' && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={handleDeleteChannel}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Channel
                                </DropdownMenuItem>
                            </>
                        )}
                        {activeChannel.type === 'DM' && (
                            <DropdownMenuItem onClick={() => openDetails('USER', activeChannel.dmUser!.id)}>
                                <Info className="mr-2 h-4 w-4" />
                                User Profile
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

export default ChatHeader;

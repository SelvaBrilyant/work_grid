import { useState, useEffect, useRef } from 'react';
import { Hash, Lock, MoreVertical, Phone, Video, Users, Info, Trash2, Search, X } from 'lucide-react';
import { useChatStore, useAuthStore } from '@/store';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ChatHeader() {
    const { activeChannel, onlineUsers, deleteChannel, setActiveChannel, openDetails, searchMessages, searchResults } = useChatStore();
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
                    <p className="text-xs text-muted-foreground">
                        {activeChannel.type === 'DM' ? (
                            isOnline ? (
                                <span className="text-green-500 font-medium">● Online</span>
                            ) : (
                                'Offline'
                            )
                        ) : (
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {activeChannel.memberCount || 0} members
                                {activeChannel.description && ` · ${activeChannel.description}`}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
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

                {/* Search */}
                <div className="relative" ref={searchRef}>
                    <div className={cn(
                        "flex items-center gap-2 overflow-hidden bg-muted/50 rounded-lg transition-all",
                        isSearchOpen ? "w-[250px] px-2 py-1 ml-2" : "w-0 px-0 py-0"
                    )}>
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search messages..."
                            className="bg-transparent border-none focus:ring-0 text-sm w-full"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery('');
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {!isSearchOpen && (
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
                            <TooltipContent>Search</TooltipContent>
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

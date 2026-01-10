import { Hash, Lock, MoreVertical, Phone, Video, Users, Info, Trash2 } from 'lucide-react';
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
    const { activeChannel, onlineUsers, deleteChannel, setActiveChannel } = useChatStore();
    const { user } = useAuthStore();

    if (!activeChannel) {
        return (
            <div className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" />
        );
    }

    const isOnline = activeChannel.dmUser && onlineUsers.includes(activeChannel.dmUser.id);
    const isAdmin = user?.role === 'ADMIN';

    const handleDeleteChannel = async () => {
        if (!window.confirm('Are you sure you want to delete this channel?')) return;
        try {
            await deleteChannel(activeChannel.id);
            setActiveChannel(null);
        } catch (error) {
            console.error('Failed to delete channel:', error);
        }
    };

    return (
        <div className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
            {/* Channel Info */}
            <div className="flex items-center gap-3">
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
                    <h1 className="font-semibold text-base">
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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                            <Info className="mr-2 h-4 w-4" />
                            Channel Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Users className="mr-2 h-4 w-4" />
                            View Members
                        </DropdownMenuItem>
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
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

export default ChatHeader;

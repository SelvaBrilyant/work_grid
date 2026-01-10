import { useState } from 'react';
import {
    Hash,
    Lock,
    Plus,
    Settings,
    LogOut,
    ChevronDown,
    Users,
    Search,
} from 'lucide-react';
import { useAuthStore, useChatStore } from '@/store';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function Sidebar() {
    const { user, organization, logout } = useAuthStore();
    const { channels, activeChannel, setActiveChannel, onlineUsers, createChannel, fetchUsers, users, createDM } = useChatStore();
    const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
    const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
    const [searchQuery, setSearchQuery] = useState('');

    const publicChannels = channels.filter((c) => c.type === 'PUBLIC');
    const privateChannels = channels.filter((c) => c.type === 'PRIVATE');
    const dmChannels = channels.filter((c) => c.type === 'DM');

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        try {
            await createChannel({
                name: newChannelName.trim(),
                type: newChannelType,
            });
            setNewChannelName('');
            setIsCreateChannelOpen(false);
        } catch (error) {
            console.error('Failed to create channel:', error);
        }
    };

    const handleOpenDMDialog = async () => {
        setIsDirectMessageOpen(true);
        await fetchUsers();
    };

    const handleStartDM = async (userId: string) => {
        try {
            const channel = await createDM(userId);
            setActiveChannel(channel);
            setIsDirectMessageOpen(false);
        } catch (error) {
            console.error('Failed to create DM:', error);
        }
    };

    const filteredUsers = users.filter(
        (u) =>
            u.id !== user?.id &&
            (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const ChannelItem = ({ channel }: { channel: typeof channels[0] }) => {
        const isActive = activeChannel?.id === channel.id;
        const isOnline = channel.dmUser && onlineUsers.includes(channel.dmUser.id);

        return (
            <button
                onClick={() => setActiveChannel(channel)}
                className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
            >
                {channel.type === 'DM' ? (
                    <div className="relative">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={channel.dmUser?.avatar} />
                            <AvatarFallback className={cn('text-xs', getAvatarColor(channel.dmUser?.name || 'U'))}>
                                {getInitials(channel.dmUser?.name || 'User')}
                            </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar online-pulse" />
                        )}
                    </div>
                ) : channel.type === 'PRIVATE' ? (
                    <Lock className="h-4 w-4 opacity-60" />
                ) : (
                    <Hash className="h-4 w-4 opacity-60" />
                )}
                <span className="truncate flex-1 text-left">
                    {channel.type === 'DM' ? channel.dmUser?.name || 'Direct Message' : channel.name}
                </span>
                {channel.unreadCount ? (
                    <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-full">
                        {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                    </span>
                ) : null}
            </button>
        );
    };

    return (
        <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border">
            {/* Organization Header */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-sidebar-accent transition-colors">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                                <span className="text-sm font-bold text-white">
                                    {organization?.name?.[0] || 'W'}
                                </span>
                            </div>
                            <div className="text-left">
                                <h2 className="font-semibold text-sm truncate max-w-[140px]">
                                    {organization?.name || 'WorkNest'}
                                </h2>
                                <p className="text-xs text-sidebar-foreground/60 truncate">
                                    {organization?.subdomain}.worknest.com
                                </p>
                            </div>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-60" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">
                    <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Separator className="bg-sidebar-border" />

            {/* Channels */}
            <ScrollArea className="flex-1 px-2 py-2">
                {/* Public Channels */}
                <div className="mb-4">
                    <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                            Channels
                        </span>
                        {user?.role === 'ADMIN' && (
                            <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
                                <DialogTrigger asChild>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5">
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Create Channel</TooltipContent>
                                    </Tooltip>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create Channel</DialogTitle>
                                        <DialogDescription>
                                            Create a new channel for your team to collaborate.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Channel Name</label>
                                            <Input
                                                placeholder="e.g., engineering"
                                                value={newChannelName}
                                                onChange={(e) => setNewChannelName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Type</label>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={newChannelType === 'PUBLIC' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setNewChannelType('PUBLIC')}
                                                >
                                                    <Hash className="mr-1 h-4 w-4" />
                                                    Public
                                                </Button>
                                                <Button
                                                    variant={newChannelType === 'PRIVATE' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setNewChannelType('PRIVATE')}
                                                >
                                                    <Lock className="mr-1 h-4 w-4" />
                                                    Private
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsCreateChannelOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleCreateChannel}>Create Channel</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                    <div className="space-y-0.5">
                        {publicChannels.map((channel) => (
                            <ChannelItem key={channel.id} channel={channel} />
                        ))}
                    </div>
                </div>

                {/* Private Channels */}
                {privateChannels.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center px-2 py-1">
                            <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                                Private Channels
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            {privateChannels.map((channel) => (
                                <ChannelItem key={channel.id} channel={channel} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Direct Messages */}
                <div className="mb-4">
                    <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                            Direct Messages
                        </span>
                        <Dialog open={isDirectMessageOpen} onOpenChange={setIsDirectMessageOpen}>
                            <DialogTrigger asChild>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleOpenDMDialog}>
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>New Message</TooltipContent>
                                </Tooltip>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>New Message</DialogTitle>
                                    <DialogDescription>Start a conversation with a team member.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search users..."
                                            className="pl-9"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <ScrollArea className="h-[300px]">
                                        <div className="space-y-1">
                                            {filteredUsers.map((u) => (
                                                <button
                                                    key={u.id}
                                                    onClick={() => handleStartDM(u.id)}
                                                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                                                >
                                                    <div className="relative">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={u.avatar} />
                                                            <AvatarFallback className={getAvatarColor(u.name)}>
                                                                {getInitials(u.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {u.isOnline && (
                                                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                                                        )}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-medium text-sm">{u.name}</p>
                                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="space-y-0.5">
                        {dmChannels.map((channel) => (
                            <ChannelItem key={channel.id} channel={channel} />
                        ))}
                    </div>
                </div>
            </ScrollArea>

            {/* User Profile */}
            <Separator className="bg-sidebar-border" />
            <div className="p-2">
                <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-sidebar-accent/50">
                    <div className="relative">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.avatar} />
                            <AvatarFallback className={getAvatarColor(user?.name || 'User')}>
                                {getInitials(user?.name || 'User')}
                            </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-sidebar online-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-sidebar-foreground/60">
                            {user?.role === 'ADMIN' ? (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Admin
                                </span>
                            ) : (
                                'Online'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;

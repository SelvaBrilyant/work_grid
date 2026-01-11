import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Hash,
    Lock,
    Plus,
    Settings,
    LogOut,
    ChevronDown,
    Users,
    Search,
    UserPlus,
    Mail,
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
import { StatusPicker } from '@/components/StatusPicker';

export function Sidebar() {
    const navigate = useNavigate();
    const { user, organization, logout } = useAuthStore();
    const { channels, activeChannel, setActiveChannel, onlineUsers, createChannel, fetchUsers, users, createDM } = useChatStore();
    const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
    const [isDirectMessageOpen, setIsDirectMessageOpen] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelDescription, setNewChannelDescription] = useState('');
    const [newChannelType, setNewChannelType] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const { invite, isLoading: isAuthLoading, error: authError, clearError: clearAuthError } = useAuthStore();

    const publicChannels = channels.filter((c) => c.type === 'PUBLIC');
    const privateChannels = channels.filter((c) => c.type === 'PRIVATE');
    const dmChannels = channels.filter((c) => c.type === 'DM');

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;
        try {
            await createChannel({
                name: newChannelName.trim(),
                description: newChannelDescription.trim(),
                type: newChannelType,
                members: selectedMembers,
            });
            setNewChannelName('');
            setNewChannelDescription('');
            setSelectedMembers([]);
            setIsCreateChannelOpen(false);
        } catch (error) {
            console.error('Failed to create channel:', error);
        }
    };

    const handleOpenCreateChannel = async () => {
        setIsCreateChannelOpen(true);
        await fetchUsers();
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

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !inviteName) return;

        try {
            await invite({ email: inviteEmail, name: inviteName });
            setIsInviteOpen(false);
            setInviteEmail('');
            setInviteName('');
            setIsDirectMessageOpen(false);
        } catch (error) {
            console.error('Failed to invite user:', error);
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
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
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
                        <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
                            <DialogTrigger asChild>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={handleOpenCreateChannel}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Create Channel</TooltipContent>
                                </Tooltip>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>Create Channel</DialogTitle>
                                    <DialogDescription>
                                        Channels are where your team communicates. They're best when organized around a topic — #marketing, for example.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Name</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="e.g. plan-budget"
                                                className="pl-9"
                                                value={newChannelName}
                                                onChange={(e) => setNewChannelName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                                        <Input
                                            placeholder="What's this channel about?"
                                            value={newChannelDescription}
                                            onChange={(e) => setNewChannelDescription(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium">Visibility</label>
                                        <div className={cn("grid gap-4", user?.role === 'ADMIN' ? "grid-cols-2" : "grid-cols-1")}>
                                            <button
                                                onClick={() => setNewChannelType('PUBLIC')}
                                                className={cn(
                                                    "flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                                                    newChannelType === 'PUBLIC'
                                                        ? "border-primary bg-primary/5"
                                                        : "border-transparent bg-muted/50 hover:bg-muted"
                                                )}
                                            >
                                                <span className="font-semibold text-sm flex items-center gap-2">
                                                    <Hash className="h-4 w-4" /> Public
                                                </span>
                                                <span className="text-xs text-muted-foreground mt-1">Anyone in your workspace can join</span>
                                            </button>

                                            {user?.role === 'ADMIN' && (
                                                <button
                                                    onClick={() => setNewChannelType('PRIVATE')}
                                                    className={cn(
                                                        "flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                                                        newChannelType === 'PRIVATE'
                                                            ? "border-primary bg-primary/5"
                                                            : "border-transparent bg-muted/50 hover:bg-muted"
                                                    )}
                                                >
                                                    <span className="font-semibold text-sm flex items-center gap-2">
                                                        <Lock className="h-4 w-4" /> Private
                                                    </span>
                                                    <span className="text-xs text-muted-foreground mt-1">Only invited people can see and join</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Add members <span className="text-muted-foreground font-normal">(optional)</span></label>
                                        <ScrollArea className="h-[120px] rounded-md border p-2">
                                            <div className="space-y-1">
                                                {users.filter(u => u.id !== user?.id).map((u) => (
                                                    <div
                                                        key={u.id}
                                                        className="flex items-center space-x-2 p-1 hover:bg-muted rounded-md cursor-pointer"
                                                        onClick={() => {
                                                            if (selectedMembers.includes(u.id)) {
                                                                setSelectedMembers(selectedMembers.filter(id => id !== u.id));
                                                            } else {
                                                                setSelectedMembers([...selectedMembers, u.id]);
                                                            }
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedMembers.includes(u.id)}
                                                            readOnly
                                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                        />
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={u.avatar} />
                                                            <AvatarFallback className="text-[10px]">
                                                                {getInitials(u.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm truncate">{u.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateChannelOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateChannel} disabled={!newChannelName.trim()}>
                                        Create Channel
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                                            {filteredUsers.length > 0 ? (
                                                filteredUsers.map((u) => (
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
                                                ))
                                            ) : (
                                                <div className="text-center py-8">
                                                    <p className="text-sm text-muted-foreground mb-4">No users found.</p>
                                                    {user?.role === 'ADMIN' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => {
                                                                clearAuthError();
                                                                setIsInviteOpen(true);
                                                            }}
                                                        >
                                                            <UserPlus className="h-4 w-4" />
                                                            Invite someone new
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>

                                    {user?.role === 'ADMIN' && filteredUsers.length > 0 && (
                                        <div className="pt-2 border-t mt-2">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start gap-2 text-primary hover:text-primary hover:bg-primary/10"
                                                onClick={() => {
                                                    clearAuthError();
                                                    setIsInviteOpen(true);
                                                }}
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                Can't find someone? Invite them
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Invite Dialog */}
                    <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-primary" />
                                    Invite to {organization?.name}
                                </DialogTitle>
                                <DialogDescription>
                                    They'll receive an email with a link to join your workspace.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleInvite} className="space-y-4 py-4">
                                {authError && (
                                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                        {authError}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Full Name</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Jane Doe"
                                            className="pl-9"
                                            value={inviteName}
                                            onChange={(e) => setInviteName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            placeholder="jane@example.com"
                                            className="pl-9"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsInviteOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isAuthLoading}>
                                        {isAuthLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                                <span>Sending...</span>
                                            </div>
                                        ) : (
                                            'Send Invitation'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
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
                        {user?.customStatus?.text ? (
                            <StatusPicker
                                currentStatus={user.customStatus}
                                trigger={
                                    <button className="text-xs text-sidebar-foreground/60 truncate flex items-center gap-1 hover:text-sidebar-foreground transition-colors max-w-full">
                                        <span>{user.customStatus.emoji || '😊'}</span>
                                        <span className="truncate">{user.customStatus.text}</span>
                                    </button>
                                }
                            />
                        ) : (
                            <StatusPicker
                                currentStatus={user?.customStatus}
                                trigger={
                                    <button className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex items-center gap-1">
                                        {user?.role === 'ADMIN' ? (
                                            <>
                                                <Users className="h-3 w-3" /> Admin
                                            </>
                                        ) : (
                                            'Set status'
                                        )}
                                    </button>
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Sidebar;

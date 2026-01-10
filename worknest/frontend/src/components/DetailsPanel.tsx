import { X, Mail, Shield, Clock, Hash, Lock, Users, Info, Calendar, Search, UserPlus, Pin } from 'lucide-react';
import { useAuthStore, useChatStore } from '@/store';
import { cn, getInitials, getAvatarColor, formatTime } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function DetailsPanel() {
    const { user: currentUser } = useAuthStore();
    const { detailsPanel, closeDetails, channels, users, onlineUsers, addMemberToChannel, pinnedMessages, fetchPinnedMessages } = useChatStore();
    const { isOpen, type, id } = detailsPanel;

    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'ABOUT' | 'PINNED'>('ABOUT');

    useEffect(() => {
        if (isOpen && type === 'CHANNEL' && id) {
            fetchPinnedMessages(id);
        }
    }, [isOpen, type, id, fetchPinnedMessages]);

    if (!isOpen || !type || !id) return null;

    let content = null;

    if (type === 'USER') {
        const user = users.find((u) => u.id === id);
        if (!user) return null;

        const isOnline = onlineUsers.includes(user.id);

        content = (
            <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="p-4 flex items-center justify-between border-b">
                    <h2 className="font-semibold text-lg">Profile</h2>
                    <Button variant="ghost" size="icon" onClick={closeDetails}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="relative mb-4">
                                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                                    <AvatarImage src={user.avatar} />
                                    <AvatarFallback className={cn("text-3xl", getAvatarColor(user.name))}>
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                                {isOnline && (
                                    <span className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-green-500 border-4 border-background" />
                                )}
                            </div>
                            <h3 className="text-xl font-bold">{user.name}</h3>
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                {isOnline ? 'Online' : user.lastSeenAt ? `Last seen ${formatTime(user.lastSeenAt)}` : 'Offline'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">Contact Information</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground">Email Address</p>
                                            <p className="text-sm font-medium truncate">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground">Workspace Role</p>
                                            <p className="text-sm font-medium">{user.role}</p>
                                        </div>
                                    </div>
                                    {user.lastSeenAt && (
                                        <div className="flex items-center gap-3 px-1">
                                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-muted-foreground">Last Seen</p>
                                                <p className="text-sm font-medium">{new Date(user.lastSeenAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div className="flex gap-2">
                                <Button className="flex-1" variant="outline">Message</Button>
                                <Button className="flex-1" variant="outline">Call</Button>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        );
    } else if (type === 'CHANNEL') {
        const channel = channels.find((c) => c.id === id);
        if (!channel) return null;

        content = (
            <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                <div className="p-4 flex items-center justify-between border-b">
                    <h2 className="font-semibold text-lg">Details</h2>
                    <Button variant="ghost" size="icon" onClick={closeDetails}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex border-b">
                    <button
                        className={cn(
                            "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
                            activeTab === 'ABOUT' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab('ABOUT')}
                    >
                        About
                    </button>
                    <button
                        className={cn(
                            "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
                            activeTab === 'PINNED' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab('PINNED')}
                    >
                        Pinned
                        {pinnedMessages.length > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 rounded-full text-[10px]">{pinnedMessages.length}</span>
                        )}
                    </button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 text-xl font-bold mb-2">
                                {channel.type === 'PRIVATE' ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                                <span>{channel.name}</span>
                            </div>
                            {channel.description && (
                                <p className="text-sm text-muted-foreground italic">
                                    {channel.description}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-muted/50 border text-center">
                                <Users className="h-4 w-4 mx-auto mb-1.5 opacity-60" />
                                <p className="text-xs text-muted-foreground">Members</p>
                                <p className="text-lg font-bold">{channel.memberCount || 0}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/50 border text-center">
                                <Info className="h-4 w-4 mx-auto mb-1.5 opacity-60" />
                                <p className="text-xs text-muted-foreground">Type</p>
                                <p className="text-lg font-bold capitalize">{channel.type.toLowerCase()}</p>
                            </div>
                        </div>
                    </div>

                    {activeTab === 'ABOUT' ? (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">About</h4>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 px-1">
                                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Created On</p>
                                            <p className="text-sm font-medium">
                                                {channel.joinedAt ? new Date(channel.joinedAt).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</h4>
                                    {currentUser?.role === 'ADMIN' && (
                                        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <UserPlus className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Add Members</DialogTitle>
                                                    <DialogDescription>
                                                        Add people to #{channel.name}
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="relative mb-4">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Search people..."
                                                        className="pl-9"
                                                        value={memberSearch}
                                                        onChange={(e) => setMemberSearch(e.target.value)}
                                                    />
                                                </div>
                                                <ScrollArea className="max-h-[300px] pr-4">
                                                    <div className="space-y-1">
                                                        {users
                                                            .filter(u =>
                                                                !channel.members?.some(m => m.user?.id === u.id) &&
                                                                (u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                                                    u.email.toLowerCase().includes(memberSearch.toLowerCase()))
                                                            )
                                                            .map(u => (
                                                                <div key={u.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-8 w-8">
                                                                            <AvatarImage src={u.avatar} />
                                                                            <AvatarFallback className={getAvatarColor(u.name)}>{getInitials(u.name)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="text-left">
                                                                            <p className="text-sm font-medium">{u.name}</p>
                                                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                                                        </div>
                                                                    </div>
                                                                    <Button size="sm" onClick={() => addMemberToChannel(channel.id, u.id)}>Add</Button>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </ScrollArea>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {channel.members?.map((member) => (
                                        <div key={member.user?.id} className="flex items-center gap-3 px-1">
                                            <div className="relative">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.user?.avatar} />
                                                    <AvatarFallback className={cn("text-xs", getAvatarColor(member.user?.name || '?'))}>
                                                        {getInitials(member.user?.name || '?')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {onlineUsers.includes(member.user?.id || '') && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 text-left">
                                                    <span className="text-sm font-medium truncate">{member.user?.name}</span>
                                                    {member.role === 'ADMIN' && (
                                                        <span className="text-[10px] bg-primary/10 text-primary px-1 rounded font-bold uppercase">Admin</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pinnedMessages.length > 0 ? (
                                pinnedMessages.map((msg) => (
                                    <div key={msg.id} className="p-3 rounded-lg border bg-muted/30 group animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={msg.sender.avatar} />
                                                <AvatarFallback className={cn("text-[10px]", getAvatarColor(msg.sender?.name || '?'))}>{getInitials(msg.sender?.name || '?')}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-semibold">{msg.sender?.name}</span>
                                            <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm line-clamp-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{msg.content}</p>
                                        <div className="flex items-center gap-1 mt-2 text-[10px] text-primary">
                                            <Pin className="h-3 w-3 fill-current" />
                                            <span>Pinned message</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                        <Pin className="h-6 w-6 text-muted-foreground opacity-20" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">No pinned messages yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </div>
        );
    }

    return (
        <div className="w-80 border-l border-border bg-background h-full">
            {content}
        </div>
    );
}

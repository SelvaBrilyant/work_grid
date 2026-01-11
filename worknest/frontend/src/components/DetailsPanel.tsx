import { X, Mail, Shield, Clock, Hash, Lock, Users, Info, Calendar, Search, UserPlus, Pin, Trash2, AlertTriangle, FileIcon, Download, Image, Video, FileText, Music, Bell } from 'lucide-react';
import { toast } from 'sonner';
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
import { channelsApi } from '@/lib/api';

export function DetailsPanel() {
    const { user: currentUser } = useAuthStore();
    const { detailsPanel, closeDetails, channels, users, onlineUsers, addMemberToChannel, pinnedMessages, fetchPinnedMessages, deleteChannel } = useChatStore();
    const { isOpen, type, id } = detailsPanel;

    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'ABOUT' | 'PINNED' | 'FILES'>('ABOUT');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [files, setFiles] = useState<{
        url: string;
        name: string;
        type: string;
        size: number;
        uploadedBy: { id: string; name: string; avatar?: string };
        uploadedAt: string;
        messageId: string;
    }[]>([]);
    const [filesSummary, setFilesSummary] = useState({ images: 0, videos: 0, audio: 0, documents: 0 });
    const [filesFilter, setFilesFilter] = useState<string | null>(null);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    useEffect(() => {
        if (isOpen && type === 'CHANNEL' && id) {
            fetchPinnedMessages(id);
        }
    }, [isOpen, type, id, fetchPinnedMessages]);

    useEffect(() => {
        if (isOpen && type === 'CHANNEL' && id && activeTab === 'FILES') {
            setIsLoadingFiles(true);
            channelsApi.getFiles(id, filesFilter || undefined)
                .then(({ data }) => {
                    if (data.success) {
                        setFiles(data.data.files);
                        setFilesSummary(data.data.summary);
                    }
                })
                .catch(console.error)
                .finally(() => setIsLoadingFiles(false));
        }
    }, [isOpen, type, id, activeTab, filesFilter]);

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
                            {user.profile?.title && (
                                <p className="text-sm text-muted-foreground">{user.profile.title}</p>
                            )}
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                {isOnline ? 'Online' : user.lastSeenAt ? `Last seen ${formatTime(user.lastSeenAt)}` : 'Offline'}
                            </p>
                            {/* Custom Status Display */}
                            {user.customStatus?.text && (
                                <div className="mt-3 px-3 py-2 rounded-full bg-muted/50 border inline-flex items-center gap-2">
                                    <span>{user.customStatus.emoji || '😊'}</span>
                                    <span className="text-sm">{user.customStatus.text}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {/* Professional Details */}
                            {(user.profile?.department || user.profile?.bio) && (
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">About</h4>
                                    <div className="space-y-3">
                                        {user.profile?.department && (
                                            <div className="px-1">
                                                <p className="text-xs text-muted-foreground">Department</p>
                                                <p className="text-sm font-medium">{user.profile.department}</p>
                                            </div>
                                        )}
                                        {user.profile?.bio && (
                                            <div className="px-1">
                                                <p className="text-xs text-muted-foreground mb-1">Bio</p>
                                                <p className="text-sm">{user.profile.bio}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

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
                                    {user.profile?.phone && (
                                        <div className="flex items-center gap-3 px-1">
                                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                                <span className="text-muted-foreground">📞</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-muted-foreground">Phone</p>
                                                <p className="text-sm font-medium">{user.profile.phone}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground">Workspace Role</p>
                                            <p className="text-sm font-medium">{user.role}</p>
                                        </div>
                                    </div>
                                    {user.profile?.timezone && (
                                        <div className="flex items-center gap-3 px-1">
                                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-muted-foreground">Timezone</p>
                                                <p className="text-sm font-medium">{user.profile.timezone}</p>
                                            </div>
                                        </div>
                                    )}
                                    {user.lastSeenAt && (
                                        <div className="flex items-center gap-3 px-1">
                                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
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
                    <button
                        className={cn(
                            "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
                            activeTab === 'FILES' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveTab('FILES')}
                    >
                        Files
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
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1 flex items-center gap-2">
                                    <Bell className="h-3 w-3" />
                                    Notification Settings
                                </h4>
                                <div className="space-y-2 px-1">
                                    <div className="flex gap-1 bg-muted p-1 rounded-lg">
                                        {[
                                            { id: 'ALL', label: 'All' },
                                            { id: 'MENTIONS', label: 'Mentions' },
                                            { id: 'NONE', label: 'None' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={async () => {
                                                    try {
                                                        await channelsApi.updateNotifications(channel.id, {
                                                            notifyOn: opt.id as 'ALL' | 'MENTIONS' | 'NONE'
                                                        });
                                                        // Update local channel state if needed, but fetchUser or channel update should handle it
                                                        // For now just toast
                                                        toast.success(`Notifications set to ${opt.label}`);
                                                    } catch {
                                                        toast.error('Failed to update settings');
                                                    }
                                                }}
                                                className={cn(
                                                    "flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all",
                                                    (channel.notifications?.notifyOn || 'ALL') === opt.id
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground px-1 italic">
                                        Configure triggers specifically for this channel.
                                    </p>
                                </div>
                            </div>

                            <Separator />

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

                            {currentUser?.role === 'ADMIN' && (
                                <>
                                    <Separator />
                                    <div className="pt-2 px-1">
                                        <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                                            setIsDeleteDialogOpen(open);
                                            if (!open) setDeleteConfirmName('');
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-3 px-3">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span>Delete Channel</span>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[425px]">
                                                <DialogHeader>
                                                    <DialogTitle className="flex items-center gap-2 text-destructive">
                                                        <AlertTriangle className="h-5 w-5" />
                                                        Delete Channel
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        This action cannot be undone. This will permanently delete the <strong>#{channel.name}</strong> channel and all of its message history.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <p className="text-sm">Please type <span className="font-mono font-bold bg-muted px-1 rounded">{channel.name}</span> to confirm.</p>
                                                        <Input
                                                            placeholder="Enter channel name"
                                                            value={deleteConfirmName}
                                                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                                                            className="focus-visible:ring-destructive"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        variant="destructive"
                                                        className="w-full"
                                                        disabled={deleteConfirmName !== channel.name || isDeleting}
                                                        onClick={async () => {
                                                            setIsDeleting(true);
                                                            try {
                                                                await deleteChannel(channel.id);
                                                                closeDetails();
                                                            } catch (error) {
                                                                console.error(error);
                                                            } finally {
                                                                setIsDeleting(false);
                                                                setIsDeleteDialogOpen(false);
                                                            }
                                                        }}
                                                    >
                                                        {isDeleting ? "Deleting..." : "Delete Channel"}
                                                    </Button>
                                                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : activeTab === 'PINNED' ? (
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
                    ) : (
                        /* FILES TAB */
                        <div className="space-y-4">
                            {/* Filter buttons */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setFilesFilter(null)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                        filesFilter === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                    )}
                                >
                                    All ({filesSummary.images + filesSummary.videos + filesSummary.audio + filesSummary.documents})
                                </button>
                                <button
                                    onClick={() => setFilesFilter('image')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
                                        filesFilter === 'image' ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                    )}
                                >
                                    <Image className="h-3 w-3" />
                                    Images ({filesSummary.images})
                                </button>
                                <button
                                    onClick={() => setFilesFilter('video')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
                                        filesFilter === 'video' ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                    )}
                                >
                                    <Video className="h-3 w-3" />
                                    Videos ({filesSummary.videos})
                                </button>
                                <button
                                    onClick={() => setFilesFilter('document')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
                                        filesFilter === 'document' ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                    )}
                                >
                                    <FileText className="h-3 w-3" />
                                    Docs ({filesSummary.documents})
                                </button>
                            </div>

                            {isLoadingFiles ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : files.length > 0 ? (
                                <>
                                    {/* Images Grid */}
                                    {(filesFilter === null || filesFilter === 'image') && files.filter(f => f.type.startsWith('image/')).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                                <Image className="h-3 w-3" /> Images
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2">
                                                {files.filter(f => f.type.startsWith('image/')).map((file, i) => (
                                                    <a
                                                        key={i}
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="aspect-square rounded-lg overflow-hidden bg-muted group relative"
                                                    >
                                                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Download className="h-5 w-5 text-white" />
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Videos Grid */}
                                    {(filesFilter === null || filesFilter === 'video') && files.filter(f => f.type.startsWith('video/')).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                                <Video className="h-3 w-3" /> Videos
                                            </h4>
                                            <div className="space-y-2">
                                                {files.filter(f => f.type.startsWith('video/')).map((file, i) => (
                                                    <a
                                                        key={i}
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                                                            <Video className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                                            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                        <Download className="h-4 w-4 text-muted-foreground" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Documents List */}
                                    {(filesFilter === null || filesFilter === 'document') && files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/')).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                                <FileText className="h-3 w-3" /> Documents
                                            </h4>
                                            <div className="space-y-2">
                                                {files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/')).map((file, i) => (
                                                    <a
                                                        key={i}
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="h-10 w-10 rounded bg-orange-500/10 flex items-center justify-center">
                                                            <FileIcon className="h-5 w-5 text-orange-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleDateString()}</p>
                                                        </div>
                                                        <Download className="h-4 w-4 text-muted-foreground" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Audio List */}
                                    {(filesFilter === null || filesFilter === 'audio') && files.filter(f => f.type.startsWith('audio/')).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                                                <Music className="h-3 w-3" /> Audio
                                            </h4>
                                            <div className="space-y-2">
                                                {files.filter(f => f.type.startsWith('audio/')).map((file, i) => (
                                                    <a
                                                        key={i}
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="h-10 w-10 rounded bg-purple-500/10 flex items-center justify-center">
                                                            <Music className="h-5 w-5 text-purple-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                                            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                        <Download className="h-4 w-4 text-muted-foreground" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                        <FileIcon className="h-6 w-6 text-muted-foreground opacity-20" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">No files shared yet</p>
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

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    User,
    Lock,
    Bell,
    Palette,
    Shield,
    LogOut,
    Camera,
    Check,
    Building2,
    Monitor,
    AlertTriangle,
    Loader2,
    Users,
    Settings as SettingsIcon,
    Globe,
    ShieldCheck,
    MessageSquare,
    UserPlus,
    MoreVertical,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore, useChatStore } from '@/store';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usersApi, settingsApi, authApi, uploadsApi } from '@/lib/api';
import { UserSettings } from '@/types';
import { StatusPicker } from '@/components';

type SettingsSection =
    | 'u-profile' | 'u-preferences' | 'u-security' | 'u-notifications' | 'u-privacy'
    | 'o-general' | 'o-members' | 'o-security' | 'o-policies' | 'o-notifications' | 'o-account';

export function Settings() {
    const navigate = useNavigate();
    const { user, organization, logout, fetchUser } = useAuthStore();
    const { users, fetchUsers } = useChatStore();

    const isAdmin = user?.role === 'ADMIN';

    // Section state
    const [activeSection, setActiveSection] = useState<SettingsSection>('u-profile');

    // Load users if on members section
    useEffect(() => {
        if (activeSection === 'o-members' || activeSection === 'o-account') {
            fetchUsers();
        }
    }, [activeSection, fetchUsers]);

    // General States
    const [loading, setLoading] = useState(false);

    // User Profile States
    const [profileData, setProfileData] = useState({
        name: user?.name || '',
        statusMessage: user?.statusMessage || '',
    });

    // Password Update State
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Org Settings States
    const [orgData, setOrgData] = useState({
        name: organization?.name || '',
        timezone: organization?.settings?.general?.timezone || 'UTC',
        language: organization?.settings?.general?.language || 'en',
        allowPrivateChannels: organization?.settings?.channelPolicies?.allowPrivateChannels ?? true,
        messageRetentionDays: organization?.settings?.channelPolicies?.messageRetentionDays || 0,
        minLength: organization?.settings?.security?.passwordPolicy?.minLength || 8,
    });

    // Sync state with store updates
    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || '',
                statusMessage: user.statusMessage || '',
            });
        }
    }, [user]);

    useEffect(() => {
        if (organization) {
            setOrgData({
                name: organization.name || '',
                timezone: organization.settings?.general?.timezone || 'UTC',
                language: organization.settings?.general?.language || 'en',
                allowPrivateChannels: organization.settings?.channelPolicies?.allowPrivateChannels ?? true,
                messageRetentionDays: organization.settings?.channelPolicies?.messageRetentionDays || 0,
                minLength: organization.settings?.security?.passwordPolicy?.minLength || 8,
            });
        }
    }, [organization]);

    // Deletion Dialog State
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Avatar Upload State
    const [isAvatarLoading, setIsAvatarLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAvatarLoading(true);
        try {
            const { data } = await uploadsApi.uploadFile(file);
            if (data.success) {
                const avatarUrl = data.data.url;
                await usersApi.update(user!.id, { avatar: avatarUrl });
                await fetchUser();
                toast.success('Avatar updated successfully');
            }
        } catch {
            toast.error('Failed to upload avatar');
        } finally {
            setIsAvatarLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpdateUser = async () => {
        setLoading(true);
        try {
            await settingsApi.updateUser({
                statusMessage: profileData.statusMessage,
            });
            if (profileData.name !== user?.name) {
                await usersApi.update(user!.id, { name: profileData.name });
            }
            await fetchUser();
            toast.success('Profile updated successfully');
        } catch (err: unknown) {
            let errorMsg = 'Failed to update profile';
            if (axios.isAxiosError(err)) {
                errorMsg = err.response?.data?.error || err.message;
            } else if (err instanceof Error) {
                errorMsg = err.message;
            }
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOrg = async () => {
        setLoading(true);
        try {
            await settingsApi.updateOrganization({
                name: orgData.name,
                settings: {
                    general: {
                        timezone: orgData.timezone,
                        language: orgData.language,
                    },
                    channelPolicies: {
                        allowPrivateChannels: orgData.allowPrivateChannels,
                    }
                }
            });
            await fetchUser();
            toast.success('Organization updated successfully');
        } catch (err: unknown) {
            let errorMsg = 'Failed to update organization';
            if (axios.isAxiosError(err)) {
                errorMsg = err.response?.data?.error || err.message;
            } else if (err instanceof Error) {
                errorMsg = err.message;
            }
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            await authApi.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            toast.success('Password changed successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: unknown) {
            let errorMsg = 'Failed to change password';
            if (axios.isAxiosError(err)) {
                errorMsg = err.response?.data?.error || err.message;
            }
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            await usersApi.deleteMe();
            toast.success('Account deleted successfully');
            logout();
            navigate('/login');
        } catch (err: unknown) {
            let errorMsg = 'Failed to delete account';
            if (axios.isAxiosError(err)) {
                errorMsg = err.response?.data?.error || err.message;
            }
            toast.error(errorMsg);
            setShowDeleteDialog(false);
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        {
            label: 'USER SETTINGS',
            items: [
                { id: 'u-profile', label: 'Profile', icon: User },
                { id: 'u-preferences', label: 'Preferences', icon: Palette },
                { id: 'u-security', label: 'Security', icon: Lock },
                { id: 'u-notifications', label: 'Notifications', icon: Bell },
                { id: 'u-privacy', label: 'Privacy & Sessions', icon: Shield },
            ]
        },
        ...(isAdmin ? [{
            label: 'ORGANIZATION',
            items: [
                { id: 'o-general', label: 'General', icon: Building2 },
                { id: 'o-members', label: 'Members', icon: Users },
                { id: 'o-security', label: 'Security & Access', icon: ShieldCheck },
                { id: 'o-policies', label: 'Channel Policies', icon: MessageSquare },
                { id: 'o-notifications', label: 'Global Notifications', icon: Globe },
                { id: 'o-account', label: 'Workspace Account', icon: AlertTriangle },
            ]
        }] : [])
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'u-profile':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Public Profile</h2>
                            <p className="text-muted-foreground">Manage how you appear to others in the organization.</p>
                        </div>

                        <Card className="glass-card">
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                        />
                                        <Avatar className="h-32 w-32 border-4 border-primary/20">
                                            {isAvatarLoading ? (
                                                <div className="h-full w-full flex items-center justify-center bg-muted">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                            ) : (
                                                <>
                                                    <AvatarImage src={user?.avatar} />
                                                    <AvatarFallback className={cn('text-3xl', getAvatarColor(user?.name || 'U'))}>
                                                        {getInitials(user?.name || 'U')}
                                                    </AvatarFallback>
                                                </>
                                            )}
                                        </Avatar>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isAvatarLoading}
                                            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                                        >
                                            <Camera className="text-white h-8 w-8" />
                                        </button>
                                    </div>

                                    <div className="flex-1 space-y-4 w-full">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Full Name</Label>
                                            <Input
                                                id="name"
                                                value={profileData.name}
                                                onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="status">Status Message</Label>
                                            <Input
                                                id="status"
                                                placeholder="What's on your mind?"
                                                value={profileData.statusMessage}
                                                onChange={e => setProfileData({ ...profileData, statusMessage: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Email</Label>
                                            <Input value={user?.email} disabled className="bg-muted/50 cursor-not-allowed" />
                                            <p className="text-xs text-muted-foreground">Email cannot be changed. Contact admin for assistance.</p>
                                        </div>
                                        <Button onClick={handleUpdateUser} disabled={loading} className="w-full md:w-auto">
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Custom Status Section */}
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Custom Status</CardTitle>
                                <CardDescription>Let your team know what you're up to or when you'll be back.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                                    <div className="flex items-center gap-3">
                                        {user?.customStatus?.text ? (
                                            <>
                                                <span className="text-2xl">{user.customStatus.emoji || '😊'}</span>
                                                <div>
                                                    <p className="font-medium">{user.customStatus.text}</p>
                                                    {user.customStatus.expiresAt && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Clears {new Date(user.customStatus.expiresAt).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground">No status set</p>
                                        )}
                                    </div>
                                    <StatusPicker
                                        currentStatus={user?.customStatus}
                                        trigger={
                                            <Button variant="outline" size="sm">
                                                {user?.customStatus?.text ? 'Edit status' : 'Set status'}
                                            </Button>
                                        }
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Rich Profile Section */}
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Professional Details</CardTitle>
                                <CardDescription>Add more information about your role in the organization.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Job Title</Label>
                                        <Input
                                            placeholder="e.g. Senior Software Engineer"
                                            defaultValue={user?.profile?.title}
                                            onBlur={async (e) => {
                                                if (e.target.value !== user?.profile?.title) {
                                                    try {
                                                        await usersApi.updateProfile({ title: e.target.value });
                                                        await fetchUser();
                                                        toast.success('Title updated');
                                                    } catch {
                                                        toast.error('Failed to update title');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Department</Label>
                                        <Input
                                            placeholder="e.g. Engineering"
                                            defaultValue={user?.profile?.department}
                                            onBlur={async (e) => {
                                                if (e.target.value !== user?.profile?.department) {
                                                    try {
                                                        await usersApi.updateProfile({ department: e.target.value });
                                                        await fetchUser();
                                                        toast.success('Department updated');
                                                    } catch {
                                                        toast.error('Failed to update department');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Phone Number</Label>
                                        <Input
                                            placeholder="+1 (555) 123-4567"
                                            defaultValue={user?.profile?.phone}
                                            onBlur={async (e) => {
                                                if (e.target.value !== user?.profile?.phone) {
                                                    try {
                                                        await usersApi.updateProfile({ phone: e.target.value });
                                                        await fetchUser();
                                                        toast.success('Phone updated');
                                                    } catch {
                                                        toast.error('Failed to update phone');
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Timezone</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            defaultValue={user?.profile?.timezone || 'UTC'}
                                            onChange={async (e) => {
                                                try {
                                                    await usersApi.updateProfile({ timezone: e.target.value });
                                                    await fetchUser();
                                                    toast.success('Timezone updated');
                                                } catch {
                                                    toast.error('Failed to update timezone');
                                                }
                                            }}
                                        >
                                            <option value="UTC">UTC (GMT +0:00)</option>
                                            <option value="Asia/Kolkata">Asia/Kolkata (GMT +5:30)</option>
                                            <option value="America/New_York">America/New_York (GMT -5:00)</option>
                                            <option value="America/Los_Angeles">America/Los_Angeles (GMT -8:00)</option>
                                            <option value="Europe/London">Europe/London (GMT +0:00)</option>
                                            <option value="Europe/Paris">Europe/Paris (GMT +1:00)</option>
                                            <option value="Asia/Tokyo">Asia/Tokyo (GMT +9:00)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Bio</Label>
                                    <textarea
                                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                                        placeholder="Tell your team a bit about yourself..."
                                        maxLength={500}
                                        defaultValue={user?.profile?.bio}
                                        onBlur={async (e) => {
                                            if (e.target.value !== user?.profile?.bio) {
                                                try {
                                                    await usersApi.updateProfile({ bio: e.target.value });
                                                    await fetchUser();
                                                    toast.success('Bio updated');
                                                } catch {
                                                    toast.error('Failed to update bio');
                                                }
                                            }
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground text-right">Max 500 characters</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'u-preferences':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Preferences</h2>
                            <p className="text-muted-foreground">Customize your experience and workspace appearance.</p>
                        </div>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Appearance</CardTitle>
                                <CardDescription>Choose how WorkNest looks to you.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="text-sm font-medium">Theme Mode</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'light', label: 'Light', icon: Check },
                                            { id: 'dark', label: 'Dark', icon: Check },
                                            { id: 'system', label: 'System', icon: Check },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={async () => {
                                                    try {
                                                        await settingsApi.updateUser({ settings: { preferences: { theme: t.id as UserSettings["preferences"]["theme"] } } });
                                                        await fetchUser();
                                                        toast.success(`Theme set to ${t.label}`);
                                                    } catch {
                                                        toast.error('Failed to update theme');
                                                    }
                                                }}
                                                className={cn(
                                                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                                    (user?.settings?.preferences?.theme || 'system') === t.id
                                                        ? "border-primary bg-primary/5"
                                                        : "border-muted hover:border-primary/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-12 w-full rounded-md",
                                                    t.id === 'light' ? "bg-white border" : t.id === 'dark' ? "bg-slate-900" : "bg-gradient-to-r from-white to-slate-900"
                                                )} />
                                                <span className="text-sm font-medium">{t.label}</span>
                                                {(user?.settings?.preferences?.theme || 'system') === t.id && (
                                                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                                        <Check className="h-2.5 w-2.5 text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Language</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={user?.settings?.preferences?.language || 'en'}
                                            onChange={async (e) => {
                                                await settingsApi.updateUser({ settings: { preferences: { language: e.target.value } } });
                                                await fetchUser();
                                            }}
                                        >
                                            <option value="en">English</option>
                                            <option value="es">Español</option>
                                            <option value="fr">Français</option>
                                        </select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Timezone</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={user?.settings?.preferences?.timezone || 'UTC'}
                                            onChange={async (e) => {
                                                await settingsApi.updateUser({ settings: { preferences: { timezone: e.target.value } } });
                                                await fetchUser();
                                            }}
                                        >
                                            <option value="UTC">UTC</option>
                                            <option value="Asia/Kolkata">Asia/Kolkata</option>
                                            <option value="America/New_York">America/New_York</option>
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'u-security':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Security</h2>
                            <p className="text-muted-foreground">Manage your password and account security settings.</p>
                        </div>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Change Password</CardTitle>
                                <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Current Password</Label>
                                    <div className="relative">
                                        <Input
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={passwordData.currentPassword}
                                            onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            {showCurrentPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>New Password</Label>
                                    <div className="relative">
                                        <Input
                                            type={showNewPassword ? "text" : "password"}
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            {showNewPassword ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Confirm New Password</Label>
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        value={passwordData.confirmPassword}
                                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    />
                                </div>
                                <Button onClick={handleChangePassword} disabled={loading || !passwordData.newPassword}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Password
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'u-notifications':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Notifications</h2>
                            <p className="text-muted-foreground">Choose when and how you want to be notified.</p>
                        </div>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Notification Triggers</CardTitle>
                                <CardDescription>Configure which events trigger a notification.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {[
                                    { id: 'messages', label: 'All Messages', desc: 'Get notified for every message in your joined channels.' },
                                    { id: 'mentions', label: 'Mentions & DMs', desc: 'Only get notified when you are mentioned or receive a DM.' },
                                    { id: 'email', label: 'Email Digest', desc: 'Receive a daily summary of missed activity.' },
                                ].map((n) => {
                                    const key = n.id as keyof UserSettings['notifications'];
                                    const isEnabled = (user?.settings?.notifications?.[key] as boolean) ?? true;
                                    return (
                                        <div key={n.id} className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">{n.label}</Label>
                                                <p className="text-sm text-muted-foreground">{n.desc}</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    await settingsApi.updateUser({ settings: { notifications: { [key]: !isEnabled } } });
                                                    await fetchUser();
                                                }}
                                                className={cn(
                                                    "h-6 w-11 rounded-full relative transition-colors duration-200 focus:outline-none",
                                                    isEnabled ? "bg-primary" : "bg-muted"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                                                    isEnabled ? "right-1" : "left-1"
                                                )} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Methods & Sound</CardTitle>
                                <CardDescription>Configure how you receive notifications.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {[
                                    { id: 'desktop', label: 'Desktop Notifications', desc: 'Show toast notifications on your computer.' },
                                    { id: 'mobile', label: 'Mobile Push', desc: 'Send push notifications to your mobile device.' },
                                    { id: 'sound', label: 'Notification Sound', desc: 'Play a sound when a notification arrives.' },
                                ].map((n) => {
                                    const key = n.id as keyof UserSettings['notifications'];
                                    const isEnabled = (user?.settings?.notifications?.[key] as boolean) ?? true;
                                    return (
                                        <div key={n.id} className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">{n.label}</Label>
                                                <p className="text-sm text-muted-foreground">{n.desc}</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    await settingsApi.updateUser({ settings: { notifications: { [key]: !isEnabled } } });
                                                    await fetchUser();
                                                }}
                                                className={cn(
                                                    "h-6 w-11 rounded-full relative transition-colors duration-200 focus:outline-none",
                                                    isEnabled ? "bg-primary" : "bg-muted"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                                                    isEnabled ? "right-1" : "left-1"
                                                )} />
                                            </button>
                                        </div>
                                    );
                                })}

                                {user?.settings?.notifications?.sound && (
                                    <div className="pt-4 border-t">
                                        <Label className="text-sm font-medium mb-3 block">Sound Effect</Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {['default', 'chime', 'bell', 'glass', 'ping'].map((s) => (
                                                <Button
                                                    key={s}
                                                    variant={user?.settings?.notifications?.soundName === s ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="capitalize"
                                                    onClick={async () => {
                                                        await settingsApi.updateUser({ settings: { notifications: { soundName: s } } });
                                                        await fetchUser();
                                                    }}
                                                >
                                                    {s}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Do Not Disturb</CardTitle>
                                <CardDescription>Automatically mute notifications during specific hours.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">DND Schedule</Label>
                                        <p className="text-sm text-muted-foreground">Automatically enable DND during these hours.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const enabled = !user?.settings?.notifications?.dnd?.enabled;
                                            await settingsApi.updateUser({
                                                settings: {
                                                    notifications: {
                                                        dnd: {
                                                            enabled,
                                                            start: user?.settings?.notifications?.dnd?.start || "22:00",
                                                            end: user?.settings?.notifications?.dnd?.end || "08:00"
                                                        }
                                                    }
                                                }
                                            });
                                            await fetchUser();
                                        }}
                                        className={cn(
                                            "h-6 w-11 rounded-full relative transition-colors duration-200 focus:outline-none",
                                            user?.settings?.notifications?.dnd?.enabled ? "bg-primary" : "bg-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                                            user?.settings?.notifications?.dnd?.enabled ? "right-1" : "left-1"
                                        )} />
                                    </button>
                                </div>

                                {user?.settings?.notifications?.dnd?.enabled && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <Label>Start Time</Label>
                                            <Input
                                                type="time"
                                                value={user?.settings?.notifications?.dnd?.start || "22:00"}
                                                onChange={async (e) => {
                                                    await settingsApi.updateUser({
                                                        settings: {
                                                            notifications: {
                                                                dnd: {
                                                                    enabled: true,
                                                                    start: e.target.value,
                                                                    end: user?.settings?.notifications?.dnd?.end || "08:00"
                                                                }
                                                            }
                                                        }
                                                    });
                                                    await fetchUser();
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>End Time</Label>
                                            <Input
                                                type="time"
                                                value={user?.settings?.notifications?.dnd?.end || "08:00"}
                                                onChange={async (e) => {
                                                    await settingsApi.updateUser({
                                                        settings: {
                                                            notifications: {
                                                                dnd: {
                                                                    enabled: true,
                                                                    start: user?.settings?.notifications?.dnd?.start || "22:00",
                                                                    end: e.target.value
                                                                }
                                                            }
                                                        }
                                                    });
                                                    await fetchUser();
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Keyword Alerts</CardTitle>
                                <CardDescription>Get notified whenever someone uses these specific words.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        id="new-keyword"
                                        placeholder="Add a keyword (e.g. urgent, feedback)"
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value.trim();
                                                if (val) {
                                                    const keywords = [...(user?.settings?.notifications?.keywords || []), val];
                                                    await settingsApi.updateUser({ settings: { notifications: { keywords } } });
                                                    (e.target as HTMLInputElement).value = '';
                                                    await fetchUser();
                                                    toast.success('Keyword added');
                                                }
                                            }
                                        }}
                                    />
                                    <Button variant="secondary" onClick={async () => {
                                        const input = document.getElementById('new-keyword') as HTMLInputElement;
                                        const val = input.value.trim();
                                        if (val) {
                                            const keywords = [...(user?.settings?.notifications?.keywords || []), val];
                                            await settingsApi.updateUser({ settings: { notifications: { keywords } } });
                                            input.value = '';
                                            await fetchUser();
                                            toast.success('Keyword added');
                                        }
                                    }}>Add</Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {user?.settings?.notifications?.keywords?.map((k: string, i: number) => (
                                        <div key={i} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                                            {k}
                                            <button
                                                onClick={async () => {
                                                    const keywords = user?.settings?.notifications?.keywords?.filter((_: string, idx: number) => idx !== i);
                                                    await settingsApi.updateUser({ settings: { notifications: { keywords } } });
                                                    await fetchUser();
                                                }}
                                                className="hover:text-primary/70"
                                            >
                                                <Check className="h-3 w-3 rotate-45" />
                                            </button>
                                        </div>
                                    ))}
                                    {(!user?.settings?.notifications?.keywords || user.settings.notifications.keywords.length === 0) && (
                                        <p className="text-sm text-muted-foreground italic">No keywords added yet.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'o-general':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Organization Settings</h2>
                            <p className="text-muted-foreground">Manage your workspace's identity and global defaults.</p>
                        </div>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Workspace Identity</CardTitle>
                                <CardDescription>Configure your organization's core details.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Organization Name</Label>
                                    <Input
                                        value={orgData.name}
                                        onChange={e => setOrgData({ ...orgData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Subdomain</Label>
                                    <div className="flex items-center gap-2">
                                        <Input value={organization?.subdomain} disabled className="bg-muted/50 font-mono" />
                                        <span className="text-muted-foreground font-mono">.worknest.com</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Subdomain cannot be changed after creation.</p>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Default Timezone</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                            value={orgData.timezone}
                                            onChange={e => setOrgData({ ...orgData, timezone: e.target.value })}
                                        >
                                            <option value="UTC">UTC (GMT +0:00)</option>
                                            <option value="Asia/Kolkata">Asia/Kolkata (GMT +5:30)</option>
                                            <option value="America/New_York">America/New_York (GMT -5:00)</option>
                                            <option value="Europe/London">Europe/London (GMT +0:00)</option>
                                        </select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Default Language</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                            value={orgData.language}
                                            onChange={e => setOrgData({ ...orgData, language: e.target.value })}
                                        >
                                            <option value="en">English (US)</option>
                                            <option value="es">Español</option>
                                            <option value="fr">Français</option>
                                            <option value="de">Deutsch</option>
                                        </select>
                                    </div>
                                </div>

                                <Button onClick={handleUpdateOrg} disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Organization
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'o-members':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-2xl font-bold">Members & Access</h2>
                                <p className="text-muted-foreground">Manage team members, roles, and invitations.</p>
                            </div>
                            <Button className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Invite Member
                            </Button>
                        </div>

                        <Card className="glass-card">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="px-4 py-3 text-left font-medium">Member</th>
                                            <th className="px-4 py-3 text-left font-medium">Role</th>
                                            <th className="px-4 py-3 text-left font-medium">Status</th>
                                            <th className="px-4 py-3 text-left font-medium">Last Active</th>
                                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={u.avatar} />
                                                            <AvatarFallback className={cn('text-xs', getAvatarColor(u.name))}>
                                                                {getInitials(u.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{u.name}</p>
                                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                                                        u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'
                                                    )}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            'h-2 w-2 rounded-full',
                                                            u.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-500'
                                                        )} />
                                                        {u.status}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : 'Never'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem>Change Role</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                );

            case 'u-privacy':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Privacy & Sessions</h2>
                            <p className="text-muted-foreground">Control your visibility and manage active devices.</p>
                        </div>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Privacy Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Online Status</Label>
                                        <p className="text-sm text-muted-foreground">Show when you're active to others.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const current = user?.settings?.privacy?.showOnlineStatus ?? true;
                                            await settingsApi.updateUser({ settings: { privacy: { showOnlineStatus: !current } } });
                                            await fetchUser();
                                        }}
                                        className={cn(
                                            "h-6 w-11 rounded-full relative transition-colors duration-200",
                                            (user?.settings?.privacy?.showOnlineStatus ?? true) ? "bg-primary" : "bg-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                                            (user?.settings?.privacy?.showOnlineStatus ?? true) ? "right-1" : "left-1"
                                        )} />
                                    </button>
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Read Receipts</Label>
                                        <p className="text-sm text-muted-foreground">Let others see when you've read their messages.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const current = user?.settings?.privacy?.readReceipts ?? true;
                                            await settingsApi.updateUser({ settings: { privacy: { readReceipts: !current } } });
                                            await fetchUser();
                                        }}
                                        className={cn(
                                            "h-6 w-11 rounded-full relative transition-colors duration-200",
                                            (user?.settings?.privacy?.readReceipts ?? true) ? "bg-primary" : "bg-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                                            (user?.settings?.privacy?.readReceipts ?? true) ? "right-1" : "left-1"
                                        )} />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-destructive/20 bg-destructive/5 shadow-none">
                            <CardHeader>
                                <CardTitle className="text-destructive">Active Sessions</CardTitle>
                                <CardDescription>You are currently logged in on this device.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-background/50 border rounded-lg p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Monitor className="text-primary h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Current Session</p>
                                            <p className="text-xs text-muted-foreground">Web Browser • India</p>
                                        </div>
                                    </div>
                                    <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full mt-4 border-destructive/20 text-destructive hover:bg-destructive/10"
                                    onClick={async () => {
                                        await settingsApi.logoutDevices();
                                        logout();
                                        navigate('/login');
                                    }}
                                >
                                    Log out from all other devices
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'o-security':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Security & Access</h2>
                            <p className="text-muted-foreground">Configure organization-wide security policies.</p>
                        </div>

                        <Card className="glass-card border-amber-500/20">
                            <CardHeader>
                                <CardTitle className="text-amber-500 flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    Password Policy
                                </CardTitle>
                                <CardDescription>Enforce stronger passwords for all members.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Minimum Length</Label>
                                            <p className="text-sm text-muted-foreground">Require passwords to be at least this long.</p>
                                        </div>
                                        <Input
                                            type="number"
                                            className="w-20"
                                            value={orgData.minLength}
                                            onChange={e => setOrgData({ ...orgData, minLength: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Session Revocation</Label>
                                            <p className="text-sm text-muted-foreground text-destructive font-medium">Instantly log out ALL users from the organization.</p>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={async () => {
                                                if (confirm("Are you sure? This will force every user in your organization to log in again.")) {
                                                    await settingsApi.forceLogoutAll();
                                                    toast.success("All sessions revoked.");
                                                }
                                            }}
                                        >
                                            Force Logout All
                                        </Button>
                                    </div>
                                </div>
                                <Button onClick={handleUpdateOrg} disabled={loading} className="w-full">
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Security Policies
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'o-policies':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Channel Policies</h2>
                            <p className="text-muted-foreground">Control how channels are created and managed.</p>
                        </div>

                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle>Workspace Governance</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Allow Private Channels</Label>
                                        <p className="text-sm text-muted-foreground">When disabled, only admins can create private channels.</p>
                                    </div>
                                    <button
                                        onClick={() => setOrgData({ ...orgData, allowPrivateChannels: !orgData.allowPrivateChannels })}
                                        className={cn(
                                            "h-6 w-11 rounded-full relative transition-colors duration-200",
                                            orgData.allowPrivateChannels ? "bg-primary" : "bg-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm",
                                            orgData.allowPrivateChannels ? "right-1" : "left-1"
                                        )} />
                                    </button>
                                </div>
                                <Separator />
                                <div className="grid gap-2">
                                    <Label>Message Retention (Days)</Label>
                                    <Input
                                        type="number"
                                        value={orgData.messageRetentionDays}
                                        onChange={e => setOrgData({ ...orgData, messageRetentionDays: parseInt(e.target.value) })}
                                    />
                                    <p className="text-xs text-muted-foreground text-amber-500">Set to 0 for infinite retention. Enterprise plan required for automatic deletion.</p>
                                </div>
                                <Button onClick={handleUpdateOrg} disabled={loading}>
                                    Save Policies
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'o-notifications':
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Global Notifications</h2>
                            <p className="text-muted-foreground">Set default notification behavior for the whole team.</p>
                        </div>

                        <Card className="glass-card bg-primary/5 border-primary/20">
                            <div className="p-12 text-center space-y-4">
                                <Globe className="h-12 w-12 mx-auto text-primary animate-pulse" />
                                <h3 className="text-xl font-bold">Smart Defaults</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto">Configure what new members see by default. Existing users won't be affected.</p>
                                <Button variant="outline" className="border-primary/20">Configure Defaults</Button>
                            </div>
                        </Card>
                    </div>
                );

            case 'o-account': {
                const employeeCount = users.filter(u => u.role === 'EMPLOYEE').length;
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold">Workspace Account</h2>
                            <p className="text-muted-foreground">Danger zone. Manage workspace deletion and billing.</p>
                        </div>

                        <Card className="border-destructive/50 bg-destructive/5 shadow-xl shadow-destructive/5">
                            <CardHeader>
                                <CardTitle className="text-destructive flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Delete Workspace Account
                                </CardTitle>
                                <CardDescription>
                                    This action is permanent and involves deleting all data, channels, and messages for everyone.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {employeeCount > 0 ? (
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-4">
                                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-amber-500">Action Blocked</p>
                                            <p className="text-sm text-amber-700 dark:text-amber-400">
                                                You have <b>{employeeCount} employees</b> in your organization. Deletion is only possible after all other members have been removed or deactivated.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex gap-4">
                                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-green-500">Ready for Deletion</p>
                                            <p className="text-sm text-green-700 dark:text-green-400">
                                                No other active members found. You can proceed with account deletion.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    variant="destructive"
                                    size="lg"
                                    className="w-full font-bold shadow-lg shadow-destructive/25"
                                    disabled={employeeCount > 0}
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    Delete My Account & Organization
                                </Button>
                            </CardContent>
                        </Card>

                        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Confirm Permanently Deletion</DialogTitle>
                                    <DialogDescription>
                                        Are you absolutely sure? This will delete your account and all associated workspace data. This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                                    <Button variant="destructive" onClick={handleDeleteAccount} disabled={loading}>
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Delete Forever"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                );
            }

            default:
                return (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground flex-col gap-4">
                        <SettingsIcon className="h-12 w-12 animate-pulse" />
                        <p>This section is coming soon...</p>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Settings Navigation Sidebar */}
            <div className="w-80 border-r bg-card/30 flex flex-col">
                <div className="p-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/chat')}
                        className="mb-6 -ml-2 text-muted-foreground"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Chat
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                </div>

                <ScrollArea className="flex-1 px-4 pb-8">
                    <div className="space-y-8">
                        {menuItems.map((group) => (group && (
                            <div key={group.label} className="space-y-2">
                                <h3 className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                    {group.label}
                                </h3>
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveSection(item.id as SettingsSection)}
                                            className={cn(
                                                'w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group',
                                                activeSection === item.id
                                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon className={cn(
                                                    'h-4 w-4',
                                                    activeSection === item.id ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                                                )} />
                                                <span className="font-medium">{item.label}</span>
                                            </div>
                                            {activeSection === item.id && <ChevronRight className="h-3 w-3 opacity-50" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )))}
                    </div>
                </ScrollArea>

                <div className="p-4 mt-auto border-t bg-muted/20">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border shadow-sm">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={user?.avatar} />
                            <AvatarFallback className={getAvatarColor(user?.name || 'U')}>
                                {getInitials(user?.name || 'U')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{user?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={logout}
                        className="w-full mt-4 justify-start text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                        <LogOut className="h-4 w-4 mr-3" />
                        Log out
                    </Button>
                </div>
            </div>

            {/* Settings Content Area */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                    <div className="max-w-4xl py-12 px-6 lg:py-16 lg:px-12">
                        {renderContent()}
                    </div>
                </ScrollArea>

                <div className="border-t bg-background/50 backdrop-blur-md">
                    <div className="max-w-4xl px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <p>© 2026 WorkNest Inc.</p>
                            <div className="flex gap-4">
                                <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
                                <a href="#" className="hover:text-foreground transition-colors">Terms</a>
                                <a href="#" className="hover:text-foreground transition-colors">Help</a>
                            </div>
                        </div>
                        <p className="font-mono text-[10px] opacity-40 uppercase tracking-widest">Version 1.0.4-stable</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Settings;

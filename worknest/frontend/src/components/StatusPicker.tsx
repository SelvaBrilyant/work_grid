import { useState } from 'react';
import { Smile, Clock, X, Check, Loader2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';

const PRESET_STATUSES = [
    { emoji: '📅', text: 'In a meeting', duration: '1 hour' },
    { emoji: '🚗', text: 'Commuting', duration: '30 min' },
    { emoji: '🤒', text: 'Out sick', duration: 'Today' },
    { emoji: '🏖️', text: 'Vacationing', duration: 'This week' },
    { emoji: '🎯', text: 'Focusing', duration: '2 hours' },
    { emoji: '🍽️', text: 'Lunch break', duration: '1 hour' },
];

const DURATION_OPTIONS = [
    { label: "Don't clear", value: null },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '4 hours', value: 240 },
    { label: 'Today', value: 'today' },
];

interface StatusPickerProps {
    currentStatus?: {
        text: string;
        emoji?: string;
        expiresAt?: string;
    };
    onStatusChange?: () => void;
    trigger?: React.ReactNode;
}

export function StatusPicker({ currentStatus, onStatusChange, trigger }: StatusPickerProps) {
    const { fetchUser } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState(currentStatus?.text || '');
    const [selectedEmoji, setSelectedEmoji] = useState(currentStatus?.emoji || '😊');
    const [selectedDuration, setSelectedDuration] = useState<number | string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const handleEmojiSelect = (emojiData: EmojiClickData) => {
        setSelectedEmoji(emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handlePresetSelect = async (preset: typeof PRESET_STATUSES[0]) => {
        setLoading(true);
        try {
            const expiresAt = calculateExpiry(preset.duration);
            await usersApi.updateStatus({
                text: preset.text,
                emoji: preset.emoji,
                expiresAt: expiresAt?.toISOString(),
            });
            await fetchUser();
            onStatusChange?.();
            toast.success('Status updated');
            setOpen(false);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const handleCustomStatus = async () => {
        if (!statusText.trim()) {
            toast.error('Please enter a status message');
            return;
        }
        setLoading(true);
        try {
            const expiresAt = calculateExpiry(selectedDuration);
            await usersApi.updateStatus({
                text: statusText.trim(),
                emoji: selectedEmoji,
                expiresAt: expiresAt?.toISOString(),
            });
            await fetchUser();
            onStatusChange?.();
            toast.success('Status updated');
            setOpen(false);
        } catch {
            toast.error('Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    const handleClearStatus = async () => {
        setLoading(true);
        try {
            await usersApi.updateStatus({ clearStatus: true });
            await fetchUser();
            onStatusChange?.();
            toast.success('Status cleared');
            setOpen(false);
            setStatusText('');
            setSelectedEmoji('😊');
        } catch {
            toast.error('Failed to clear status');
        } finally {
            setLoading(false);
        }
    };

    const calculateExpiry = (duration: string | number | null): Date | null => {
        if (!duration) return null;
        const now = new Date();
        if (duration === 'today') {
            now.setHours(23, 59, 59, 999);
            return now;
        }
        if (typeof duration === 'number') {
            now.setMinutes(now.getMinutes() + duration);
            return now;
        }
        // Parse string duration like "1 hour", "30 min"
        const match = duration.match(/(\d+)\s*(hour|min|day|week)/i);
        if (match) {
            const amount = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit.startsWith('min')) now.setMinutes(now.getMinutes() + amount);
            if (unit.startsWith('hour')) now.setHours(now.getHours() + amount);
            if (unit.startsWith('day')) now.setDate(now.getDate() + amount);
            if (unit.startsWith('week')) now.setDate(now.getDate() + amount * 7);
            return now;
        }
        return null;
    };

    const hasStatus = currentStatus?.text && currentStatus.text.length > 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="gap-2">
                        {hasStatus ? (
                            <>
                                <span>{currentStatus?.emoji || '😊'}</span>
                                <span className="truncate max-w-[120px]">{currentStatus?.text}</span>
                            </>
                        ) : (
                            <>
                                <Smile className="h-4 w-4" />
                                <span>Set status</span>
                            </>
                        )}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Set your status</DialogTitle>
                    <DialogDescription>
                        Let your team know what you're up to.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Custom Status Input */}
                    <div className="space-y-2">
                        <Label>What's your status?</Label>
                        <div className="flex gap-2">
                            <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="shrink-0 text-xl">
                                        {selectedEmoji}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="bottom" align="start" className="p-0 border-none bg-transparent">
                                    <EmojiPicker onEmojiClick={handleEmojiSelect} autoFocusSearch={false} />
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Input
                                value={statusText}
                                onChange={(e) => setStatusText(e.target.value)}
                                placeholder="What's happening?"
                                maxLength={100}
                            />
                        </div>
                    </div>

                    {/* Duration Selector */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Clear status after
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {DURATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.label}
                                    onClick={() => setSelectedDuration(opt.value)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-full text-sm transition-colors',
                                        selectedDuration === opt.value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80'
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-2">
                        <Label>Quick presets</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {PRESET_STATUSES.map((preset, i) => (
                                <button
                                    key={i}
                                    onClick={() => handlePresetSelect(preset)}
                                    disabled={loading}
                                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                                >
                                    <span className="text-xl">{preset.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{preset.text}</p>
                                        <p className="text-xs text-muted-foreground">{preset.duration}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {hasStatus && (
                        <Button
                            variant="outline"
                            onClick={handleClearStatus}
                            disabled={loading}
                            className="w-full sm:w-auto"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Clear status
                        </Button>
                    )}
                    <Button
                        onClick={handleCustomStatus}
                        disabled={loading || !statusText.trim()}
                        className="w-full sm:w-auto"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4 mr-2" />
                        )}
                        Save status
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default StatusPicker;

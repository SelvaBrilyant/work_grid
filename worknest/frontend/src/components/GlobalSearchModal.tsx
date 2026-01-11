import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileIcon, MessageSquare, Hash, Lock, User, Calendar, Filter, Loader2 } from 'lucide-react';
import { searchApi } from '@/lib/api';
import { useChatStore } from '@/store';
import { cn, formatTime, getInitials, getAvatarColor } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface SearchResult {
    messages: {
        id: string;
        content: string;
        sender: { name: string; email: string; avatar?: string; _id?: string };
        channel: { id: string; name: string; type: string };
        createdAt: string;
        attachments?: unknown[];
        threadCount?: number;
    }[];
    files: {
        id: string;
        messageId: string;
        channel: { id: string; name: string; type: string };
        sender: { name: string; email: string; avatar?: string; _id?: string };
        file: { url: string; name: string; type: string; size: number };
        createdAt: string;
    }[];
    total: number;
    totalMessages: number;
    totalFiles: number;
    page: number;
    totalPages: number;
    query: string;
}

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
    const { channels, setActiveChannel, users: allUsers } = useChatStore();
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SearchResult | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'files'>('all');
    const [selectedChannel, setSelectedChannel] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load recent searches
    useEffect(() => {
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved));
            } catch {
                console.error('Failed to parse recent searches');
            }
        }
    }, [isOpen]);

    const addToRecentSearches = (searchTerm: string) => {
        const trimmed = searchTerm.trim();
        if (!trimmed) return;
        setRecentSearches(prev => {
            const filtered = prev.filter(s => s !== trimmed);
            const updated = [trimmed, ...filtered].slice(0, 5);
            localStorage.setItem('recentSearches', JSON.stringify(updated));
            return updated;
        });
    };

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Reset when closing
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults(null);
            setActiveTab('all');
            setSelectedChannel('');
            setSelectedUser('');
            setShowFilters(false);
        }
    }, [isOpen]);

    const performSearch = useCallback(async (searchQuery: string, type: 'all' | 'messages' | 'files' = 'all') => {
        if (searchQuery.trim().length < 2) {
            setResults(null);
            return;
        }

        setIsLoading(true);
        try {
            const { data } = await searchApi.globalSearch({
                q: searchQuery,
                type,
                channelId: (selectedChannel && selectedChannel !== 'all-channels') ? selectedChannel : undefined,
                userId: (selectedUser && selectedUser !== 'anyone') ? selectedUser : undefined,
                limit: 20,
            });
            if (data.success) {
                setResults(data.data);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedChannel, selectedUser]);

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (query.trim().length >= 2) {
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(query, activeTab);
            }, 300);
        } else {
            setResults(null);
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [query, activeTab, performSearch]);

    const handleResultClick = (channelId: string) => {
        addToRecentSearches(query);
        // Find and set the active channel
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
            setActiveChannel(channel);
            onClose();
        }
    };

    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? (
                <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getChannelIcon = (type: string) => {
        switch (type) {
            case 'PRIVATE':
                return <Lock className="h-3 w-3" />;
            case 'DM':
                return <User className="h-3 w-3" />;
            default:
                return <Hash className="h-3 w-3" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle className="sr-only">Search</DialogTitle>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search messages, files, and more..."
                            className="pl-10 pr-20 h-12 text-lg border-0 border-b rounded-none focus-visible:ring-0"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                ESC
                            </kbd>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-4 border-b">
                    <div className="flex items-center justify-between gap-4">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1">
                            <TabsList className="grid w-full grid-cols-3 max-w-md">
                                <TabsTrigger value="all" className="gap-2">
                                    All
                                    {results && <span className="text-xs text-muted-foreground">({results.total})</span>}
                                </TabsTrigger>
                                <TabsTrigger value="messages" className="gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Messages
                                    {results && <span className="text-xs text-muted-foreground">({results.totalMessages})</span>}
                                </TabsTrigger>
                                <TabsTrigger value="files" className="gap-2">
                                    <FileIcon className="h-4 w-4" />
                                    Files
                                    {results && <span className="text-xs text-muted-foreground">({results.totalFiles})</span>}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Button
                            variant={showFilters ? 'secondary' : 'outline'}
                            size="sm"
                            className="gap-2"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                        </Button>
                    </div>

                    {/* Filters */}
                    {showFilters && (
                        <div className="mt-4 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Hash className="h-3 w-3" />
                                    Channel
                                </label>
                                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="All channels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all-channels">All channels</SelectItem>
                                        {channels.map((channel) => (
                                            <SelectItem key={channel.id} value={channel.id}>
                                                <span className="flex items-center gap-2">
                                                    {getChannelIcon(channel.type)}
                                                    {channel.name}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    From User
                                </label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Anyone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="anyone">Anyone</SelectItem>
                                        {allUsers.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={u.avatar} />
                                                        <AvatarFallback className="text-[8px] bg-primary/20">
                                                            {getInitials(u.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {u.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>

                <ScrollArea className="flex-1 max-h-[60vh]">
                    {!query.trim() ? (
                        <div className="p-8">
                            {recentSearches.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Searches</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {recentSearches.map((s, i) => (
                                            <Button
                                                key={i}
                                                variant="secondary"
                                                size="sm"
                                                className="h-8 rounded-full px-4 gap-2 text-sm"
                                                onClick={() => setQuery(s)}
                                            >
                                                <Search className="h-3 w-3" />
                                                {s}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="text-center py-8 border-2 border-dashed rounded-xl border-muted">
                                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                <h3 className="text-base font-semibold">Global Search</h3>
                                <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                                    Search across all messages, files, and channels in your workspace.
                                </p>
                                <div className="mt-6 flex flex-wrap justify-center gap-2">
                                    <kbd className="px-2 py-1 rounded bg-muted text-xs border shadow-sm font-mono">⌘ K</kbd>
                                    <span className="text-xs text-muted-foreground">to search</span>
                                </div>
                            </div>
                        </div>
                    ) : query.trim().length < 2 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Type at least 2 characters to search
                        </div>
                    ) : isLoading && !results ? (
                        <div className="p-8 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : results && (results.messages.length > 0 || results.files.length > 0) ? (
                        <div className="p-4 space-y-6">
                            {/* Messages */}
                            {(activeTab === 'all' || activeTab === 'messages') && results.messages.length > 0 && (
                                <div>
                                    {activeTab === 'all' && (
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" />
                                            Messages ({results.totalMessages})
                                        </h3>
                                    )}
                                    <div className="space-y-2">
                                        {results.messages.map((msg) => (
                                            <button
                                                key={msg.id}
                                                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                                                onClick={() => handleResultClick(msg.channel.id)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Avatar className="h-8 w-8 shrink-0">
                                                        <AvatarImage src={msg.sender.avatar} />
                                                        <AvatarFallback className={cn('text-xs', getAvatarColor(msg.sender.name))}>
                                                            {getInitials(msg.sender.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="font-semibold">{msg.sender.name}</span>
                                                            <span className="text-muted-foreground text-xs flex items-center gap-1">
                                                                in {getChannelIcon(msg.channel.type)} {msg.channel.name}
                                                            </span>
                                                            <span className="text-muted-foreground text-xs ml-auto flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {formatTime(msg.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm mt-1 line-clamp-2">
                                                            {highlightMatch(msg.content, query)}
                                                        </p>
                                                        {msg.threadCount && msg.threadCount > 0 && (
                                                            <span className="text-xs text-primary mt-1 inline-block">
                                                                {msg.threadCount} replies
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Files */}
                            {(activeTab === 'all' || activeTab === 'files') && results.files.length > 0 && (
                                <div>
                                    {activeTab === 'all' && (
                                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                                            <FileIcon className="h-4 w-4" />
                                            Files ({results.totalFiles})
                                        </h3>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {results.files.map((file) => (
                                            <a
                                                key={file.id}
                                                href={file.file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
                                            >
                                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                    <FileIcon className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {highlightMatch(file.file.name, query)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>{formatFileSize(file.file.size)}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            {getChannelIcon(file.channel.type)} {file.channel.name}
                                                        </span>
                                                    </p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : results ? (
                        <div className="p-8 text-center">
                            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <p className="text-muted-foreground">No results found for "{query}"</p>
                            <p className="text-xs text-muted-foreground mt-2">Try a different search term or adjust your filters</p>
                        </div>
                    ) : null}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default GlobalSearchModal;

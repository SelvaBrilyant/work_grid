import { useEffect, useState } from 'react';
import { useChatStore } from '@/store';
import { Sidebar, ChatHeader, ChatWindow, DetailsPanel, ThreadPanel, GlobalSearchModal } from '@/components';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Chat() {
    const { fetchChannels, initSocketEvents, detailsPanel, threadPanel } = useChatStore();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        // Fetch initial data
        fetchChannels();

        // Initialize socket event listeners
        initSocketEvents();
    }, [fetchChannels, initSocketEvents]);

    // Keyboard shortcut listener (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <TooltipProvider delayDuration={300}>
            <div className="h-screen flex overflow-hidden bg-background">
                {/* Global Search Modal */}
                <GlobalSearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                />

                {/* Sidebar */}
                <Sidebar />

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <ChatHeader onOpenGlobalSearch={() => setIsSearchOpen(true)} />

                    <div className="flex-1 flex overflow-hidden min-w-0">
                        {/* Messages */}
                        <ChatWindow />

                        {/* Thread Panel - shown when viewing a thread */}
                        {threadPanel.isOpen && <ThreadPanel />}

                        {/* Right Detail Panel */}
                        {detailsPanel.isOpen && <DetailsPanel />}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default Chat;

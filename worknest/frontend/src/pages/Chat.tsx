import { useEffect } from 'react';
import { useChatStore } from '@/store';
import { Sidebar, ChatHeader, ChatWindow, DetailsPanel } from '@/components';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Chat() {
    const { fetchChannels, initSocketEvents, detailsPanel } = useChatStore();

    useEffect(() => {
        // Fetch initial data
        fetchChannels();

        // Initialize socket event listeners
        initSocketEvents();
    }, [fetchChannels, initSocketEvents]);

    return (
        <TooltipProvider delayDuration={300}>
            <div className="h-screen flex overflow-hidden bg-background">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <ChatHeader />

                    <div className="flex-1 flex overflow-hidden">
                        {/* Messages */}
                        <ChatWindow />

                        {/* Right Detail Panel */}
                        {detailsPanel.isOpen && <DetailsPanel />}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default Chat;

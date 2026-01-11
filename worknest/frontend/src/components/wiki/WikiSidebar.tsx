import React from "react";
import { useWikiStore, WikiPage } from "@/store/wikiStore";
import { useChatStore } from "@/store/chatStore";
import { cn } from "@/lib/utils";
import {
    FileText,
    ChevronRight,
    ChevronDown,
    Plus,
    MoreVertical,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export function WikiSidebar() {
    const { activeChannel } = useChatStore();
    const { pages, currentPage, fetchPages, createPage, deletePage, setCurrentPage } = useWikiStore();
    const [expandedPages, setExpandedPages] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (activeChannel) {
            fetchPages(activeChannel.id);
        }
    }, [activeChannel, fetchPages]);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedPages);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedPages(newExpanded);
    };

    const handleCreatePage = async (parentId?: string) => {
        if (!activeChannel) return;
        const title = prompt("Enter page title:");
        if (title) {
            const newPage = await createPage(activeChannel.id, { title, parentId });
            if (newPage) {
                toast.success("Page created");
                if (parentId) {
                    const newExpanded = new Set(expandedPages);
                    newExpanded.add(parentId);
                    setExpandedPages(newExpanded);
                }
            }
        }
    };

    const handleDeletePage = async (page: WikiPage, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeChannel) return;
        if (confirm(`Are you sure you want to delete "${page.title}"?`)) {
            await deletePage(activeChannel.id, page.slug);
            toast.success("Page deleted");
        }
    };

    const renderPageItem = (page: WikiPage, depth: number = 0) => {
        const isExpanded = expandedPages.has(page._id);
        const isSelected = currentPage?._id === page._id;
        const children = pages.filter(p => p.parentId === page._id);
        const hasChildren = children.length > 0;

        return (
            <React.Fragment key={page._id}>
                <div
                    className={cn(
                        "group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer hover:bg-accent/50 text-sm",
                        isSelected && "bg-accent text-accent-foreground",
                        depth > 0 && "ml-4"
                    )}
                    onClick={() => setCurrentPage(page)}
                >
                    <div
                        className="p-0.5 hover:bg-accent rounded cursor-pointer"
                        onClick={(e) => hasChildren && toggleExpand(page._id, e)}
                    >
                        {hasChildren ? (
                            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : (
                            <div className="w-4" />
                        )}
                    </div>

                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{page.title}</span>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCreatePage(page._id)}>
                                    <Plus className="h-3.5 w-3.5 mr-2" /> Add subpage
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => handleDeletePage(page, e)} className="text-destructive">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {isExpanded && children.map(child => renderPageItem(child, depth + 1))}
            </React.Fragment>
        );
    };

    const rootPages = pages.filter(p => !p.parentId).sort((a, b) => a.order - b.order);

    return (
        <div className="w-64 border-r flex flex-col bg-muted/30">
            <div className="p-4 flex items-center justify-between border-b">
                <h3 className="font-semibold text-sm">Documentation</h3>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleCreatePage()}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-2">
                <div className="space-y-1">
                    {rootPages.map(page => renderPageItem(page))}
                    {rootPages.length === 0 && (
                        <div className="text-center py-8 px-4">
                            <p className="text-xs text-muted-foreground mb-4">No pages yet. Create your first doc!</p>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => handleCreatePage()}>
                                Create first page
                            </Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

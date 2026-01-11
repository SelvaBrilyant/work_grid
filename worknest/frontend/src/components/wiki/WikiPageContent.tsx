import React from "react";
import { useWikiStore } from "@/store/wikiStore";
import {
    Edit2,
    History,
    Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface WikiPageContentProps {
    onEdit: () => void;
    onShowHistory: () => void;
}

export function WikiPageContent({ onEdit, onShowHistory }: WikiPageContentProps) {
    const { currentPage } = useWikiStore();

    if (!currentPage) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
                <div className="max-w-md">
                    <h2 className="text-2xl font-bold mb-2">Select a page</h2>
                    <p className="text-muted-foreground">
                        Choose a page from the sidebar to view its content or create a new one to get started.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-background">
            <div className="max-w-4xl mx-auto p-8 md:p-12">
                <div className="flex items-center justify-between mb-8 group">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                        {currentPage.title}
                    </h1>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onShowHistory} className="gap-2">
                            <History className="h-4 w-4" /> History
                        </Button>
                        <Button variant="default" size="sm" onClick={onEdit} className="gap-2">
                            <Edit2 className="h-4 w-4" /> Edit
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-6 mb-12 py-4 border-y border-border/50 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={currentPage.lastEditedBy.avatar} />
                            <AvatarFallback className={cn("text-[10px]", getAvatarColor(currentPage.lastEditedBy.name))}>
                                {getInitials(currentPage.lastEditedBy.name)}
                            </AvatarFallback>
                        </Avatar>
                        <span>Last edited by <span className="font-medium text-foreground">{currentPage.lastEditedBy.name}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Updated {format(new Date(currentPage.updatedAt), "PPP")}</span>
                    </div>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none min-h-[400px]">
                    {currentPage.content ? (
                        <div dangerouslySetInnerHTML={{ __html: currentPage.content }} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/20">
                            <p className="text-muted-foreground mb-4 font-medium">This page has no content yet.</p>
                            <Button variant="outline" onClick={onEdit}>Add Content</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

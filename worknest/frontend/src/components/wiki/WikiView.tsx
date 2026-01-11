import React from "react";
import { WikiSidebar } from "./WikiSidebar";
import { WikiPageContent } from "./WikiPageContent";
import { WikiEditor } from "./WikiEditor";
import { useWikiStore } from "@/store/wikiStore";

export function WikiView() {
    const [viewState, setViewState] = React.useState<"view" | "edit" | "history">("view");
    const { currentPage } = useWikiStore();

    React.useEffect(() => {
        setViewState("view");
    }, [currentPage]);

    return (
        <div className="flex h-full overflow-hidden bg-background">
            <WikiSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                {viewState === "edit" ? (
                    <WikiEditor
                        onCancel={() => setViewState("view")}
                        onSave={() => setViewState("view")}
                    />
                ) : (
                    <WikiPageContent
                        onEdit={() => setViewState("edit")}
                        onShowHistory={() => setViewState("history")}
                    />
                )}
            </div>
        </div>
    );
}

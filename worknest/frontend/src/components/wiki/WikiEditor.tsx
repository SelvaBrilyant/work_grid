import React from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import { useWikiStore } from "@/store/wikiStore";
import { useChatStore } from "@/store/chatStore";
import {
    Save,
    X,
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Code,
    Undo,
    Redo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WikiEditorProps {
    onCancel: () => void;
    onSave: () => void;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) return null;

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/50 rounded-t-lg">
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("bold") && "bg-accent")}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("italic") && "bg-accent")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("heading", { level: 1 }) && "bg-accent")}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
                <Heading1 className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("heading", { level: 2 }) && "bg-accent")}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
                <Heading2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 my-1" />
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("bulletList") && "bg-accent")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("orderedList") && "bg-accent")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 my-1" />
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("blockquote") && "bg-accent")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <Quote className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", editor.isActive("codeBlock") && "bg-accent")}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
                <Code className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 my-1" />
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().undo().run()}
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().redo().run()}
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    );
};

export function WikiEditor({ onCancel, onSave }: WikiEditorProps) {
    const { activeChannel } = useChatStore();
    const { currentPage, updatePage } = useWikiStore();
    const [title, setTitle] = React.useState(currentPage?.title || "");
    const [isSaving, setIsSaving] = React.useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
            }),
            Placeholder.configure({
                placeholder: "Write something amazing...",
            }),
            Highlight,
            Typography,
        ],
        content: currentPage?.content || "",
        editorProps: {
            attributes: {
                class: "prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-4",
            },
        },
    });

    const handleSave = async () => {
        if (!activeChannel || !currentPage || !editor) return;

        setIsSaving(true);
        try {
            await updatePage(activeChannel.id, currentPage.slug, {
                title,
                content: editor.getHTML(),
                versionSummary: "Updated via web editor",
            });
            toast.success("Page saved successfully");
            onSave();
        } catch {
            toast.error("Failed to save page");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="flex-1 max-w-2xl">
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-2xl font-bold bg-transparent border-none focus-visible:ring-0 px-0 h-auto"
                        placeholder="Page Title"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
                        <X className="h-4 w-4 mr-2" /> Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
                        <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-background p-4 md:p-8">
                <div className="max-w-4xl mx-auto border rounded-lg shadow-sm">
                    <MenuBar editor={editor} />
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    );
}

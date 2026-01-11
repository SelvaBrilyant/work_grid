import * as React from "react";
import { GripVertical, Paperclip, MessageSquare, CalendarIcon, PlusCircleIcon, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as Kanban from "@/components/ui/kanban";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { cn, getInitials, getAvatarColor } from "@/lib/utils";
import { useTaskStore, Task } from "@/store/taskStore";
import { useChatStore } from "@/store/chatStore";

const COLUMN_CONFIG = [
    { id: "todo", title: "To Do" },
    { id: "in-progress", title: "In Progress" },
    { id: "review", title: "Review" },
    { id: "done", title: "Done" }
];

export function KanbanBoard() {
    const { activeChannel } = useChatStore();
    const { tasks, fetchTasks, createTask, reorderTasks } = useTaskStore();

    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [newTask, setNewTask] = React.useState({
        title: '',
        description: '',
        priority: 'medium' as Task['priority'],
        status: 'todo' as Task['status']
    });

    React.useEffect(() => {
        if (activeChannel) {
            fetchTasks(activeChannel.id);
        }
    }, [activeChannel, fetchTasks]);

    // Map flat tasks array to columns object
    const columns = React.useMemo(() => {
        const cols: Record<string, Task[]> = {
            todo: [],
            "in-progress": [],
            review: [],
            done: []
        };

        tasks.forEach(task => {
            if (cols[task.status]) {
                cols[task.status].push(task);
            }
        });

        // Sort items in each column by order
        Object.keys(cols).forEach(key => {
            cols[key].sort((a, b) => a.order - b.order);
        });

        return cols;
    }, [tasks]);

    const handleCreateTask = async () => {
        if (!activeChannel || !newTask.title.trim()) return;
        await createTask(activeChannel.id, {
            ...newTask,
            channelId: activeChannel.id
        });
        setIsCreateModalOpen(false);
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            status: 'todo'
        });
    };

    const handleDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        // Handle item move
        const activeId = active.id;
        const overId = over.id;

        const activeTask = tasks.find(t => t._id === activeId);
        if (!activeTask) return;

        // Determine target column and position
        let targetStatus = activeTask.status;
        let targetOrder = 0;

        // If dropped over a column
        if (COLUMN_CONFIG.some(c => c.id === overId)) {
            targetStatus = overId as Task['status'];
            const colTasks = columns[targetStatus];
            targetOrder = colTasks.length > 0 ? colTasks[colTasks.length - 1].order + 1000 : 1000;
        } else {
            // Dropped over another task
            const overTask = tasks.find(t => t._id === overId);
            if (overTask) {
                targetStatus = overTask.status;
                targetOrder = overTask.order;
            }
        }

        if (activeTask._id === overId && activeTask.status === targetStatus) return;

        // Prepare updates for reorderTasks
        const taskUpdates: { id: string, status: string, order: number }[] = [];

        // Get all tasks in the target column after move
        const targetColTasks = [...columns[targetStatus]].filter(t => t._id !== activeTask._id);

        // Find index where to insert
        const insertIndex = targetColTasks.findIndex(t => t.order >= targetOrder);
        if (insertIndex === -1) {
            targetColTasks.push(activeTask);
        } else {
            targetColTasks.splice(insertIndex, 0, activeTask);
        }

        // Assign new orders
        targetColTasks.forEach((t, index) => {
            taskUpdates.push({
                id: t._id,
                status: targetStatus,
                order: (index + 1) * 1000
            });
        });

        reorderTasks(taskUpdates);
    };

    if (!activeChannel) return null;

    return (
        <TooltipProvider>
            <div className="h-full p-6 bg-muted/30">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Tasks Board</h2>
                        <p className="text-muted-foreground text-sm flex items-center gap-1">
                            Manage project tasks and work items for #{activeChannel.name}
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                        <PlusCircleIcon className="h-4 w-4" />
                        Add Task
                    </Button>
                </div>

                <Kanban.Root
                    value={columns}
                    onDragEnd={handleDragEnd}
                    getItemValue={(item) => item._id}
                >
                    <Kanban.Board className="flex w-full gap-6 overflow-x-auto pb-6">
                        {COLUMN_CONFIG.map(({ id, title }) => (
                            <Kanban.Column key={id} value={id} className="min-w-[320px] bg-background/40 backdrop-blur-sm border-dashed">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold tracking-tight uppercase text-muted-foreground/80">{title}</span>
                                        <Badge variant="secondary" className="bg-muted hover:bg-muted font-bold">
                                            {columns[id]?.length || 0}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        <Kanban.ColumnHandle asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                <GripVertical className="h-4 w-4" />
                                            </Button>
                                        </Kanban.ColumnHandle>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => {
                                                    setNewTask(prev => ({ ...prev, status: id as Task['status'] }));
                                                    setIsCreateModalOpen(true);
                                                }}>
                                                    <PlusCircleIcon className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Add Task to {title}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 min-h-[100px]">
                                    {columns[id]?.map((task) => (
                                        <Kanban.Item key={task._id} value={task._id} asHandle asChild>
                                            <Card className="shadow-sm hover:shadow-md transition-all border-border/50 group">
                                                <CardHeader className="p-4 pb-2 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] uppercase tracking-wider font-bold h-5 px-1.5",
                                                                task.priority === 'urgent' ? "border-red-500 text-red-500 bg-red-500/10" :
                                                                    task.priority === 'high' ? "border-orange-500 text-orange-500 bg-orange-500/10" :
                                                                        task.priority === 'medium' ? "border-blue-500 text-blue-500 bg-blue-500/10" :
                                                                            "border-slate-500 text-slate-500 bg-slate-500/10"
                                                            )}
                                                        >
                                                            {task.priority}
                                                        </Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <MoreHorizontal className="h-3 w-3" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem className="text-xs">Edit Task</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-xs">Assign Member</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-xs text-destructive" onClick={() => useTaskStore.getState().deleteTask(task._id)}>
                                                                    Delete Task
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <CardTitle className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">
                                                        {task.title}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 space-y-4">
                                                    {task.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                            {task.description}
                                                        </p>
                                                    )}

                                                    <div className="flex items-center justify-between pt-2 border-t border-dashed border-border/40">
                                                        <div className="flex items-center gap-3">
                                                            {task.dueDate && (
                                                                <div className={cn(
                                                                    "flex items-center gap-1.5 text-[10px] font-bold",
                                                                    new Date(task.dueDate) < new Date() && task.status !== 'done' ? "text-red-500" : "text-muted-foreground"
                                                                )}>
                                                                    <CalendarIcon className="h-3 w-3" />
                                                                    <span>{format(new Date(task.dueDate), 'MMM d')}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-3 text-muted-foreground">
                                                                <div className="flex items-center gap-1 text-[10px]">
                                                                    <Paperclip className="h-3 w-3" />
                                                                    <span>0</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[10px]">
                                                                    <MessageSquare className="h-3 w-3" />
                                                                    <span>0</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex -space-x-2">
                                                            {task.assigneeId ? (
                                                                <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-border/20 shadow-sm">
                                                                    <AvatarImage src={task.assigneeId.avatar} />
                                                                    <AvatarFallback className={cn("text-[8px] font-bold", getAvatarColor(task.assigneeId.name))}>
                                                                        {getInitials(task.assigneeId.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ) : (
                                                                <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-border/20 shadow-sm">
                                                                    <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">?</AvatarFallback>
                                                                </Avatar>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Kanban.Item>
                                    ))}
                                </div>
                            </Kanban.Column>
                        ))}
                    </Kanban.Board>
                    <Kanban.Overlay>
                        <div className="bg-primary/5 size-full rounded-xl border-2 border-primary/20 backdrop-blur-sm" />
                    </Kanban.Overlay>
                </Kanban.Root>

                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create New Task</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Task Title</Label>
                                <Input
                                    id="title"
                                    placeholder="What needs to be done?"
                                    value={newTask.title}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Add more details about this task..."
                                    value={newTask.description}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Priority</Label>
                                    <Select
                                        value={newTask.priority}
                                        onValueChange={(val: Task['priority']) => setNewTask(prev => ({ ...prev, priority: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select
                                        value={newTask.status}
                                        onValueChange={(val: Task['status']) => setNewTask(prev => ({ ...prev, status: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todo">To Do</SelectItem>
                                            <SelectItem value="in-progress">In Progress</SelectItem>
                                            <SelectItem value="review">Review</SelectItem>
                                            <SelectItem value="done">Done</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>Create Task</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
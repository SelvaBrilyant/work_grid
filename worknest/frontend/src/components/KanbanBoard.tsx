import * as React from "react";
import { GripVertical, Paperclip, MessageSquare, CalendarIcon, PlusCircleIcon, MoreHorizontal, Settings2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    defaultKeyboardCoordinateGetter
} from "@dnd-kit/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as Kanban from "@/components/ui/kanban";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    DialogFooter,
    DialogDescription
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
import { toast } from "sonner";

const DEFAULT_COLUMNS = [
    { id: "todo", title: "To Do", order: 1000 },
    { id: "in-progress", title: "In Progress", order: 2000 },
    { id: "review", title: "Review", order: 3000 },
    { id: "done", title: "Done", order: 4000 }
];

export function KanbanBoard() {
    const { activeChannel, updateChannelColumns, sendMessage, openDetails } = useChatStore();
    const { tasks, fetchTasks, createTask, updateTask, reorderTasks, deleteTask } = useTaskStore();

    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
    const [isManageColumnsModalOpen, setIsManageColumnsModalOpen] = React.useState(false);
    const [editingTask, setEditingTask] = React.useState<Task | null>(null);
    const [editingColumnId, setEditingColumnId] = React.useState<string | null>(null);
    const [editingColumnTitle, setEditingColumnTitle] = React.useState("");
    const [newColumnTitle, setNewColumnTitle] = React.useState("");

    const [newTask, setNewTask] = React.useState({
        title: '',
        description: '',
        priority: 'medium' as Task['priority'],
        status: 'todo',
        assigneeId: '' as string
    });

    // Fetch channel details to get members
    React.useEffect(() => {
        if (activeChannel && !activeChannel.members) {
            openDetails('CHANNEL', activeChannel.id);
        }
    }, [activeChannel, openDetails]);

    // Get channel members for assignee dropdown
    const channelMembers = React.useMemo(() => {
        return (activeChannel?.members?.map(m => m.user) || []).filter(u => u && u.id && u.name);
    }, [activeChannel?.members]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: defaultKeyboardCoordinateGetter,
        })
    );

    React.useEffect(() => {
        if (activeChannel) {
            fetchTasks(activeChannel.id);
        }
    }, [activeChannel, fetchTasks]);

    // Get columns configuration from channel or use default
    const columnConfig = React.useMemo(() => {
        if (activeChannel?.kanbanColumns && activeChannel.kanbanColumns.length > 0) {
            return [...activeChannel.kanbanColumns].sort((a, b) => a.order - b.order);
        }
        return DEFAULT_COLUMNS;
    }, [activeChannel]);

    // Initialize default columns if the channel doesn't have any
    React.useEffect(() => {
        if (activeChannel && (!activeChannel.kanbanColumns || activeChannel.kanbanColumns.length === 0)) {
            updateChannelColumns(activeChannel.id, DEFAULT_COLUMNS);
        }
    }, [activeChannel, updateChannelColumns]);

    // Map flat tasks array to columns object
    const columns = React.useMemo(() => {
        const cols: Record<string, Task[]> = {};

        // Initialize with all configured columns
        columnConfig.forEach(col => {
            cols[col.id] = [];
        });

        tasks.forEach(task => {
            if (cols[task.status]) {
                cols[task.status].push(task);
            } else {
                // Handle tasks with statuses that no longer exist
                if (!cols["todo"]) cols["todo"] = [];
                cols["todo"].push(task);
            }
        });

        // Sort items in each column by order
        Object.keys(cols).forEach(key => {
            cols[key].sort((a, b) => a.order - b.order);
        });

        return cols;
    }, [tasks, columnConfig]);

    const sendTaskNotification = (action: 'created' | 'updated' | 'status_changed', taskTitle: string, extra?: string) => {
        if (!activeChannel) return;
        const actionText = action === 'created' ? '📋 New task created'
            : action === 'updated' ? '✏️ Task updated'
                : '🔄 Task status changed';
        const content = extra
            ? `${actionText}: **${taskTitle}** → ${extra}`
            : `${actionText}: **${taskTitle}**`;
        sendMessage(content);
    };

    const handleCreateTask = async () => {
        if (!activeChannel || !newTask.title.trim()) return;
        const taskTitle = newTask.title;

        // Build payload - assigneeId is sent as string ID, not object
        const payload: Record<string, unknown> = {
            title: newTask.title,
            description: newTask.description,
            priority: newTask.priority,
            status: newTask.status,
            channelId: activeChannel.id
        };
        if (newTask.assigneeId) {
            payload.assigneeId = newTask.assigneeId;
        }

        await createTask(activeChannel.id, payload as Partial<Task>);
        setIsCreateModalOpen(false);
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            status: columnConfig[0]?.id || 'todo',
            assigneeId: ''
        });
        // Send notification to chat
        sendTaskNotification('created', taskTitle);
    };

    const handleEditTask = async () => {
        if (!editingTask) return;

        // Build payload - assigneeId is sent as string ID
        const payload: Record<string, unknown> = {
            title: editingTask.title,
            description: editingTask.description,
            priority: editingTask.priority,
            status: editingTask.status
        };
        if (editingTask.assigneeId?._id) {
            payload.assigneeId = editingTask.assigneeId._id;
        } else {
            payload.assigneeId = null; // Unassign
        }

        await updateTask(editingTask._id, payload as Partial<Task>);
        sendTaskNotification('updated', editingTask.title);
        setIsEditModalOpen(false);
        setEditingTask(null);
        toast.success("Task updated");
    };

    const handleAddColumn = async () => {
        if (!activeChannel || !newColumnTitle.trim()) return;

        const newId = newColumnTitle.toLowerCase().replace(/\s+/g, '-');
        if (columnConfig.some(c => c.id === newId)) {
            toast.error("A column with this name already exists");
            return;
        }

        const maxOrder = columnConfig.length > 0
            ? Math.max(...columnConfig.map(c => c.order))
            : 0;

        const newColumns = [
            ...columnConfig,
            { id: newId, title: newColumnTitle, order: maxOrder + 1000 }
        ];

        await updateChannelColumns(activeChannel.id, newColumns);
        setNewColumnTitle("");
        toast.success("Column added");
    };

    const handleEditColumn = async (columnId: string, newTitle: string) => {
        if (!activeChannel || !newTitle.trim()) return;

        const newColumns = columnConfig.map(c =>
            c.id === columnId ? { ...c, title: newTitle } : c
        );

        await updateChannelColumns(activeChannel.id, newColumns);
        setEditingColumnId(null);
        setEditingColumnTitle("");
        toast.success("Column updated");
    };

    const handleDeleteColumn = async (columnId: string) => {
        if (!activeChannel) return;

        // Check if column has tasks
        if (columns[columnId]?.length > 0) {
            toast.error("Cannot delete a column that contains tasks. Move the tasks first.");
            return;
        }

        const newColumns = columnConfig.filter(c => c.id !== columnId);
        await updateChannelColumns(activeChannel.id, newColumns);
        toast.success("Column deleted");
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // 1. Handle Column Reordering
        if (columnConfig.some(c => c.id === activeId)) {
            if (activeId === overId) return;

            const activeIndex = columnConfig.findIndex(c => c.id === activeId);
            const overIndex = columnConfig.findIndex(c => c.id === overId);

            if (activeIndex !== -1 && overIndex !== -1) {
                const newColumns = [...columnConfig];
                const [removed] = newColumns.splice(activeIndex, 1);
                newColumns.splice(overIndex, 0, removed);

                // Reassign orders
                const updatedColumns = newColumns.map((col, idx) => ({
                    ...col,
                    order: (idx + 1) * 1000
                }));

                updateChannelColumns(activeChannel!.id, updatedColumns);
            }
            return;
        }

        // 2. Handle Task Movement/Reordering
        const activeTask = tasks.find(t => t._id === activeId);
        if (!activeTask) return;

        let targetStatus = activeTask.status;
        let targetOrder = 0;

        // If dropped over a column header or empty column
        if (columnConfig.some(c => c.id === overId)) {
            targetStatus = overId;
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

        const taskUpdates: { id: string, status: string, order: number }[] = [];
        const targetColTasks = [...(columns[targetStatus] || [])].filter(t => t._id !== activeTask._id);

        const insertIndex = targetColTasks.findIndex(t => t.order >= targetOrder);
        if (insertIndex === -1) {
            targetColTasks.push(activeTask);
        } else {
            targetColTasks.splice(insertIndex, 0, activeTask);
        }

        targetColTasks.forEach((t, index) => {
            taskUpdates.push({
                id: t._id,
                status: targetStatus,
                order: (index + 1) * 1000
            });
        });

        // Send notification if task moved to a different column
        if (activeTask.status !== targetStatus) {
            const oldCol = columnConfig.find(c => c.id === activeTask.status);
            const newCol = columnConfig.find(c => c.id === targetStatus);
            if (oldCol && newCol) {
                sendTaskNotification('status_changed', activeTask.title, `${oldCol.title} → ${newCol.title}`);
            }
        }

        reorderTasks(taskUpdates);
    };

    if (!activeChannel) return null;

    return (
        <TooltipProvider>
            <div className="h-full w-full max-w-full min-h-0 bg-muted/30 flex flex-col overflow-hidden">
                {/* Board Header */}
                <div className="px-6 py-4 flex justify-between items-center bg-background/50 border-b border-border/50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold">Tasks Board</h2>
                        <p className="text-xs text-muted-foreground">Manage tasks for #{activeChannel.name}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsManageColumnsModalOpen(true)} className="gap-2">
                            <Settings2 className="h-4 w-4" />
                            Manage Columns
                        </Button>
                        <Button size="sm" onClick={() => setIsCreateModalOpen(true)} className="gap-2 shadow-sm">
                            <PlusCircleIcon className="h-4 w-4" />
                            Add Task
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto min-h-0 p-6">
                    <Kanban.Root
                        value={columns}
                        onDragEnd={handleDragEnd}
                        getItemValue={(item) => item._id}
                        sensors={sensors}
                    >
                        <Kanban.Board className="flex h-full w-max min-w-full gap-6">
                            {columnConfig.map(({ id, title }) => (
                                <Kanban.Column
                                    key={id}
                                    value={id}
                                    className="min-w-[320px] w-[320px] h-full flex flex-col bg-background/50 border-border/50 rounded-xl overflow-hidden"
                                >
                                    <div className="flex items-center justify-between p-4 shrink-0 bg-background/20">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold tracking-tight uppercase text-muted-foreground/80">{title}</span>
                                            <Badge variant="secondary" className="bg-muted hover:bg-muted font-bold text-[10px] h-5">
                                                {columns[id]?.length || 0}
                                            </Badge>
                                        </div>
                                        <div className="flex gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setNewTask(prev => ({ ...prev, status: id }));
                                                        setIsCreateModalOpen(true);
                                                    }}>
                                                        Add Task
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDeleteColumn(id)}
                                                    >
                                                        Delete Column
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Kanban.ColumnHandle asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-grab active:cursor-grabbing">
                                                    <GripVertical className="h-4 w-4" />
                                                </Button>
                                            </Kanban.ColumnHandle>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[100px]">
                                        {columns[id]?.map((task) => (
                                            <Kanban.Item key={task._id} value={task._id} asHandle asChild>
                                                <Card className="hover:ring-2 hover:ring-primary/20 transition-all border-border shadow-sm group cursor-pointer relative">
                                                    <CardHeader className="p-4 pb-2 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-[10px] uppercase tracking-wider font-bold h-5 px-1.5",
                                                                    task.priority === 'urgent' ? "border-red-500 text-red-500 bg-red-500/5" :
                                                                        task.priority === 'high' ? "border-orange-500 text-orange-500 bg-orange-500/5" :
                                                                            task.priority === 'medium' ? "border-blue-500 text-blue-500 bg-blue-500/5" :
                                                                                "border-slate-500 text-slate-500 bg-slate-500/5"
                                                                )}
                                                            >
                                                                {task.priority}
                                                            </Badge>
                                                            <div className="flex gap-1 translate-x-2 -translate-y-2">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem
                                                                            className="gap-2"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingTask(task);
                                                                                setIsEditModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <Settings2 className="h-3.5 w-3.5" /> Edit
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            className="text-destructive gap-2"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                deleteTask(task._id);
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>
                                                        <CardTitle className="text-sm font-semibold leading-tight pr-4">
                                                            {task.title}
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0 space-y-3">
                                                        {task.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                                {task.description}
                                                            </p>
                                                        )}

                                                        <div className="flex items-center justify-between pt-2">
                                                            <div className="flex items-center gap-3">
                                                                {task.dueDate && (
                                                                    <div className={cn(
                                                                        "flex items-center gap-1 text-[10px] font-medium",
                                                                        new Date(task.dueDate) < new Date() && task.status !== 'done' ? "text-red-500" : "text-muted-foreground"
                                                                    )}>
                                                                        <CalendarIcon className="h-3 w-3" />
                                                                        <span>{format(new Date(task.dueDate), 'MMM d')}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex gap-2 text-muted-foreground/60 text-[10px]">
                                                                    <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> 0</span>
                                                                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 0</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                                {task.assigneeId && task.assigneeId.name ? (
                                                                    <Avatar className="h-6 w-6 border border-background shadow-xs">
                                                                        <AvatarImage src={task.assigneeId.avatar} />
                                                                        <AvatarFallback className={cn("text-[8px] font-bold", getAvatarColor(task.assigneeId.name))}>
                                                                            {getInitials(task.assigneeId.name)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                ) : (
                                                                    <div className="h-6 w-6 rounded-full bg-muted border border-background flex items-center justify-center">
                                                                        <span className="text-[10px] text-muted-foreground">?</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </Kanban.Item>
                                        ))}
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/5 h-10 border-dashed border-2 hover:border-primary/50 text-xs gap-2"
                                            onClick={() => {
                                                setNewTask(prev => ({ ...prev, status: id }));
                                                setIsCreateModalOpen(true);
                                            }}
                                        >
                                            <PlusCircleIcon className="h-3.5 w-3.5" />
                                            Add Task
                                        </Button>
                                    </div>
                                </Kanban.Column>
                            ))}

                            <Button
                                variant="ghost"
                                className="h-[120px] min-w-[320px] border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 rounded-xl gap-2 text-muted-foreground flex flex-col items-center justify-center p-6"
                                onClick={() => setIsManageColumnsModalOpen(true)}
                            >
                                <PlusCircleIcon className="h-6 w-6" />
                                <span className="font-semibold">Add Status Column</span>
                                <span className="text-[10px] opacity-70">Create a new workflow stage</span>
                            </Button>
                        </Kanban.Board>
                        <Kanban.Overlay>
                            <div className="bg-primary/10 size-full rounded-xl border-2 border-primary/30 backdrop-blur-md" />
                        </Kanban.Overlay>
                    </Kanban.Root>
                </div>

                {/* Create Task Modal */}
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create New Task</DialogTitle>
                            <DialogDescription>Add a new work item to the board.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Task Title</Label>
                                <Input
                                    id="title"
                                    placeholder="What needs to be done?"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Add more details about this task..."
                                    value={newTask.description}
                                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
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
                                            <SelectValue />
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
                                        onValueChange={(val) => setNewTask(prev => ({ ...prev, status: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {columnConfig.map(col => (
                                                <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Assign To</Label>
                                <Select
                                    value={newTask.assigneeId || '__unassigned__'}
                                    onValueChange={(val) => setNewTask(prev => ({ ...prev, assigneeId: val === '__unassigned__' ? '' : val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Unassigned" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                        {channelMembers.map(member => (
                                            <SelectItem key={member.id} value={member.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={member.avatar} />
                                                        <AvatarFallback className={cn("text-[8px]", getAvatarColor(member.name))}>
                                                            {getInitials(member.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {member.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>Create Task</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Manage Columns Modal */}
                <Dialog open={isManageColumnsModalOpen} onOpenChange={setIsManageColumnsModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Manage Columns</DialogTitle>
                            <DialogDescription>Add, edit, or remove workflow stages.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {/* Existing Columns */}
                            <div className="space-y-2">
                                <Label>Current Columns</Label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                    {columnConfig.map((col) => (
                                        <div key={col.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                            {editingColumnId === col.id ? (
                                                <>
                                                    <Input
                                                        value={editingColumnTitle}
                                                        onChange={(e) => setEditingColumnTitle(e.target.value)}
                                                        className="flex-1 h-8"
                                                        autoFocus
                                                    />
                                                    <Button size="sm" variant="ghost" onClick={() => {
                                                        handleEditColumn(col.id, editingColumnTitle);
                                                    }}>Save</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => {
                                                        setEditingColumnId(null);
                                                        setEditingColumnTitle("");
                                                    }}>Cancel</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                    <span className="flex-1 font-medium">{col.title}</span>
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {columns[col.id]?.length || 0} tasks
                                                    </Badge>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                                                        setEditingColumnId(col.id);
                                                        setEditingColumnTitle(col.title);
                                                    }}>
                                                        <Settings2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteColumn(col.id)}
                                                        disabled={columns[col.id]?.length > 0}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Add New Column */}
                            <div className="space-y-2 pt-4 border-t">
                                <Label htmlFor="newColTitle">Add New Column</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="newColTitle"
                                        placeholder="e.g. Backlog, Testing..."
                                        value={newColumnTitle}
                                        onChange={(e) => setNewColumnTitle(e.target.value)}
                                    />
                                    <Button onClick={handleAddColumn} disabled={!newColumnTitle.trim()}>Add</Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsManageColumnsModalOpen(false)}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Task Modal */}
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Edit Task</DialogTitle>
                            <DialogDescription>Update task details.</DialogDescription>
                        </DialogHeader>
                        {editingTask && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="editTitle">Title</Label>
                                    <Input
                                        id="editTitle"
                                        value={editingTask.title}
                                        onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editDesc">Description</Label>
                                    <Textarea
                                        id="editDesc"
                                        value={editingTask.description || ''}
                                        onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Priority</Label>
                                        <Select
                                            value={editingTask.priority}
                                            onValueChange={(val: Task['priority']) => setEditingTask({ ...editingTask, priority: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
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
                                            value={editingTask.status}
                                            onValueChange={(val) => setEditingTask({ ...editingTask, status: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {columnConfig.map(col => (
                                                    <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Assign To</Label>
                                    <Select
                                        value={editingTask.assigneeId?._id || '__unassigned__'}
                                        onValueChange={(val) => {
                                            if (val === '__unassigned__') {
                                                setEditingTask({ ...editingTask, assigneeId: undefined });
                                            } else {
                                                const member = channelMembers.find(m => m.id === val);
                                                setEditingTask({
                                                    ...editingTask,
                                                    assigneeId: member ? { _id: member.id, name: member.name, avatar: member.avatar } : undefined
                                                });
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Unassigned" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__unassigned__">Unassigned</SelectItem>
                                            {channelMembers.map(member => (
                                                <SelectItem key={member.id} value={member.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={member.avatar} />
                                                            <AvatarFallback className={cn("text-[8px]", getAvatarColor(member.name))}>
                                                                {getInitials(member.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {member.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}>Cancel</Button>
                            <Button onClick={handleEditTask} disabled={!editingTask?.title.trim()}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
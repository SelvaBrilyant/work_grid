import { create } from "zustand";
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  channelId: string;
  creatorId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  assigneeId?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  dueDate?: string;
  labels: string[];
  order: number;
  createdAt: string;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: (channelId: string) => Promise<void>;
  createTask: (channelId: string, taskData: Partial<Task>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  reorderTasks: (
    tasks: { id: string; status: string; order: number }[]
  ) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async (channelId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/tasks/channel/${channelId}`);
      set({ tasks: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  createTask: async (channelId: string, taskData: Partial<Task>) => {
    try {
      const response = await api.post(`/tasks/channel/${channelId}`, taskData);
      set({ tasks: [...get().tasks, response.data] });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  },

  updateTask: async (taskId: string, updates: Partial<Task>) => {
    // Optimistic update
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.map((t) =>
        t._id === taskId ? { ...t, ...updates } : t
      ),
    });

    try {
      const response = await api.patch(`/tasks/${taskId}`, updates);
      set({
        tasks: get().tasks.map((t) => (t._id === taskId ? response.data : t)),
      });
    } catch (error: unknown) {
      set({
        tasks: previousTasks,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  deleteTask: async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      set({ tasks: get().tasks.filter((t) => t._id !== taskId) });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  },

  reorderTasks: async (
    taskUpdates: { id: string; status: string; order: number }[]
  ) => {
    // Optimistic update
    const previousTasks = get().tasks;
    const newTasks = [...previousTasks];
    taskUpdates.forEach((update) => {
      const task = newTasks.find((t) => t._id === update.id);
      if (task) {
        task.status = update.status as Task["status"];
        task.order = update.order;
      }
    });
    set({ tasks: newTasks.sort((a, b) => a.order - b.order) });

    try {
      await api.post("/tasks/reorder", { tasks: taskUpdates });
    } catch (error: unknown) {
      set({
        tasks: previousTasks,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
}));

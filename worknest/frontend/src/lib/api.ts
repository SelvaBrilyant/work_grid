import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor to add auth token and organization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const subdomain = localStorage.getItem("subdomain");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (subdomain) {
      config.headers["X-Organization-Subdomain"] = subdomain;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Get current path
      const currentPath = window.location.pathname;
      const publicRoutes = ["/login", "/register"];

      // Only clear auth and redirect if we're not already on a public route
      // This prevents redirect loops when fetchUser() fails on protected routes
      if (!publicRoutes.includes(currentPath)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("subdomain");
        // Don't force redirect - let React Router handle it naturally via isAuthenticated state
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: {
    organizationName: string;
    subdomain: string;
    name: string;
    email: string;
    password: string;
  }) => api.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),

  me: () => api.get("/auth/me"),

  invite: (data: { email: string; name: string; role?: string }) =>
    api.post("/auth/invite", data),

  activate: (data: {
    email: string;
    tempPassword: string;
    newPassword: string;
  }) => api.post("/auth/activate", data),
};

// Channels API
export const channelsApi = {
  getAll: () => api.get("/channels"),

  getById: (id: string) => api.get(`/channels/${id}`),

  create: (data: {
    name: string;
    description?: string;
    type: string;
    members?: string[];
  }) => api.post("/channels", data),

  delete: (id: string) => api.delete(`/channels/${id}`),

  addMember: (channelId: string, userId: string) =>
    api.post(`/channels/${channelId}/members`, { userId }),

  removeMember: (channelId: string, userId: string) =>
    api.delete(`/channels/${channelId}/members/${userId}`),

  createDM: (userId: string) => api.post("/channels/dm", { userId }),
};

// Messages API
export const messagesApi = {
  getByChannel: (
    channelId: string,
    params?: { limit?: number; before?: string }
  ) => api.get(`/messages/${channelId}`, { params }),

  send: (
    channelId: string,
    data: { content: string; contentType?: string; replyTo?: string }
  ) => api.post(`/messages/${channelId}`, data),

  update: (id: string, content: string) =>
    api.put(`/messages/${id}`, { content }),

  delete: (id: string) => api.delete(`/messages/${id}`),

  addReaction: (id: string, emoji: string) =>
    api.post(`/messages/${id}/reactions`, { emoji }),
};

// Users API
export const usersApi = {
  getAll: (params?: { status?: string; role?: string; search?: string }) =>
    api.get("/users", { params }),

  getById: (id: string) => api.get(`/users/${id}`),

  update: (
    id: string,
    data: { name?: string; avatar?: string; role?: string; status?: string }
  ) => api.put(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),
};

export default api;

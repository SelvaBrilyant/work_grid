import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";
import { initSocket, disconnectSocket } from "@/lib/socket";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  avatar?: string;
  status?: string;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  plan?: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  subdomain: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSubdomain: (subdomain: string) => void;
  login: (
    email: string,
    password: string
  ) => Promise<{ success?: boolean; redirectUrl?: string } | void>;
  register: (data: {
    organizationName: string;
    subdomain: string;
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  invite: (data: {
    email: string;
    name: string;
    role?: string;
  }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      token: null,
      subdomain: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setSubdomain: (subdomain: string) => {
        localStorage.setItem("subdomain", subdomain);
        set({ subdomain });
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.login({ email, password });

          if (data.success) {
            const { user, organization, token, redirectUrl } = data.data;

            if (redirectUrl) {
              set({ isLoading: false });
              return { redirectUrl };
            }

            localStorage.setItem("token", token);
            localStorage.setItem(
              "subdomain",
              organization?.subdomain || get().subdomain || ""
            );

            // Initialize socket
            initSocket(token);

            set({
              user,
              organization,
              token,
              subdomain: organization?.subdomain || get().subdomain,
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true };
          }
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: string } } };
          set({
            error: err.response?.data?.error || "Login failed",
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const { data: response } = await authApi.register(data);

          if (response.success) {
            const { user, organization, token } = response.data;

            localStorage.setItem("token", token);
            localStorage.setItem("subdomain", organization.subdomain);

            // Initialize socket
            initSocket(token);

            set({
              user,
              organization,
              token,
              subdomain: organization.subdomain,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: string } } };
          set({
            error: err.response?.data?.error || "Registration failed",
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        disconnectSocket();
        localStorage.removeItem("token");
        localStorage.removeItem("subdomain");

        set({
          user: null,
          organization: null,
          token: null,
          subdomain: null,
          isAuthenticated: false,
        });
      },

      fetchUser: async () => {
        const token = localStorage.getItem("token");
        if (!token) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const { data } = await authApi.me();

          if (data.success) {
            const { user, organization } = data.data;

            // Initialize socket if not already
            initSocket(token);

            set({
              user,
              organization,
              token,
              subdomain: organization.subdomain,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch {
          localStorage.removeItem("token");
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      invite: async (data) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.invite(data);
          set({ isLoading: false });
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: string } } };
          set({
            error: err.response?.data?.error || "Invitation failed",
            isLoading: false,
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        subdomain: state.subdomain,
        user: state.user,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // When the store is rehydrated, ensure isAuthenticated is synced with token
        if (state) {
          const token = state.token || localStorage.getItem("token");
          if (token && state.user) {
            // Update localStorage to ensure it's in sync
            localStorage.setItem("token", token);
            if (state.subdomain) {
              localStorage.setItem("subdomain", state.subdomain);
            }
          } else if (!token) {
            // No token, ensure we're logged out
            state.isAuthenticated = false;
            state.user = null;
            state.organization = null;
          }
        }
      },
    }
  )
);

export default useAuthStore;

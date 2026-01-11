import { create } from "zustand";
import { wikiApi } from "@/lib/api";
import { AxiosError } from "axios";

export interface WikiPage {
  _id: string;
  title: string;
  slug: string;
  content: string;
  channelId: string;
  parentId?: string | null;
  order: number;
  lastEditedBy: {
    _id: string;
    name: string;
    avatar?: string;
  };
  updatedAt: string;
}

export interface WikiVersion {
  _id: string;
  content: string;
  authorId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  summary?: string;
  createdAt: string;
}

interface WikiState {
  pages: WikiPage[];
  currentPage: WikiPage | null;
  versions: WikiVersion[];
  isLoading: boolean;
  error: string | null;

  fetchPages: (channelId: string) => Promise<void>;
  fetchPage: (channelId: string, slug: string) => Promise<void>;
  createPage: (
    channelId: string,
    data: { title: string; content?: string; parentId?: string }
  ) => Promise<WikiPage | null>;
  updatePage: (
    channelId: string,
    slug: string,
    data: { title?: string; content?: string; versionSummary?: string }
  ) => Promise<void>;
  deletePage: (channelId: string, slug: string) => Promise<void>;
  fetchVersions: (channelId: string, slug: string) => Promise<void>;
  restoreVersion: (
    channelId: string,
    slug: string,
    versionId: string
  ) => Promise<void>;
  reorderPages: (
    channelId: string,
    pages: { id: string; parentId: string | null; order: number }[]
  ) => Promise<void>;
  setCurrentPage: (page: WikiPage | null) => void;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
};

export const useWikiStore = create<WikiState>((set) => ({
  pages: [],
  currentPage: null,
  versions: [],
  isLoading: false,
  error: null,

  fetchPages: async (channelId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wikiApi.getChannelPages(channelId);
      set({ pages: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  fetchPage: async (channelId: string, slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wikiApi.getPage(channelId, slug);
      set({ currentPage: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  createPage: async (channelId: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wikiApi.createPage(channelId, data);
      const newPage = response.data;
      set((state) => ({
        pages: [...state.pages, newPage],
        currentPage: newPage,
        isLoading: false,
      }));
      return newPage;
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
      return null;
    }
  },

  updatePage: async (channelId: string, slug: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wikiApi.updatePage(channelId, slug, data);
      const updatedPage = response.data;
      set((state) => ({
        pages: state.pages.map((p) => (p.slug === slug ? updatedPage : p)),
        currentPage:
          state.currentPage?.slug === slug ? updatedPage : state.currentPage,
        isLoading: false,
      }));
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  deletePage: async (channelId: string, slug: string) => {
    set({ isLoading: true, error: null });
    try {
      await wikiApi.deletePage(channelId, slug);
      set((state) => ({
        pages: state.pages.filter((p) => p.slug !== slug),
        currentPage:
          state.currentPage?.slug === slug ? null : state.currentPage,
        isLoading: false,
      }));
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  fetchVersions: async (channelId: string, slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wikiApi.getVersions(channelId, slug);
      set({ versions: response.data.versions, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  restoreVersion: async (
    channelId: string,
    slug: string,
    versionId: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await wikiApi.restoreVersion(channelId, slug, versionId);
      set({ currentPage: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  reorderPages: async (channelId: string, pages) => {
    set({ isLoading: true, error: null });
    try {
      await wikiApi.reorderPages(channelId, pages);
      const response = await wikiApi.getChannelPages(channelId);
      set({ pages: response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  setCurrentPage: (page: WikiPage | null) => set({ currentPage: page }),
}));

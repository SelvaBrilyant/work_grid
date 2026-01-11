export type UserRole = "ADMIN" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "INVITED" | "BLOCKED";
export type OrganizationStatus = "ACTIVE" | "SUSPENDED";
export type OrganizationPlan = "FREE" | "PRO" | "ENTERPRISE";

export interface UserSettings {
  preferences: {
    language: string;
    timezone: string;
    theme: "light" | "dark" | "system";
  };
  notifications: {
    messages: boolean;
    mentions: boolean;
    email: boolean;
    desktop: boolean;
    mobile: boolean;
    sound: boolean;
    soundName: string;
    dnd: {
      enabled: boolean;
      start: string;
      end: string;
    };
    keywords: string[];
  };
  privacy: {
    showOnlineStatus: boolean;
    readReceipts: boolean;
    lastSeenVisibility: "everyone" | "contacts" | "none";
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  statusMessage?: string;
  customStatus?: {
    text: string;
    emoji?: string;
    expiresAt?: string;
  };
  profile?: {
    title?: string;
    department?: string;
    phone?: string;
    timezone?: string;
    bio?: string;
  };
  settings?: UserSettings;
  lastSeenAt?: string;
  createdAt?: string;
}

export interface OrganizationSettings {
  general: {
    timezone: string;
    language: string;
  };
  channelPolicies: {
    defaultChannels: string[];
    allowPrivateChannels: boolean;
    messageRetentionDays: number;
  };
  security: {
    passwordPolicy: {
      minLength: number;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
    sessionTimeoutMinutes: number;
  };
  notifications: {
    enableEmailNotifications: boolean;
    defaultPreferences: {
      allMessages: boolean;
      mentionsOnly: boolean;
    };
  };
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  status: OrganizationStatus;
  plan: OrganizationPlan;
  logo?: string;
  settings?: OrganizationSettings;
  createdAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

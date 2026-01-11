import { Request } from "express";

// JWT Payload Interface
export interface JWTPayload {
  userId: string;
  organizationId: string;
  role: "ADMIN" | "EMPLOYEE";
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

// Extended Request with user and organization context
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  organizationId?: string;
  subdomain?: string;
}

// Organization Types
export type OrganizationStatus = "ACTIVE" | "SUSPENDED";
export type OrganizationPlan = "FREE" | "PRO" | "ENTERPRISE";

// User Types
export type UserRole = "ADMIN" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "INVITED" | "BLOCKED";

// Channel Types
export type ChannelType = "PUBLIC" | "PRIVATE" | "DM";
export type ChannelMemberRole = "ADMIN" | "MEMBER";

// Message Types
export type ContentType = "TEXT" | "FILE" | "SYSTEM" | "AUDIO";

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Socket Event Payloads
export interface SendMessagePayload {
  channelId: string;
  content: string;
  contentType?: ContentType;
}

export interface TypingPayload {
  channelId: string;
  userId: string;
  userName: string;
}

export interface JoinChannelPayload {
  channelId: string;
}

export interface PresencePayload {
  userId: string;
  organizationId: string;
  status: "online" | "offline";
}

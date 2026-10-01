// types.ts - Core type definitions

export enum TokenStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  LOCKED = "LOCKED",
  FLAGGED = "FLAGGED",
  PENDING = "PENDING",
}

export enum OperationType {
  CHECK = "CHECK",
  COMPLETE_QUEST = "COMPLETE_QUEST",
  CLAIM_QUEST = "CLAIM_QUEST",
  CHECK_NITRO = "CHECK_NITRO",
}

export enum JobStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  RETRY = "RETRY",
}

export interface ParsedToken {
  email: string;
  password: string;
  token: string;
  hash: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  error?: string;
  format?: ParsedToken;
}

export interface DiscordUser {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  verified: boolean;
  flags: number;
  premium_type: number;
}

export interface DiscordSubscription {
  id: string;
  user_id: string;
  status: number;
  current_period_end: string;
  currency: string;
  price: number;
}

export interface AccountCheckResult {
  status: TokenStatus;
  user?: DiscordUser;
  hasNitro: boolean;
  nitroExpiry?: string;
  nitroBoosts?: number;
  isFlagged: boolean;
  isLocked: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountAge: string;
  error?: string;
}

export interface QuestCheckResult {
  questId: string;
  enrolled: boolean;
  completed: boolean;
  progress?: number;
  error?: string;
}

export interface JobPayload {
  jobId: string;
  tokenHash: string;
  operation: OperationType;
  questId?: string;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  operation: OperationType;
  result?: {
    questId?: string;
    enrolled?: boolean;
    completed?: boolean;
    claimed?: boolean;
  };
  error?: string;
  progress?: number;
  updatedAt: number;
}

export interface RateLimitState {
  lastReset: number;
  requestCount: number;
  blockUntil: number;
}

export interface ValidationGate {
  passed: boolean;
  reason?: string;
  severity: "critical" | "warning" | "info";
}

export interface SecurityCheckResult {
  tokenValid: boolean;
  accountValid: boolean;
  notFlagged: boolean;
  notLocked: boolean;
  belowRateLimit: boolean;
  allChecksPassed: boolean;
  failureReasons: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  timestamp: number;
}

export interface WebSocketMessage {
  type: "progress" | "complete" | "error" | "status";
  jobId: string;
  payload: any;
  timestamp: number;
}

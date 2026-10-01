// lib/errors.ts - Custom error types and handling

export enum ErrorCode {
  // Validation errors
  INVALID_FORMAT = "INVALID_FORMAT",
  INVALID_STRUCTURE = "INVALID_STRUCTURE",
  INVALID_CONTENT = "INVALID_CONTENT",
  
  // Discord API errors
  INVALID_TOKEN = "INVALID_TOKEN",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  ACCOUNT_FLAGGED = "ACCOUNT_FLAGGED",
  RATE_LIMITED = "RATE_LIMITED",
  QUEST_NOT_FOUND = "QUEST_NOT_FOUND",
  
  // Operation errors
  OPERATION_IN_PROGRESS = "OPERATION_IN_PROGRESS",
  EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
  
  // Server errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  QUEUE_ERROR = "QUEUE_ERROR",
}

export class DiscordToolError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "DiscordToolError";
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  statusCode: number = 400,
  details?: Record<string, any>
): DiscordToolError {
  return new DiscordToolError(code, statusCode, message, details);
}

export function isRecoverable(error: Error): boolean {
  if (error instanceof DiscordToolError) {
    // Rate limits and server errors are recoverable
    return (
      error.code === ErrorCode.RATE_LIMITED ||
      error.statusCode >= 500
    );
  }
  return false;
}

export function getErrorMessage(error: Error): string {
  if (error instanceof DiscordToolError) {
    return error.message;
  }
  return error.message || "An unknown error occurred";
}

export function getStatusCode(error: Error): number {
  if (error instanceof DiscordToolError) {
    return error.statusCode;
  }
  return 500;
}

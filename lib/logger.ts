// lib/logger.ts - Logging with token masking

enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  private maskToken(token: string | undefined): string {
    if (!token || typeof token !== "string") return "[INVALID]";
    if (token.length < 8) return "[SHORT]";
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  private maskEmail(email: string | undefined): string {
    if (!email || typeof email !== "string") return "[INVALID]";
    const [name, domain] = email.split("@");
    if (!name || !domain) return "[INVALID]";
    return `${name.substring(0, 2)}***@${domain}`;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    data?: Record<string, any>
  ): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;

    if (data) {
      const masked = { ...data };
      if (masked.token) masked.token = this.maskToken(masked.token);
      if (masked.email) masked.email = this.maskEmail(masked.email);
      if (masked.tokenHash) masked.tokenHash = masked.tokenHash.substring(0, 16) + "...";
      
      formatted += ` ${JSON.stringify(masked)}`;
    }

    return formatted;
  }

  debug(message: string, data?: Record<string, any>): void {
    if (
      [LogLevel.DEBUG].includes(this.level) ||
      process.env.DEBUG === "true"
    ) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: Record<string, any>): void {
    console.log(this.formatMessage(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: Record<string, any>): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, data));
  }

  error(message: string, error?: Error | string, data?: Record<string, any>): void {
    const errorMsg =
      error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const fullMessage = errorMsg ? `${message}: ${errorMsg}` : message;
    console.error(this.formatMessage(LogLevel.ERROR, fullMessage, data));
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger();

// Structured logging for operations
export function logValidation(
  token: string,
  passed: boolean,
  reason?: string
): void {
  if (passed) {
    logger.info("Token validation passed", {
      token: token.substring(0, 20),
    });
  } else {
    logger.warn("Token validation failed", {
      token: token.substring(0, 20),
      reason,
    });
  }
}

export function logOperation(
  jobId: string,
  operation: string,
  status: "start" | "complete" | "error",
  data?: Record<string, any>
): void {
  const message = `Operation ${operation} - ${status.toUpperCase()}`;
  if (status === "error") {
    logger.error(message, undefined, { jobId, ...data });
  } else if (status === "start") {
    logger.info(message, { jobId, ...data });
  } else {
    logger.info(message, { jobId, ...data });
  }
}

export function logRateLimit(
  tokenHash: string,
  remaining: number
): void {
  logger.warn("Rate limit approaching", {
    tokenHash: tokenHash.substring(0, 16),
    remaining,
  });
}

export function logSecurityGate(
  gateName: string,
  passed: boolean,
  reason?: string
): void {
  if (passed) {
    logger.debug(`Security gate passed: ${gateName}`);
  } else {
    logger.warn(`Security gate failed: ${gateName}`, { reason });
  }
}

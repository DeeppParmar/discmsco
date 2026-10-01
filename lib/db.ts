// lib/db.ts - Vercel KV database with encryption

import { kv } from "@vercel/kv";
import crypto from "crypto";
import { AccountCheckResult, JobResult, JobStatus } from "@/types";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-unsafe-key";
const IV_LENGTH = 16;

class DatabaseService {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = crypto
      .createHash("sha256")
      .update(ENCRYPTION_KEY)
      .digest();
  }

  // Encryption/Decryption
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", this.encryptionKey, iv);
    let decrypted = decipher.update(parts[1], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // Token management
  async storeTokenSession(
    tokenHash: string,
    email: string,
    checkResult: AccountCheckResult,
    expiryHours: number = 24
  ): Promise<void> {
    const sessionKey = `session:${tokenHash}`;
    const encryptedEmail = this.encrypt(email);

    const sessionData = {
      tokenHash,
      email: encryptedEmail,
      checkResult,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiryHours * 3600000,
    };

    await kv.setex(
      sessionKey,
      expiryHours * 3600,
      JSON.stringify(sessionData)
    );
  }

  async getTokenSession(
    tokenHash: string
  ): Promise<{ email: string; checkResult: AccountCheckResult } | null> {
    const sessionKey = `session:${tokenHash}`;
    const data = await kv.get<string>(sessionKey);

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      return {
        email: this.decrypt(parsed.email),
        checkResult: parsed.checkResult,
      };
    } catch {
      return null;
    }
  }

  async deleteTokenSession(tokenHash: string): Promise<void> {
    const sessionKey = `session:${tokenHash}`;
    await kv.del(sessionKey);
  }

  // Job management
  async createJob(jobId: string, jobData: any): Promise<void> {
    const jobKey = `job:${jobId}`;
    const jobResult: JobResult = {
      jobId,
      status: JobStatus.PENDING,
      operation: jobData.operation,
      progress: 0,
      updatedAt: Date.now(),
    };

    await kv.setex(jobKey, 86400, JSON.stringify(jobResult)); // 24 hour TTL
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress?: number,
    result?: any,
    error?: string
  ): Promise<void> {
    const jobKey = `job:${jobId}`;
    const existing = await kv.get<string>(jobKey);

    if (existing) {
      const parsed = JSON.parse(existing);
      const updated: JobResult = {
        ...parsed,
        status,
        progress: progress ?? parsed.progress,
        result: result ?? parsed.result,
        error: error ?? parsed.error,
        updatedAt: Date.now(),
      };

      await kv.setex(jobKey, 86400, JSON.stringify(updated));
    }
  }

  async getJobStatus(jobId: string): Promise<JobResult | null> {
    const jobKey = `job:${jobId}`;
    const data = await kv.get<string>(jobKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // Rate limiting
  async checkRateLimit(
    tokenHash: string,
    windowSizeSeconds: number = 60
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `ratelimit:${tokenHash}`;
    const current = await kv.incr(key);

    if (current === 1) {
      await kv.expire(key, windowSizeSeconds);
    }

    const ttl = await kv.ttl(key);
    return {
      allowed: current <= 50, // 50 requests per minute
      remaining: Math.max(0, 50 - current),
    };
  }

  // Account check cache
  async cacheAccountCheck(
    tokenHash: string,
    result: AccountCheckResult,
    cacheDurationHours: number = 1
  ): Promise<void> {
    const cacheKey = `cache:account:${tokenHash}`;
    await kv.setex(
      cacheKey,
      cacheDurationHours * 3600,
      JSON.stringify(result)
    );
  }

  async getAccountCheckCache(tokenHash: string): Promise<AccountCheckResult | null> {
    const cacheKey = `cache:account:${tokenHash}`;
    const data = await kv.get<string>(cacheKey);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // Processing locks (prevent duplicate operations)
  async acquireLock(
    tokenHash: string,
    operation: string,
    durationSeconds: number = 300
  ): Promise<boolean> {
    const lockKey = `lock:${tokenHash}:${operation}`;
    const existing = await kv.get(lockKey);

    if (existing) {
      return false; // Lock already exists
    }

    await kv.setex(lockKey, durationSeconds, "locked");
    return true;
  }

  async releaseLock(tokenHash: string, operation: string): Promise<void> {
    const lockKey = `lock:${tokenHash}:${operation}`;
    await kv.del(lockKey);
  }

  // Statistics
  async recordOperationAttempt(
    operation: string,
    success: boolean
  ): Promise<void> {
    const key = `stats:${operation}:${success ? "success" : "failed"}`;
    await kv.incr(key);
  }

  async getStatistics(): Promise<{
    checksTotal: number;
    checksSuccess: number;
    questsTotal: number;
    questsSuccess: number;
  }> {
    const [checkSuccess, checkFailed, questSuccess, questFailed] =
      await Promise.all([
        kv.get<number>("stats:CHECK:success"),
        kv.get<number>("stats:CHECK:failed"),
        kv.get<number>("stats:COMPLETE_QUEST:success"),
        kv.get<number>("stats:COMPLETE_QUEST:failed"),
      ]);

    return {
      checksTotal: (checkSuccess || 0) + (checkFailed || 0),
      checksSuccess: checkSuccess || 0,
      questsTotal: (questSuccess || 0) + (questFailed || 0),
      questsSuccess: questSuccess || 0,
    };
  }

  // Batch operations
  async storeTokenBatch(
    tokens: Array<{ hash: string; email: string; result: AccountCheckResult }>
  ): Promise<void> {
    const pipeline = kv.pipeline();

    for (const token of tokens) {
      const sessionKey = `session:${token.hash}`;
      const sessionData = {
        tokenHash: token.hash,
        email: this.encrypt(token.email),
        checkResult: token.result,
        createdAt: Date.now(),
      };

      pipeline.setex(sessionKey, 86400, JSON.stringify(sessionData));
    }

    await pipeline.exec();
  }

  // Cleanup
  async cleanupExpiredSessions(): Promise<number> {
    // Vercel KV handles TTL automatically, this is for manual cleanup if needed
    const cursor = "0";
    let cleaned = 0;

    // Note: This would require iterating through keys, which is expensive
    // Vercel KV TTL handles this automatically, so this is a no-op
    return cleaned;
  }
}

export const dbService = new DatabaseService();

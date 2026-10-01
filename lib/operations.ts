// lib/operations.ts - Synchronous operations for Discord Multi-Tool

import { OperationType, JobStatus, AccountCheckResult, TokenStatus } from "@/types";
import { discordService } from "./discord-service";
import { dbService } from "./db";

export async function checkToken(
  jobId: string,
  tokenHash: string,
  token: string,
  email: string
) {
  try {
    // Check cache first
    const cached = await dbService.getAccountCheckCache(tokenHash);

    if (cached) {
      await dbService.updateJobStatus(
        jobId,
        JobStatus.SUCCESS,
        100,
        {
          checkResult: cached,
          source: "cache",
        }
      );
      return { success: true, fromCache: true, checkResult: cached };
    }

    // Get user info
    const user = await discordService.getUser(token);

    // Check if flagged
    const isFlagged = (user.flags & 1048576) === 1048576;

    // Get subscriptions
    let subscriptions: any[] = [];
    try {
      subscriptions = await discordService.getSubscriptions(token);
    } catch {
      subscriptions = [];
    }

    // Get boost slots if has nitro
    let boosts = 0;
    if (subscriptions.length > 0) {
      try {
        boosts = await discordService.getBoostSlots(token);
      } catch {
        boosts = 0;
      }
    }

    // Calculate account age
    const userId = user.id;
    const createdTimestamp =
      ((BigInt(userId) >> 22n) + 1420070400000n) / 1000n;
    const ageMs = Date.now() - Number(createdTimestamp) * 1000;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageMonths = Math.floor(ageDays / 30);
    const ageYears = Math.floor(ageMonths / 12);

    let ageString = "";
    if (ageYears > 0) {
      ageString = `${ageYears} year${ageYears > 1 ? "s" : ""}`;
    } else if (ageMonths > 0) {
      ageString = `${ageMonths} month${ageMonths > 1 ? "s" : ""}`;
    } else {
      ageString = `${ageDays} day${ageDays > 1 ? "s" : ""}`;
    }

    const checkResult: AccountCheckResult = {
      status: isFlagged ? TokenStatus.FLAGGED : TokenStatus.VALID,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        verified: user.verified,
        flags: user.flags,
        premium_type: user.premium_type,
      },
      hasNitro: subscriptions.length > 0,
      nitroExpiry: subscriptions[0]?.current_period_end || undefined,
      nitroBoosts: boosts,
      isFlagged,
      isLocked: false,
      emailVerified: user.verified && !!user.email,
      phoneVerified: !!user.phone,
      accountAge: ageString,
    };

    // Cache result
    await dbService.cacheAccountCheck(tokenHash, checkResult as any, 1);

    // Update job
    await dbService.updateJobStatus(
      jobId,
      JobStatus.SUCCESS,
      100,
      checkResult
    );
    await dbService.recordOperationAttempt("CHECK", true);

    return { success: true, checkResult };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await dbService.updateJobStatus(
      jobId,
      JobStatus.FAILED,
      100,
      undefined,
      errorMessage
    );
    await dbService.recordOperationAttempt("CHECK", false);

    throw error;
  }
}

export async function completeQuest(
  jobId: string,
  tokenHash: string,
  token: string,
  questId: string
) {
  try {
    const lockAcquired = await dbService.acquireLock(
      tokenHash,
      `complete-${questId}`,
      300
    );

    if (!lockAcquired) {
      throw new Error("Operation already in progress for this token");
    }

    try {
      // Enroll quest
      await discordService.enrollQuest(token, questId);

      // Complete quest
      await discordService.completeQuest(token, questId);

      // Update job
      await dbService.updateJobStatus(
        jobId,
        JobStatus.SUCCESS,
        100,
        {
          questId,
          enrolled: true,
          completed: true,
        }
      );
      await dbService.recordOperationAttempt("COMPLETE_QUEST", true);

      return { success: true };
    } finally {
      await dbService.releaseLock(tokenHash, `complete-${questId}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await dbService.updateJobStatus(
      jobId,
      JobStatus.FAILED,
      100,
      undefined,
      errorMessage
    );
    await dbService.recordOperationAttempt("COMPLETE_QUEST", false);

    throw error;
  }
}

export async function claimQuest(
  jobId: string,
  tokenHash: string,
  token: string,
  questId: string
) {
  try {
    const lockAcquired = await dbService.acquireLock(
      tokenHash,
      `claim-${questId}`,
      300
    );

    if (!lockAcquired) {
      throw new Error("Operation already in progress for this token");
    }

    try {
      // Enroll and complete quest
      await discordService.enrollQuest(token, questId);
      await discordService.completeQuest(token, questId);

      // Update job
      await dbService.updateJobStatus(
        jobId,
        JobStatus.SUCCESS,
        100,
        {
          questId,
          enrolled: true,
          completed: true,
          claimed: true,
        }
      );
      await dbService.recordOperationAttempt("CLAIM_QUEST", true);

      return { success: true };
    } finally {
      await dbService.releaseLock(tokenHash, `claim-${questId}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await dbService.updateJobStatus(
      jobId,
      JobStatus.FAILED,
      100,
      undefined,
      errorMessage
    );
    await dbService.recordOperationAttempt("CLAIM_QUEST", false);

    throw error;
  }
}

export async function checkNitro(
  jobId: string,
  tokenHash: string,
  token: string,
  email: string
) {
  try {
    const subscriptions = await discordService.getSubscriptions(token);

    let boosts = 0;
    if (subscriptions.length > 0) {
      try {
        boosts = await discordService.getBoostSlots(token);
      } catch {
        boosts = 0;
      }
    }

    await dbService.updateJobStatus(
      jobId,
      JobStatus.SUCCESS,
      100,
      {
        hasNitro: subscriptions.length > 0,
        subscriptions: subscriptions.map((s: any) => ({
          expires: s.current_period_end,
        })),
        boosts,
      }
    );
    await dbService.recordOperationAttempt("CHECK_NITRO", true);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await dbService.updateJobStatus(
      jobId,
      JobStatus.FAILED,
      100,
      undefined,
      errorMessage
    );
    await dbService.recordOperationAttempt("CHECK_NITRO", false);

    throw error;
  }
}

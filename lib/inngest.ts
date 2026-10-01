// lib/inngest.ts - Inngest job queue setup

import { Inngest, EventSchemas } from "inngest";
import { OperationType, JobStatus } from "@/types";
import { discordService } from "./discord-service";
import { dbService } from "./db";

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || "invalid";

type Events = {
  "discord/check.token": {
    data: {
      jobId: string;
      tokenHash: string;
      token: string;
      email: string;
    };
  };
  "discord/complete.quest": {
    data: {
      jobId: string;
      tokenHash: string;
      token: string;
      questId: string;
    };
  };
  "discord/claim.quest": {
    data: {
      jobId: string;
      tokenHash: string;
      token: string;
      questId: string;
    };
  };
  "discord/check.nitro": {
    data: {
      jobId: string;
      tokenHash: string;
      token: string;
      email: string;
    };
  };
};

export const inngest = new Inngest<EventSchemas<Events>>({
  id: "discord-tools",
  eventKey: INNGEST_EVENT_KEY,
  baseUrl: process.env.INNGEST_BASE_URL,
});

// Check Token Handler
export const checkTokenHandler = inngest.createFunction(
  {
    id: "check-token",
    retryPolicy: {
      initialDelayMs: 1000,
      maxAttempts: 3,
      multiplier: 1.5,
    },
  },
  { event: "discord/check.token" },
  async ({ event, step }) => {
    const { jobId, tokenHash, token, email } = event.data;

    try {
      // Check cache first
      const cached = await step.run("check-cache", async () => {
        return await dbService.getAccountCheckCache(tokenHash);
      });

      if (cached) {
        await step.run("update-job-cached", async () => {
          await dbService.updateJobStatus(
            jobId,
            JobStatus.SUCCESS,
            100,
            {
              checkResult: cached,
              source: "cache",
            }
          );
        });

        return { success: true, fromCache: true };
      }

      // Get user info
      const user = await step.run("get-user", async () => {
        return await discordService.getUser(token);
      });

      // Check if flagged
      const isFlagged = (user.flags & 1048576) === 1048576;

      // Get subscriptions
      const subscriptions = await step.run("get-subscriptions", async () => {
        try {
          return await discordService.getSubscriptions(token);
        } catch {
          return [];
        }
      });

      // Get boost slots if has nitro
      let boosts = 0;
      if (subscriptions.length > 0) {
        boosts = await step.run("get-boosts", async () => {
          try {
            return await discordService.getBoostSlots(token);
          } catch {
            return 0;
          }
        });
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

      const checkResult = {
        status: isFlagged ? "FLAGGED" : user.verified ? "VALID" : "VALID",
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
      await step.run("cache-result", async () => {
        await dbService.cacheAccountCheck(tokenHash, checkResult as any, 1);
      });

      // Update job
      await step.run("update-job", async () => {
        await dbService.updateJobStatus(
          jobId,
          JobStatus.SUCCESS,
          100,
          checkResult
        );
        await dbService.recordOperationAttempt("CHECK", true);
      });

      return { success: true, checkResult };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Determine if token is invalid
      const isInvalidToken =
        errorMessage.includes("Invalid token") ||
        errorMessage.includes("401");
      const isLockedAccount =
        errorMessage.includes("locked") ||
        errorMessage.includes("403");

      await step.run("update-job-error", async () => {
        await dbService.updateJobStatus(
          jobId,
          JobStatus.FAILED,
          100,
          undefined,
          errorMessage
        );
        await dbService.recordOperationAttempt("CHECK", false);
      });

      throw error;
    }
  }
);

// Complete Quest Handler
export const completeQuestHandler = inngest.createFunction(
  {
    id: "complete-quest",
    retryPolicy: {
      initialDelayMs: 2000,
      maxAttempts: 2,
      multiplier: 2,
    },
  },
  { event: "discord/complete.quest" },
  async ({ event, step }) => {
    const { jobId, tokenHash, token, questId } = event.data;

    try {
      // Acquire lock to prevent duplicate operations
      const lockAcquired = await step.run("acquire-lock", async () => {
        return await dbService.acquireLock(
          tokenHash,
          `complete-${questId}`,
          300
        );
      });

      if (!lockAcquired) {
        throw new Error("Operation already in progress for this token");
      }

      try {
        // Enroll quest
        await step.run("enroll-quest", async () => {
          await discordService.enrollQuest(token, questId);
        });

        // Complete quest
        await step.run("complete-quest-step", async () => {
          await discordService.completeQuest(token, questId);
        });

        // Update job
        await step.run("update-job", async () => {
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
        });

        return { success: true };
      } finally {
        await step.run("release-lock", async () => {
          await dbService.releaseLock(tokenHash, `complete-${questId}`);
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await step.run("update-job-error", async () => {
        await dbService.updateJobStatus(
          jobId,
          JobStatus.FAILED,
          100,
          undefined,
          errorMessage
        );
        await dbService.recordOperationAttempt("COMPLETE_QUEST", false);
      });

      throw error;
    }
  }
);

// Claim Quest Handler
export const claimQuestHandler = inngest.createFunction(
  {
    id: "claim-quest",
    retryPolicy: {
      initialDelayMs: 1000,
      maxAttempts: 2,
      multiplier: 2,
    },
  },
  { event: "discord/claim.quest" },
  async ({ event, step }) => {
    const { jobId, tokenHash, token, questId } = event.data;

    try {
      const lockAcquired = await step.run("acquire-lock", async () => {
        return await dbService.acquireLock(
          tokenHash,
          `claim-${questId}`,
          300
        );
      });

      if (!lockAcquired) {
        throw new Error("Operation already in progress for this token");
      }

      try {
        // Enroll and complete quest
        await step.run("claim-quest-step", async () => {
          await discordService.enrollQuest(token, questId);
          await discordService.completeQuest(token, questId);
        });

        // Update job
        await step.run("update-job", async () => {
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
        });

        return { success: true };
      } finally {
        await step.run("release-lock", async () => {
          await dbService.releaseLock(tokenHash, `claim-${questId}`);
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await step.run("update-job-error", async () => {
        await dbService.updateJobStatus(
          jobId,
          JobStatus.FAILED,
          100,
          undefined,
          errorMessage
        );
        await dbService.recordOperationAttempt("CLAIM_QUEST", false);
      });

      throw error;
    }
  }
);

// Check Nitro Handler
export const checkNitroHandler = inngest.createFunction(
  {
    id: "check-nitro",
    retryPolicy: {
      initialDelayMs: 1000,
      maxAttempts: 3,
      multiplier: 1.5,
    },
  },
  { event: "discord/check.nitro" },
  async ({ event, step }) => {
    const { jobId, tokenHash, token, email } = event.data;

    try {
      const subscriptions = await step.run("get-subscriptions", async () => {
        return await discordService.getSubscriptions(token);
      });

      let boosts = 0;
      if (subscriptions.length > 0) {
        boosts = await step.run("get-boosts", async () => {
          try {
            return await discordService.getBoostSlots(token);
          } catch {
            return 0;
          }
        });
      }

      await step.run("update-job", async () => {
        await dbService.updateJobStatus(
          jobId,
          JobStatus.SUCCESS,
          100,
          {
            hasNitro: subscriptions.length > 0,
            subscriptions: subscriptions.map((s) => ({
              expires: s.current_period_end,
            })),
            boosts,
          }
        );
        await dbService.recordOperationAttempt("CHECK_NITRO", true);
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await step.run("update-job-error", async () => {
        await dbService.updateJobStatus(
          jobId,
          JobStatus.FAILED,
          100,
          undefined,
          errorMessage
        );
        await dbService.recordOperationAttempt("CHECK_NITRO", false);
      });

      throw error;
    }
  }
);

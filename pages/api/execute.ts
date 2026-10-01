// pages/api/execute.ts - Execute operation endpoint

import type { NextApiRequest, NextApiResponse } from "next";
import { dbService } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { OperationType, ApiResponse } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface ExecuteRequest {
  tokenHash: string;
  operation: OperationType;
  questId?: string;
  token: string;
  email: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      statusCode: 405,
      timestamp: Date.now(),
    });
  }

  const { tokenHash, operation, questId, token, email } = req.body as ExecuteRequest;

  // Validation
  if (!tokenHash || typeof tokenHash !== "string") {
    return res.status(400).json({
      success: false,
      error: "tokenHash is required",
      statusCode: 400,
      timestamp: Date.now(),
    });
  }

  if (!operation || !Object.values(OperationType).includes(operation)) {
    return res.status(400).json({
      success: false,
      error: "Invalid operation type",
      statusCode: 400,
      timestamp: Date.now(),
    });
  }

  if (!token || typeof token !== "string") {
    return res.status(400).json({
      success: false,
      error: "Token is required",
      statusCode: 400,
      timestamp: Date.now(),
    });
  }

  try {
    // Gate 1: Check rate limit
    const rateLimitCheck = await dbService.checkRateLimit(tokenHash, 60);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Rate limited. ${rateLimitCheck.remaining} operations remaining this minute`,
        statusCode: 429,
        timestamp: Date.now(),
      });
    }

    // Gate 2: Get cached account check result
    const session = await dbService.getTokenSession(tokenHash);
    if (!session) {
      return res.status(400).json({
        success: false,
        error:
          "Token not validated. Please validate token first",
        statusCode: 400,
        timestamp: Date.now(),
      });
    }

    const accountCheck = session.checkResult;

    // Gate 3: Check if account is valid for operations
    if (accountCheck.isLocked) {
      return res.status(403).json({
        success: false,
        error: "Account is locked. Cannot perform operations",
        statusCode: 403,
        timestamp: Date.now(),
      });
    }

    if (accountCheck.isFlagged) {
      return res.status(403).json({
        success: false,
        error: "Account is flagged. Cannot perform operations",
        statusCode: 403,
        timestamp: Date.now(),
      });
    }

    // Gate 4: Prevent quest operations on unverified accounts
    if (
      (operation === OperationType.COMPLETE_QUEST ||
        operation === OperationType.CLAIM_QUEST) &&
      !accountCheck.emailVerified
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Account email not verified. Quest operations require verified email",
        statusCode: 403,
        timestamp: Date.now(),
      });
    }

    // Gate 5: Validate quest ID if provided
    if (
      (operation === OperationType.COMPLETE_QUEST ||
        operation === OperationType.CLAIM_QUEST) &&
      (!questId || typeof questId !== "string")
    ) {
      return res.status(400).json({
        success: false,
        error: "questId is required for quest operations",
        statusCode: 400,
        timestamp: Date.now(),
      });
    }

    const jobId = uuidv4();

    // Create job
    await dbService.createJob(jobId, {
      operation,
    });

    // Queue operation based on type
    if (operation === OperationType.CHECK) {
      await inngest.send({
        name: "discord/check.token",
        data: {
          jobId,
          tokenHash,
          token,
          email,
        },
      });
    } else if (operation === OperationType.COMPLETE_QUEST) {
      await inngest.send({
        name: "discord/complete.quest",
        data: {
          jobId,
          tokenHash,
          token,
          questId: questId!,
        },
      });
    } else if (operation === OperationType.CLAIM_QUEST) {
      await inngest.send({
        name: "discord/claim.quest",
        data: {
          jobId,
          tokenHash,
          token,
          questId: questId!,
        },
      });
    } else if (operation === OperationType.CHECK_NITRO) {
      await inngest.send({
        name: "discord/check.nitro",
        data: {
          jobId,
          tokenHash,
          token,
          email,
        },
      });
    }

    return res.status(202).json({
      success: true,
      data: {
        jobId,
        operation,
        status: "pending",
      },
      statusCode: 202,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[EXECUTE_ERROR]", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error",
      statusCode: 500,
      timestamp: Date.now(),
    });
  }
}

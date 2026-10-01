// pages/api/execute.ts - Execute operation endpoint

import type { NextApiRequest, NextApiResponse } from "next";
import { dbService } from "@/lib/db";
import { checkToken, completeQuest, claimQuest, checkNitro } from "@/lib/operations";
import { OperationType, ApiResponse } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Quest completion takes ~30-60+ real seconds due to real-time video simulation
// Increase API route timeout to 5 minutes
export const config = {
  api: {
    responseLimit: false,
    bodyParser: true,
  },
  maxDuration: 300,
};

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
    const rateLimitCheck = await dbService.checkRateLimit(tokenHash, 60);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Rate limited. ${rateLimitCheck.remaining} operations remaining this minute`,
        statusCode: 429,
        timestamp: Date.now(),
      });
    }

    const session = await dbService.getTokenSession(tokenHash);
    if (!session) {
      return res.status(400).json({
        success: false,
        error: "Token not validated. Please validate token first",
        statusCode: 400,
        timestamp: Date.now(),
      });
    }

    const accountCheck = session.checkResult;

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

    if (
      (operation === OperationType.COMPLETE_QUEST ||
        operation === OperationType.CLAIM_QUEST) &&
      !accountCheck.emailVerified
    ) {
      return res.status(403).json({
        success: false,
        error: "Account email not verified. Quest operations require verified email",
        statusCode: 403,
        timestamp: Date.now(),
      });
    }

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

    await dbService.createJob(jobId, {
      operation,
    });

    try {
      if (operation === OperationType.CHECK) {
        await checkToken(jobId, tokenHash, token, email);
      } else if (operation === OperationType.COMPLETE_QUEST) {
        await completeQuest(jobId, tokenHash, token, questId!);
      } else if (operation === OperationType.CLAIM_QUEST) {
        await claimQuest(jobId, tokenHash, token, questId!);
      } else if (operation === OperationType.CHECK_NITRO) {
        await checkNitro(jobId, tokenHash, token, email);
      }
    } catch (e) {
      // Job is already marked as FAILED in DB. We return 200 so the frontend 
      // polling logic can gracefully pick up the failed status.
      return res.status(200).json({
        success: true,
        data: {
          jobId,
          operation,
          status: "error",
          error: e instanceof Error ? e.message : "Operation failed",
        },
        statusCode: 200,
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        operation,
        status: "success",
      },
      statusCode: 200,
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

// pages/api/validate.ts - Token validation endpoint

import type { NextApiRequest, NextApiResponse } from "next";
import { validateToken } from "@/lib/validation";
import { dbService } from "@/lib/db";
import { checkToken } from "@/lib/operations";
import {
  TokenStatus,
  AccountCheckResult,
  ApiResponse,
} from "@/types";
import { v4 as uuidv4 } from "uuid";

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

  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string") {
    return res.status(400).json({
      success: false,
      error: "Token is required",
      statusCode: 400,
      timestamp: Date.now(),
    });
  }

  try {
    const validationResult = validateToken(token);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: validationResult.error,
        statusCode: 400,
        timestamp: Date.now(),
      });
    }

    const parsedToken = validationResult.format!;
    const jobId = uuidv4();

    const rateLimitCheck = await dbService.checkRateLimit(parsedToken.hash);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Rate limited. ${rateLimitCheck.remaining} requests remaining this minute`,
        statusCode: 429,
        timestamp: Date.now(),
      });
    }

    const cached = await dbService.getAccountCheckCache(parsedToken.hash);
    if (cached) {
      await dbService.storeTokenSession(
        parsedToken.hash,
        parsedToken.email,
        cached
      );

      return res.status(200).json({
        success: true,
        data: {
          jobId,
          tokenHash: parsedToken.hash,
          cached: true,
          result: cached,
        },
        statusCode: 200,
        timestamp: Date.now(),
      });
    }

    await dbService.createJob(jobId, {
      operation: "CHECK",
    });

    const pendingResult: AccountCheckResult = {
      status: TokenStatus.PENDING,
      hasAvatar: false,
      hasNitro: false,
      isFlagged: false,
      isLocked: false,
      emailVerified: false,
      phoneVerified: false,
      accountAge: "unknown",
    };

    await dbService.storeTokenSession(
      parsedToken.hash,
      parsedToken.email,
      pendingResult
    );

    let result: any = null;
    try {
      result = await checkToken(jobId, parsedToken.hash, parsedToken.token, parsedToken.email);
    } catch (e) {
      // Job is already marked as FAILED in DB. We return 200 so the frontend 
      // polling logic can gracefully pick up the failed status.
      return res.status(200).json({
        success: true,
        data: {
          jobId,
          tokenHash: parsedToken.hash,
          status: "error",
        },
        statusCode: 200,
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        tokenHash: parsedToken.hash,
        status: "ready",
        result: result?.checkResult
      },
      statusCode: 200,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[VALIDATE_ERROR]", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error",
      statusCode: 500,
      timestamp: Date.now(),
    });
  }
}

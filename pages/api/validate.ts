// pages/api/validate.ts - Token validation endpoint

import type { NextApiRequest, NextApiResponse } from "next";
import { validateToken } from "@/lib/validation";
import { discordService } from "@/lib/discord-service";
import { dbService } from "@/lib/db";
import { inngest } from "@/lib/inngest";
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

  // Validation: Check if token is provided
  if (!token || typeof token !== "string") {
    return res.status(400).json({
      success: false,
      error: "Token is required",
      statusCode: 400,
      timestamp: Date.now(),
    });
  }

  try {
    // Gate 1: Format validation
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

    // Gate 2: Rate limit check
    const rateLimitCheck = await dbService.checkRateLimit(parsedToken.hash);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Rate limited. ${rateLimitCheck.remaining} requests remaining this minute`,
        statusCode: 429,
        timestamp: Date.now(),
      });
    }

    // Gate 3: Check cache first
    const cached = await dbService.getAccountCheckCache(parsedToken.hash);
    if (cached) {
      // Store session with cached result
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

    // Gate 4: Create job and queue check
    await dbService.createJob(jobId, {
      operation: "CHECK",
    });

    // Queue the check operation
    await inngest.send({
      name: "discord/check.token",
      data: {
        jobId,
        tokenHash: parsedToken.hash,
        token: parsedToken.token,
        email: parsedToken.email,
      },
    });

    // Store session immediately
    const pendingResult: AccountCheckResult = {
      status: TokenStatus.PENDING,
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

    return res.status(202).json({
      success: true,
      data: {
        jobId,
        tokenHash: parsedToken.hash,
        status: "pending",
      },
      statusCode: 202,
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

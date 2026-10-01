// pages/api/status.ts - Job status endpoint

import type { NextApiRequest, NextApiResponse } from "next";
import { dbService } from "@/lib/db";
import { ApiResponse } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
      statusCode: 405,
      timestamp: Date.now(),
    });
  }

  const { jobId } = req.query as { jobId?: string };

  // Validation
  if (!jobId || typeof jobId !== "string") {
    return res.status(400).json({
      success: false,
      error: "jobId is required",
      statusCode: 400,
      timestamp: Date.now(),
    });
  }

  try {
    const jobStatus = await dbService.getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
        statusCode: 404,
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      success: true,
      data: jobStatus,
      statusCode: 200,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[STATUS_ERROR]", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Internal server error",
      statusCode: 500,
      timestamp: Date.now(),
    });
  }
}

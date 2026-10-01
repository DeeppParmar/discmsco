// pages/api/quests.ts - Fetch available quests for a token

import type { NextApiRequest, NextApiResponse } from "next";
import { discordService } from "@/lib/discord-service";
import { ApiResponse } from "@/types";

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
    const quests = await discordService.getQuests(token);
    const now = new Date();

    // Map quests to a clean format - handle various Discord response structures
    const mapped = quests.map((q: any) => {
      // Extract quest ID from various possible locations
      const id = q.id || q.quest_id || q.config?.id || "";

      // Extract name - try multiple paths
      const name = q.config?.quest_bar_config?.quest_name
        || q.config?.messages?.quest_name
        || q.config?.name
        || q.quest_title
        || q.name
        || q.config?.quest_bar_config?.game_title
        || `Quest ${id}`;

      // Extract description
      const description = q.config?.quest_bar_config?.quest_description
        || q.config?.messages?.quest_description
        || q.config?.description
        || q.quest_description
        || q.description
        || "";

      // Extract game name
      const gameName = q.config?.quest_bar_config?.game_title
        || q.config?.application_name
        || q.config?.game_title
        || q.game_title
        || "";

      // Check completion status
      const enrolled = !!(q.user_status?.enrolled_at);
      const completed = !!(q.user_status?.completed_at);
      const claimed = !!(q.user_status?.claimed_at);

      // Expiry — check multiple paths
      const expiresAt = q.config?.expires_at || q.expires_at || null;

      // Start date
      const startsAt = q.config?.starts_at || q.starts_at || null;

      // Check if quest is currently active (not expired and has started)
      let isExpired = false;
      if (expiresAt) {
        const expiryDate = new Date(expiresAt);
        isExpired = expiryDate < now;
      }

      let hasStarted = true;
      if (startsAt) {
        const startDate = new Date(startsAt);
        hasStarted = startDate <= now;
      }

      // Identify quest type (Video vs Gameplay)
      const configStr = JSON.stringify(q.config || {});
      const isVideo = configStr.includes("WATCH_VIDEO") || !!q.config?.assets?.hero_video || !!q.config?.assets?.quest_bar_hero_video;
      const questType = isVideo ? "video" : "play";

      // Check if quest is targetted/available to user
      // Discord returns quests with a `target_completed` field for unavailable ones
      const isTargetCompleted = q.target_completed === true;

      return {
        id,
        name,
        description,
        gameName,
        enrolled,
        completed,
        claimed,
        expiresAt,
        isExpired,
        hasStarted,
        isTargetCompleted,
        questType,
      };
    })
    // FILTER: Only show quests the user can actually interact with
    .filter((q: any) => {
      // Must have a valid ID
      if (!q.id) return false;
      // Must not be expired
      if (q.isExpired) return false;
      // Must have started
      if (!q.hasStarted) return false;
      // Must not be a target-completed quest (already fully done on Discord's side)
      if (q.isTargetCompleted) return false;
      return true;
    });

    return res.status(200).json({
      success: true,
      data: {
        quests: mapped,
        rawCount: quests.length,
        filteredCount: mapped.length,
      },
      statusCode: 200,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[QUESTS_ERROR]", error);
    return res.status(200).json({
      success: true,
      data: {
        quests: [],
        error: error instanceof Error ? error.message : "Failed to fetch quests",
      },
      statusCode: 200,
      timestamp: Date.now(),
    });
  }
}

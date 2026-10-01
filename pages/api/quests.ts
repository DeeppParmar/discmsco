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

    // Map quests to a clean format
    const mapped = quests.map((q: any) => ({
      id: q.id || q.quest_id,
      name: q.config?.quest_bar_config?.quest_name
        || q.config?.name
        || q.quest_title
        || q.name
        || `Quest ${q.id || q.quest_id}`,
      description: q.config?.quest_bar_config?.quest_description
        || q.config?.description
        || q.quest_description
        || "",
      gameName: q.config?.quest_bar_config?.game_title
        || q.config?.game_title
        || q.game_title
        || "",
      enrolled: !!q.user_status?.enrolled_at,
      completed: !!q.user_status?.completed_at,
      claimed: !!q.user_status?.claimed_at,
      expiresAt: q.config?.expires_at || q.expires_at || null,
      rewardCode: q.user_status?.claimed_at ? true : false,
    }));

    return res.status(200).json({
      success: true,
      data: { quests: mapped },
      statusCode: 200,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[QUESTS_ERROR]", error);
    return res.status(200).json({
      success: true,
      data: { quests: [], error: error instanceof Error ? error.message : "Failed to fetch quests" },
      statusCode: 200,
      timestamp: Date.now(),
    });
  }
}

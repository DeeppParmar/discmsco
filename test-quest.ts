import { discordService } from "./lib/discord-service";

async function testPlayQuest() {
  const token = "MTU0NTczOTY0MDY1NTU3NzE1NQ.GvszQs.0fGTa-JDCqJynDkMKraPdDp0EzxsRVYeBhx5-c";
  const questId = "1550081499628441600"; // War Thunder
  const appId = "357607478105604096";

  const session = await discordService.createSession(token);
  
  // Enroll first
  console.log("Enrolling...");
  await discordService.enrollQuest(token, questId).catch(console.error);

  console.log("Sending heartbeat...");
  // POST /quests/{quest.id}/heartbeat
  const payload = {
    application_id: appId,
    session_id: "test-session-" + Date.now(),
    terminal: false
  };

  const response = await session.post(`https://discord.com/api/v9/quests/${questId}/heartbeat`, { json: payload, headers: session.headers });
  console.log(response.status_code);
  console.log(await response.text());
}

testPlayQuest().catch(console.error);

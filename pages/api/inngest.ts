// pages/api/inngest.ts - Inngest serve endpoint

import { serve } from "inngest/next";
import {
  inngest,
  checkTokenHandler,
  completeQuestHandler,
  claimQuestHandler,
  checkNitroHandler,
} from "@/lib/inngest";

export default serve({
  client: inngest,
  functions: [
    checkTokenHandler,
    completeQuestHandler,
    claimQuestHandler,
    checkNitroHandler,
  ],
});

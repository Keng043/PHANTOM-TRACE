import { z } from "zod";

export const InteractionSignalSchema = z.object({
  clientEventId: z.string().uuid(),
  signal: z.enum([
    "DECISION_CHANGE", "DECISION_SUBMIT", "LINK_CLICK",
    "SCROLL_25", "SCROLL_50", "SCROLL_75", "SCROLL_100",
    "TAB_HIDDEN", "TAB_VISIBLE", "IDLE_30S", "RETURNED",
  ]),
  elapsedBucket: z.enum(["LT_1S", "1_3S", "3_10S", "10_30S", "30_60S", "GT_60S"]),
}).strict();

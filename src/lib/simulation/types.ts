import type { z } from "zod";
import type { TrackingEventSchema } from "@/lib/validation/tracking";
export type TrackingEventPayload = z.infer<typeof TrackingEventSchema>;

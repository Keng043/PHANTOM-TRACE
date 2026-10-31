import { z } from "zod";

export const EVENT_TYPES = [
  "PAGE_VIEW",
  "CONSENT_GRANTED",
  "CONSENT_DECLINED",
  "DEMO_FORM_SUBMITTED",
  "LINK_CLICKED",
  "REPORT_SUBMITTED",
  "EDUCATION_VIEWED",
  "DEVICE_PROFILE_RECORDED",
  "SESSION_ENDED",
] as const;

const METADATA_KEYS = ["interactionType"] as const;
const allowedMetadataKeys = new Set<string>(METADATA_KEYS);
const metadataValue = z.union([z.string().trim().max(80), z.number().finite(), z.boolean()]);

export const EventPayloadSchema = z.object({
  clientEventId: z.string().uuid().optional(),
  type: z.enum(["PAGE_VIEW", "DEMO_FORM_SUBMITTED", "LINK_CLICKED", "REPORT_SUBMITTED", "EDUCATION_VIEWED"]),
  path: z.string().trim().min(1).max(120).startsWith("/").refine(
    (value) => !value.includes("?") && !value.includes("#") && !value.includes(".."),
    "Invalid event path",
  ),
  metadata: z.record(z.string(), metadataValue).refine(
    (value) => Object.keys(value).length <= METADATA_KEYS.length &&
      Object.keys(value).every((key) => allowedMetadataKeys.has(key)),
    "Metadata contains unsupported fields",
  ).optional(),
}).strict();

export type EventPayload = z.infer<typeof EventPayloadSchema>;

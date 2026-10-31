import { z } from "zod";

const safeLabel = z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._/ -]+$/);

export const DeviceProfileSchema = z.object({
  browserFamily: z.enum(["Chrome", "Edge", "Firefox", "Safari", "Other"]),
  osFamily: z.enum(["Windows", "macOS", "Linux", "Android", "iOS", "Other"]),
  deviceType: z.enum(["Desktop", "Mobile", "Tablet", "Other"]),
  screenClass: z.enum(["Small", "Medium", "Large"]),
  locale: safeLabel,
  timezone: safeLabel,
}).strict();

export const HeartbeatSchema = z.object({
  visible: z.literal(true),
}).strict();

export const TrackingEventSchema = z.object({
  clientEventId: z.string().uuid().optional(),
  type: z.enum(["PAGE_VIEW", "DEMO_FORM_SUBMITTED", "LINK_CLICKED", "REPORT_SUBMITTED", "EDUCATION_VIEWED"]),
  path: z.string().trim().min(1).max(120).startsWith("/").refine(
    (value) => !value.includes("?") && !value.includes("#") && !value.includes(".."),
    "Path must not contain query strings, fragments, or traversal segments",
  ),
  metadata: z.record(z.string(), z.union([z.string().trim().max(80), z.number().finite(), z.boolean()])).refine(
    (value) => Object.keys(value).length <= 1 && Object.keys(value).every((key) => key === "interactionType"),
    "Only the interaction type may be recorded",
  ).optional(),
}).strict();

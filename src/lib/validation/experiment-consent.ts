import { z } from "zod";

export const EXPERIMENT_CAPABILITIES = [
  "NOTIFICATION",
  "SCREEN_SHARING",
  "INTERACTION_TRACKING",
  "REMOTE_SUPPORT",
  "CAMERA",
] as const;

export const ExperimentConsentSchema = z.object({
  accepted: z.literal(true),
  policyVersion: z.string().trim().min(1).max(40),
  capabilities: z.array(z.enum(EXPERIMENT_CAPABILITIES)).max(EXPERIMENT_CAPABILITIES.length)
    .refine((values) => new Set(values).size === values.length, "Duplicate capabilities are not allowed."),
}).strict();

export const RevokeCapabilitySchema = z.object({
  capability: z.enum(EXPERIMENT_CAPABILITIES),
}).strict();

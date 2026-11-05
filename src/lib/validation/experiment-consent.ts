import { z } from "zod";

export const EXPERIMENT_CAPABILITIES = [
  "NOTIFICATION",
  "SCREEN_SHARING",
  "INTERACTION_TRACKING",
  "REMOTE_SUPPORT",
  "CAMERA",
] as const;

export const APPROVED_DATA_FIELDS = [
  "USAGE_EVENTS",
  "INTERACTION_SIGNALS",
  "COARSE_DEVICE_PROFILE",
  "PERMISSION_OUTCOMES",
] as const;

export const ExperimentConsentSchema = z.object({
  accepted: z.literal(true),
  policyVersion: z.string().trim().min(1).max(40),
  capabilities: z.array(z.enum(EXPERIMENT_CAPABILITIES)).max(EXPERIMENT_CAPABILITIES.length)
    .refine((values) => new Set(values).size === values.length, "Duplicate capabilities are not allowed."),
  approvedDataFields: z.array(z.enum(APPROVED_DATA_FIELDS)).max(APPROVED_DATA_FIELDS.length)
    .refine((values) => new Set(values).size === values.length, "Duplicate data fields are not allowed."),
}).strict();

export const RevokeCapabilitySchema = z.object({
  capability: z.enum(EXPERIMENT_CAPABILITIES),
}).strict();

export const RevokeDataFieldSchema = z.object({
  dataField: z.enum(APPROVED_DATA_FIELDS),
}).strict();

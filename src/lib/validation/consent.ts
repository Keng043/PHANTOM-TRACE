import { z } from "zod";
import { POLICY_VERSION } from "../security/consent";
export const ConsentRequestSchema = z.object({
  accepted: z.literal(true),
  policyVersion: z.literal(POLICY_VERSION),
}).strict();

import { describe, expect, it } from "vitest";
import { ExperimentConsentSchema, RevokeCapabilitySchema } from "../src/lib/validation/experiment-consent";

const policyVersion = "2026-10-31-v3";

describe("granular experiment consent", () => {
  it("accepts voluntary participation with any optional capability subset", () => {
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: [] }).success).toBe(true);
    expect(ExperimentConsentSchema.safeParse({
      accepted: true, policyVersion,
      capabilities: ["NOTIFICATION", "SCREEN_SHARING", "INTERACTION_TRACKING", "REMOTE_SUPPORT", "CAMERA"],
    }).success).toBe(true);
  });

  it("requires explicit overall consent and rejects unknown or duplicate capabilities", () => {
    expect(ExperimentConsentSchema.safeParse({ accepted: false, policyVersion, capabilities: [] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: ["FILE_ACCESS"] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: ["CAMERA", "CAMERA"] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: [], extra: true }).success).toBe(false);
  });

  it("validates revocation for a single known capability only", () => {
    expect(RevokeCapabilitySchema.safeParse({ capability: "SCREEN_SHARING" }).success).toBe(true);
    expect(RevokeCapabilitySchema.safeParse({ capability: "REMOTE_SHELL" }).success).toBe(false);
    expect(RevokeCapabilitySchema.safeParse({ capability: "CAMERA", granted: true }).success).toBe(false);
  });
});

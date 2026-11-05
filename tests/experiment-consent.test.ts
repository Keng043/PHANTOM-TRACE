import { describe, expect, it } from "vitest";
import {
  APPROVED_DATA_FIELDS,
  ExperimentConsentSchema,
  RevokeCapabilitySchema,
  RevokeDataFieldSchema,
} from "../src/lib/validation/experiment-consent";

const policyVersion = "2026-11-05-v5";

describe("granular experiment and data consent", () => {
  it("accepts volunteer participation with any subset of optional activities and data categories", () => {
    expect(ExperimentConsentSchema.safeParse({
      accepted: true, policyVersion, capabilities: [], approvedDataFields: [],
    }).success).toBe(true);
    expect(ExperimentConsentSchema.safeParse({
      accepted: true, policyVersion,
      capabilities: ["NOTIFICATION", "SCREEN_SHARING", "INTERACTION_TRACKING", "REMOTE_SUPPORT", "CAMERA"],
      approvedDataFields: [...APPROVED_DATA_FIELDS],
    }).success).toBe(true);
  });

  it("requires explicit overall consent and rejects unknown, duplicate, or undeclared fields", () => {
    expect(ExperimentConsentSchema.safeParse({ accepted: false, policyVersion, capabilities: [], approvedDataFields: [] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: ["FILE_ACCESS"], approvedDataFields: [] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: [], approvedDataFields: ["RAW_COOKIES"] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: [], approvedDataFields: ["USAGE_EVENTS", "USAGE_EVENTS"] }).success).toBe(false);
    expect(ExperimentConsentSchema.safeParse({ accepted: true, policyVersion, capabilities: [], approvedDataFields: [], extra: true }).success).toBe(false);
  });

  it("validates revocation for a single known activity or data category", () => {
    expect(RevokeCapabilitySchema.safeParse({ capability: "SCREEN_SHARING" }).success).toBe(true);
    expect(RevokeCapabilitySchema.safeParse({ capability: "REMOTE_SHELL" }).success).toBe(false);
    expect(RevokeDataFieldSchema.safeParse({ dataField: "COARSE_DEVICE_PROFILE" }).success).toBe(true);
    expect(RevokeDataFieldSchema.safeParse({ dataField: "RAW_COOKIES" }).success).toBe(false);
    expect(RevokeDataFieldSchema.safeParse({ dataField: "CAMERA", granted: true }).success).toBe(false);
  });
});

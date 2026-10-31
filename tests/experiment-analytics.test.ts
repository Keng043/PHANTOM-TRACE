import { describe, expect, it } from "vitest";
import { buildExperimentAnalytics } from "../src/lib/analytics/experiment";

describe("experiment analytics aggregation", () => {
  it("counts active and withdrawn consent separately", () => {
    const result = buildExperimentAnalytics([
      { capability: "CAMERA", granted: true, grantedAt: new Date(), revokedAt: null },
      { capability: "CAMERA", granted: false, grantedAt: new Date(), revokedAt: new Date() },
    ], [], []);
    expect(result.capabilities.CAMERA.consented).toBe(2);
    expect(result.capabilities.CAMERA.active).toBe(1);
    expect(result.capabilities.CAMERA.withdrawn).toBe(1);
  });

  it("aggregates permission outcomes without collecting media", () => {
    const result = buildExperimentAnalytics([], [
      { capability: "NOTIFICATION", outcome: "GRANTED" },
      { capability: "NOTIFICATION", outcome: "DENIED" },
      { capability: "CAMERA", outcome: "STOPPED" },
      { capability: "CAMERA", outcome: "RAW_VIDEO" },
    ], []);
    expect(result.capabilities.NOTIFICATION.outcomes.GRANTED).toBe(1);
    expect(result.capabilities.NOTIFICATION.outcomes.DENIED).toBe(1);
    expect(result.capabilities.CAMERA.outcomes.STOPPED).toBe(1);
    expect(result.capabilities.CAMERA.outcomes.GRANTED).toBe(0);
  });

  it("summarizes remote assist room lifecycle", () => {
    const result = buildExperimentAnalytics([], [], [
      { status: "PENDING", approvedAt: null },
      { status: "ACTIVE", approvedAt: new Date() },
      { status: "CLOSED", approvedAt: new Date() },
      { status: "EXPIRED", approvedAt: null },
    ]);
    expect(result.remote).toEqual({
      invitations: 4, approved: 2, pending: 1, active: 1, closed: 1, expired: 1,
    });
  });

  it("counts elapsed pending rooms as expired even before lazy database cleanup", () => {
    const result = buildExperimentAnalytics([], [], [
      { status: "PENDING", approvedAt: null, expiresAt: new Date(Date.now() - 60_000) },
      { status: "ACTIVE", approvedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) },
    ]);
    expect(result.remote.pending).toBe(0);
    expect(result.remote.active).toBe(1);
    expect(result.remote.expired).toBe(1);
  });

  it("returns zero-filled capability groups for an empty period", () => {
    const result = buildExperimentAnalytics([], [], []);
    expect(result.capabilities.NOTIFICATION.consented).toBe(0);
    expect(result.capabilities.REMOTE_SUPPORT.outcomes.ERROR).toBe(0);
    expect(result.remote.invitations).toBe(0);
  });
});

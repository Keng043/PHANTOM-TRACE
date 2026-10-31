import { describe, expect, it } from "vitest";
import {
  EVENT_WINDOW_LIMIT, EVENT_WINDOW_MS, HEARTBEAT_STALE_MS,
  SESSION_EVENT_LIMIT, SESSION_MAX_AGE_MS, getSessionExpiry,
  isHeartbeatStale, isSessionExpired,
} from "../src/lib/simulation/tracking";
import { DeviceProfileSchema, TrackingEventSchema } from "../src/lib/validation/tracking";

describe("tracking limits", () => {
  it("sets a two-hour absolute session expiry", () => {
    const now = new Date("2026-10-31T10:00:00.000Z");
    expect(getSessionExpiry(now).toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(SESSION_MAX_AGE_MS).toBe(7_200_000);
  });

  it("recognizes expired sessions", () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    expect(isSessionExpired(new Date("2026-10-31T11:59:59.000Z"), now)).toBe(true);
    expect(isSessionExpired(new Date("2026-10-31T12:00:01.000Z"), now)).toBe(false);
  });

  it("marks a heartbeat stale only after its allowed idle period", () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    expect(isHeartbeatStale(new Date(now.getTime() - HEARTBEAT_STALE_MS - 1), now)).toBe(true);
    expect(isHeartbeatStale(new Date(now.getTime() - HEARTBEAT_STALE_MS + 1), now)).toBe(false);
  });

  it("keeps server-side event quotas bounded", () => {
    expect(EVENT_WINDOW_LIMIT).toBe(60);
    expect(SESSION_EVENT_LIMIT).toBe(1000);
    expect(EVENT_WINDOW_MS).toBe(60_000);
  });
});

describe("tracking payload validation", () => {
  it("accepts an allow-listed event with a UUID id", () => {
    expect(TrackingEventSchema.safeParse({
      clientEventId: "4a7f8c2e-3c11-4f9c-a555-222222222222",
      type: "PAGE_VIEW", path: "/simulation/demo",
    }).success).toBe(true);
  });

  it("rejects query strings, fragments, arbitrary fields and credential-like metadata", () => {
    expect(TrackingEventSchema.safeParse({ type: "PAGE_VIEW", path: "/simulation/demo?email=a@b.com" }).success).toBe(false);
    expect(TrackingEventSchema.safeParse({ type: "PAGE_VIEW", path: "/simulation/demo#token" }).success).toBe(false);
    expect(TrackingEventSchema.safeParse({ type: "PAGE_VIEW", path: "/simulation/demo", metadata: { password: "secret" } }).success).toBe(false);
    expect(TrackingEventSchema.safeParse({ type: "SESSION_ENDED", path: "/simulation/demo" }).success).toBe(false);
  });

  it("accepts only coarse device profile values", () => {
    const profile = {
      browserFamily: "Chrome", osFamily: "Windows", deviceType: "Desktop",
      screenClass: "Large", locale: "en-US", timezone: "Asia/Bangkok",
    };
    expect(DeviceProfileSchema.safeParse(profile).success).toBe(true);
    expect(DeviceProfileSchema.safeParse({ ...profile, ipAddress: "127.0.0.1" }).success).toBe(false);
    expect(DeviceProfileSchema.safeParse({ ...profile, timezone: "Asia/Bangkok", gps: "..." }).success).toBe(false);
  });
});

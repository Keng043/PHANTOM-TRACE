import { describe, expect, it } from "vitest";
import { EventPayloadSchema } from "../src/lib/validation/event";

describe("event payload validation", () => {
  it("accepts allow-listed event types and minimal interaction metadata", () => {
    expect(EventPayloadSchema.safeParse({
      type: "PAGE_VIEW", path: "/simulation/demo",
    }).success).toBe(true);
    expect(EventPayloadSchema.safeParse({
      type: "DEMO_FORM_SUBMITTED", path: "/simulation/demo",
      metadata: { interactionType: "verify" },
    }).success).toBe(true);
  });

  it("rejects unknown event types, unexpected fields, and credential fields", () => {
    expect(EventPayloadSchema.safeParse({ type: "PASSWORD_CAPTURED", path: "/simulation/demo" }).success).toBe(false);
    expect(EventPayloadSchema.safeParse({ type: "PAGE_VIEW", path: "/simulation/demo", password: "secret" }).success).toBe(false);
    expect(EventPayloadSchema.safeParse({
      type: "DEMO_FORM_SUBMITTED", path: "/simulation/demo",
      metadata: { password: "secret" },
    }).success).toBe(false);
  });

  it("rejects external paths, query strings, and non-allow-listed metadata", () => {
    expect(EventPayloadSchema.safeParse({ type: "PAGE_VIEW", path: "https://example.com" }).success).toBe(false);
    expect(EventPayloadSchema.safeParse({ type: "PAGE_VIEW", path: "/simulation/demo?email=a@b.com" }).success).toBe(false);
    expect(EventPayloadSchema.safeParse({
      type: "PAGE_VIEW", path: "/simulation/demo",
      metadata: { deviceType: "desktop", personalEmail: "person@example.com" },
    }).success).toBe(false);
  });
});

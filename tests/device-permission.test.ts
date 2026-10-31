import { describe, expect, it } from "vitest";
import { DevicePermissionResultSchema } from "../src/lib/validation/device-permission";

describe("device permission result validation", () => {
  it("accepts only the three consented browser permission modules", () => {
    expect(DevicePermissionResultSchema.safeParse({ capability: "NOTIFICATION", outcome: "GRANTED" }).success).toBe(true);
    expect(DevicePermissionResultSchema.safeParse({ capability: "SCREEN_SHARING", outcome: "DENIED" }).success).toBe(true);
    expect(DevicePermissionResultSchema.safeParse({ capability: "CAMERA", outcome: "STOPPED" }).success).toBe(true);
  });

  it("rejects remote control, microphone, and arbitrary outcomes", () => {
    expect(DevicePermissionResultSchema.safeParse({ capability: "REMOTE_SUPPORT", outcome: "GRANTED" }).success).toBe(false);
    expect(DevicePermissionResultSchema.safeParse({ capability: "MICROPHONE", outcome: "GRANTED" }).success).toBe(false);
    expect(DevicePermissionResultSchema.safeParse({ capability: "CAMERA", outcome: "CONNECTED" }).success).toBe(false);
    expect(DevicePermissionResultSchema.safeParse({ capability: "CAMERA", outcome: "GRANTED", payload: "frame data" }).success).toBe(false);
  });
});

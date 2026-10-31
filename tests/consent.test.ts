import { describe, expect, it } from "vitest";
import { isPermissionValid } from "../src/lib/security/consent";

describe("telemetry permission gate", () => {
  it("blocks collection when permission is missing", () => {
    expect(isPermissionValid(null)).toBe(false);
    expect(isPermissionValid(undefined)).toBe(false);
  });

  it("allows collection only with a valid timestamp", () => {
    expect(isPermissionValid(new Date())).toBe(true);
    expect(isPermissionValid(new Date("invalid"))).toBe(false);
  });
});

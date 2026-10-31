import { describe, expect, it } from "vitest";
import { isSupportSignalRateLimited } from "../src/lib/support/rate-limit";

describe("Remote Assist signaling rate limit", () => {
  it("allows traffic below the per-sender window limit", () => {
    expect(isSupportSignalRateLimited(0)).toBe(false);
    expect(isSupportSignalRateLimited(29)).toBe(false);
  });

  it("blocks the 31st signal within a rolling 60-second window", () => {
    expect(isSupportSignalRateLimited(30)).toBe(true);
    expect(isSupportSignalRateLimited(31)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { InteractionSignalSchema } from "../src/lib/validation/interaction";

describe("interaction signal validation", () => {
  it("accepts an allow-listed signal and coarse elapsed-time bucket", () => {
    expect(InteractionSignalSchema.safeParse({
      clientEventId: "4a7f8c2e-3c11-4f9c-a555-222222222222",
      signal: "DECISION_SUBMIT", elapsedBucket: "3_10S",
    }).success).toBe(true);
  });

  it("rejects typed content, target selectors, raw durations, and unknown signals", () => {
    const base = { clientEventId: "4a7f8c2e-3c11-4f9c-a555-222222222222", signal: "DECISION_SUBMIT", elapsedBucket: "3_10S" };
    expect(InteractionSignalSchema.safeParse({ ...base, text: "private content" }).success).toBe(false);
    expect(InteractionSignalSchema.safeParse({ ...base, target: "#password" }).success).toBe(false);
    expect(InteractionSignalSchema.safeParse({ ...base, elapsedMs: 1823 }).success).toBe(false);
    expect(InteractionSignalSchema.safeParse({ ...base, signal: "KEYSTROKES" }).success).toBe(false);
    expect(InteractionSignalSchema.safeParse({ ...base, signal: "DECISION_SUBMIT", elapsedBucket: "1823ms" }).success).toBe(false);
  });
});

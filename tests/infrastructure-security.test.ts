import { describe, expect, it } from "vitest";
import { consumeRateLimit, getTrustedClientAddress, opaqueRateLimitKey, resetRateLimit } from "../src/lib/security/rate-limit";
import { buildIceServers } from "../src/lib/support/ice-servers";

describe("shared rate-limit contract", () => {
  it("hashes identifiers so raw email and address values are not embedded in keys", () => {
    const key = opaqueRateLimitKey("login", "person@example.test");
    expect(key).toMatch(/^phantom-trace:rate:login:[a-f0-9]{64}$/);
    expect(key).not.toContain("person@example.test");
  });

  it("enforces a fixed-window limit in local development", async () => {
    const key = opaqueRateLimitKey("test", crypto.randomUUID());
    await resetRateLimit(key);
    expect((await consumeRateLimit(key, 2, 60)).allowed).toBe(true);
    expect((await consumeRateLimit(key, 2, 60)).allowed).toBe(true);
    const blocked = await consumeRateLimit(key, 2, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    await resetRateLimit(key);
  });

  it("uses only trusted proxy address headers and extracts the first forwarded address", () => {
    const request = new Request("https://example.test", { headers: { "x-forwarded-for": "192.0.2.8, 10.0.0.1" } });
    expect(getTrustedClientAddress(request)).toBe("192.0.2.8");
  });
});

describe("short-lived TURN credentials", () => {
  it("creates time-limited HMAC credentials only when TURN is configured", () => {
    const originalUrl = process.env.TURN_URL;
    const originalSecret = process.env.TURN_SHARED_SECRET;
    process.env.TURN_URL = "turn:turn.example.test:3478,turns:turn.example.test:5349";
    process.env.TURN_SHARED_SECRET = "test-shared-secret-with-sufficient-length";
    const now = 1_800_000_000_000;
    const servers = buildIceServers("room-test", now);
    expect(servers).toHaveLength(2);
    expect(servers[1].urls).toEqual(["turn:turn.example.test:3478", "turns:turn.example.test:5349"]);
    expect(servers[1].username).toBe(`${Math.floor(now / 1000) + 1200}:room-test`);
    expect(typeof servers[1].credential).toBe("string");
    if (originalUrl === undefined) delete process.env.TURN_URL; else process.env.TURN_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.TURN_SHARED_SECRET; else process.env.TURN_SHARED_SECRET = originalSecret;
  });

  it("does not expose TURN credentials when the relay is not configured", () => {
    const originalUrl = process.env.TURN_URL;
    const originalSecret = process.env.TURN_SHARED_SECRET;
    delete process.env.TURN_URL;
    delete process.env.TURN_SHARED_SECRET;
    expect(buildIceServers("room-test")).toHaveLength(1);
    if (originalUrl !== undefined) process.env.TURN_URL = originalUrl;
    if (originalSecret !== undefined) process.env.TURN_SHARED_SECRET = originalSecret;
  });
});

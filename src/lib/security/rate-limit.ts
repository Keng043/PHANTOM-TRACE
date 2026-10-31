import { createHash } from "node:crypto";

type LimitResult = { allowed: boolean; retryAfterSeconds: number };
type LocalEntry = { count: number; resetAt: number };
const localEntries = new Map<string, LocalEntry>();

const script = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('TTL', KEYS[1])",
  "return {current, ttl}",
].join("\n");

export function opaqueRateLimitKey(namespace: string, identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex");
  return `phantom-trace:rate:${namespace}:${digest}`;
}

async function redisCommand(key: string, windowSeconds: number): Promise<{ count: number; ttl: number }> {
  const url = process.env.RATE_LIMIT_URL;
  const token = process.env.RATE_LIMIT_TOKEN;
  if (process.env.RATE_LIMIT_BACKEND !== "redis" || !url || !token) {
    throw new Error("Shared Redis rate limiter is not configured.");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, "1", key, String(windowSeconds)]),
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`Rate limiter service returned HTTP ${response.status}.`);
  const body = await response.json() as { result?: unknown; error?: string };
  if (body.error || !Array.isArray(body.result) || body.result.length < 2) {
    throw new Error("Rate limiter returned an invalid response.");
  }
  const count = Number(body.result[0]);
  const ttl = Number(body.result[1]);
  if (!Number.isSafeInteger(count) || !Number.isFinite(ttl)) throw new Error("Rate limiter returned invalid counters.");
  return { count, ttl: Math.max(1, ttl) };
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<LimitResult> {
  if (process.env.RATE_LIMIT_BACKEND === "redis") {
    const result = await redisCommand(key, windowSeconds);
    return { allowed: result.count <= limit, retryAfterSeconds: result.ttl };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production requests require the shared Redis rate limiter.");
  }
  const now = Date.now();
  for (const [entryKey, entry] of localEntries) if (entry.resetAt <= now) localEntries.delete(entryKey);
  const current = localEntries.get(key);
  if (!current || current.resetAt <= now) {
    localEntries.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: windowSeconds };
  }
  current.count++;
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  if (process.env.RATE_LIMIT_BACKEND === "redis") {
    const url = process.env.RATE_LIMIT_URL;
    const token = process.env.RATE_LIMIT_TOKEN;
    if (!url || !token) throw new Error("Shared Redis rate limiter is not configured.");
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["DEL", key]),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("Could not reset rate-limit counter.");
    return;
  }
  localEntries.delete(key);
}

export function getTrustedClientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || null;
}

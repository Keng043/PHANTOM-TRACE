import "dotenv/config";

type Check = { name: string; ok: boolean; detail: string; productionOnly?: boolean };

const production = process.env.NODE_ENV === "production";
const baseUrl = process.env.APP_BASE_URL ?? "";
const turnUrls = (process.env.TURN_URL ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const turnSecret = process.env.TURN_SHARED_SECRET ?? "";
const rateLimitBackend = process.env.RATE_LIMIT_BACKEND ?? "";
const rateLimitUrl = process.env.RATE_LIMIT_URL ?? "";
const rateLimitToken = process.env.RATE_LIMIT_TOKEN ?? "";

const turnConfigured = turnUrls.length > 0 && turnUrls.every((url) => /^(turn|turns):/i.test(url)) && Buffer.byteLength(turnSecret) >= 32;
const redisConfigured = rateLimitBackend.toLowerCase() === "redis" && /^https:\/\//i.test(rateLimitUrl) && Boolean(rateLimitToken);

const checks: Check[] = [
  {
    name: "DATABASE_URL",
    ok: Boolean(process.env.DATABASE_URL),
    detail: process.env.DATABASE_URL ? "configured" : "missing",
  },
  {
    name: "AUTH_SECRET",
    ok: Buffer.byteLength(process.env.AUTH_SECRET ?? "") >= 32,
    detail: Buffer.byteLength(process.env.AUTH_SECRET ?? "") >= 32 ? "at least 32 bytes" : "missing or shorter than 32 bytes",
  },
  {
    name: "APP_BASE_URL uses HTTPS",
    ok: /^https:\/\//i.test(baseUrl),
    detail: baseUrl ? (/^https:\/\//i.test(baseUrl) ? "HTTPS configured" : "must use https://") : "APP_BASE_URL is missing",
    productionOnly: true,
  },
  {
    name: "TURN relay and shared secret",
    ok: turnConfigured,
    detail: turnConfigured ? "TURN URLs and shared secret configured" : "set TURN_URL (comma-separated turn:/turns: URLs) and TURN_SHARED_SECRET (at least 32 bytes)",
    productionOnly: true,
  },
  {
    name: "Shared Redis rate limiter",
    ok: redisConfigured,
    detail: redisConfigured ? "Redis REST endpoint and token configured" : "set RATE_LIMIT_BACKEND=redis, RATE_LIMIT_URL=https://..., and RATE_LIMIT_TOKEN",
    productionOnly: true,
  },
];

console.log(`PHANTOM TRACE deployment preflight · mode: ${production ? "production" : "development"}`);
let blockers = 0;
for (const check of checks) {
  if (!production && check.productionOnly) {
    console.log(`WARN ${check.name}: ${check.detail} (production requirement)`);
    continue;
  }
  if (!check.ok) blockers++;
  console.log(`${check.ok ? "PASS" : "BLOCK"} ${check.name}: ${check.detail}`);
}

if (production && blockers > 0) {
  console.error(`Preflight blocked: ${blockers} production requirement(s) are not met. No deployment should proceed.`);
  process.exitCode = 1;
} else {
  console.log(production ? "Production preflight passed." : "Local preflight passed; production-only requirements remain warnings.");
}

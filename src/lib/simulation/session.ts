import { createHash, randomBytes } from "node:crypto";
export const SESSION_COOKIE = "phantom_trace_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 2;
export function createSessionSecret(): string { return randomBytes(32).toString("base64url"); }
export function hashSessionSecret(secret: string): string { return createHash("sha256").update(secret).digest("hex"); }

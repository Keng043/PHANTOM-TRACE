import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createAuthToken, AUTH_COOKIE } from "@/lib/auth";
import { hasValidOrigin } from "@/lib/security/request";
import { consumeRateLimit, getTrustedClientAddress, opaqueRateLimitKey, resetRateLimit } from "@/lib/security/rate-limit";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("phantom-trace-invalid-login-placeholder", 12);
const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  const input = body as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 254) : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 200) return NextResponse.json({ error: "Invalid email or password." }, { status: 400, headers });

  const address = getTrustedClientAddress(request);
  if (!address && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Request could not be rate-limited safely." }, { status: 503, headers });
  }
  const ipKey = opaqueRateLimitKey("login-ip", address ?? "local-development");
  const emailKey = opaqueRateLimitKey("login-email", email);
  try {
    const ipLimit = await consumeRateLimit(ipKey, 30, 10 * 60);
    if (!ipLimit.allowed) return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429, headers: { ...headers, "Retry-After": String(ipLimit.retryAfterSeconds) } });
    const emailLimit = await consumeRateLimit(emailKey, 8, 10 * 60);
    if (!emailLimit.allowed) return NextResponse.json({ error: "Too many attempts. Try again in 10 minutes." }, { status: 429, headers: { ...headers, "Retry-After": String(emailLimit.retryAfterSeconds) } });
  } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable. Please try again." }, { status: 503, headers });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid || !user.active) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401, headers });

  try { await resetRateLimit(emailKey); } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
  const token = await createAuthToken({ id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "AUTH_LOGIN", targetType: "USER", targetId: user.id } });
  const response = NextResponse.json({ ok: true, user: { name: user.name, role: user.role } }, { headers });
  response.cookies.set(AUTH_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

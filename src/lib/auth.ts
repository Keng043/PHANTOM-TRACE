import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/db";

export const AUTH_COOKIE = "phantom_trace_auth";
const SESSION_SECONDS = 60 * 60 * 8;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "RESEARCHER";
  sessionVersion: number;
};

export async function createAuthToken(user: AuthUser) {
  return new SignJWT({ email: user.email, role: user.role, sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, active: true, sessionVersion: true },
    });
    if (!user?.active || payload.sv !== user.sessionVersion) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion };
  } catch {
    return null;
  }
}

export async function isAdmin(user: AuthUser | null) {
  return user?.role === "ADMIN";
}

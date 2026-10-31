import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers });
  if (actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403, headers });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json({ users }, { headers });
}

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers });
  if (actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403, headers });
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const role = input.role === "ADMIN" ? "ADMIN" : input.role === "RESEARCHER" ? "RESEARCHER" : null;
  if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 200 || !role) {
    return NextResponse.json({ error: "Provide a valid name, email, role and password of at least 12 characters." }, { status: 400, headers });
  }
  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409, headers });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name, email, role, passwordHash: await bcrypt.hash(password, 12) },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "USER_CREATED", targetType: "USER", targetId: created.id, details: { role } } });
    return created;
  });
  return NextResponse.json({ user }, { status: 201, headers });
}

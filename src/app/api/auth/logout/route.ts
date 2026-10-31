import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (user) await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } }),
    prisma.auditLog.create({ data: { actorId: user.id, action: "AUTH_LOGOUT", targetType: "USER", targetId: user.id } }),
  ]);
  (await cookies()).delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/security/consent";
import { hasValidOrigin } from "@/lib/security/request";
import { z } from "zod";
const Input = z.object({ sessionId: z.string().min(1).max(64) }).strict();
export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  const now = new Date();
  const session = await prisma.session.findFirst({ where: { id: parsed.data.sessionId, consentedAt: { not: null }, endedAt: null, expiresAt: { gt: now }, capabilityConsents: { some: { capability: "REMOTE_SUPPORT", granted: true, revokedAt: null, policyVersion: POLICY_VERSION } } }, select: { id: true, supportRoom: { select: { id: true, status: true, expiresAt: true } } } });
  if (!session) return NextResponse.json({ error: "No active session with current Remote Support consent." }, { status: 403 });
  if (session.supportRoom && ["PENDING", "ACTIVE"].includes(session.supportRoom.status) && session.supportRoom.expiresAt > now) return NextResponse.json({ room: session.supportRoom });
  const expiresAt = new Date(now.getTime() + 15 * 60_000);
  const room = session.supportRoom
    ? await prisma.$transaction(async (tx) => {
        await tx.supportSignal.deleteMany({ where: { roomId: session.supportRoom!.id } });
        return tx.supportRoom.update({ where: { id: session.supportRoom!.id }, data: { createdById: user.id, status: "PENDING", createdAt: now, approvedAt: null, closedAt: null, expiresAt }, select: { id: true, status: true, expiresAt: true } });
      })
    : await prisma.supportRoom.create({ data: { sessionId: session.id, createdById: user.id, expiresAt }, select: { id: true, status: true, expiresAt: true } });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "SUPPORT_ROOM_CREATED", targetType: "SupportRoom", targetId: room.id, details: { sessionId: session.id } } });
  return NextResponse.json({ room }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

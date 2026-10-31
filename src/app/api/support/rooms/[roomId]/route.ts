import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/security/consent";
import { hasValidOrigin } from "@/lib/security/request";
import { StaffSupportActionSchema } from "@/lib/validation/support";
type Context = { params: Promise<{ roomId: string }> };
async function access(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, room: null, error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  const room = await prisma.supportRoom.findFirst({ where: { id: roomId, createdById: user.id, expiresAt: { gt: new Date() }, session: { endedAt: null, expiresAt: { gt: new Date() }, capabilityConsents: { some: { capability: "REMOTE_SUPPORT", granted: true, revokedAt: null, policyVersion: POLICY_VERSION } } } }, select: { id: true, status: true, expiresAt: true, approvedAt: true } });
  if (!room) return { user, room: null, error: NextResponse.json({ error: "Room unavailable or participant consent withdrawn." }, { status: 404 }) };
  return { user, room, error: null };
}
export async function GET(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  const auth = await access(roomId);
  if (auth.error || !auth.room) return auth.error;
  const after = request.nextUrl.searchParams.get("after");
  const date = after ? new Date(after) : new Date(0);
  const signals = await prisma.supportSignal.findMany({ where: { roomId, sender: "PARTICIPANT", ...(Number.isFinite(date.getTime()) ? { createdAt: { gte: date } } : {}) }, orderBy: { createdAt: "asc" }, take: 40, select: { id: true, kind: true, payload: true, createdAt: true } });
  return NextResponse.json({ room: auth.room, signals }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest, context: Context) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { roomId } = await context.params;
  const auth = await access(roomId);
  if (auth.error || !auth.room || !auth.user) return auth.error;
  const parsed = StaffSupportActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid signaling payload." }, { status: 400 });
  if ("action" in parsed.data) {
    await prisma.$transaction([
      prisma.supportRoom.update({ where: { id: roomId }, data: { status: "CLOSED", closedAt: new Date() } }),
      prisma.supportSignal.deleteMany({ where: { roomId } }),
    ]);
    return NextResponse.json({ ok: true });
  }
  if (auth.room.status !== "ACTIVE") return NextResponse.json({ error: "Participant approval is required." }, { status: 403 });
  await prisma.supportSignal.create({ data: { roomId, sender: "STAFF", kind: parsed.data.kind, payload: parsed.data.payload as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

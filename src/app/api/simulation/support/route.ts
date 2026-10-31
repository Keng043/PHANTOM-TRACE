import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/security/consent";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";
import { approveSupportRoom, writeSupportSignal } from "@/lib/support/authorization";
import { buildIceServers } from "@/lib/support/ice-servers";
import { ParticipantSupportActionSchema, SupportSignalSchema } from "@/lib/validation/support";
async function participant(request: NextRequest) {
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return null;
  return prisma.session.findFirst({ where: { sessionToken: hashSessionSecret(secret), consentedAt: { not: null }, endedAt: null, expiresAt: { gt: new Date() }, capabilityConsents: { some: { capability: "REMOTE_SUPPORT", granted: true, revokedAt: null, policyVersion: POLICY_VERSION } } }, select: { id: true } });
}
export async function GET(request: NextRequest) {
  const session = await participant(request);
  if (!session) return NextResponse.json({ error: "Current Remote Support consent required." }, { status: 403 });
  let room = await prisma.supportRoom.findFirst({ where: { sessionId: session.id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true, expiresAt: true } });
  if (!room) return NextResponse.json({ room: null, signals: [] }, { headers: { "Cache-Control": "no-store" } });
  if (room.expiresAt <= new Date() && ["PENDING", "ACTIVE"].includes(room.status)) {
    await prisma.$transaction([
      prisma.supportRoom.update({ where: { id: room.id }, data: { status: "EXPIRED", closedAt: new Date() } }),
      prisma.supportSignal.deleteMany({ where: { roomId: room.id } }),
    ]);
    room = { ...room, status: "EXPIRED" };
  }
  const after = request.nextUrl.searchParams.get("after");
  const date = after ? new Date(after) : new Date(0);
  const signals = await prisma.supportSignal.findMany({ where: { roomId: room.id, sender: "STAFF", ...(Number.isFinite(date.getTime()) ? { createdAt: { gte: date } } : {}) }, orderBy: { createdAt: "asc" }, take: 40, select: { id: true, kind: true, payload: true, createdAt: true } });
  return NextResponse.json({ room, signals, iceServers: room.status === "ACTIVE" ? buildIceServers(session.id) : [] }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const session = await participant(request);
  if (!session) return NextResponse.json({ error: "Current Remote Support consent required." }, { status: 403 });
  const parsed = ParticipantSupportActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid support action." }, { status: 400 });
  const room = await prisma.supportRoom.findFirst({ where: { sessionId: session.id, status: { in: ["PENDING", "ACTIVE"] }, expiresAt: { gt: new Date() } }, select: { id: true, status: true } });
  if (!room) return NextResponse.json({ error: "No active support invitation." }, { status: 404 });
  if (parsed.data.action === "approve") {
    if (room.status !== "PENDING") return NextResponse.json({ error: "Invitation is no longer pending." }, { status: 409 });
    const approval = await approveSupportRoom(session.id);
    if (approval === "inactive") return NextResponse.json({ error: "Invitation expired or consent is no longer active." }, { status: 409 });
    if (approval === "retry") return NextResponse.json({ error: "Please retry approval." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === "close") {
    await prisma.$transaction([
      prisma.supportRoom.update({ where: { id: room.id }, data: { status: "CLOSED", closedAt: new Date() } }),
      prisma.supportSignal.deleteMany({ where: { roomId: room.id } }),
    ]);
    return NextResponse.json({ ok: true });
  }
  if (room.status !== "ACTIVE") return NextResponse.json({ error: "Participant approval is required." }, { status: 403 });
  const signal = { kind: parsed.data.kind, payload: parsed.data.payload };
  const safe = SupportSignalSchema.safeParse(signal);
  if (!safe.success) return NextResponse.json({ error: "Invalid signaling payload." }, { status: 400 });
  const result = await writeSupportSignal({
    roomId: room.id, sessionId: session.id, sender: "PARTICIPANT",
    kind: safe.data.kind, payload: safe.data.payload as Prisma.InputJsonValue,
  });
  if (result === "inactive") return NextResponse.json({ error: "The room is closed or consent is no longer active." }, { status: 403 });
  if (result === "rate_limited") return NextResponse.json({ error: "Signaling rate limit reached." }, { status: 429, headers: { "Retry-After": "60" } });
  if (result === "retry") return NextResponse.json({ error: "Please retry signaling." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (secret) {
    const session = await prisma.session.findUnique({
      where: { sessionToken: hashSessionSecret(secret) },
      select: { id: true, endedAt: true },
    });
    if (session && !session.endedAt) {
      await prisma.$transaction(async (tx) => {
        const endedAt = new Date();
        await tx.event.create({ data: { sessionId: session.id, type: "SESSION_ENDED", path: "/simulation/learn" } });
        await tx.capabilityConsent.updateMany({
          where: { sessionId: session.id, granted: true, revokedAt: null },
          data: { granted: false, revokedAt: endedAt },
        });
        const rooms = await tx.supportRoom.findMany({ where: { sessionId: session.id, status: { in: ["PENDING", "ACTIVE"] } }, select: { id: true } });
        await tx.supportRoom.updateMany({ where: { sessionId: session.id, status: { in: ["PENDING", "ACTIVE"] } }, data: { status: "CLOSED", closedAt: endedAt } });
        if (rooms.length) await tx.supportSignal.deleteMany({ where: { roomId: { in: rooms.map((room) => room.id) } } });
        await tx.session.updateMany({
          where: { id: session.id, endedAt: null },
          data: { endedAt },
        });
      });
    }
  }
  const response = NextResponse.json({ ok: true, next: "/simulation/learn" });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0,
  });
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/simulation/tracking";
import { HeartbeatSchema } from "@/lib/validation/tracking";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "Session required." }, { status: 401 });
  const parsed = HeartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid heartbeat." }, { status: 400 });

  const now = new Date();
  const heartbeatBefore = new Date(now.getTime() - HEARTBEAT_INTERVAL_MS);
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionSecret(secret) },
    select: { id: true, endedAt: true, expiresAt: true, lastHeartbeatAt: true, consentedAt: true },
  });
  if (!session || !session.consentedAt || session.endedAt || session.expiresAt <= now) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }
  if (session.lastHeartbeatAt > heartbeatBefore) {
    return NextResponse.json({ ok: true, throttled: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const updated = await prisma.session.updateMany({
    where: { id: session.id, endedAt: null, expiresAt: { gt: now }, lastHeartbeatAt: { lte: heartbeatBefore } },
    data: { lastHeartbeatAt: now, lastSeenAt: now },
  });
  if (updated.count !== 1) return NextResponse.json({ ok: true, throttled: true });
  return NextResponse.json({ ok: true, visible: parsed.data.visible }, { headers: { "Cache-Control": "no-store" } });
}

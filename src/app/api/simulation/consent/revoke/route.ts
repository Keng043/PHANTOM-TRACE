import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";
import { RevokeCapabilitySchema } from "@/lib/validation/experiment-consent";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "An active experiment session is required." }, { status: 401 });
  const parsed = RevokeCapabilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid capability." }, { status: 400 });

  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionSecret(secret) },
    select: { id: true, consentedAt: true, endedAt: true, expiresAt: true },
  });
  if (!session || !session.consentedAt || session.endedAt || session.expiresAt <= now) {
    return NextResponse.json({ error: "The experiment session is not active." }, { status: 401 });
  }

  const result = await prisma.capabilityConsent.updateMany({
    where: { sessionId: session.id, capability: parsed.data.capability, granted: true, revokedAt: null },
    data: { granted: false, revokedAt: now },
  });
  return NextResponse.json({ ok: true, revoked: result.count > 0 }, {
    headers: { "Cache-Control": "no-store" },
  });
}

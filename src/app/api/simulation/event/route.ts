import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/security/consent";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";
import { writeTrackingEvent } from "@/lib/simulation/event-writer";
import { TrackingEventSchema } from "@/lib/validation/tracking";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "A consented simulation session is required." }, { status: 401 });
  const parsed = TrackingEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionSecret(secret) },
    select: {
      id: true, consentedAt: true, endedAt: true, expiresAt: true,
      capabilityConsents: { where: { capability: "INTERACTION_TRACKING", granted: true, revokedAt: null, policyVersion: POLICY_VERSION }, select: { id: true }, take: 1 },
    },
  });
  const now = new Date();
  if (!session || !session.consentedAt || session.endedAt || session.expiresAt <= now) {
    return NextResponse.json({ error: "The simulation session is not active." }, { status: 401 });
  }

  if (["DEMO_FORM_SUBMITTED", "REPORT_SUBMITTED", "LINK_CLICKED"].includes(parsed.data.type) && session.capabilityConsents.length === 0) {
    return NextResponse.json({ error: "Interaction tracking consent is not active." }, { status: 403 });
  }

  const result = await writeTrackingEvent(session.id, parsed.data);
  if (result.status === "inactive") return NextResponse.json({ error: "The simulation session is not active." }, { status: 401 });
  if (result.status === "rate_limited") {
    return NextResponse.json({ error: "Event limit reached. Please wait before trying again." }, {
      status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({ ok: true, duplicate: result.status === "duplicate" }, {
    headers: { "Cache-Control": "no-store" },
  });
}

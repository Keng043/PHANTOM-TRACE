import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/security/consent";
import { hasValidOrigin } from "@/lib/security/request";
import { getSessionExpiry } from "@/lib/simulation/tracking";
import { ExperimentConsentSchema } from "@/lib/validation/experiment-consent";
import { createSessionSecret, hashSessionSecret, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/simulation/session";
import { consumeRateLimit, getTrustedClientAddress, opaqueRateLimitKey } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const address = getTrustedClientAddress(request);
  if (!address && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Request could not be rate-limited safely." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const limit = await consumeRateLimit(opaqueRateLimitKey("session-create", address ?? "local-development"), 10, 10 * 60);
    if (!limit.allowed) return NextResponse.json({ error: "Too many experiment sessions from this network. Try again later." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } });
  } catch {
    return NextResponse.json({ error: "Experiment sessions are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = ExperimentConsentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.policyVersion !== POLICY_VERSION) {
    return NextResponse.json({ error: "Please review the current experiment notice and data choices before starting." }, { status: 400 });
  }

  const now = new Date();
  const campaign = await prisma.campaign.findFirst({
    where: { status: "ACTIVE", OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    orderBy: { createdAt: "asc" }, select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "The volunteer lab is not available yet." }, { status: 503 });

  const secret = createSessionSecret();
  const pseudonym = `Volunteer-${crypto.randomUUID().slice(0, 8)}`;
  const expiresAt = getSessionExpiry(now);
  await prisma.$transaction(async (tx) => {
    const participant = await tx.participant.create({ data: { pseudonym } });
    await tx.session.create({
      data: {
        sessionToken: hashSessionSecret(secret), campaignId: campaign.id, participantId: participant.id,
        consentedAt: now, consentVersion: POLICY_VERSION,
        expiresAt, lastSeenAt: now, lastHeartbeatAt: now,
        consentRecords: { create: { participantId: participant.id, policyVersion: POLICY_VERSION, granted: true } },
        capabilityConsents: { create: parsed.data.capabilities.map((capability) => ({
          capability, granted: true, policyVersion: POLICY_VERSION, grantedAt: now,
        })) },
        dataFieldConsents: { create: parsed.data.approvedDataFields.map((dataField) => ({
          dataField, granted: true, policyVersion: POLICY_VERSION, grantedAt: now,
        })) },
        events: { create: { type: "CONSENT_GRANTED", path: "/simulation" } },
      },
    });
  });

  const response = NextResponse.json({ ok: true, next: "/simulation/experiment", expiresAt: expiresAt.toISOString() });
  response.cookies.set(SESSION_COOKIE, secret, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: SESSION_TTL_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

import "dotenv/config";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { POST as interactionPost } from "../src/app/api/simulation/interaction/route";
import { POST as eventPost } from "../src/app/api/simulation/event/route";
import { createSessionSecret, hashSessionSecret, SESSION_COOKIE } from "../src/lib/simulation/session";
import { getSessionExpiry } from "../src/lib/simulation/tracking";

function assertStatus(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected HTTP ${expected}, received ${actual}`);
  console.log(`PASS ${label}: HTTP ${actual}`);
}

function makeRequest(url: string, secret: string | null, payload: unknown, origin = "http://localhost:3000") {
  const headers = new Headers({ origin, host: "localhost:3000", "content-type": "application/json" });
  if (secret) headers.set("cookie", `${SESSION_COOKIE}=${secret}`);
  return new NextRequest(url, { method: "POST", headers, body: JSON.stringify(payload) });
}

async function main() {
  const campaign = await prisma.campaign.findFirst({ where: { status: "ACTIVE" }, select: { id: true } });
  if (!campaign) throw new Error("An active campaign is required for interaction integration checks.");

  const now = new Date();
  const secret = createSessionSecret();
  const participant = await prisma.participant.create({ data: { pseudonym: `InteractionCheck-${crypto.randomUUID().slice(0, 8)}` } });
  const session = await prisma.session.create({
    data: {
      sessionToken: hashSessionSecret(secret), campaignId: campaign.id, participantId: participant.id,
      consentedAt: now, consentVersion: "interaction-check", expiresAt: getSessionExpiry(now),
      capabilityConsents: { create: { capability: "INTERACTION_TRACKING", granted: true, policyVersion: "2026-10-31-v3", grantedAt: now } },
    },
    select: { id: true },
  });

  try {
    const payload = { clientEventId: crypto.randomUUID(), signal: "DECISION_SUBMIT", elapsedBucket: "3_10S" };
    const staleConsent = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", secret, payload));
    assertStatus("Outdated consent version cannot submit expanded interaction signals", staleConsent.status, 403);

    const legacyEvent = await eventPost(makeRequest("http://localhost:3000/api/simulation/event", secret, {
      clientEventId: crypto.randomUUID(), type: "DEMO_FORM_SUBMITTED", path: "/simulation/demo", metadata: { interactionType: "verify" },
    }));
    assertStatus("Legacy decision telemetry also requires current interaction consent", legacyEvent.status, 403);

    const badOrigin = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", secret, payload, "https://attacker.example"));
    assertStatus("Cross-origin interaction signal is rejected", badOrigin.status, 403);

    const noCookie = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", null, payload));
    assertStatus("Missing session cookie is rejected", noCookie.status, 401);

    const invalid = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", secret, {
      ...payload, signal: "KEYSTROKES", typedText: "do-not-store",
    }));
    assertStatus("Unknown signal and arbitrary content are rejected", invalid.status, 400);

    await prisma.capabilityConsent.updateMany({
      where: { sessionId: session.id, capability: "INTERACTION_TRACKING" },
      data: { policyVersion: "2026-10-31-v4" },
    });
    const allowed = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", secret, payload));
    assertStatus("Current explicit interaction consent allows signal", allowed.status, 200);

    const event = await prisma.event.findFirst({ where: { sessionId: session.id, type: "INTERACTION_SIGNAL" } });
    if (!event || event.metadata === null) throw new Error("Interaction signal event was not persisted.");
    const metadata = event.metadata as { signal?: string; elapsedBucket?: string };
    if (metadata.signal !== "DECISION_SUBMIT" || metadata.elapsedBucket !== "3_10S") throw new Error("Unexpected interaction metadata.");
    if (Object.keys(metadata).sort().join(",") !== "elapsedBucket,signal") throw new Error("Unexpected data was stored in interaction metadata.");
    console.log("PASS Only allow-listed signal and coarse elapsed-time bucket are stored");

    const duplicate = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", secret, payload));
    assertStatus("Duplicate event IDs are idempotent", duplicate.status, 200);

    await prisma.capabilityConsent.updateMany({
      where: { sessionId: session.id, capability: "INTERACTION_TRACKING" },
      data: { granted: false, revokedAt: new Date() },
    });
    const revoked = await interactionPost(makeRequest("http://localhost:3000/api/simulation/interaction", secret, {
      ...payload, clientEventId: crypto.randomUUID(), signal: "TAB_HIDDEN",
    }));
    assertStatus("Revoked interaction consent blocks further signals", revoked.status, 403);

    console.log("Phase 8 interaction API checks passed.");
  } finally {
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.participant.delete({ where: { id: participant.id } });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Interaction verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

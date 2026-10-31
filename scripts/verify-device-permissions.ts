import "dotenv/config";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { POST } from "../src/app/api/simulation/permission-result/route";
import { createSessionSecret, hashSessionSecret, SESSION_COOKIE } from "../src/lib/simulation/session";
import { getSessionExpiry } from "../src/lib/simulation/tracking";

function assertStatus(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected HTTP ${expected}, received ${actual}`);
  console.log(`PASS ${label}: HTTP ${actual}`);
}

function makeRequest(secret: string | null, payload: unknown, origin = "http://localhost:3000") {
  const headers = new Headers({ origin, host: "localhost:3000", "content-type": "application/json" });
  if (secret) headers.set("cookie", `${SESSION_COOKIE}=${secret}`);
  return new NextRequest("http://localhost:3000/api/simulation/permission-result", {
    method: "POST", headers, body: JSON.stringify(payload),
  });
}

async function main() {
  const campaign = await prisma.campaign.findFirst({ where: { status: "ACTIVE" }, select: { id: true } });
  if (!campaign) throw new Error("An active campaign is required for permission integration checks.");

  const now = new Date();
  const secret = createSessionSecret();
  const participant = await prisma.participant.create({ data: { pseudonym: `PermissionCheck-${crypto.randomUUID().slice(0, 8)}` } });
  const session = await prisma.session.create({
    data: {
      sessionToken: hashSessionSecret(secret), campaignId: campaign.id, participantId: participant.id,
      consentedAt: now, consentVersion: "permission-check", expiresAt: getSessionExpiry(now),
      capabilityConsents: { create: { capability: "NOTIFICATION", granted: true, policyVersion: "permission-check", grantedAt: now } },
    },
    select: { id: true },
  });

  try {
    const allowed = await POST(makeRequest(secret, { capability: "NOTIFICATION", outcome: "GRANTED" }));
    assertStatus("Consent-authorized permission result is recorded", allowed.status, 200);
    const event = await prisma.event.findFirst({ where: { sessionId: session.id, type: "DEVICE_PERMISSION_RESULT" } });
    if (!event || event.metadata === null) throw new Error("Permission result event was not persisted.");
    const metadata = event.metadata as { capability?: string; outcome?: string };
    if (metadata.capability !== "NOTIFICATION" || metadata.outcome !== "GRANTED") throw new Error("Permission result metadata did not match the allow-list payload.");
    console.log("PASS Permission event stores only capability and outcome");

    const notConsented = await POST(makeRequest(secret, { capability: "CAMERA", outcome: "GRANTED" }));
    assertStatus("Unconsented capability is rejected", notConsented.status, 403);

    const badOrigin = await POST(makeRequest(secret, { capability: "NOTIFICATION", outcome: "DENIED" }, "https://attacker.example"));
    assertStatus("Cross-origin permission result is rejected", badOrigin.status, 403);

    const noCookie = await POST(makeRequest(null, { capability: "NOTIFICATION", outcome: "DENIED" }));
    assertStatus("Missing session cookie is rejected", noCookie.status, 401);

    const invalid = await POST(makeRequest(secret, { capability: "REMOTE_SUPPORT", outcome: "CONNECTED" }));
    assertStatus("Remote control and unknown outcomes are rejected", invalid.status, 400);

    await prisma.capabilityConsent.updateMany({
      where: { sessionId: session.id, capability: "NOTIFICATION" }, data: { granted: false, revokedAt: new Date() },
    });
    const revoked = await POST(makeRequest(secret, { capability: "NOTIFICATION", outcome: "STOPPED" }));
    assertStatus("Revoked capability cannot write permission telemetry", revoked.status, 403);

    console.log("Phase 7 device permission API checks passed.");
  } finally {
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.participant.delete({ where: { id: participant.id } });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Device permission verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

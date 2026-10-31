import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { POLICY_VERSION } from "../src/lib/security/consent";
import { createSessionSecret, hashSessionSecret } from "../src/lib/simulation/session";
import { getSessionExpiry } from "../src/lib/simulation/tracking";

const base = process.env.REMOTE_SUPPORT_CHECK_BASE_URL ?? "http://localhost:3000";
const suffix = randomUUID();
const email = `remote-support-${suffix}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let userId: string | null = null;
let participantId: string | null = null;
let sessionId: string | null = null;

function assertStatus(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected HTTP ${expected}, received ${actual}`);
  console.log(`PASS ${label}: HTTP ${actual}`);
}

async function main() {
  try {
    const campaign = await prisma.campaign.findFirst({ where: { status: "ACTIVE" }, select: { id: true } });
    if (!campaign) throw new Error("An active campaign is required for Remote Support verification.");
    const user = await prisma.user.create({
      data: { name: "Remote Support Check", email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
      select: { id: true },
    });
    userId = user.id;
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assertStatus("Researcher/Admin login for Remote Support check", login.status, 200);
    const staffCookie = login.headers.getSetCookie().find((v) => v.startsWith("phantom_trace_auth="))?.split(";")[0];
    if (!staffCookie) throw new Error("Authentication cookie missing.");

    const now = new Date();
    const secret = createSessionSecret();
    const participant = await prisma.participant.create({
      data: { pseudonym: `RemoteSupportCheck-${suffix.slice(0, 8)}` },
      select: { id: true },
    });
    participantId = participant.id;
    const session = await prisma.session.create({
      data: {
        sessionToken: hashSessionSecret(secret),
        campaignId: campaign.id,
        participantId: participant.id,
        consentedAt: now,
        consentVersion: POLICY_VERSION,
        expiresAt: getSessionExpiry(now),
        capabilityConsents: {
          create: { capability: "REMOTE_SUPPORT", granted: true, policyVersion: POLICY_VERSION, grantedAt: now },
        },
      },
      select: { id: true },
    });
    sessionId = session.id;
    const participantCookie = `phantom_trace_session=${secret}`;

    const noOrigin = await fetch(`${base}/api/support/rooms`, {
      method: "POST", headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    assertStatus("Room creation rejects missing Origin", noOrigin.status, 403);

    const created = await fetch(`${base}/api/support/rooms`, {
      method: "POST",
      headers: { Origin: base, Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    assertStatus("Consented active session can receive a room invitation", created.status, 201);
    const { room } = await created.json() as { room: { id: string; status: string } };

    const invitation = await fetch(`${base}/api/simulation/support`, { headers: { Cookie: participantCookie } });
    assertStatus("Participant can see own pending invitation", invitation.status, 200);
    const invitationData = await invitation.json() as { room: { id: string; status: string } };
    if (invitationData.room?.id !== room.id || invitationData.room.status !== "PENDING") throw new Error("Participant invitation does not match the created room.");

    const premature = await fetch(`${base}/api/support/rooms/${room.id}`, { headers: { Cookie: staffCookie } });
    assertStatus("Staff signaling is blocked before participant approval", premature.status, 200);
    const prematureData = await premature.json() as { signals: unknown[] };
    if (prematureData.signals.length !== 0) throw new Error("Unexpected signaling before participant approval.");

    const approve = await fetch(`${base}/api/simulation/support`, {
      method: "POST", headers: { Origin: base, Cookie: participantCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    assertStatus("Participant explicitly approves the invitation", approve.status, 200);

    const sdp = "v=0\\r\\no=- 0 0 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0";
    const offer = await fetch(`${base}/api/simulation/support`, {
      method: "POST", headers: { Origin: base, Cookie: participantCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signal", kind: "OFFER", payload: { type: "offer", sdp } }),
    });
    assertStatus("Approved participant can submit bounded WebRTC offer", offer.status, 200);

    const received = await fetch(`${base}/api/support/rooms/${room.id}`, { headers: { Cookie: staffCookie } });
    assertStatus("Room owner can receive participant signaling", received.status, 200);
    const receivedData = await received.json() as { room: { status: string }; signals: { kind: string }[] };
    if (receivedData.room.status !== "ACTIVE" || !receivedData.signals.some((v) => v.kind === "OFFER")) throw new Error("Staff did not receive the participant offer.");

    const answer = await fetch(`${base}/api/support/rooms/${room.id}`, {
      method: "POST", headers: { Origin: base, Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "ANSWER", payload: { type: "answer", sdp } }),
    });
    assertStatus("Room owner can submit WebRTC answer", answer.status, 200);

    const close = await fetch(`${base}/api/support/rooms/${room.id}`, {
      method: "POST", headers: { Origin: base, Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    assertStatus("Room owner can close the viewer", close.status, 200);

    const closed = await fetch(`${base}/api/simulation/support`, { headers: { Cookie: participantCookie } });
    assertStatus("Participant receives room closure", closed.status, 200);
    const closedData = await closed.json() as { room: { status: string }; signals: unknown[] };
    if (closedData.room.status !== "CLOSED" || closedData.signals.length !== 0) throw new Error("Room closure did not clear signaling.");

    console.log("Phase 9 Remote Support API integration checks passed.");
  } finally {
    if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
    if (participantId) await prisma.participant.deleteMany({ where: { id: participantId } });
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Remote Support verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});

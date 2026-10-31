import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

const base = process.env.AUTH_CHECK_BASE_URL ?? "http://localhost:3000";
const suffix = randomUUID();
const adminEmail = `phase5-admin-${suffix}@example.invalid`;
const researcherEmail = `phase5-researcher-${suffix}@example.invalid`;
const throttledEmail = `phase5-throttle-${suffix}@example.invalid`;
const password = randomBytes(24).toString("base64url");
const createdIds: string[] = [];

function assertStatus(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected HTTP ${expected}, received ${actual}`);
  console.log(`PASS ${label}: HTTP ${actual}`);
}

async function signIn(email: string) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed for test account: HTTP ${response.status}`);
  const authCookie = response.headers.getSetCookie().find((value) => value.startsWith("phantom_trace_auth="))?.split(";")[0];
  if (!authCookie) throw new Error("Login did not issue the expected HttpOnly session cookie.");
  return authCookie;
}

async function main() {
  try {
    const badOrigin = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assertStatus("Login rejects missing Origin", badOrigin.status, 403);
    for (let attempt = 0; attempt < 8; attempt++) {
      const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ email: throttledEmail, password: "invalid-password" }) });
      assertStatus(`Failed login attempt ${attempt + 1}`, response.status, 401);
    }
    const throttled = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ email: throttledEmail, password: "invalid-password" }) });
    assertStatus("Login rate limit", throttled.status, 429);

    const anonymous = await fetch(`${base}/api/analytics/dashboard`);
    assertStatus("Anonymous analytics denied", anonymous.status, 401);
    const admin = await prisma.user.create({
      data: { name: "Phase 5 Test Admin", email: adminEmail, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
      select: { id: true },
    });
    createdIds.push(admin.id);

    const adminCookie = await signIn(adminEmail);
    const adminDashboard = await fetch(`${base}/api/analytics/dashboard`, { headers: { Cookie: adminCookie } });
    assertStatus("Admin dashboard access", adminDashboard.status, 200);
    const adminUsers = await fetch(`${base}/api/admin/users`, { headers: { Cookie: adminCookie } });
    assertStatus("Admin account listing", adminUsers.status, 200);

    const createResponse = await fetch(`${base}/api/admin/users`, {
      method: "POST", headers: { Origin: base, Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Phase 5 Test Researcher", email: researcherEmail, password, role: "RESEARCHER" }),
    });
    assertStatus("Admin creates Researcher", createResponse.status, 201);
    const created = await createResponse.json() as { user: { id: string } };
    createdIds.push(created.user.id);

    const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { Origin: base, Cookie: adminCookie } });
    assertStatus("Logout clears session", logout.status, 200);
    const revokedAdmin = await fetch(`${base}/api/analytics/dashboard`, { headers: { Cookie: adminCookie } });
    assertStatus("Logout revokes existing token", revokedAdmin.status, 401);

    const researcherCookie = await signIn(researcherEmail);
    const researcherDashboard = await fetch(`${base}/api/analytics/dashboard`, { headers: { Cookie: researcherCookie } });
    assertStatus("Researcher dashboard access", researcherDashboard.status, 200);
    const researcherUsers = await fetch(`${base}/api/admin/users`, { headers: { Cookie: researcherCookie } });
    assertStatus("Researcher denied account listing", researcherUsers.status, 403);
    console.log("Phase 5 authentication and RBAC checks passed.");
  } finally {
    if (createdIds.length) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: createdIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Phase 5 auth verification failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
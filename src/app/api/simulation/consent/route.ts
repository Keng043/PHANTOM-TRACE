import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";

export async function GET(request: NextRequest) {
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "An active experiment session is required." }, { status: 401 });
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionSecret(secret) },
    select: {
      id: true, endedAt: true, expiresAt: true,
      capabilityConsents: { select: { capability: true, granted: true, grantedAt: true, revokedAt: true, policyVersion: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!session || session.endedAt || session.expiresAt <= now) {
    return NextResponse.json({ error: "The experiment session is not active." }, { status: 401 });
  }
  return NextResponse.json({ capabilities: session.capabilityConsents, expiresAt: session.expiresAt.toISOString() }, {
    headers: { "Cache-Control": "no-store" },
  });
}

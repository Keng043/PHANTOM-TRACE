import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";
import { POLICY_VERSION } from "@/lib/security/consent";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";
import { EVENT_WINDOW_LIMIT, EVENT_WINDOW_MS, SESSION_EVENT_LIMIT } from "@/lib/simulation/tracking";
import { DevicePermissionResultSchema } from "@/lib/validation/device-permission";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "An active experiment session is required." }, { status: 401 });
  const parsed = DevicePermissionResultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid permission result." }, { status: 400 });

  const now = new Date();
  const cutoff = new Date(now.getTime() - EVENT_WINDOW_MS);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: {
          sessionToken: hashSessionSecret(secret), consentedAt: { not: null }, endedAt: null, expiresAt: { gt: now },
          capabilityConsents: { some: { capability: parsed.data.capability, granted: true, revokedAt: null, policyVersion: POLICY_VERSION } },
          dataFieldConsents: { some: { dataField: "PERMISSION_OUTCOMES", granted: true, revokedAt: null, policyVersion: POLICY_VERSION } },
        },
        select: { id: true, eventWindowStartedAt: true },
      });
      if (!session) return "inactive" as const;

      const windowExpired = session.eventWindowStartedAt <= cutoff;
      const updated = await tx.session.updateMany({
        where: {
          id: session.id, endedAt: null, expiresAt: { gt: now }, eventCount: { lt: SESSION_EVENT_LIMIT },
          ...(windowExpired ? {} : { eventWindowStartedAt: { gt: cutoff }, eventWindowCount: { lt: EVENT_WINDOW_LIMIT } }),
          capabilityConsents: { some: { capability: parsed.data.capability, granted: true, revokedAt: null, policyVersion: POLICY_VERSION } },
          dataFieldConsents: { some: { dataField: "PERMISSION_OUTCOMES", granted: true, revokedAt: null, policyVersion: POLICY_VERSION } },
        },
        data: {
          eventCount: { increment: 1 },
          ...(windowExpired ? { eventWindowStartedAt: now, eventWindowCount: 1 } : { eventWindowCount: { increment: 1 } }),
          lastSeenAt: now,
        },
      });
      if (updated.count !== 1) return "rate_limited" as const;
      await tx.event.create({
        data: {
          sessionId: session.id, type: "DEVICE_PERMISSION_RESULT", path: "/simulation/experiment",
          metadata: { capability: parsed.data.capability, outcome: parsed.data.outcome },
        },
      });
      return "created" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result === "inactive") return NextResponse.json({ error: "Both activity consent and permission-outcome data approval are required." }, { status: 403 });
    if (result === "rate_limited") return NextResponse.json({ error: "Experiment event limit reached." }, { status: 429 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Please retry the permission result." }, { status: 409 });
    }
    throw error;
  }
}

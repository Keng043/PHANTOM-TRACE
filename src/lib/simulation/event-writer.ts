import { Prisma } from "@/generated/prisma/client";
import { POLICY_VERSION } from "@/lib/security/consent";
import { prisma } from "@/lib/db";
import { EVENT_WINDOW_LIMIT, EVENT_WINDOW_MS, SESSION_EVENT_LIMIT } from "./tracking";
import type { TrackingEventPayload } from "./types";

export type TrackingWriteResult =
  | { status: "created" }
  | { status: "duplicate" }
  | { status: "rate_limited" }
  | { status: "inactive" };

const INTERACTION_EVENT_TYPES = ["DEMO_FORM_SUBMITTED", "REPORT_SUBMITTED", "LINK_CLICKED"] as const;

export async function writeTrackingEvent(sessionId: string, payload: TrackingEventPayload): Promise<TrackingWriteResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - EVENT_WINDOW_MS);
  const requiresInteraction = INTERACTION_EVENT_TYPES.includes(payload.type as typeof INTERACTION_EVENT_TYPES[number]);
  const requiredConsentFilters: Prisma.SessionWhereInput[] = [
    {
      dataFieldConsents: {
        some: { dataField: "USAGE_EVENTS", granted: true, revokedAt: null, policyVersion: POLICY_VERSION },
      },
    },
  ];
  if (requiresInteraction) {
    requiredConsentFilters.push(
      {
        dataFieldConsents: {
          some: { dataField: "INTERACTION_SIGNALS", granted: true, revokedAt: null, policyVersion: POLICY_VERSION },
        },
      },
      {
        capabilityConsents: {
          some: { capability: "INTERACTION_TRACKING", granted: true, revokedAt: null, policyVersion: POLICY_VERSION },
        },
      },
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (payload.clientEventId) {
        const duplicate = await tx.event.findUnique({ where: { clientEventId: payload.clientEventId }, select: { id: true, sessionId: true } });
        if (duplicate) return duplicate.sessionId === sessionId ? { status: "duplicate" } : { status: "inactive" };
      }

      const session = await tx.session.findFirst({
        where: {
          id: sessionId, consentedAt: { not: null }, endedAt: null, expiresAt: { gt: now },
          AND: requiredConsentFilters,
        },
        select: { id: true, eventWindowStartedAt: true },
      });
      if (!session) return { status: "inactive" };

      const windowExpired = session.eventWindowStartedAt <= cutoff;
      const updated = await tx.session.updateMany({
        where: {
          id: sessionId,
          consentedAt: { not: null },
          endedAt: null,
          expiresAt: { gt: now },
          AND: requiredConsentFilters,
          eventCount: { lt: SESSION_EVENT_LIMIT },
          ...(windowExpired ? {} : { eventWindowStartedAt: { gt: cutoff }, eventWindowCount: { lt: EVENT_WINDOW_LIMIT } }),
        },
        data: {
          eventCount: { increment: 1 },
          ...(windowExpired
            ? { eventWindowStartedAt: now, eventWindowCount: 1 }
            : { eventWindowCount: { increment: 1 } }),
          lastSeenAt: now,
        },
      });
      if (updated.count !== 1) return { status: "rate_limited" };

      await tx.event.create({
        data: {
          sessionId,
          clientEventId: payload.clientEventId,
          type: payload.type,
          path: payload.path,
          metadata: payload.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      if (payload.type === "REPORT_SUBMITTED") {
        await tx.report.create({ data: { sessionId, category: "SUSPICIOUS_MESSAGE" } });
      }
      return { status: "created" };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && payload.clientEventId) {
      return { status: "duplicate" };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { status: "rate_limited" };
    }
    throw error;
  }
}

import { connection, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { POLICY_VERSION } from "@/lib/security/consent";
import { buildExperimentAnalytics } from "@/lib/analytics/experiment";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers });

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const activeSince = new Date(now.getTime() - 90_000);
  const [
    campaigns, participantIds, sessions, activeSessionsCount, events, reports,
    endedSessions, recentEvents, activeSessions, hourlyEvents, decisions, interactionEvents,
    consentRows, permissionResults, supportRooms,
  ] = await Promise.all([
    prisma.campaign.count(),
    prisma.session.groupBy({ by: ["participantId"] }),
    prisma.session.count(),
    prisma.session.count({ where: { endedAt: null, expiresAt: { gt: now }, lastSeenAt: { gte: activeSince } } }),
    prisma.event.count(),
    prisma.report.count(),
    prisma.session.count({ where: { endedAt: { not: null } } }),
    prisma.event.findMany({
      take: 12, orderBy: { createdAt: "desc" },
      select: { id: true, type: true, path: true, metadata: true, createdAt: true, session: { select: { campaign: { select: { name: true } } } } },
    }),
    prisma.session.findMany({
      where: { endedAt: null, expiresAt: { gt: now }, lastSeenAt: { gte: activeSince } },
      take: 12, orderBy: { lastSeenAt: "desc" },
      select: { id: true, startedAt: true, lastSeenAt: true, eventCount: true, campaign: { select: { name: true } }, capabilityConsents: { where: { capability: "REMOTE_SUPPORT", granted: true, revokedAt: null, policyVersion: POLICY_VERSION }, select: { id: true }, take: 1 } },

    }),
    prisma.event.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.event.findMany({
      where: { createdAt: { gte: since }, type: { in: ["DEMO_FORM_SUBMITTED", "REPORT_SUBMITTED"] } },
      select: { type: true, metadata: true }, take: 5000, orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: { createdAt: { gte: since }, type: "INTERACTION_SIGNAL" },
      select: { metadata: true }, take: 5000, orderBy: { createdAt: "desc" },
    }),
    prisma.capabilityConsent.findMany({
      where: { policyVersion: POLICY_VERSION, session: { startedAt: { gte: since } } },
      select: { capability: true, granted: true, grantedAt: true, revokedAt: true },
      take: 10000,
    }),
    prisma.event.findMany({
      where: { createdAt: { gte: since }, type: "DEVICE_PERMISSION_RESULT" },
      select: { metadata: true }, take: 5000, orderBy: { createdAt: "desc" },
    }),
    prisma.supportRoom.findMany({
      where: { createdAt: { gte: since } }, select: { status: true, approvedAt: true, expiresAt: true }, take: 5000,
    }),
  ]);

  const activity = Array.from({ length: 24 }, (_, i) => {
    const start = new Date(now.getTime() - (23 - i) * 3_600_000);
    start.setMinutes(0, 0, 0);
    return { hour: start.toISOString(), count: 0, timestamp: start.getTime() };
  });
  for (const event of hourlyEvents) {
    const index = Math.floor((event.createdAt.getTime() - activity[0].timestamp) / 3_600_000);
    if (index >= 0 && index < activity.length) activity[index].count++;
  }

  const behavior = { verify: 0, report: 0, continue: 0 };
  for (const event of decisions) {
    const meta = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown> : {};
    const choice = meta.interactionType;
    if (choice === "verify" || choice === "report" || choice === "continue") behavior[choice]++;
    else if (event.type === "REPORT_SUBMITTED") behavior.report++;
  }

  const interactionSignals: Record<string, number> = {};
  for (const event of interactionEvents) {
    const meta = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown> : {};
    const signal = meta.signal;
    if (typeof signal === "string" && /^[A-Z0-9_]{1,32}$/.test(signal)) {
      interactionSignals[signal] = (interactionSignals[signal] ?? 0) + 1;
    }
  }

  const permissionEvents = permissionResults.flatMap((event) => {
    const meta = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown> : {};
    return typeof meta.capability === "string" && typeof meta.outcome === "string"
      ? [{ capability: meta.capability, outcome: meta.outcome }] : [];
  });
  const experiment = buildExperimentAnalytics(consentRows, permissionEvents, supportRooms);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    metrics: {
      campaigns, participants: participantIds.length, sessions, activeSessions: activeSessionsCount,
      events, reports, endedSessions,
      completionRate: sessions ? Math.round(endedSessions / sessions * 100) : 0,
    },
    activity: activity.map(({ hour, count }) => ({ hour, count })),
    behavior, behaviorSampleSize: decisions.length,
    interactionSignals, interactionSignalSampleSize: interactionEvents.length,
    experiment, experimentWindow: { since: since.toISOString(), until: now.toISOString() },
    activeSessions: activeSessions.map((s) => ({
      id: s.id.slice(-8).toUpperCase(), sessionId: s.id, canRemoteSupport: s.capabilityConsents.length > 0, campaign: s.campaign.name,
      startedAt: s.startedAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), eventCount: s.eventCount,
    })),
    recentEvents: recentEvents.map((e) => {
      const meta = e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata)
        ? e.metadata as Record<string, unknown> : {};
      const choice = meta.interactionType;
      const signal = meta.signal;
      return {
        id: e.id, type: e.type, path: e.path,
        choice: choice === "verify" || choice === "report" || choice === "continue" ? choice
          : typeof signal === "string" && /^[A-Z0-9_]{1,32}$/.test(signal) ? signal.replaceAll("_", " ") : null,
        campaign: e.session.campaign.name, createdAt: e.createdAt.toISOString(),
      };
    }),
  }, { headers });
}

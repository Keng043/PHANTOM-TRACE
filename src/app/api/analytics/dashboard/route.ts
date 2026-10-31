import { connection, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  // Local-only preview until Phase 5 RBAC is implemented.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Local preview only." }, { status: 404, headers });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const activeSince = new Date(now.getTime() - 90_000);
  const [
    campaigns, participantIds, sessions, activeSessionsCount, events, reports,
    endedSessions, recentEvents, activeSessions, hourlyEvents, decisions,
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
      select: { id: true, startedAt: true, lastSeenAt: true, eventCount: true, campaign: { select: { name: true } } },
    }),
    prisma.event.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.event.findMany({
      where: { createdAt: { gte: since }, type: { in: ["DEMO_FORM_SUBMITTED", "REPORT_SUBMITTED"] } },
      select: { type: true, metadata: true }, take: 5000, orderBy: { createdAt: "desc" },
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

  return NextResponse.json({
    generatedAt: now.toISOString(),
    metrics: {
      campaigns, participants: participantIds.length, sessions, activeSessions: activeSessionsCount,
      events, reports, endedSessions,
      completionRate: sessions ? Math.round(endedSessions / sessions * 100) : 0,
    },
    activity: activity.map(({ hour, count }) => ({ hour, count })),
    behavior, behaviorSampleSize: decisions.length,
    activeSessions: activeSessions.map((s) => ({
      id: s.id.slice(-8).toUpperCase(), campaign: s.campaign.name,
      startedAt: s.startedAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), eventCount: s.eventCount,
    })),
    recentEvents: recentEvents.map((e) => {
      const meta = e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata)
        ? e.metadata as Record<string, unknown> : {};
      const choice = meta.interactionType;
      return {
        id: e.id, type: e.type, path: e.path,
        choice: choice === "verify" || choice === "report" || choice === "continue" ? choice : null,
        campaign: e.session.campaign.name, createdAt: e.createdAt.toISOString(),
      };
    }),
  }, { headers });
}

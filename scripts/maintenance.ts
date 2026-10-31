import "dotenv/config";
import { prisma } from "../src/lib/db";
import { HEARTBEAT_STALE_MS, TRACKING_RETENTION_DAYS } from "../src/lib/simulation/tracking";

async function main() {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - HEARTBEAT_STALE_MS);
  const retentionCutoff = new Date(now.getTime() - TRACKING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const expiredIds = await tx.session.findMany({
      where: { endedAt: null, expiresAt: { lte: now } }, select: { id: true },
    });
    const idleIds = await tx.session.findMany({
      where: { endedAt: null, expiresAt: { gt: now }, lastSeenAt: { lt: staleCutoff } }, select: { id: true },
    });
    const expired = await tx.session.updateMany({
      where: { id: { in: expiredIds.map((session) => session.id) }, endedAt: null }, data: { endedAt: now },
    });
    const idle = await tx.session.updateMany({
      where: { id: { in: idleIds.map((session) => session.id) }, endedAt: null }, data: { endedAt: now },
    });
    const closedSessionIds = [...expiredIds, ...idleIds].map((session) => session.id);
    await tx.capabilityConsent.updateMany({
      where: { sessionId: { in: closedSessionIds }, granted: true, revokedAt: null },
      data: { granted: false, revokedAt: now },
    });
    const oldSessions = await tx.session.deleteMany({
      where: { OR: [{ endedAt: { lt: retentionCutoff } }, { expiresAt: { lt: retentionCutoff } }] },
    });
    const oldEvents = await tx.event.deleteMany({ where: { createdAt: { lt: retentionCutoff } } });
    const oldReports = await tx.report.deleteMany({ where: { createdAt: { lt: retentionCutoff } } });
    const orphanParticipants = await tx.participant.deleteMany({ where: { sessions: { none: {} } } });
    const oldAuditLogs = await tx.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
    return {
      expiredSessions: expired.count, idleSessions: idle.count,
      deletedSessions: oldSessions.count, deletedEvents: oldEvents.count,
      deletedReports: oldReports.count, deletedOrphanParticipants: orphanParticipants.count,
      deletedAuditLogs: oldAuditLogs.count,
    };
  });

  console.log("Tracking maintenance completed:", JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error("Tracking maintenance failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });

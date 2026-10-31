import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const [activeCampaigns, sessions, activeSessions, consents, events, reports, deviceProfiles] = await Promise.all([
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.session.count(),
    prisma.session.count({ where: { endedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.consentRecord.count({ where: { granted: true } }),
    prisma.event.count(),
    prisma.report.count(),
    prisma.deviceProfile.count(),
  ]);

  const result = { activeCampaigns, sessions, activeSessions, grantedConsents: consents, events, reports, deviceProfiles };
  console.log(JSON.stringify(result, null, 2));

  if (activeCampaigns < 1 || sessions < 1 || consents < 1 || events < 1 || reports < 1) {
    throw new Error("Simulation records are incomplete.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Simulation verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

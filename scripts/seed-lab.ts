import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const existing = await prisma.campaign.findFirst({ where: { status: "ACTIVE" } });
  if (existing) {
    console.log("An active lab campaign already exists:", existing.name);
    return;
  }

  const email = "lab-admin@phantom-trace.local";
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Local Lab Administrator",
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: "Phishing Awareness — Demo Lab",
      description: "Local fictional scenario for consent-based security awareness training.",
      status: "ACTIVE",
      createdById: admin.id,
    },
  });
  console.log("Created local demo campaign:", campaign.name);
  console.log("The local seed administrator has a random non-login password. Configure a real account through the future admin setup flow.");
}

main()
  .catch((error: unknown) => {
    console.error("Unable to seed local lab:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

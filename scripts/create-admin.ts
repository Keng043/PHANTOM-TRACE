import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const name = (await rl.question("Admin name: ")).trim();
    const email = (await rl.question("Admin email: ")).trim().toLowerCase();
    const password = await rl.question("Admin password (12+ characters): ");
    if (name.length < 2 || name.length > 80) throw new Error("Name must be 2–80 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
    if (password.length < 12 || password.length > 200) throw new Error("Password must be 12–200 characters.");
    if (await prisma.user.findUnique({ where: { email } })) throw new Error("An account with this email already exists.");
    const user = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN", active: true }, select: { id: true, email: true } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "ADMIN_BOOTSTRAP", targetType: "USER", targetId: user.id } });
    console.log("Administrator created:", user.email);
  } finally { rl.close(); }
}
main().catch((error: unknown) => { console.error("Admin setup failed:", error instanceof Error ? error.message : "Unknown error"); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });

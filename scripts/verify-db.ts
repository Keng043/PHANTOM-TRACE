import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await prisma.$queryRaw<
    Array<{ database_name: string; connected_user: string }>
  >`SELECT current_database() AS database_name, current_user AS connected_user`;

  const connection = result[0];
  if (!connection) {
    throw new Error("Database returned no connection metadata.");
  }

  console.log(
    `PostgreSQL connection OK: database=${connection.database_name}, user=${connection.connected_user}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Database verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

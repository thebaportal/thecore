import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const pings = await db.ping.findMany({
    select: { id: true, type: true, title: true, projectId: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  console.log(JSON.stringify(pings, null, 2));
  await db.$disconnect();
  await pool.end();
}
main();

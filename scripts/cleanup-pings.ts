import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"]! });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const r1 = await db.ping.deleteMany({
    where: { type: "GROUP", title: "Project Chat", projectId: null },
  });
  const r2 = await db.ping.deleteMany({
    where: { id: { in: ["cmpabw74w0006yw5gvui6b7dh"] } },
  });
  console.log("Deleted orphaned Project Chats:", r1.count);
  console.log("Deleted unexplained Direct ping:", r2.count);
  await db.$disconnect();
  await pool.end();
}
main();

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as never);

  const projects = await db.project.findMany({
    select: { name: true, status: true, _count: { select: { members: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  projects.forEach((p) => {
    console.log(`${p.status.padEnd(12)} ${String(p._count.members).padStart(5)} mbr | ${p.name}`);
  });

  await db.$disconnect();
}

main();

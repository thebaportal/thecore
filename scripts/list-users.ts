import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      clerkUserId: true,
      memberships: {
        select: { role: true, organization: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const u of users) {
    const orgs =
      u.memberships.map((m) => `${m.organization.name} (${m.role})`).join(", ") ||
      "no orgs";
    console.log(`${u.name} | ${u.email} | ${orgs}`);
  }

  await pool.end();
}

main().catch(console.error);

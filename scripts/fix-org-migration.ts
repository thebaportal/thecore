import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const allOrgs = await db.organization.findMany({
    select: {
      id: true,
      clerkOrgId: true,
      name: true,
      _count: { select: { projects: true, memberships: true } },
    },
  });

  console.log("\nAll orgs in database:");
  allOrgs.forEach((o) => {
    console.log(`  ${o.name} | clerkOrgId: ${o.clerkOrgId} | projects: ${o._count.projects} | members: ${o._count.memberships}`);
  });

  // Real org = most data
  const sorted = [...allOrgs].sort(
    (a, b) => (b._count.projects + b._count.memberships) - (a._count.projects + a._count.memberships)
  );
  const realOrg = sorted[0]!;
  const emptyOrgs = sorted.slice(1);

  console.log(`\nReal org: "${realOrg.name}" (${realOrg._count.projects} projects, ${realOrg._count.memberships} members)`);
  console.log(`Empty orgs to delete: ${emptyOrgs.length}`);

  // The production Clerk org ID — the one that doesn't belong to the real org
  // It's whichever clerkOrgId is NOT on the real org
  const productionClerkOrgId = emptyOrgs[0]?.clerkOrgId;

  if (!productionClerkOrgId) {
    console.log("\n✅ Only one org exists — nothing to migrate.");
    return;
  }

  console.log(`\nProduction Clerk org ID: ${productionClerkOrgId}`);
  console.log(`Will update "${realOrg.name}" to use this ID and delete empty orgs.`);

  // Delete empty orgs first (releases the unique constraint)
  for (const org of emptyOrgs) {
    await db.organization.delete({ where: { id: org.id } });
    console.log(`  Deleted empty org: ${org.name} (${org.clerkOrgId})`);
  }

  // Update real org to use production Clerk org ID
  await db.organization.update({
    where: { id: realOrg.id },
    data: { clerkOrgId: productionClerkOrgId },
  });

  console.log(`\n✅ Done! "${realOrg.name}" now linked to production Clerk.`);
  console.log("Refresh onthecore.com/dashboard — all your data should be back.");
}

main().catch(console.error).finally(() => db.$disconnect());

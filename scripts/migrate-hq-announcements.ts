import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const hqProject = await db.project.findFirst({
    where: { name: { contains: "Globalstride", mode: "insensitive" } },
    select: { id: true, name: true, organizationId: true },
  });

  if (!hqProject) {
    console.log("❌ Could not find Globalstride HQ project.");
    return;
  }
  console.log(`✅ Found: "${hqProject.name}"`);

  const posts = await db.projectPost.findMany({
    where: { projectId: hqProject.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });
  console.log(`📋 ${posts.length} posts to migrate`);

  let migrated = 0, skipped = 0;
  for (const post of posts) {
    const exists = await db.announcement.findFirst({
      where: { organizationId: hqProject.organizationId, title: post.title },
    });
    if (exists) { skipped++; continue; }
    await db.announcement.create({
      data: {
        organizationId: hqProject.organizationId,
        authorId:       post.authorId,
        title:          post.title,
        body:           post.body,
        createdAt:      post.createdAt,
        updatedAt:      post.updatedAt,
      },
    });
    migrated++;
    console.log(`  ✓ "${post.title}" — ${post.author.name}`);
  }

  console.log(`\n✅ Migrated: ${migrated}  Skipped: ${skipped}`);
  console.log(`\nNow delete "${hqProject.name}" from the Projects UI.`);
}

main().catch(console.error).finally(() => db.$disconnect());

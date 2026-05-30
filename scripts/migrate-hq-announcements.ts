import { PrismaClient } from "../src/generated/prisma";

const db = new PrismaClient();

async function main() {
  // Find the HQ project
  const hqProject = await db.project.findFirst({
    where: { name: { contains: "Globalstride", mode: "insensitive" } },
    select: { id: true, name: true, organizationId: true },
  });

  if (!hqProject) {
    console.log("❌ Could not find Globalstride HQ project.");
    return;
  }

  console.log(`✅ Found project: "${hqProject.name}" (${hqProject.id})`);

  const posts = await db.projectPost.findMany({
    where: { projectId: hqProject.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });

  console.log(`📋 Found ${posts.length} posts to migrate`);

  if (posts.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  let migrated = 0;
  let skipped  = 0;

  for (const post of posts) {
    // Skip if already migrated (same title + org)
    const existing = await db.announcement.findFirst({
      where: { organizationId: hqProject.organizationId, title: post.title },
    });
    if (existing) { skipped++; continue; }

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
    console.log(`  ✓ "${post.title}" by ${post.author.name}`);
  }

  console.log(`\n✅ Done. Migrated: ${migrated}, Skipped (already exist): ${skipped}`);
  console.log(`\nYou can now delete the "${hqProject.name}" project from the UI.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ONE-TIME migration route — delete this file after running once.
// Moves all posts from the Globalstride HQ project into Announcements.

export async function POST() {
  const secret = process.env.MIGRATION_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATION_SECRET env var not set" }, { status: 403 });

  const hqProject = await db.project.findFirst({
    where: { name: { contains: "Globalstride", mode: "insensitive" } },
    select: { id: true, name: true, organizationId: true },
  });

  if (!hqProject) {
    return NextResponse.json({ error: "HQ project not found" }, { status: 404 });
  }

  const posts = await db.projectPost.findMany({
    where: { projectId: hqProject.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });

  let migrated = 0;
  let skipped  = 0;

  for (const post of posts) {
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
  }

  return NextResponse.json({
    project: hqProject.name,
    total: posts.length,
    migrated,
    skipped,
    message: migrated > 0
      ? `Done. You can now delete the "${hqProject.name}" project from the UI.`
      : "Nothing new to migrate.",
  });
}

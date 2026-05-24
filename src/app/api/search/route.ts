import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({}, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const empty = { projects: [], tasks: [], docs: [], posts: [], files: [], chatFiles: [], pings: [] };
  if (q.length < 2) return NextResponse.json(empty);

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) return NextResponse.json(empty);

  // Determine role
  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  const isAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";

  // For members: get the project IDs they belong to
  let memberProjectIds: string[] | null = null;
  if (!isAdmin) {
    const memberships = await db.projectMember.findMany({
      where: { userId: user.id, project: { organizationId: org.id } },
      select: { projectId: true },
    });
    memberProjectIds = memberships.map((m) => m.projectId);
  }

  const ci = { contains: q, mode: "insensitive" as const };

  // Base project filter
  const projectWhere = isAdmin
    ? { organizationId: org.id }
    : { organizationId: org.id, id: { in: memberProjectIds! } };

  const [projects, tasks, docs, posts, files, chatFiles, pings] = await Promise.all([

    // Projects
    db.project.findMany({
      where: { ...projectWhere, OR: [{ name: ci }, { description: ci }] },
      select: { id: true, name: true, color: true, iconEmoji: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),

    // Tasks
    db.task.findMany({
      where: { organizationId: org.id, parentTaskId: null, title: ci,
        ...(isAdmin ? {} : { projectId: { in: memberProjectIds! } }),
      },
      select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),

    // Docs — title + content; members see only docs in their projects
    db.doc.findMany({
      where: {
        organizationId: org.id,
        OR: [{ title: ci }, { content: ci }],
        ...(isAdmin ? {} : { projectId: { in: memberProjectIds! } }),
      },
      select: { id: true, title: true, emoji: true, projectId: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),

    // Posts — title + body
    db.projectPost.findMany({
      where: {
        project: { organizationId: org.id, ...(isAdmin ? {} : { id: { in: memberProjectIds! } }) },
        OR: [{ title: ci }, { body: ci }],
      },
      select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Files (vault uploads)
    db.projectFile.findMany({
      where: {
        organizationId: org.id,
        name: ci,
        ...(isAdmin ? {} : { projectId: { in: memberProjectIds! } }),
      },
      select: { id: true, name: true, mimeType: true, projectId: true, project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Chat attachments — files shared inside messages
    db.attachment.findMany({
      where: {
        name: ci,
        message: {
          deletedAt: null,
          ping: {
            organizationId: org.id,
            ...(isAdmin ? {} : { participants: { some: { userId: user.id } } }),
          },
        },
      },
      select: {
        id: true, name: true, mimeType: true,
        message: { select: { pingId: true, ping: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),

    // Pings with title
    db.ping.findMany({
      where: {
        organizationId: org.id,
        title: ci,
        ...(isAdmin ? {} : { participants: { some: { userId: user.id } } }),
      },
      select: { id: true, title: true, type: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  return NextResponse.json({ projects, tasks, docs, posts, files, chatFiles, pings });
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function requireAdmin() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthenticated");
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("Not found");
  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") throw new Error("Admin only");
  return { user, org };
}

function isRepositorySuspect(name: string, taskCount: number): boolean {
  const n = name.trim();
  if (/\bproject$/i.test(n)) return false;
  if (
    /\b(materials?|learning|resources?|curriculum|knowledge|templates?|playbooks?)\b/i.test(n) ||
    /\(docs?\s*(only)?\)/i.test(n) ||
    /\bhq\b/i.test(n)
  ) return true;
  if (taskCount === 0) return true;
  return false;
}

export type ProjectForReclassification = {
  id: string;
  name: string;
  status: string;
  taskCount: number;
  docCount: number;
  fileCount: number;
  memberCount: number;
  suspect: boolean;
};

export async function getProjectsForReclassification(): Promise<ProjectForReclassification[]> {
  const { org } = await requireAdmin();

  const projects = await db.project.findMany({
    where: { organizationId: org.id, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      status: true,
      _count: {
        select: {
          tasks: true,
          members: true,
          docs: true,
          files: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    taskCount: p._count.tasks,
    docCount: p._count.docs,
    fileCount: p._count.files,
    memberCount: p._count.members,
    suspect: isRepositorySuspect(p.name, p._count.tasks),
  }));
}

export async function reclassifyProjectToLibrary(projectId: string): Promise<{ moved: { docs: number; files: number; folders: number }; membersRemoved: number }> {
  const { org } = await requireAdmin();

  const project = await db.project.findUnique({
    where: { id: projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  // Move content to Library (projectId = null, isTemplate = false)
  const [folders, docs, files, members] = await Promise.all([
    db.docFolder.updateMany({ where: { projectId }, data: { projectId: null, isTemplate: false } }),
    db.doc.updateMany({ where: { projectId }, data: { projectId: null, isTemplate: false } }),
    db.projectFile.updateMany({
      where: { projectId, submittedDeliverable: null, deliverableVersionFiles: { none: {} } },
      data: { projectId: null, isTemplate: false },
    }),
    db.projectMember.deleteMany({ where: { projectId } }),
  ]);

  await db.projectInvitation.deleteMany({ where: { projectId } });
  await db.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });

  revalidatePath("/library");
  revalidatePath("/team");
  revalidatePath("/projects");

  return {
    moved: { docs: docs.count, files: files.count, folders: folders.count },
    membersRemoved: members.count,
  };
}

export async function reclassifyProjectToTemplate(projectId: string): Promise<{ moved: { docs: number; files: number; folders: number }; membersRemoved: number }> {
  const { org } = await requireAdmin();

  const project = await db.project.findUnique({
    where: { id: projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const [folders, docs, files, members] = await Promise.all([
    db.docFolder.updateMany({ where: { projectId }, data: { projectId: null, isTemplate: true } }),
    db.doc.updateMany({ where: { projectId }, data: { projectId: null, isTemplate: true } }),
    db.projectFile.updateMany({
      where: { projectId, submittedDeliverable: null, deliverableVersionFiles: { none: {} } },
      data: { projectId: null, isTemplate: true },
    }),
    db.projectMember.deleteMany({ where: { projectId } }),
  ]);

  await db.projectInvitation.deleteMany({ where: { projectId } });
  await db.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } });

  revalidatePath("/templates");
  revalidatePath("/team");
  revalidatePath("/projects");

  return {
    moved: { docs: docs.count, files: files.count, folders: folders.count },
    membersRemoved: members.count,
  };
}

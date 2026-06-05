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

const LIBRARY_PROJECTS = new Set([
  "BA Interview Prep Materials",
  "BA Learning Material",
  "Globalstride Consulting HQ",
  "Managers",
  "Mentoring Tuesday",
]);

const TEMPLATE_PROJECTS = new Set([
  "Templates for Project Deliverables",
]);

function isRepositorySuspect(name: string): boolean {
  const n = name.trim();
  return LIBRARY_PROJECTS.has(n) || TEMPLATE_PROJECTS.has(n);
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
    suspect: isRepositorySuspect(p.name),
  }));
}

// ── Multi-project membership report ──────────────────────────────────────────

export type MultiProjectUser = {
  userId: string;
  name: string;
  email: string;
  projects: { id: string; name: string; color: string | null; isRepo: boolean }[];
  realCount: number;
  repoCount: number;
};

export async function getMultiProjectReport(): Promise<MultiProjectUser[]> {
  const { org } = await requireAdmin();

  const allMemberships = await db.projectMember.findMany({
    where: { project: { organizationId: org.id, status: { not: "ARCHIVED" } } },
    select: { userId: true, project: { select: { id: true, name: true, color: true } } },
  });

  // Group by userId
  const byUser = new Map<string, { id: string; name: string; color: string | null }[]>();
  for (const m of allMemberships) {
    const list = byUser.get(m.userId) ?? [];
    list.push(m.project);
    byUser.set(m.userId, list);
  }

  // Keep only users with 2+ memberships
  const multiUserIds = [...byUser.entries()]
    .filter(([, projects]) => projects.length >= 2)
    .map(([userId]) => userId);

  if (multiUserIds.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: multiUserIds } },
    select: { id: true, name: true, email: true },
  });

  return users
    .map((user) => {
      const projects = (byUser.get(user.id) ?? []).map((p) => ({
        ...p,
        isRepo: isRepositorySuspect(p.name),
      }));
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        projects,
        realCount: projects.filter((p) => !p.isRepo).length,
        repoCount: projects.filter((p) => p.isRepo).length,
      };
    })
    .filter((u) => u.repoCount > 0) // only show users who have repo memberships to clean up
    .sort((a, b) => b.repoCount - a.repoCount);
}

export async function removeRepositoryMemberships(): Promise<{ membershipsRemoved: number; orgMembershipsRemoved: number }> {
  const { org } = await requireAdmin();

  const allProjects = await db.project.findMany({
    where: { organizationId: org.id, status: { not: "ARCHIVED" } },
    select: { id: true, name: true },
  });

  const repoProjectIds = allProjects
    .filter((p) => isRepositorySuspect(p.name))
    .map((p) => p.id);

  if (repoProjectIds.length === 0) return { membershipsRemoved: 0, orgMembershipsRemoved: 0 };

  // Capture affected users before deletion
  const affected = await db.projectMember.findMany({
    where: { projectId: { in: repoProjectIds } },
    select: { userId: true },
  });
  const affectedUserIds = [...new Set(affected.map((m) => m.userId))];

  const deleted = await db.projectMember.deleteMany({
    where: { projectId: { in: repoProjectIds } },
  });

  // Cascade: if a MEMBER-role user now has zero real project memberships, remove from org
  let orgMembershipsRemoved = 0;
  for (const userId of affectedUserIds) {
    const orgMembership = await db.orgMembership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      select: { role: true },
    });
    if (orgMembership?.role !== "MEMBER") continue;

    const remaining = await db.projectMember.count({
      where: { userId, project: { organizationId: org.id, status: { not: "ARCHIVED" } } },
    });
    if (remaining === 0) {
      await db.orgMembership.delete({
        where: { organizationId_userId: { organizationId: org.id, userId } },
      });
      orgMembershipsRemoved++;
    }
  }

  revalidatePath("/team");
  revalidatePath("/projects");
  revalidatePath("/settings/organization");

  return { membershipsRemoved: deleted.count, orgMembershipsRemoved };
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

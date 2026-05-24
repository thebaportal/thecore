"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const createDocSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(200),
  emoji: z.string().max(10).optional(),
  folderId: z.string().optional(),
});

const updateDocSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(100000).optional(),
  emoji: z.string().max(10).nullable().optional(),
});

async function getContext() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("User not found");
  return { user, org };
}

async function getOrg() {
  const { orgId } = await auth();
  if (!orgId) return null;
  return db.organization.findUnique({ where: { clerkOrgId: orgId } });
}

export async function createDocFolder(input: { projectId: string; name: string; parentId?: string | null }) {
  const { org } = await getContext();

  const project = await db.project.findUnique({
    where: { id: input.projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const folder = await db.docFolder.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: org.id,
      projectId: input.projectId,
      name: input.name.trim(),
      parentId: input.parentId ?? null,
    },
  });

  revalidatePath(`/projects/${input.projectId}/docs`);
  revalidatePath(`/projects/${input.projectId}/files`);
  return folder;
}

export async function renameDocFolder(folderId: string, name: string) {
  const { org } = await getContext();
  const folder = await db.docFolder.findFirst({
    where: { id: folderId, organizationId: org.id },
    select: { projectId: true },
  });
  if (!folder) throw new Error("Folder not found");

  await db.docFolder.update({
    where: { id: folderId },
    data: { name: name.trim() },
  });

  if (folder.projectId) revalidatePath(`/projects/${folder.projectId}/files`);
  else revalidatePath("/library");
}

export async function deleteDocFolder(folderId: string) {
  const { org } = await getContext();
  const folder = await db.docFolder.findFirst({
    where: { id: folderId, organizationId: org.id },
    select: { projectId: true, parentId: true },
  });
  if (!folder) throw new Error("Folder not found");

  // Move child folders up one level before deleting (FK constraint: NoAction)
  await db.docFolder.updateMany({
    where: { parentId: folderId, organizationId: org.id },
    data: { parentId: folder.parentId },
  });

  // Files and docs auto-unlink via SetNull cascade
  await db.docFolder.delete({ where: { id: folderId } });

  if (folder.projectId) revalidatePath(`/projects/${folder.projectId}/files`);
  else revalidatePath("/library");
}

export async function getProjectFolders(projectId: string, parentId: string | null = null) {
  const org = await getOrg();
  if (!org) return [];

  return db.docFolder.findMany({
    where: { projectId, organizationId: org.id, parentId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { docs: true, children: true, files: true } },
    },
  });
}

export async function getFolderBreadcrumb(folderId: string): Promise<{ id: string; name: string }[]> {
  const org = await getOrg();
  if (!org) return [];

  const crumbs: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const row: { id: string; name: string; parentId: string | null } | null =
      await db.docFolder.findUnique({
        where: { id: currentId, organizationId: org.id },
        select: { id: true, name: true, parentId: true },
      });
    if (!row) break;
    crumbs.unshift({ id: row.id, name: row.name });
    currentId = row.parentId;
  }

  return crumbs;
}

export async function getProjectDocs(projectId: string, folderId: string | null = null) {
  const org = await getOrg();
  if (!org) return [];

  return db.doc.findMany({
    where: { projectId, organizationId: org.id, folderId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      emoji: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function getDoc(docId: string) {
  const { orgId } = await auth();
  if (!orgId) return null;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;

  return db.doc.findUnique({
    where: { id: docId, organizationId: org.id },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function createDoc(input: { projectId: string; title: string; emoji?: string; folderId?: string }) {
  const { user, org } = await getContext();
  const validated = createDocSchema.parse(input);

  const project = await db.project.findUnique({
    where: { id: validated.projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const doc = await db.doc.create({
    data: {
      organizationId: org.id,
      projectId: validated.projectId,
      authorId: user.id,
      title: validated.title,
      emoji: validated.emoji ?? null,
      folderId: validated.folderId ?? null,
    },
  });

  revalidatePath(`/projects/${validated.projectId}/docs`);
  return doc;
}

export async function updateDoc(docId: string, input: { title?: string; content?: string; emoji?: string | null }) {
  const { org } = await getContext();
  const validated = updateDocSchema.parse(input);

  const doc = await db.doc.findUnique({
    where: { id: docId, organizationId: org.id },
    select: { projectId: true, isTemplate: true },
  });
  if (!doc) throw new Error("Doc not found");

  const updated = await db.doc.update({
    where: { id: docId },
    data: validated,
  });

  if (doc.projectId) {
    revalidatePath(`/projects/${doc.projectId}/docs`);
    revalidatePath(`/projects/${doc.projectId}/docs/${docId}`);
  } else if (doc.isTemplate) {
    revalidatePath("/templates");
    revalidatePath(`/templates/docs/${docId}`);
  } else {
    revalidatePath("/library");
    revalidatePath(`/library/docs/${docId}`);
  }
  return updated;
}

export async function deleteDoc(docId: string) {
  const { org } = await getContext();

  const doc = await db.doc.findUnique({
    where: { id: docId, organizationId: org.id },
    select: { projectId: true },
  });
  if (!doc) throw new Error("Doc not found");

  await db.doc.delete({ where: { id: docId } });
  if (doc.projectId) revalidatePath(`/projects/${doc.projectId}/docs`);
  else revalidatePath("/library");
}

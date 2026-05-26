"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

async function requireAdmin() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("User not found");
  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") throw new Error("Admin only");
  return { user, org };
}

// ─── Queries (admin-only — templates are never visible to students) ───────────

export async function getTemplateFolders(parentId: string | null = null) {
  const { org } = await requireAdmin();
  return db.docFolder.findMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true, parentId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { docs: true, children: true, files: true } },
      docs: { select: { title: true, emoji: true }, take: 4, orderBy: { updatedAt: "desc" } },
      files: { select: { name: true }, take: 3, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getTemplateDocs(folderId: string | null = null) {
  const { org } = await requireAdmin();
  return db.doc.findMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true, folderId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, emoji: true, createdAt: true, updatedAt: true,
      content: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function getTemplateFiles(folderId: string | null = null) {
  const { org } = await requireAdmin();
  return db.projectFile.findMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true, folderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, url: true, utKey: true, mimeType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function getTemplateDoc(docId: string) {
  const { org } = await requireAdmin();
  return db.doc.findFirst({
    where: { id: docId, organizationId: org.id, projectId: { equals: null }, isTemplate: true },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function getTemplateFolderBreadcrumb(folderId: string): Promise<{ id: string; name: string }[]> {
  const { org } = await requireAdmin();
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

export async function searchTemplateItems(query: string) {
  const { org } = await requireAdmin();

  const q = query.trim();
  if (!q) return { folders: [], docs: [], files: [] };

  const [folders, docs, files] = await Promise.all([
    db.docFolder.findMany({
      where: { organizationId: org.id, projectId: null, isTemplate: true, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, _count: { select: { docs: true, files: true, children: true } } },
      take: 8,
      orderBy: { name: "asc" },
    }),
    db.doc.findMany({
      where: { organizationId: org.id, projectId: null, isTemplate: true, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, emoji: true, updatedAt: true, author: { select: { name: true } }, folder: { select: { id: true, name: true } } },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    db.projectFile.findMany({
      where: { organizationId: org.id, projectId: null, isTemplate: true, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true, folder: { select: { id: true, name: true } } },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { folders, docs, files };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createTemplateFolder(name: string, parentId?: string | null) {
  const { org } = await requireAdmin();
  if (parentId) {
    const parent = await db.docFolder.findFirst({ where: { id: parentId, organizationId: org.id } });
    if (!parent) parentId = null;
  }
  const folder = await db.docFolder.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: org.id,
      projectId: null,
      isTemplate: true,
      name: name.trim(),
      parentId: parentId ?? null,
    },
  });
  revalidatePath("/templates");
  return folder;
}

export async function renameTemplateFolder(folderId: string, name: string) {
  const { org } = await requireAdmin();
  await db.docFolder.findFirstOrThrow({ where: { id: folderId, organizationId: org.id, isTemplate: true } });
  await db.docFolder.update({ where: { id: folderId }, data: { name: name.trim() } });
  revalidatePath("/templates");
}

export async function deleteTemplateFolder(folderId: string) {
  const { org } = await requireAdmin();
  const folder = await db.docFolder.findFirstOrThrow({
    where: { id: folderId, organizationId: org.id, isTemplate: true },
    select: { parentId: true },
  });
  await db.docFolder.updateMany({
    where: { parentId: folderId, organizationId: org.id },
    data: { parentId: folder.parentId },
  });
  await db.docFolder.delete({ where: { id: folderId } });
  revalidatePath("/templates");
}

export async function createTemplateDoc(title: string, folderId?: string | null, emoji?: string) {
  const { user, org } = await requireAdmin();
  const doc = await db.doc.create({
    data: {
      organizationId: org.id,
      projectId: null,
      isTemplate: true,
      authorId: user.id,
      title: title.trim() || "Untitled",
      emoji: emoji ?? null,
      folderId: folderId ?? null,
    },
  });
  revalidatePath("/templates");
  return doc;
}

export async function updateTemplateDoc(docId: string, input: { title?: string; content?: string; emoji?: string | null }) {
  const { org } = await requireAdmin();
  await db.doc.findFirstOrThrow({ where: { id: docId, organizationId: org.id, isTemplate: true } });
  const updated = await db.doc.update({ where: { id: docId }, data: input });
  revalidatePath("/templates");
  revalidatePath(`/templates/docs/${docId}`);
  return updated;
}

export async function deleteTemplateDoc(docId: string) {
  const { org } = await requireAdmin();
  await db.doc.findFirstOrThrow({ where: { id: docId, organizationId: org.id, isTemplate: true } });
  await db.doc.delete({ where: { id: docId } });
  revalidatePath("/templates");
}

export async function deleteTemplateFile(fileId: string) {
  const { org } = await requireAdmin();
  await db.projectFile.findFirstOrThrow({ where: { id: fileId, organizationId: org.id, isTemplate: true } });
  await db.projectFile.delete({ where: { id: fileId } });
  revalidatePath("/templates");
}

// ─── Import project content into templates ────────────────────────────────────

export type ImportResult = {
  folders: number;
  docs: number;
  files: number;
  projectName: string;
};

export async function importProjectToTemplates(projectId: string, targetFolderId?: string | null): Promise<ImportResult> {
  const { org } = await requireAdmin();

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId, organizationId: org.id },
    select: { name: true },
  });

  const sourceFolders = await db.docFolder.findMany({
    where: { projectId, organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });

  const folderIdMap = new Map<string, string>();
  const toProcess = [...sourceFolders];
  let maxPasses = 10;

  while (toProcess.length > 0 && maxPasses-- > 0) {
    const deferred: typeof toProcess = [];
    for (const f of toProcess) {
      if (f.parentId && !folderIdMap.has(f.parentId)) { deferred.push(f); continue; }
      const newParentId = f.parentId ? (folderIdMap.get(f.parentId) ?? null) : (targetFolderId ?? null);
      const existing = await db.docFolder.findFirst({
        where: { organizationId: org.id, isTemplate: true, parentId: newParentId, name: f.name },
        select: { id: true },
      });
      if (existing) {
        folderIdMap.set(f.id, existing.id);
      } else {
        const newFolder = await db.docFolder.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: org.id,
            projectId: null,
            isTemplate: true,
            name: f.name,
            parentId: newParentId,
          },
        });
        folderIdMap.set(f.id, newFolder.id);
      }
    }
    toProcess.splice(0, toProcess.length, ...deferred);
  }

  const projectDocs = await db.doc.findMany({
    where: { projectId, organizationId: org.id },
    select: { id: true, folderId: true },
  });

  for (const doc of projectDocs) {
    const newFolderId = doc.folderId ? (folderIdMap.get(doc.folderId) ?? null) : (targetFolderId ?? null);
    await db.doc.update({
      where: { id: doc.id },
      data: { projectId: null, isTemplate: true, folderId: newFolderId },
    });
  }

  const projectFiles = await db.projectFile.findMany({
    where: {
      projectId,
      organizationId: org.id,
      submittedDeliverable: null,
      deliverableVersionFiles: { none: {} },
    },
    select: { id: true, folderId: true },
  });

  for (const file of projectFiles) {
    const newFolderId = file.folderId ? (folderIdMap.get(file.folderId) ?? null) : (targetFolderId ?? null);
    await db.projectFile.update({
      where: { id: file.id },
      data: { projectId: null, isTemplate: true, folderId: newFolderId },
    });
  }

  revalidatePath("/templates");
  revalidatePath(`/projects/${projectId}/docs`);
  revalidatePath(`/projects/${projectId}/files`);

  return {
    projectName: project.name,
    folders: folderIdMap.size,
    docs: projectDocs.length,
    files: projectFiles.length,
  };
}

export async function moveTemplateItemToFolder(type: "doc" | "file", itemId: string, folderId: string | null) {
  const { org } = await requireAdmin();
  if (type === "doc") {
    await db.doc.findFirstOrThrow({ where: { id: itemId, organizationId: org.id, isTemplate: true } });
    await db.doc.update({ where: { id: itemId }, data: { folderId } });
  } else {
    await db.projectFile.findFirstOrThrow({ where: { id: itemId, organizationId: org.id, isTemplate: true } });
    await db.projectFile.update({ where: { id: itemId }, data: { folderId } });
  }
  revalidatePath("/templates");
}

export async function bulkDeleteTemplateItems(docIds: string[], fileIds: string[]) {
  const { org } = await requireAdmin();
  await Promise.all([
    docIds.length > 0
      ? db.doc.deleteMany({ where: { id: { in: docIds }, organizationId: org.id, isTemplate: true } })
      : Promise.resolve(),
    fileIds.length > 0
      ? db.projectFile.deleteMany({ where: { id: { in: fileIds }, organizationId: org.id, isTemplate: true } })
      : Promise.resolve(),
  ]);
  revalidatePath("/templates");
}

export async function revertTemplateImport(projectId: string) {
  const { org } = await requireAdmin();
  await db.project.findFirstOrThrow({ where: { id: projectId, organizationId: org.id } });

  await db.doc.updateMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true },
    data: { projectId, folderId: null, isTemplate: false },
  });
  await db.projectFile.updateMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true },
    data: { projectId, folderId: null, isTemplate: false },
  });
  await db.docFolder.updateMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true },
    data: { parentId: null },
  });
  await db.docFolder.deleteMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: true },
  });

  revalidatePath("/templates");
  revalidatePath(`/projects/${projectId}/docs`);
  revalidatePath(`/projects/${projectId}/files`);
}

export async function getProjectsForTemplateImport() {
  const { org } = await requireAdmin();
  return db.project.findMany({
    where: { organizationId: org.id, status: { not: "ARCHIVED" } },
    select: {
      id: true, name: true, color: true, iconEmoji: true,
      _count: { select: { docs: true, files: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getTemplatesNote(): Promise<string | null> {
  const { orgId } = await auth();
  if (!orgId) return null;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  return org?.templatesNote ?? null;
}

export async function updateTemplatesNote(note: string) {
  const ctx = await requireAdmin();
  await db.organization.update({
    where: { id: ctx.org.id },
    data: { templatesNote: note.trim() || null },
  });
  revalidatePath("/templates");
}

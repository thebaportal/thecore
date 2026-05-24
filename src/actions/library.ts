"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

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

async function requireAdmin() {
  const ctx = await getContext();
  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: ctx.org.id, userId: ctx.user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") {
    throw new Error("Admin only");
  }
  return ctx;
}

// ─── Queries (available to all org members) ───────────────────────────────────

export async function getLibraryFolders(parentId: string | null = null) {
  const { orgId } = await auth();
  if (!orgId) return [];
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.docFolder.findMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false, parentId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { docs: true, children: true, files: true } },
      docs: { select: { title: true, emoji: true }, take: 4, orderBy: { updatedAt: "desc" } },
      files: { select: { name: true }, take: 3, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getLibraryDocs(folderId: string | null = null) {
  const { orgId } = await auth();
  if (!orgId) return [];
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.doc.findMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false, folderId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, emoji: true, createdAt: true, updatedAt: true,
      content: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function getLibraryFiles(folderId: string | null = null) {
  const { orgId } = await auth();
  if (!orgId) return [];
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.projectFile.findMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false, folderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, url: true, utKey: true, mimeType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function getLibraryDoc(docId: string) {
  const { orgId } = await auth();
  if (!orgId) return null;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;

  return db.doc.findFirst({
    where: { id: docId, organizationId: org.id, projectId: { equals: null }, isTemplate: false },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function getLibraryFolderBreadcrumb(folderId: string): Promise<{ id: string; name: string }[]> {
  const { orgId } = await auth();
  if (!orgId) return [];
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
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

export async function searchLibraryItems(query: string) {
  const { orgId } = await auth();
  if (!orgId) return { folders: [], docs: [], files: [] };
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return { folders: [], docs: [], files: [] };

  const q = query.trim();
  if (!q) return { folders: [], docs: [], files: [] };

  const [folders, docs, files] = await Promise.all([
    db.docFolder.findMany({
      where: { organizationId: org.id, projectId: null, isTemplate: false, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, _count: { select: { docs: true, files: true, children: true } } },
      take: 8,
      orderBy: { name: "asc" },
    }),
    db.doc.findMany({
      where: { organizationId: org.id, projectId: null, isTemplate: false, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, emoji: true, updatedAt: true, author: { select: { name: true } }, folder: { select: { id: true, name: true } } },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    db.projectFile.findMany({
      where: { organizationId: org.id, projectId: null, isTemplate: false, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true, folder: { select: { id: true, name: true } } },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { folders, docs, files };
}

// ─── Admin mutations ──────────────────────────────────────────────────────────

export async function createLibraryFolder(name: string, parentId?: string | null) {
  const { org } = await requireAdmin();

  // Validate parentId — fall back to root if the folder no longer exists
  if (parentId) {
    const parent = await db.docFolder.findFirst({ where: { id: parentId, organizationId: org.id } });
    if (!parent) parentId = null;
  }

  const folder = await db.docFolder.create({
    data: {
      id: crypto.randomUUID(),
      organizationId: org.id,
      projectId: null,
      isTemplate: false,
      name: name.trim(),
      parentId: parentId ?? null,
    },
  });
  revalidatePath("/library");
  return folder;
}

export async function renameLibraryFolder(folderId: string, name: string) {
  const { org } = await requireAdmin();
  await db.docFolder.findFirstOrThrow({ where: { id: folderId, organizationId: org.id, projectId: { equals: null } } });
  await db.docFolder.update({ where: { id: folderId }, data: { name: name.trim() } });
  revalidatePath("/library");
}

export async function deleteLibraryFolder(folderId: string) {
  const { org } = await requireAdmin();
  const folder = await db.docFolder.findFirstOrThrow({
    where: { id: folderId, organizationId: org.id, projectId: { equals: null } },
    select: { parentId: true },
  });
  // Promote children up one level before deleting
  await db.docFolder.updateMany({
    where: { parentId: folderId, organizationId: org.id },
    data: { parentId: folder.parentId },
  });
  await db.docFolder.delete({ where: { id: folderId } });
  revalidatePath("/library");
}

export async function createLibraryDoc(title: string, folderId?: string | null, emoji?: string) {
  const { user, org } = await requireAdmin();
  const doc = await db.doc.create({
    data: {
      organizationId: org.id,
      projectId: null,
      isTemplate: false,
      authorId: user.id,
      title: title.trim() || "Untitled",
      emoji: emoji ?? null,
      folderId: folderId ?? null,
    },
  });
  revalidatePath("/library");
  return doc;
}

export async function updateLibraryDoc(docId: string, input: { title?: string; content?: string; emoji?: string | null }) {
  const { org } = await requireAdmin();
  await db.doc.findFirstOrThrow({ where: { id: docId, organizationId: org.id, projectId: { equals: null } } });
  const updated = await db.doc.update({ where: { id: docId }, data: input });
  revalidatePath("/library");
  revalidatePath(`/library/docs/${docId}`);
  return updated;
}

export async function deleteLibraryDoc(docId: string) {
  const { org } = await requireAdmin();
  await db.doc.findFirstOrThrow({ where: { id: docId, organizationId: org.id, projectId: { equals: null } } });
  await db.doc.delete({ where: { id: docId } });
  revalidatePath("/library");
}

export async function deleteLibraryFile(fileId: string) {
  const { org } = await requireAdmin();
  await db.projectFile.findFirstOrThrow({ where: { id: fileId, organizationId: org.id, projectId: { equals: null } } });
  await db.projectFile.delete({ where: { id: fileId } });
  revalidatePath("/library");
}

// ─── Import project content into the library ─────────────────────────────────

export type ImportResult = {
  folders: number;
  docs: number;
  files: number;
  projectName: string;
};

export async function importProjectToLibrary(projectId: string, targetFolderId?: string | null): Promise<ImportResult> {
  const { org } = await requireAdmin();

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId, organizationId: org.id },
    select: { name: true },
  });

  // Get all folders for this project
  const sourceFolders = await db.docFolder.findMany({
    where: { projectId, organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });

  // Build folder ID mapping: old project folder ID → new library folder ID
  const folderIdMap = new Map<string, string>();

  // Process folders level by level (root first, then children)
  const toProcess = [...sourceFolders];
  let maxPasses = 10;

  while (toProcess.length > 0 && maxPasses-- > 0) {
    const deferred: typeof toProcess = [];
    for (const f of toProcess) {
      if (f.parentId && !folderIdMap.has(f.parentId)) {
        deferred.push(f);
        continue;
      }
      // Root-level project folders land in targetFolderId (if set), otherwise library root
      const newParentId = f.parentId ? (folderIdMap.get(f.parentId) ?? null) : (targetFolderId ?? null);
      const newFolder = await db.docFolder.create({
        data: {
          id: crypto.randomUUID(),
          organizationId: org.id,
          projectId: null,
          isTemplate: false,
          name: f.name,
          parentId: newParentId,
        },
      });
      folderIdMap.set(f.id, newFolder.id);
    }
    toProcess.splice(0, toProcess.length, ...deferred);
  }

  // Move docs: update projectId → null, remap folderId
  const projectDocs = await db.doc.findMany({
    where: { projectId, organizationId: org.id },
    select: { id: true, folderId: true },
  });

  for (const doc of projectDocs) {
    // Root-level docs land in targetFolderId (if set), otherwise library root
    const newFolderId = doc.folderId ? (folderIdMap.get(doc.folderId) ?? null) : (targetFolderId ?? null);
    await db.doc.update({
      where: { id: doc.id },
      data: { projectId: null, isTemplate: false, folderId: newFolderId },
    });
  }

  // Move files (exclude deliverable files)
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
    // Root-level files land in targetFolderId (if set), otherwise library root
    const newFolderId = file.folderId ? (folderIdMap.get(file.folderId) ?? null) : (targetFolderId ?? null);
    await db.projectFile.update({
      where: { id: file.id },
      data: { projectId: null, isTemplate: false, folderId: newFolderId },
    });
  }

  revalidatePath("/library");
  revalidatePath(`/projects/${projectId}/docs`);
  revalidatePath(`/projects/${projectId}/files`);

  return {
    projectName: project.name,
    folders: folderIdMap.size,
    docs: projectDocs.length,
    files: projectFiles.length,
  };
}

export async function moveLibraryItemToFolder(
  type: "doc" | "file",
  itemId: string,
  folderId: string | null,
) {
  const { org } = await requireAdmin();
  if (type === "doc") {
    await db.doc.findFirstOrThrow({ where: { id: itemId, organizationId: org.id, projectId: { equals: null }, isTemplate: false } });
    await db.doc.update({ where: { id: itemId }, data: { folderId } });
  } else {
    await db.projectFile.findFirstOrThrow({ where: { id: itemId, organizationId: org.id, projectId: { equals: null }, isTemplate: false } });
    await db.projectFile.update({ where: { id: itemId }, data: { folderId } });
  }
  revalidatePath("/library");
}

export async function bulkDeleteLibraryItems(docIds: string[], fileIds: string[]) {
  const { org } = await requireAdmin();
  await Promise.all([
    docIds.length > 0
      ? db.doc.deleteMany({ where: { id: { in: docIds }, organizationId: org.id, projectId: { equals: null }, isTemplate: false } })
      : Promise.resolve(),
    fileIds.length > 0
      ? db.projectFile.deleteMany({ where: { id: { in: fileIds }, organizationId: org.id, projectId: { equals: null }, isTemplate: false } })
      : Promise.resolve(),
  ]);
  revalidatePath("/library");
}

export async function revertLibraryImport(projectId: string) {
  const { org } = await requireAdmin();
  await db.project.findFirstOrThrow({ where: { id: projectId, organizationId: org.id } });

  // Move docs back (clears library folder references too)
  await db.doc.updateMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false },
    data: { projectId, folderId: null },
  });

  // Move files back
  await db.projectFile.updateMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false },
    data: { projectId, folderId: null },
  });

  // Break folder parent-child links first (onDelete: NoAction prevents deleting with children)
  await db.docFolder.updateMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false },
    data: { parentId: null },
  });

  // Delete all library folders (not template folders)
  await db.docFolder.deleteMany({
    where: { organizationId: org.id, projectId: { equals: null }, isTemplate: false },
  });

  revalidatePath("/library");
  revalidatePath(`/projects/${projectId}/docs`);
  revalidatePath(`/projects/${projectId}/files`);
}

// ─── Project list for import picker ──────────────────────────────────────────

export async function getProjectsForImport() {
  const { orgId } = await auth();
  if (!orgId) return [];
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.project.findMany({
    where: { organizationId: org.id, status: { not: "ARCHIVED" } },
    select: {
      id: true, name: true, color: true, iconEmoji: true,
      _count: { select: { docs: true, files: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getLibraryNote(): Promise<string | null> {
  const { orgId } = await auth();
  if (!orgId) return null;
  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  return org?.libraryNote ?? null;
}

export async function updateLibraryNote(note: string) {
  const ctx = await requireAdmin();
  await db.organization.update({
    where: { id: ctx.org.id },
    data: { libraryNote: note.trim() || null },
  });
  revalidatePath("/library");
}

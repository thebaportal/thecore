"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function getProjectFiles(projectId: string, folderId: string | null = null) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.projectFile.findMany({
    where: { projectId, organizationId: org.id, folderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      utKey: true,
      mimeType: true,
      size: true,
      createdAt: true,
      importedAuthor: true,
      uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function deleteProjectFile(fileId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) throw new Error("Organization not found");

  const file = await db.projectFile.findUnique({
    where: { id: fileId, organizationId: org.id },
    select: { utKey: true, projectId: true },
  });
  if (!file) throw new Error("File not found");

  if (file.utKey) {
    await utapi.deleteFiles([file.utKey]);
  }

  await db.projectFile.delete({ where: { id: fileId } });
  revalidatePath(`/projects/${file.projectId}/files`);
}

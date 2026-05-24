import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createNotificationsForUsers, getOrgUserIdsByRole } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      const user = await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
      if (!user) throw new Error("User not found");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db.user.update({
        where: { id: metadata.userId },
        data: { avatarUrl: file.ufsUrl },
      });
      return { url: file.ufsUrl };
    }),

  projectFileUploader: f({
    image:              { maxFileSize: "8MB",  maxFileCount: 10 },
    pdf:                { maxFileSize: "32MB", maxFileCount: 5  },
    // Word
    "application/msword":                 { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 5 },
    // Excel
    "application/vnd.ms-excel":           { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":      { maxFileSize: "16MB", maxFileCount: 5 },
    // PowerPoint
    "application/vnd.ms-powerpoint":      { maxFileSize: "32MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxFileSize: "32MB", maxFileCount: 5 },
    // Visio (.vsd)
    "application/vnd.visio":              { maxFileSize: "32MB", maxFileCount: 5 },
    // Other
    text:               { maxFileSize: "4MB",  maxFileCount: 10 },
    video:              { maxFileSize: "256MB", maxFileCount: 2  },
    "application/zip":  { maxFileSize: "64MB", maxFileCount: 3  },
    // Catch-all for Visio VSDX and other specialised formats not in UploadThing's MIME registry
    blob:               { maxFileSize: "64MB", maxFileCount: 5  },
  })
    .input(z.object({ projectId: z.string(), folderId: z.string().optional() }))
    .middleware(async ({ input }) => {
      const { userId, orgId } = await auth();
      if (!userId || !orgId) throw new Error("Unauthorized");

      const [user, org] = await Promise.all([
        db.user.findUnique({ where: { clerkUserId: userId } }),
        db.organization.findUnique({ where: { clerkOrgId: orgId } }),
      ]);
      if (!user || !org) throw new Error("User not found");

      const project = await db.project.findUnique({
        where: { id: input.projectId, organizationId: org.id },
      });
      if (!project) throw new Error("Project not found");

      return { userId: user.id, orgId: org.id, projectId: input.projectId, folderId: input.folderId ?? null };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const saved = await db.projectFile.create({
        data: {
          organizationId: metadata.orgId,
          projectId: metadata.projectId,
          uploadedById: metadata.userId,
          folderId: metadata.folderId,
          name: file.name,
          url: file.ufsUrl,
          utKey: file.key,
          mimeType: file.type,
          size: file.size,
        },
      });
      return { fileId: saved.id };
    }),

  libraryFileUploader: f({
    image:              { maxFileSize: "8MB",  maxFileCount: 10 },
    pdf:                { maxFileSize: "32MB", maxFileCount: 5  },
    "application/msword":                 { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.ms-excel":           { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":      { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.ms-powerpoint":      { maxFileSize: "32MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxFileSize: "32MB", maxFileCount: 5 },
    "application/vnd.visio":              { maxFileSize: "32MB", maxFileCount: 5 },
    text:               { maxFileSize: "4MB",  maxFileCount: 10 },
    video:              { maxFileSize: "256MB", maxFileCount: 2  },
    "application/zip":  { maxFileSize: "64MB", maxFileCount: 3  },
    blob:               { maxFileSize: "64MB", maxFileCount: 5  },
  })
    .input(z.object({ folderId: z.string().optional() }))
    .middleware(async ({ input }) => {
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
      if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") {
        throw new Error("Only admins can upload to the library");
      }

      return { userId: user.id, orgId: org.id, orgName: org.name, folderId: input.folderId ?? null };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const saved = await db.projectFile.create({
        data: {
          organizationId: metadata.orgId,
          projectId: null,
          isTemplate: false,
          uploadedById: metadata.userId,
          folderId: metadata.folderId,
          name: file.name,
          url: file.ufsUrl,
          utKey: file.key,
          mimeType: file.type,
          size: file.size,
        },
      });

      // Notify members of currently ACTIVE projects about the new library resource
      const activeProjectMembers = await db.projectMember.findMany({
        where: {
          project: { organizationId: metadata.orgId, status: "ACTIVE" },
          userId: { not: metadata.userId },
        },
        select: { userId: true },
      });
      const memberIds = [...new Set(activeProjectMembers.map((m) => m.userId))];
      if (memberIds.length > 0) {
        void createNotificationsForUsers(metadata.orgId, memberIds, "LIBRARY_UPLOAD", {
          title: "New resource added to the Library",
          body: file.name,
          href: "/library",
        }, metadata.orgName);
      }

      revalidatePath("/library");
      return { fileId: saved.id };
    }),

  templatesFileUploader: f({
    image:              { maxFileSize: "8MB",  maxFileCount: 10 },
    pdf:                { maxFileSize: "32MB", maxFileCount: 5  },
    "application/msword":                 { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.ms-excel":           { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":      { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.ms-powerpoint":      { maxFileSize: "32MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxFileSize: "32MB", maxFileCount: 5 },
    "application/vnd.visio":              { maxFileSize: "32MB", maxFileCount: 5 },
    text:               { maxFileSize: "4MB",  maxFileCount: 10 },
    video:              { maxFileSize: "256MB", maxFileCount: 2  },
    "application/zip":  { maxFileSize: "64MB", maxFileCount: 3  },
    blob:               { maxFileSize: "64MB", maxFileCount: 5  },
  })
    .input(z.object({ folderId: z.string().optional() }))
    .middleware(async ({ input }) => {
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
      if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") {
        throw new Error("Only admins can upload to templates");
      }

      return { userId: user.id, orgId: org.id, folderId: input.folderId ?? null };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const saved = await db.projectFile.create({
        data: {
          organizationId: metadata.orgId,
          projectId: null,
          isTemplate: true,
          uploadedById: metadata.userId,
          folderId: metadata.folderId,
          name: file.name,
          url: file.ufsUrl,
          utKey: file.key,
          mimeType: file.type,
          size: file.size,
        },
      });
      return { fileId: saved.id };
    }),

  deliverableUploader: f({
    image:              { maxFileSize: "8MB",  maxFileCount: 1 },
    pdf:                { maxFileSize: "32MB", maxFileCount: 1 },
    "application/msword":                 { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.ms-excel":           { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":      { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.ms-powerpoint":      { maxFileSize: "32MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxFileSize: "32MB", maxFileCount: 1 },
    "application/vnd.visio":              { maxFileSize: "32MB", maxFileCount: 1 },
    text:               { maxFileSize: "4MB",  maxFileCount: 1 },
    "application/zip":  { maxFileSize: "64MB", maxFileCount: 1 },
    blob:               { maxFileSize: "64MB", maxFileCount: 1 },
  })
    .input(z.object({ projectId: z.string(), deliverableId: z.string(), note: z.string().optional() }))
    .middleware(async ({ input }) => {
      const { userId, orgId } = await auth();
      if (!userId || !orgId) throw new Error("Unauthorized");

      const [user, org] = await Promise.all([
        db.user.findUnique({ where: { clerkUserId: userId } }),
        db.organization.findUnique({ where: { clerkOrgId: orgId } }),
      ]);
      if (!user || !org) throw new Error("User not found");

      const deliverable = await db.phaseDeliverable.findFirst({
        where: {
          id: input.deliverableId,
          phase: { projectId: input.projectId, project: { organizationId: org.id }, isLocked: false },
        },
        select: { id: true },
      });
      if (!deliverable) throw new Error("Deliverable not found or phase is locked");

      return { userId: user.id, orgId: org.id, orgName: org.name, projectId: input.projectId, deliverableId: input.deliverableId, note: input.note ?? null };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Sequential writes — no interactive transaction to avoid connection-pool timeouts

      const pf = await db.projectFile.create({
        data: {
          organizationId: metadata.orgId,
          projectId: metadata.projectId,
          uploadedById: metadata.userId,
          name: file.name,
          url: file.ufsUrl,
          utKey: file.key,
          mimeType: file.type,
          size: file.size,
        },
      });

      const [deliverable, submitter] = await Promise.all([
        db.phaseDeliverable.findUnique({
          where: { id: metadata.deliverableId },
          select: {
            submissionKind: true,
            title: true,
            phase: { select: { project: { select: { name: true } } } },
          },
        }),
        db.user.findUnique({ where: { id: metadata.userId }, select: { name: true } }),
      ]);
      if (!deliverable) throw new Error("Deliverable not found");

      if (deliverable.submissionKind === "INDIVIDUAL") {
        await db.studentSubmission.upsert({
          where: { deliverableId_userId: { deliverableId: metadata.deliverableId, userId: metadata.userId } },
          create: {
            deliverableId: metadata.deliverableId,
            userId: metadata.userId,
            fileId: pf.id,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
          update: {
            fileId: pf.id,
            status: "SUBMITTED",
            submittedAt: new Date(),
            reviewedById: null,
            reviewedAt: null,
            reviewNote: null,
          },
        });
      } else {
        await db.phaseDeliverable.update({
          where: { id: metadata.deliverableId },
          data: {
            status: "SUBMITTED",
            submittedFileId: pf.id,
            submittedById: metadata.userId,
            submittedAt: new Date(),
            reviewedById: null,
            reviewedAt: null,
            reviewNote: null,
          },
        });
      }

      const last = await db.deliverableVersion.findFirst({
        where: { deliverableId: metadata.deliverableId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;
      await db.deliverableVersion.create({
        data: {
          deliverableId: metadata.deliverableId,
          fileId: pf.id,
          uploadedById: metadata.userId,
          versionNumber,
          note: metadata.note || null,
        },
      });

      const saved = {
        fileId: pf.id,
        versionNumber,
        deliverableTitle: deliverable.title,
        projectName: deliverable.phase.project.name,
        submitterName: submitter?.name ?? "A team member",
      };

      // Notify all instructors
      const instructorIds = await getOrgUserIdsByRole(metadata.orgId, ["OWNER", "ADMIN"]);
      await createNotificationsForUsers(metadata.orgId, instructorIds, "DELIVERABLE_SUBMITTED", {
        title: `${saved.projectName} · ${saved.deliverableTitle}`,
        body: `${saved.submitterName} submitted this deliverable and it's ready for your review.`,
        href: `/projects/${metadata.projectId}/phases`,
      }, metadata.orgName);

      revalidatePath(`/projects/${metadata.projectId}/phases`);
      return { fileId: saved.fileId, versionNumber: saved.versionNumber };
    }),
  messageAttachmentUploader: f({
    image:   { maxFileSize: "8MB",   maxFileCount: 5  },
    pdf:     { maxFileSize: "32MB",  maxFileCount: 5  },
    "application/msword":                 { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.ms-excel":           { maxFileSize: "16MB", maxFileCount: 5 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":      { maxFileSize: "16MB", maxFileCount: 5 },
    video:   { maxFileSize: "128MB", maxFileCount: 2  },
    blob:    { maxFileSize: "32MB",  maxFileCount: 5  },
  })
    .input(z.object({ pingId: z.string() }))
    .middleware(async ({ input }) => {
      const { userId, orgId } = await auth();
      if (!userId || !orgId) throw new Error("Unauthorized");

      const [user, org] = await Promise.all([
        db.user.findUnique({ where: { clerkUserId: userId } }),
        db.organization.findUnique({ where: { clerkOrgId: orgId } }),
      ]);
      if (!user || !org) throw new Error("User not found");

      const ping = await db.ping.findUnique({
        where: { id: input.pingId, organizationId: org.id },
        select: { id: true },
      });
      if (!ping) throw new Error("Chat not found");

      return { pingId: input.pingId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { pingId: metadata.pingId, url: file.ufsUrl, name: file.name, mimeType: file.type, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

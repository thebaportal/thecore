"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createNotificationsForUsers, getOrgUserIdsByRole } from "@/lib/notifications";

export async function getReviewQueue() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return null;

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return { deliverables: [], isInstructor: false };
  }

  const deliverables = await db.phaseDeliverable.findMany({
    where: {
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      phase: { project: { organizationId: org.id, status: "ACTIVE" }, isLocked: false },
    },
    include: {
      phase: {
        select: {
          id: true, order: true, name: true,
          project: { select: { id: true, name: true, color: true, iconEmoji: true } },
        },
      },
      submittedBy:   { select: { id: true, name: true, avatarUrl: true } },
      submittedFile: { select: { id: true, name: true, url: true, size: true, mimeType: true } },
      reviewedBy:    { select: { id: true, name: true } },
      versions: {
        select: {
          id: true, versionNumber: true, uploadedAt: true, note: true,
          file:       { select: { id: true, name: true, url: true, size: true } },
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  return { deliverables, isInstructor: true };
}

export async function getPendingReviewCount(): Promise<{ count: number; isInstructor: boolean }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { count: 0, isInstructor: false };

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return { count: 0, isInstructor: false };

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  const isInstructor = membership?.role === "OWNER" || membership?.role === "ADMIN";
  if (!isInstructor) return { count: 0, isInstructor: false };

  const count = await db.phaseDeliverable.count({
    where: {
      status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      phase: { project: { organizationId: org.id, status: "ACTIVE" }, isLocked: false },
    },
  });
  return { count, isInstructor: true };
}

export async function getProjectPhasesWithDeliverables(projectId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return null;

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  const isInstructor = membership?.role === "OWNER" || membership?.role === "ADMIN";

  // Students must be a ProjectMember to access the project's phases
  if (!isInstructor) {
    const isMember = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dbUser.id } },
      select: { id: true },
    });
    if (!isMember) return null;
  }

  const [phases, projectMembers, orgAdminMemberships] = await Promise.all([
    db.projectPhase.findMany({
      where: { projectId, project: { organizationId: org.id } },
      include: {
        deliverables: {
          select: {
            id: true, title: true, description: true,
            submissionKind: true, requiresFileUpload: true, dueDate: true,
            order: true, status: true,
            submittedFileId: true, submittedAt: true, reviewNote: true,
            submittedFile: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
            submittedBy:   { select: { id: true, name: true, avatarUrl: true } },
            reviewedBy:    { select: { id: true, name: true } },
            assignedReviewer: { select: { id: true, name: true } },
            versions: {
              select: {
                id: true, versionNumber: true, uploadedAt: true, note: true,
                file:       { select: { id: true, name: true, url: true, size: true } },
                uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
              },
              orderBy: { versionNumber: "desc" },
            },
            studentSubmissions: {
              select: {
                id: true, status: true, submittedAt: true, reviewNote: true,
                user:       { select: { id: true, name: true, avatarUrl: true } },
                file:       { select: { id: true, name: true, url: true, size: true } },
                reviewedBy: { select: { id: true, name: true } },
              },
              orderBy: { submittedAt: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    }),
    db.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    db.orgMembership.findMany({
      where: { organizationId: org.id, role: { in: ["OWNER", "ADMIN"] } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    phases,
    currentUserRole: membership?.role ?? ("MEMBER" as const),
    currentUserId: dbUser.id,
    projectMembers: projectMembers.map((m) => m.user),
    orgAdmins: orgAdminMemberships.map((m) => m.user),
  };
}

export async function reviewDeliverable(
  deliverableId: string,
  decision: "APPROVE" | "REVISION_NEEDED",
  note?: string,
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) throw new Error("User not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only instructors can review deliverables");
  }

  const deliverable = await db.phaseDeliverable.findFirst({
    where: { id: deliverableId, phase: { project: { organizationId: org.id } } },
    select: {
      title: true,
      phase: {
        select: {
          projectId: true,
          project: { select: { name: true } },
        },
      },
    },
  });
  if (!deliverable) throw new Error("Deliverable not found");

  const projectId = deliverable.phase.projectId;
  const projectName = deliverable.phase.project.name;

  await db.phaseDeliverable.update({
    where: { id: deliverableId },
    data: {
      status: decision === "APPROVE" ? "APPROVED" : "REVISION_NEEDED",
      reviewedById: dbUser.id,
      reviewedAt: new Date(),
      reviewNote: note?.trim() || null,
    },
  });

  const href = `/projects/${projectId}/phases`;

  // In-app notifications for all students
  const studentIds = await getOrgUserIdsByRole(org.id, ["MEMBER", "GUEST"]);
  if (decision === "APPROVE") {
    await createNotificationsForUsers(org.id, studentIds, "DELIVERABLE_APPROVED", {
      title: `${projectName} · Approved`,
      body: `"${deliverable.title}" has been approved.`,
      href,
    }, org.name);
  } else {
    const body = note?.trim()
      ? `"${deliverable.title}" needs revision: ${note.trim()}`
      : `"${deliverable.title}" needs revision.`;
    await createNotificationsForUsers(org.id, studentIds, "DELIVERABLE_REVISION", {
      title: `${projectName} · Revision needed`,
      body,
      href,
    }, org.name);
  }

  // Post message to project general ping
  const generalPing = await db.ping.findFirst({
    where: { projectId, type: "GROUP" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (generalPing) {
    const pingBody =
      decision === "APPROVE"
        ? `✅ "${deliverable.title}" has been approved.`
        : note?.trim()
          ? `📝 "${deliverable.title}" needs revision: ${note.trim()}`
          : `📝 "${deliverable.title}" needs revision.`;

    await db.pingParticipant.upsert({
      where: { pingId_userId: { pingId: generalPing.id, userId: dbUser.id } },
      create: { pingId: generalPing.id, userId: dbUser.id },
      update: {},
    });
    await db.message.create({
      data: { pingId: generalPing.id, authorId: dbUser.id, body: pingBody },
    });
    await db.ping.update({ where: { id: generalPing.id }, data: { updatedAt: new Date() } });
  }

  revalidatePath(href);
}

export async function assignDeliverableReviewer(deliverableId: string, reviewerId: string | null) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true, name: true } }),
  ]);
  if (!org || !dbUser) throw new Error("User not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only instructors can assign reviewers");
  }

  const deliverable = await db.phaseDeliverable.findFirst({
    where: { id: deliverableId, phase: { project: { organizationId: org.id } } },
    select: {
      title: true,
      phase: { select: { projectId: true, project: { select: { name: true } } } },
    },
  });
  if (!deliverable) throw new Error("Deliverable not found");

  await db.phaseDeliverable.update({
    where: { id: deliverableId },
    data: { assignedReviewerId: reviewerId },
  });

  if (reviewerId && reviewerId !== dbUser.id) {
    await createNotificationsForUsers(org.id, [reviewerId], "DELIVERABLE_ASSIGNED", {
      title: `${deliverable.phase.project.name} · Review assigned`,
      body: `${dbUser.name} assigned you to review "${deliverable.title}".`,
      href: `/projects/${deliverable.phase.projectId}/phases`,
    }, org.name);
  }

  revalidatePath(`/projects/${deliverable.phase.projectId}/phases`);
}

export async function reviewStudentSubmission(
  submissionId: string,
  decision: "APPROVE" | "REVISION_NEEDED",
  note?: string,
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) throw new Error("User not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only instructors can review submissions");
  }

  const submission = await db.studentSubmission.findFirst({
    where: { id: submissionId, deliverable: { phase: { project: { organizationId: org.id } } } },
    select: {
      userId: true,
      deliverable: {
        select: {
          title: true,
          phase: { select: { projectId: true, project: { select: { name: true } } } },
        },
      },
    },
  });
  if (!submission) throw new Error("Submission not found");

  await db.studentSubmission.update({
    where: { id: submissionId },
    data: {
      status: decision === "APPROVE" ? "APPROVED" : "REVISION_NEEDED",
      reviewedById: dbUser.id,
      reviewedAt: new Date(),
      reviewNote: note?.trim() || null,
    },
  });

  const href = `/projects/${submission.deliverable.phase.projectId}/phases`;
  const projectName = submission.deliverable.phase.project.name;
  const title = submission.deliverable.title;

  const kind = decision === "APPROVE" ? "DELIVERABLE_APPROVED" : "DELIVERABLE_REVISION";
  const notifTitle = decision === "APPROVE" ? `${projectName} · Approved` : `${projectName} · Revision needed`;
  const notifBody = decision === "APPROVE"
    ? `"${title}" has been approved.`
    : note?.trim() ? `"${title}" needs revision: ${note.trim()}` : `"${title}" needs revision.`;

  await createNotificationsForUsers(org.id, [submission.userId], kind, {
    title: notifTitle, body: notifBody, href,
  }, org.name);

  revalidatePath(href);
}

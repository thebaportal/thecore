"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createNotificationsForUsers, getOrgUserIdsByRole } from "@/lib/notifications";

async function assertInstructor() {
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
    throw new Error("Only instructors can manage phases");
  }

  return { org, dbUser };
}

async function getPhaseProjectId(phaseId: string, orgId: string) {
  const phase = await db.projectPhase.findFirst({
    where: { id: phaseId, project: { organizationId: orgId } },
    select: { projectId: true },
  });
  if (!phase) throw new Error("Phase not found");
  return phase.projectId;
}

export async function updatePhase(
  phaseId: string,
  data: { name?: string; guidance?: string; dueDate?: Date | null; startedAt?: Date | null }
) {
  const { org } = await assertInstructor();
  const projectId = await getPhaseProjectId(phaseId, org.id);

  await db.projectPhase.update({
    where: { id: phaseId },
    data,
  });

  revalidatePath(`/projects/${projectId}/phases`);
}

export async function unlockPhase(phaseId: string, startDate?: Date) {
  const { org } = await assertInstructor();
  const projectId = await getPhaseProjectId(phaseId, org.id);

  const phase = await db.projectPhase.update({
    where: { id: phaseId },
    data: {
      isLocked: false,
      status: "IN_PROGRESS",
      startedAt: startDate ?? new Date(),
    },
    select: {
      name: true,
      order: true,
      project: { select: { name: true } },
    },
  });

  // Notify all students that a new phase is available
  const studentIds = await getOrgUserIdsByRole(org.id, ["MEMBER", "GUEST"]);
  await createNotificationsForUsers(org.id, studentIds, "PHASE_UNLOCKED", {
    title: `${phase.project.name} · Phase ${phase.order} unlocked`,
    body: `"${phase.name}" is now available. Check your deliverables.`,
    href: `/projects/${projectId}/phases`,
  }, org.name);

  revalidatePath(`/projects/${projectId}/phases`);
  revalidatePath(`/projects/${projectId}`);
}

export async function completePhase(phaseId: string) {
  const { org } = await assertInstructor();
  const projectId = await getPhaseProjectId(phaseId, org.id);

  await db.projectPhase.update({
    where: { id: phaseId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  revalidatePath(`/projects/${projectId}/phases`);
  revalidatePath(`/projects/${projectId}`);
}

export async function reopenPhase(phaseId: string) {
  const { org } = await assertInstructor();
  const projectId = await getPhaseProjectId(phaseId, org.id);

  await db.projectPhase.update({
    where: { id: phaseId },
    data: { status: "IN_PROGRESS", completedAt: null },
  });

  revalidatePath(`/projects/${projectId}/phases`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createPhase(projectId: string, name: string) {
  const { org } = await assertInstructor();

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const last = await db.projectPhase.findFirst({
    where: { projectId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.projectPhase.create({
    data: {
      projectId,
      name: name.trim(),
      order: (last?.order ?? 0) + 1,
      isLocked: true,
      status: "NOT_STARTED",
    },
  });

  revalidatePath(`/projects/${projectId}/phases`);
}

export async function deletePhase(phaseId: string) {
  const { org } = await assertInstructor();

  const phase = await db.projectPhase.findFirst({
    where: { id: phaseId, project: { organizationId: org.id } },
    select: { projectId: true, order: true },
  });
  if (!phase) throw new Error("Phase not found");

  await db.projectPhase.delete({ where: { id: phaseId } });

  // Compact order numbers so there are no gaps after deletion.
  // Use the same two-pass approach as reorderPhases to avoid unique constraint conflicts.
  const remaining = await db.projectPhase.findMany({
    where: { projectId: phase.projectId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (remaining.length > 0) {
    const offset = 100000;
    await db.$transaction([
      ...remaining.map((p, i) =>
        db.projectPhase.update({ where: { id: p.id }, data: { order: offset + i } })
      ),
      ...remaining.map((p, i) =>
        db.projectPhase.update({ where: { id: p.id }, data: { order: i + 1 } })
      ),
    ]);
  }

  revalidatePath(`/projects/${phase.projectId}/phases`);
}

export async function updateDeliverable(
  deliverableId: string,
  data: {
    title?: string;
    description?: string | null;
    submissionKind?: "INDIVIDUAL" | "GROUP" | null;
    requiresFileUpload?: boolean;
    dueDate?: string | null;
  }
) {
  const { org } = await assertInstructor();

  const deliverable = await db.phaseDeliverable.findFirst({
    where: { id: deliverableId, phase: { project: { organizationId: org.id } } },
    select: { phase: { select: { projectId: true } } },
  });
  if (!deliverable) throw new Error("Deliverable not found");

  // Prisma rejects null for enum fields even when nullable — clear it via raw SQL
  if (data.submissionKind === null) {
    await db.$executeRaw`UPDATE "PhaseDeliverable" SET "submissionKind" = NULL WHERE id = ${deliverableId}`;
  }

  const updateData = {
    ...(data.title !== undefined ? { title: data.title.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
    ...(data.submissionKind != null ? { submissionKind: data.submissionKind } : {}),
    ...(data.requiresFileUpload !== undefined ? { requiresFileUpload: data.requiresFileUpload } : {}),
    ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
  };

  if (Object.keys(updateData).length > 0) {
    await db.phaseDeliverable.update({ where: { id: deliverableId }, data: updateData });
  }

  revalidatePath(`/projects/${deliverable.phase.projectId}/phases`);
}

export async function reorderPhases(projectId: string, orderedIds: string[]) {
  const { org } = await assertInstructor();

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const phases = await db.projectPhase.findMany({
    where: { projectId, id: { in: orderedIds }, isLocked: true },
    select: { id: true, order: true },
  });
  if (phases.length !== orderedIds.length) throw new Error("Invalid phase IDs");

  const minOrder = Math.min(...phases.map((p) => p.order));

  // Two-pass update to avoid @@unique([projectId, order]) conflicts:
  // first shift to a high offset, then assign final consecutive orders.
  await db.$transaction(async (tx) => {
    const offset = 100000;
    for (const [i, id] of orderedIds.entries()) {
      await tx.projectPhase.update({ where: { id }, data: { order: offset + i } });
    }
    for (const [i, id] of orderedIds.entries()) {
      await tx.projectPhase.update({ where: { id }, data: { order: minOrder + i } });
    }
  });

  revalidatePath(`/projects/${projectId}/phases`);
}

export async function deleteDeliverable(deliverableId: string) {
  const { org } = await assertInstructor();

  const deliverable = await db.phaseDeliverable.findFirst({
    where: { id: deliverableId, phase: { project: { organizationId: org.id } } },
    select: { phase: { select: { projectId: true } } },
  });
  if (!deliverable) throw new Error("Deliverable not found");

  await db.phaseDeliverable.delete({ where: { id: deliverableId } });

  revalidatePath(`/projects/${deliverable.phase.projectId}/phases`);
}

export async function createDeliverable(
  phaseId: string,
  data: {
    title: string;
    description?: string;
    submissionKind?: "INDIVIDUAL" | "GROUP";
    requiresFileUpload: boolean;
    dueDate?: string;
  }
) {
  const { org } = await assertInstructor();

  const phase = await db.projectPhase.findFirst({
    where: { id: phaseId, project: { organizationId: org.id } },
    select: { projectId: true },
  });
  if (!phase) throw new Error("Phase not found");

  const last = await db.phaseDeliverable.findFirst({
    where: { phaseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.phaseDeliverable.create({
    data: {
      phaseId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      submissionKind: data.submissionKind,
      requiresFileUpload: data.requiresFileUpload,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      order: (last?.order ?? 0) + 1,
    },
  });

  revalidatePath(`/projects/${phase.projectId}/phases`);
}

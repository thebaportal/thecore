"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
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

export async function getProjectMilestones(projectId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.milestone.findMany({
    where: { projectId, organizationId: org.id },
    orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function createMilestone(projectId: string, input: { title: string; description?: string; dueDate?: Date | null }) {
  const { org } = await getContext();
  const validated = milestoneSchema.parse(input);

  const project = await db.project.findUnique({
    where: { id: projectId, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  const milestone = await db.milestone.create({
    data: {
      organizationId: org.id,
      projectId,
      title: validated.title,
      description: validated.description ?? null,
      dueDate: validated.dueDate ?? null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return milestone;
}

export async function toggleMilestone(milestoneId: string) {
  const { org } = await getContext();

  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId, organizationId: org.id },
    select: { completedAt: true, projectId: true },
  });
  if (!milestone) throw new Error("Milestone not found");

  await db.milestone.update({
    where: { id: milestoneId },
    data: { completedAt: milestone.completedAt ? null : new Date() },
  });

  revalidatePath(`/projects/${milestone.projectId}`);
}

export async function deleteMilestone(milestoneId: string) {
  const { org } = await getContext();

  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId, organizationId: org.id },
    select: { projectId: true },
  });
  if (!milestone) throw new Error("Milestone not found");

  await db.milestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/projects/${milestone.projectId}`);
}

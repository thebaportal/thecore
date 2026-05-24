"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createNotificationsForUsers } from "@/lib/notifications";

export type MandateInput = {
  projectDescription?: string;
  timelineWeeks?: number | null;
  timelineTolerance?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  budget?: string;
  budgetTolerance?: string;
  scope?: string;
  keyDeliverables?: string;
  nextSteps?: string;
};

async function assertInstructorForProject(projectId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) throw new Error("User not found");

  const [membership, project] = await Promise.all([
    db.orgMembership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
      select: { role: true },
    }),
    db.project.findUnique({ where: { id: projectId, organizationId: org.id }, select: { id: true } }),
  ]);

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only instructors can edit the project mandate");
  }
  if (!project) throw new Error("Project not found");
}

export async function upsertProjectMandate(projectId: string, data: MandateInput) {
  await assertInstructorForProject(projectId);

  const [project] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { name: true, organizationId: true } }),
  ]);

  await db.projectMandate.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });

  revalidatePath(`/projects/${projectId}/mandate`);
  revalidatePath(`/projects/${projectId}`);

  if (project) {
    const org = await db.organization.findUnique({
      where: { id: project.organizationId },
      select: { id: true, name: true },
    });
    if (org) {
      const memberIds = await db.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      }).then((m) => m.map((x) => x.userId));

      if (memberIds.length > 0) {
        void createNotificationsForUsers(org.id, memberIds, "MANDATE_UPDATED", {
          title: `${project.name} · Project Mandate updated`,
          body: "Your instructor has updated the project brief. Review it in the mandate tab.",
          href: `/projects/${projectId}/mandate`,
        }, org.name);
      }
    }
  }
}

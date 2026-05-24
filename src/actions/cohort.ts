"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export type CohortDeliverable = {
  id: string;
  title: string;
  status: "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REVISION_NEEDED";
};

export type CohortPhase = {
  id: string;
  order: number;
  name: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  isLocked: boolean;
  dueDate: Date | null;
  deliverables: CohortDeliverable[];
};

export type CohortProject = {
  id: string;
  name: string;
  color: string | null;
  iconEmoji: string | null;
  createdAt: Date;
  phases: CohortPhase[];
};

export async function getCohortData(): Promise<{
  projects: CohortProject[];
  maxPhaseOrder: number;
  isInstructor: boolean;
} | null> {
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
  if (!isInstructor) return { projects: [], maxPhaseOrder: 0, isInstructor: false };

  const projects = await db.project.findMany({
    where: { organizationId: org.id, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      color: true,
      iconEmoji: true,
      createdAt: true,
      phases: {
        select: {
          id: true,
          order: true,
          name: true,
          status: true,
          isLocked: true,
          dueDate: true,
          deliverables: {
            select: { id: true, title: true, status: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const maxPhaseOrder =
    projects.length === 0
      ? 0
      : Math.max(...projects.flatMap((p) => p.phases.map((ph) => ph.order)));

  return { projects, maxPhaseOrder, isInstructor };
}

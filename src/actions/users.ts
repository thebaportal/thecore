"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function updateUserProfile(data: { jobTitle?: string; bio?: string }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  await db.user.update({
    where: { id: user.id },
    data: {
      jobTitle: data.jobTitle?.trim() || null,
      bio: data.bio?.trim() || null,
    },
  });

  revalidatePath("/settings/profile");
}

export async function getUserCard(userId: string) {
  const { orgId } = await auth();
  if (!orgId) return null;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;

  const [user, approvedCount, projects] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        jobTitle: true,
        bio: true,
        memberships: {
          where: { organizationId: org.id },
          select: { role: true },
        },
      },
    }),
    db.phaseDeliverable.count({
      where: {
        submittedById: userId,
        status: "APPROVED",
        phase: { project: { organizationId: org.id } },
      },
    }),
    db.projectMember.findMany({
      where: { userId, project: { organizationId: org.id } },
      select: { project: { select: { id: true, name: true, color: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  if (!user) return null;
  return {
    ...user,
    approvedCount,
    projects: projects.map((m) => m.project),
    orgName: org.name,
  };
}

export async function leaveOrganization() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Not authenticated");

  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({ organizationId: orgId, userId });

  redirect("/organization-selection");
}

export async function getCurrentUserProfile() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  return db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, name: true, avatarUrl: true, jobTitle: true, bio: true },
  });
}

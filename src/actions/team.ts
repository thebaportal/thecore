"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function getTeamByProject() {
  const { userId, orgId } = await auth();
  if (!orgId) return { orgName: "", people: [], projects: [], currentDbUserId: null };

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      // Only fetch non-archived projects — archived ones (incl. Basecamp "Coming Soon" dumps) are excluded
      projects: {
        where: { status: { not: "ARCHIVED" } },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) return { orgName: "", orgLogoUrl: null, people: [], projects: [], currentDbUserId: null };

  const dbUser = userId
    ? await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } })
    : null;

  const roleMap = new Map(org.memberships.map((m) => [m.userId, m.role]));

  // Build set of userIds who are in at least one active project
  const activeProjectMemberIds = new Set(
    org.projects.flatMap((p) => p.members.map((m) => m.userId))
  );

  // Show admins/owners always + anyone in an active project
  const visibleMemberships = org.memberships.filter(
    (m) => m.role === "OWNER" || m.role === "ADMIN" || activeProjectMemberIds.has(m.userId)
  );

  // Map each userId to their active project (first match)
  const projectByUser = new Map<string, { id: string; name: string; color: string | null }>();
  for (const p of org.projects) {
    for (const m of p.members) {
      if (!projectByUser.has(m.userId)) {
        projectByUser.set(m.userId, { id: p.id, name: p.name, color: p.color });
      }
    }
  }

  const logoUrl = org.logoUrl && !org.logoUrl.includes("clerk") ? org.logoUrl : null;
  return {
    orgName: org.displayName ?? org.name,
    orgLogoUrl: logoUrl,
    currentDbUserId: dbUser?.id ?? null,
    people: visibleMemberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      jobTitle: m.user.jobTitle,
      orgRole: m.role,
      joinedAt: m.joinedAt,
      activeProject: projectByUser.get(m.userId) ?? null,
    })),
    projects: org.projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      iconEmoji: p.iconEmoji,
      status: p.status,
      members: p.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        jobTitle: m.user.jobTitle,
        orgRole: roleMap.get(m.userId) ?? "MEMBER",
        joinedAt: m.joinedAt,
      })),
    })),
  };
}

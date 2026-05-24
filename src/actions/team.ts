"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function getTeamByProject() {
  const { userId, orgId } = await auth();
  if (!orgId) return { orgName: "", projects: [], currentDbUserId: null };

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    include: {
      memberships: {
        select: { userId: true, role: true },
      },
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

  if (!org) return { orgName: "", projects: [], currentDbUserId: null };

  const dbUser = userId
    ? await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } })
    : null;

  const roleMap = new Map(org.memberships.map((m) => [m.userId, m.role]));

  return {
    orgName: org.name,
    currentDbUserId: dbUser?.id ?? null,
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

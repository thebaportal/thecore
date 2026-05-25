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
      projects: {
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

  if (!org) return { orgName: "", people: [], projects: [], currentDbUserId: null };

  const dbUser = userId
    ? await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } })
    : null;

  const roleMap = new Map(org.memberships.map((m) => [m.userId, m.role]));

  return {
    orgName: org.name,
    currentDbUserId: dbUser?.id ?? null,
    people: org.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      jobTitle: m.user.jobTitle,
      orgRole: m.role,
      joinedAt: m.joinedAt,
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

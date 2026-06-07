"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export type MyDeliverable = {
  id: string;
  title: string;
  dueDate: Date | null;
  status: string;
};

export type StudentDashboardData = {
  user: { id: string; name: string; avatarUrl: string | null };
  project: {
    id: string;
    name: string;
    status: string;
    color: string | null;
    iconEmoji: string | null;
    targetDate: Date | null;
  };
  projectId: string;
  totalPhases: number;
  completedPhases: number;
  currentPhase: { id: string; name: string; order: number; dueDate: Date | null } | null;
  myDeliverables: MyDeliverable[];
  upcomingSessions: { id: string; title: string; datetime: Date; type: string }[];
  latestPosts: { id: string; title: string; body: string; authorName: string; createdAt: Date }[];
  chatMessages: { id: string; body: string; authorName: string; authorAvatar: string | null; createdAt: Date }[];
  teamMembers: { id: string; name: string; avatarUrl: string | null }[];
};

export async function getStudentDashboardData(): Promise<StudentDashboardData | null> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true, name: true, avatarUrl: true } }),
  ]);
  if (!org || !dbUser) return null;

  const membership = await db.projectMember.findFirst({
    where: { userId: dbUser.id, project: { organizationId: org.id } },
    select: { projectId: true },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) return null;

  const projectId = membership.projectId;
  const now = new Date();

  const [project, phases, sessions, posts, projectPing, teamMembers] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true, color: true, iconEmoji: true, targetDate: true },
    }),
    db.projectPhase.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      select: {
        id: true, name: true, order: true, status: true, isLocked: true, dueDate: true,
        deliverables: {
          orderBy: { order: "asc" },
          select: {
            id: true, title: true, dueDate: true,
            studentSubmissions: {
              where: { userId: dbUser.id },
              select: { status: true },
              take: 1,
            },
          },
        },
      },
    }),
    db.projectSession.findMany({
      where: { projectId, datetime: { gte: now } },
      orderBy: { datetime: "asc" },
      take: 3,
      select: { id: true, title: true, datetime: true, type: true },
    }),
    db.projectPost.findMany({
      where: { projectId, instructorOnly: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, title: true, body: true, createdAt: true,
        author: { select: { name: true } },
      },
    }),
    db.ping.findFirst({
      where: { projectId, type: "GROUP" },
      select: {
        id: true,
        messages: {
          where: { deletedAt: null, threadParentId: null },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            id: true, body: true, createdAt: true,
            author: { select: { name: true, avatarUrl: true } },
          },
        },
      },
    }),
    db.projectMember.findMany({
      where: { projectId },
      take: 8,
      select: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
  ]);

  if (!project) return null;

  const completedPhases = phases.filter((p) => p.status === "COMPLETED").length;
  const currentPhase =
    phases.find((p) => p.status === "IN_PROGRESS") ??
    phases.find((p) => !p.isLocked && p.status === "NOT_STARTED") ??
    null;

  const myDeliverables: MyDeliverable[] = (currentPhase?.deliverables ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    dueDate: d.dueDate,
    status: d.studentSubmissions[0]?.status ?? "NOT_SUBMITTED",
  }));

  return {
    user: { id: dbUser.id, name: dbUser.name, avatarUrl: dbUser.avatarUrl },
    project,
    projectId,
    totalPhases: phases.length,
    completedPhases,
    currentPhase: currentPhase
      ? { id: currentPhase.id, name: currentPhase.name, order: currentPhase.order, dueDate: currentPhase.dueDate }
      : null,
    myDeliverables,
    upcomingSessions: sessions,
    latestPosts: posts.map((p) => ({
      id: p.id, title: p.title, body: p.body,
      authorName: p.author.name, createdAt: p.createdAt,
    })),
    chatMessages: (projectPing?.messages ?? []).map((m) => ({
      id: m.id, body: m.body,
      authorName: m.author.name, authorAvatar: m.author.avatarUrl,
      createdAt: m.createdAt,
    })),
    teamMembers: teamMembers.map((m) => ({
      id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl,
    })),
  };
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export type StudentHubData = {
  // Phase summary
  totalPhases: number;
  completedPhases: number;
  currentPhaseName: string | null;
  currentPhaseOrder: number | null;
  // Section counts
  taskCount: number;
  fileCount: number;
  postCount: number;
  // Messaging
  projectPingId: string | null;
  unreadMessageCount: number;
  latestMessages: {
    id: string;
    body: string;
    authorName: string;
    createdAt: Date;
  }[];
  // Sessions
  upcomingSessions: {
    id: string;
    title: string;
    datetime: Date;
    type: string;
  }[];
  // Recent activity
  recentActivity: {
    id: string;
    type: "submission" | "file" | "post";
    label: string;
    authorName: string;
    createdAt: Date;
  }[];
  // Team
  memberCount: number;
};

export async function getStudentProjectHub(projectId: string): Promise<StudentHubData | null> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [phases, taskCount, fileCount, postCount, sessions, projectPing, recentSubs, recentFiles, recentPosts, members] =
    await Promise.all([
      db.projectPhase.findMany({
        where: { projectId },
        select: { id: true, name: true, order: true, status: true, isLocked: true },
        orderBy: { order: "asc" },
      }),
      db.task.count({
        where: { projectId, status: { not: "DONE" } },
      }),
      db.projectFile.count({ where: { projectId } }),
      db.projectPost.count({ where: { projectId } }),
      db.projectSession.findMany({
        where: { projectId, datetime: { gte: now } },
        orderBy: { datetime: "asc" },
        take: 3,
        select: { id: true, title: true, datetime: true, type: true },
      }),
      db.ping.findFirst({
        where: { projectId, type: "GROUP" },
        select: {
          id: true,
          messages: {
            where: { deletedAt: null, threadParentId: null },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true, body: true, createdAt: true,
              author: { select: { name: true } },
            },
          },
          participants: {
            where: { userId: dbUser.id },
            select: { lastReadAt: true },
          },
        },
      }),
      // Recent submissions (activity)
      db.studentSubmission.findMany({
        where: {
          submittedAt: { gte: sevenDaysAgo },
          deliverable: { phase: { projectId } },
          status: { not: "NOT_SUBMITTED" },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: {
          id: true, submittedAt: true,
          user: { select: { name: true } },
          deliverable: { select: { title: true } },
        },
      }),
      // Recent file uploads
      db.projectFile.findMany({
        where: { projectId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, name: true, createdAt: true, uploadedBy: { select: { name: true } } },
      }),
      // Recent posts
      db.projectPost.findMany({
        where: { projectId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, title: true, createdAt: true, author: { select: { name: true } } },
      }),
      db.projectMember.count({ where: { projectId } }),
    ]);

  const completedPhases = phases.filter((p) => p.status === "COMPLETED").length;
  const currentPhase =
    phases.find((p) => p.status === "IN_PROGRESS") ??
    phases.find((p) => !p.isLocked && p.status === "NOT_STARTED") ??
    null;

  // Unread message count
  const myParticipant = projectPing?.participants[0] ?? null;
  const unreadMessageCount = projectPing
    ? projectPing.messages.filter((m) => {
        if (!myParticipant?.lastReadAt) return true;
        return m.createdAt > myParticipant.lastReadAt;
      }).length
    : 0;

  // Merge + sort recent activity
  const activity: StudentHubData["recentActivity"] = [
    ...recentSubs.map((s) => ({
      id: s.id,
      type: "submission" as const,
      label: `submitted "${s.deliverable.title}"`,
      authorName: s.user.name,
      createdAt: s.submittedAt ?? new Date(0),
    })),
    ...recentFiles.map((f) => ({
      id: f.id,
      type: "file" as const,
      label: `uploaded "${f.name}"`,
      authorName: f.uploadedBy?.name ?? "Someone",
      createdAt: f.createdAt,
    })),
    ...recentPosts.map((p) => ({
      id: p.id,
      type: "post" as const,
      label: `posted "${p.title}"`,
      authorName: p.author.name,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6);

  return {
    totalPhases: phases.length,
    completedPhases,
    currentPhaseName: currentPhase?.name ?? null,
    currentPhaseOrder: currentPhase?.order ?? null,
    taskCount,
    fileCount,
    postCount,
    projectPingId: projectPing?.id ?? null,
    unreadMessageCount,
    latestMessages: (projectPing?.messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      authorName: m.author.name,
      createdAt: m.createdAt,
    })),
    upcomingSessions: sessions,
    recentActivity: activity,
    memberCount: members,
  };
}

"use server";

import { db } from "@/lib/db";
import { syncCurrentIdentity } from "@/actions/projects";

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NO_PRIORITY: 4 } as const;

export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "BEHIND" | "NO_DEADLINE";

function computeHealth(targetDate: Date | null, total: number, completed: number): ProjectHealth {
  if (!targetDate) return "NO_DEADLINE";
  const now = new Date();
  const daysLeft = Math.floor((targetDate.getTime() - now.getTime()) / 86_400_000);
  const pct = total > 0 ? completed / total : 0;

  if (daysLeft < 0 && pct < 1)       return "BEHIND";
  if (daysLeft <= 7  && pct < 0.80)  return "AT_RISK";
  if (daysLeft <= 14 && pct < 0.50)  return "AT_RISK";
  if (daysLeft <= 30 && pct < 0.25)  return "AT_RISK";
  return "ON_TRACK";
}

export async function getDashboardData() {
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) return null;

  const { user, org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };
  const now = new Date();
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  // Resolve role first — needed to gate project visibility for students
  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  const isInstructor = membership?.role === "OWNER" || membership?.role === "ADMIN";

  // Project filter: instructors see all, students only see assigned projects
  const projectVisibilityFilter = isInstructor
    ? { organizationId: org.id, status: "ACTIVE" as const }
    : { organizationId: org.id, status: "ACTIVE" as const, members: { some: { userId: user.id } } };

  const [
    focusTasks,
    projects,
    recentPings,
    inboxParticipants,
    stats,
    unlockedPhases,
    revisionDeliverables,
  ] = await Promise.all([
    db.task.findMany({
      where: {
        organizationId: org.id,
        assigneeId: user.id,
        status: { notIn: ["DONE", "CANCELLED"] },
        project: { status: "ACTIVE" },
        OR: [
          { dueDate: { lte: todayEnd } },
          { priority: { in: ["URGENT", "HIGH"] } },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
      take: 8,
      include: {
        project: { select: { id: true, name: true, color: true, iconEmoji: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),

    db.project.findMany({
      where: projectVisibilityFilter,
      orderBy: { updatedAt: "desc" },
      take: isInstructor ? 10 : 6,
      include: {
        _count: { select: { tasks: true } },
        creator: { select: { name: true, avatarUrl: true } },
      },
    }),

    db.ping.findMany({
      where: {
        organizationId: org.id,
        type: { in: ["DIRECT", "GROUP"] },
        participants: { some: { userId: user.id } },
        messages: { some: { deletedAt: null } },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: {
        participants: {
          select: { lastReadAt: true, user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        project: { select: { id: true, name: true, color: true, iconEmoji: true } },
        task: { select: { id: true, title: true } },
        messages: {
          where: { deletedAt: null, threadParentId: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, author: { select: { name: true } } },
        },
      },
    }),

    // Inbox-only unread count (DIRECT + non-project GROUP) — matches what the inbox page shows
    db.pingParticipant.findMany({
      where: {
        userId: user.id,
        ping: {
          organizationId: org.id,
          OR: [{ type: "DIRECT" }, { type: "GROUP", projectId: null }],
        },
      },
      include: {
        ping: {
          include: {
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    }),

    Promise.all([
      db.task.count({ where: { organizationId: org.id, status: { notIn: ["DONE", "CANCELLED"] }, project: { status: "ACTIVE" } } }),
      db.task.count({ where: { organizationId: org.id, status: "DONE", completedAt: { gte: todayStart } } }),
      db.project.count({ where: { organizationId: org.id, status: "ACTIVE" } }),
      db.task.count({ where: { organizationId: org.id, assigneeId: user.id, status: { notIn: ["DONE", "CANCELLED"] }, project: { status: "ACTIVE" } } }),
      db.user.count({ where: { projectMembers: { some: { project: { organizationId: org.id, status: "ACTIVE" } } } } }),
      db.phaseDeliverable.count({ where: { status: "SUBMITTED", phase: { project: { organizationId: org.id } } } }),
      db.task.count({
        where: {
          organizationId: org.id,
          status: { notIn: ["DONE", "CANCELLED"] },
          dueDate: { lt: todayStart },
          project: { status: "ACTIVE" },
        },
      }),
    ]),

    // Unlocked phases — students only see phases in their assigned projects
    db.projectPhase.findMany({
      where: {
        project: projectVisibilityFilter,
        isLocked: false,
      },
      include: {
        project: { select: { id: true, name: true, color: true, iconEmoji: true } },
        deliverables: {
          select: { id: true, title: true, status: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ projectId: "asc" }, { order: "asc" }],
    }),

    // Revision-needed deliverables — students only see their assigned projects
    db.phaseDeliverable.findMany({
      where: {
        status: "REVISION_NEEDED",
        phase: {
          project: projectVisibilityFilter,
          isLocked: false,
        },
      },
      include: {
        phase: {
          select: {
            id: true, order: true, name: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const [completedCounts, allPhases] = await Promise.all([
    db.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projects.map((p) => p.id) }, status: "DONE" },
      _count: { id: true },
    }),
    db.projectPhase.findMany({
      where: { project: projectVisibilityFilter },
      select: { id: true, order: true, status: true, isLocked: true, projectId: true },
      orderBy: [{ projectId: "asc" }, { order: "asc" }],
    }),
  ]);

  const completedByProject = Object.fromEntries(completedCounts.map((c) => [c.projectId, c._count.id]));

  const enrichedProjects = projects.map((p) => {
    const completed = completedByProject[p.id] ?? 0;
    return {
      ...p,
      completedTaskCount: completed,
      health: computeHealth(p.targetDate, p._count.tasks, completed),
    };
  });

  const unreadPingCount = inboxParticipants.filter((p) => {
    const lastMsg = p.ping.messages[0];
    if (!lastMsg) return false;
    if (!p.lastReadAt) return true;
    return lastMsg.createdAt > p.lastReadAt;
  }).length;

  const sorted = [...focusTasks].sort((a, b) => {
    const aOver = a.dueDate && new Date(a.dueDate) < now;
    const bOver = b.dueDate && new Date(b.dueDate) < now;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  const [openTasks, completedToday, activeProjects, myOpenTasks, memberCount, pendingReviews, overdueTaskCount] = stats;

  return {
    user,
    orgName: org.name,
    currentUserRole: membership?.role ?? ("MEMBER" as const),
    // instructor
    focusTasks: sorted,
    projects: enrichedProjects,
    recentPings,
    unreadPingCount,
    stats: { openTasks, completedToday, activeProjects, myOpenTasks, memberCount, pendingReviews, overdueTaskCount },
    // student
    unlockedPhases,
    allPhases,
    revisionDeliverables,
  };
}

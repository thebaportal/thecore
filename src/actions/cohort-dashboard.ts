"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { syncCurrentIdentity } from "@/actions/projects";

export type SessionRow = {
  id: string;
  title: string;
  datetime: Date;
  type: string;
  notes: string | null;
};

export type StudentStatusRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  submittedAt: Date | null;
};

export type DeliverableRow = {
  id: string;
  title: string;
  order: number;
  dueDate: Date | null;
  total: number;
  notSubmitted: number;
  submitted: number;      // awaiting review (SUBMITTED or UNDER_REVIEW)
  approved: number;
  needsRevision: number;
  rows: StudentStatusRow[];
};

export type ProjectCard = {
  id: string;
  name: string;
  color: string | null;
  iconEmoji: string | null;
  totalPhases: number;
  completedPhases: number;
  currentPhaseName: string | null;
  currentPhaseOrder: number | null;
  studentCount: number;
  awaitingReview: number;
  nextDueDate: Date | null;
};

export type CohortDashboardData = {
  user: { id: string; name: string; avatarUrl: string | null };
  orgName: string;
  // All active projects — used for the projects grid
  allProjects: ProjectCard[];
  totalStudents: number;
  // Focused project (most active) — used for the detailed sections below the grid
  project: { id: string; name: string; color: string | null; iconEmoji: string | null };
  phases: { id: string; name: string; order: number; status: string; isLocked: boolean; dueDate: Date | null }[];
  currentPhase: { id: string; name: string; order: number; dueDate: Date | null; status: string } | null;
  studentMembers: { id: string; name: string; avatarUrl: string | null }[];
  deliverableTracker: DeliverableRow[];
  awaitingReview: { id: string; title: string; count: number }[];
  studentsWithNoSubmissions: { id: string; name: string; avatarUrl: string | null }[];
  upcomingSessions: SessionRow[];
  recentSubmissions: {
    id: string;
    userName: string;
    userAvatar: string | null;
    deliverableTitle: string;
    phaseName: string;
    status: string;
    submittedAt: Date | null;
  }[];
  recentPings: {
    id: string;
    title: string | null;
    updatedAt: Date;
    type: string;
    participants: { lastReadAt: Date | null; user: { id: string; name: string; avatarUrl: string | null } }[];
    project: { id: string; name: string } | null;
    messages: { body: string; createdAt: Date; author: { name: string } }[];
  }[];
  unreadPingCount: number;
};

export async function getCohortDashboardData(): Promise<CohortDashboardData | null> {
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org || !ctx?.user) return null;
  const { user, org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") return null;

  const now = new Date();

  const [allProjectsRaw, recentPingsRaw, inboxParticipants] = await Promise.all([
    // Fetch ALL active projects (was findFirst — that's the bug that hid extra projects)
    db.project.findMany({
      where: { organizationId: org.id, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, color: true, iconEmoji: true,
        sessions: {
          where: { datetime: { gte: now } },
          orderBy: { datetime: "asc" },
          take: 5,
          select: { id: true, title: true, datetime: true, type: true, notes: true },
        },
        phases: {
          orderBy: { order: "asc" },
          select: {
            id: true, name: true, order: true, status: true, isLocked: true, dueDate: true,
            deliverables: {
              orderBy: { order: "asc" },
              select: {
                id: true, title: true, order: true, dueDate: true, status: true,
                studentSubmissions: {
                  select: {
                    userId: true, status: true, submittedAt: true,
                    user: { select: { id: true, name: true, avatarUrl: true } },
                  },
                },
              },
            },
          },
        },
        members: {
          select: {
            user: {
              select: {
                id: true, name: true, avatarUrl: true,
                memberships: {
                  where: { organizationId: org.id },
                  select: { role: true },
                  take: 1,
                },
              },
            },
          },
        },
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
      select: {
        id: true, title: true, updatedAt: true, type: true,
        participants: { select: { lastReadAt: true, user: { select: { id: true, name: true, avatarUrl: true } } } },
        project: { select: { id: true, name: true } },
        messages: {
          where: { deletedAt: null, threadParentId: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, author: { select: { name: true } } },
        },
      },
    }),

    db.pingParticipant.findMany({
      where: {
        userId: user.id,
        ping: { organizationId: org.id, OR: [{ type: "DIRECT" }, { type: "GROUP", projectId: null }] },
      },
      select: {
        lastReadAt: true,
        ping: {
          select: {
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
  ]);

  if (allProjectsRaw.length === 0) return null;

  // Focused project: first with an IN_PROGRESS phase, else most recently updated
  const project = allProjectsRaw.find((p) =>
    p.phases.some((ph) => ph.status === "IN_PROGRESS")
  ) ?? allProjectsRaw[0]!;

  // ── Per-project summary cards ───────────────────────────────────────────────
  const allProjects: ProjectCard[] = allProjectsRaw.map((p) => {
    const students = p.members.filter((m) => m.user.memberships[0]?.role === "MEMBER");
    const completedPhases = p.phases.filter((ph) => ph.status === "COMPLETED").length;
    const currentPhase =
      p.phases.find((ph) => ph.status === "IN_PROGRESS") ??
      p.phases.find((ph) => !ph.isLocked && ph.status === "NOT_STARTED") ??
      null;

    const awaitingReview = currentPhase
      ? currentPhase.deliverables.reduce((n, d) =>
          n + d.studentSubmissions.filter((s) =>
            s.status === "SUBMITTED" || s.status === "UNDER_REVIEW"
          ).length, 0)
      : 0;

    const nextDueDate = currentPhase
      ? currentPhase.deliverables
          .flatMap((d) => (d.dueDate ? [d.dueDate] : []))
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
      : null;

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      iconEmoji: p.iconEmoji,
      totalPhases: p.phases.length,
      completedPhases,
      currentPhaseName: currentPhase?.name ?? null,
      currentPhaseOrder: currentPhase?.order ?? null,
      studentCount: students.length,
      awaitingReview,
      nextDueDate,
    };
  });

  const totalStudents = allProjects.reduce((s, p) => s + p.studentCount, 0);

  // Aggregate upcoming sessions from all projects
  const upcomingSessions = allProjectsRaw
    .flatMap((p) => p.sessions)
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, 5);

  // ── Detailed view for focused project ──────────────────────────────────────
  const studentMembers = project.members
    .filter((m) => m.user.memberships[0]?.role === "MEMBER")
    .map((m) => ({ id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentPhase =
    project.phases.find((p) => p.status === "IN_PROGRESS") ??
    project.phases.find((p) => !p.isLocked && p.status === "NOT_STARTED") ??
    null;

  const deliverableTracker: DeliverableRow[] = currentPhase
    ? currentPhase.deliverables.map((d) => {
        const subByUser = new Map(d.studentSubmissions.map((s) => [s.userId, s]));
        const rows: StudentStatusRow[] = studentMembers.map((s) => {
          const sub = subByUser.get(s.id);
          return {
            userId: s.id,
            name: s.name,
            avatarUrl: s.avatarUrl,
            status: sub?.status ?? "NOT_SUBMITTED",
            submittedAt: sub?.submittedAt ?? null,
          };
        });
        return {
          id: d.id,
          title: d.title,
          order: d.order,
          dueDate: d.dueDate,
          total: studentMembers.length,
          notSubmitted: rows.filter((r) => r.status === "NOT_SUBMITTED").length,
          submitted: rows.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length,
          approved: rows.filter((r) => r.status === "APPROVED").length,
          needsRevision: rows.filter((r) => r.status === "REVISION_NEEDED").length,
          rows,
        };
      })
    : [];

  const awaitingReview = deliverableTracker
    .filter((d) => d.submitted > 0)
    .map((d) => ({ id: d.id, title: d.title, count: d.submitted }));

  const studentsWithNoSubmissions = currentPhase
    ? studentMembers.filter((s) =>
        deliverableTracker.every((d) =>
          d.rows.find((r) => r.userId === s.id)?.status === "NOT_SUBMITTED"
        )
      )
    : [];

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentSubs = await db.studentSubmission.findMany({
    where: {
      submittedAt: { gte: sevenDaysAgo },
      deliverable: { phase: { projectId: project.id } },
      status: { not: "NOT_SUBMITTED" },
    },
    orderBy: { submittedAt: "desc" },
    take: 8,
    select: {
      id: true, status: true, submittedAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
      deliverable: { select: { title: true, phase: { select: { name: true } } } },
    },
  });

  const unreadPingCount = inboxParticipants.filter((p) => {
    const lastMsg = p.ping.messages[0];
    if (!lastMsg) return false;
    if (!p.lastReadAt) return true;
    return lastMsg.createdAt > p.lastReadAt;
  }).length;

  return {
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
    orgName: org.name,
    allProjects,
    totalStudents,
    project: { id: project.id, name: project.name, color: project.color, iconEmoji: project.iconEmoji },
    phases: project.phases.map((p) => ({
      id: p.id, name: p.name, order: p.order,
      status: p.status, isLocked: p.isLocked, dueDate: p.dueDate,
    })),
    currentPhase: currentPhase
      ? { id: currentPhase.id, name: currentPhase.name, order: currentPhase.order, dueDate: currentPhase.dueDate, status: currentPhase.status }
      : null,
    studentMembers,
    deliverableTracker,
    awaitingReview,
    studentsWithNoSubmissions,
    upcomingSessions,
    recentSubmissions: recentSubs.map((s) => ({
      id: s.id,
      userName: s.user.name,
      userAvatar: s.user.avatarUrl,
      deliverableTitle: s.deliverable.title,
      phaseName: s.deliverable.phase.name,
      status: s.status,
      submittedAt: s.submittedAt,
    })),
    recentPings: recentPingsRaw,
    unreadPingCount,
  };
}

// ── Session management ────────────────────────────────────────────────────────

export async function addProjectSession(projectId: string, data: {
  title: string;
  datetime: string;
  type: string;
  notes?: string;
}) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("Not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") throw new Error("Admin only");

  await db.projectSession.create({
    data: {
      projectId,
      title: data.title.trim(),
      datetime: new Date(data.datetime),
      type: data.type,
      notes: data.notes?.trim() || null,
    },
  });

  revalidatePath("/dashboard");
}

export async function deleteProjectSession(sessionId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("Not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") throw new Error("Admin only");

  await db.projectSession.deleteMany({
    where: { id: sessionId, project: { organizationId: org.id } },
  });

  revalidatePath("/dashboard");
}

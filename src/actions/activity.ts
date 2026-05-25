"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { syncCurrentIdentity } from "@/actions/projects";

export type ActivityItem =
  | { kind: "project_created";        id: string; at: Date; actor: { name: string; avatarUrl: string | null }; project: { id: string; name: string; color: string | null; iconEmoji: string | null } }
  | { kind: "task_created";           id: string; at: Date; actor: { name: string; avatarUrl: string | null }; task: { id: string; title: string }; project: { id: string; name: string } }
  | { kind: "task_done";              id: string; at: Date; actor: { name: string; avatarUrl: string | null }; task: { id: string; title: string }; project: { id: string; name: string } }
  | { kind: "message_sent";           id: string; at: Date; actor: { name: string; avatarUrl: string | null }; body: string; ping: { id: string; title: string | null; type: string } }
  | { kind: "file_uploaded";          id: string; at: Date; actor: { name: string; avatarUrl: string | null }; fileName: string; project: { id: string; name: string } }
  | { kind: "doc_created";            id: string; at: Date; actor: { name: string; avatarUrl: string | null }; docTitle: string; emoji: string | null; project: { id: string; name: string }; docId: string }
  | { kind: "deliverable_submitted";  id: string; at: Date; actor: { name: string; avatarUrl: string | null }; deliverableTitle: string; phaseOrder: number; phaseName: string; project: { id: string; name: string } }
  | { kind: "deliverable_reviewed";   id: string; at: Date; actor: { name: string; avatarUrl: string | null }; deliverableTitle: string; decision: "APPROVED" | "REVISION_NEEDED"; note: string | null; phaseOrder: number; phaseName: string; project: { id: string; name: string } };

export async function getActivityFeed(limit = 60): Promise<ActivityItem[]> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return [];

  const identity = await syncCurrentIdentity();
  if (!identity?.org) return [];

  const { org } = identity;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

  const dbUser = await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
  const hiddenIds = dbUser
    ? new Set(
        (await db.activityHide.findMany({
          where: { userId: dbUser.id, organizationId: org.id },
          select: { itemId: true },
        })).map((h) => h.itemId)
      )
    : new Set<string>();

  const [projects, tasks, doneTasks, messages, files, docs, submitted, reviewed] = await Promise.all([
    db.project.findMany({
      where: { organizationId: org.id, createdAt: { gte: cutoff } },
      select: {
        id: true, name: true, color: true, iconEmoji: true, createdAt: true,
        creator: { select: { name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.task.findMany({
      where: { organizationId: org.id, createdAt: { gte: cutoff } },
      select: {
        id: true, title: true, createdAt: true,
        creator: { select: { name: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.task.findMany({
      where: {
        organizationId: org.id,
        status: "DONE",
        completedAt: { gte: cutoff, not: null },
      },
      select: {
        id: true, title: true, completedAt: true,
        assignee: { select: { name: true, avatarUrl: true } },
        creator: { select: { name: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: limit,
    }),
    db.message.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: cutoff },
        ping: { organizationId: org.id, type: "CONTEXTUAL" },
      },
      select: {
        id: true, body: true, createdAt: true,
        author: { select: { name: true, avatarUrl: true } },
        ping: { select: { id: true, title: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.projectFile.findMany({
      where: { organizationId: org.id, createdAt: { gte: cutoff } },
      select: {
        id: true, name: true, createdAt: true,
        uploadedBy: { select: { name: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.doc.findMany({
      where: { organizationId: org.id, createdAt: { gte: cutoff } },
      select: {
        id: true, title: true, emoji: true, createdAt: true,
        author: { select: { name: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),

    // deliverable submissions
    db.phaseDeliverable.findMany({
      where: {
        submittedAt: { gte: cutoff, not: null },
        status: { notIn: ["NOT_SUBMITTED"] },
        phase: { project: { organizationId: org.id } },
      },
      select: {
        id: true, title: true, submittedAt: true,
        submittedBy: { select: { name: true, avatarUrl: true } },
        phase: {
          select: {
            order: true, name: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: limit,
    }),

    // deliverable reviews
    db.phaseDeliverable.findMany({
      where: {
        reviewedAt: { gte: cutoff, not: null },
        status: { in: ["APPROVED", "REVISION_NEEDED"] },
        phase: { project: { organizationId: org.id } },
      },
      select: {
        id: true, title: true, status: true, reviewNote: true, reviewedAt: true,
        reviewedBy: { select: { name: true, avatarUrl: true } },
        phase: {
          select: {
            order: true, name: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
      take: limit,
    }),
  ]);

  const items: ActivityItem[] = [
    ...projects.map((p): ActivityItem => ({
      kind: "project_created",
      id: `proj-${p.id}`,
      at: p.createdAt,
      actor: p.creator,
      project: { id: p.id, name: p.name, color: p.color, iconEmoji: p.iconEmoji },
    })),
    ...tasks.map((t): ActivityItem => ({
      kind: "task_created",
      id: `task-${t.id}`,
      at: t.createdAt,
      actor: t.creator,
      task: { id: t.id, title: t.title },
      project: t.project,
    })),
    ...doneTasks
      .filter((t) => t.completedAt != null)
      .map((t): ActivityItem => ({
        kind: "task_done",
        id: `done-${t.id}`,
        at: t.completedAt!,
        actor: t.assignee ?? t.creator,
        task: { id: t.id, title: t.title },
        project: t.project,
      })),
    ...messages.map((m): ActivityItem => ({
      kind: "message_sent",
      id: `msg-${m.id}`,
      at: m.createdAt,
      actor: m.author,
      body: m.body,
      ping: m.ping,
    })),
    ...files
      .filter((f) => f.project != null)
      .map((f): ActivityItem => ({
        kind: "file_uploaded",
        id: `file-${f.id}`,
        at: f.createdAt,
        actor: f.uploadedBy,
        fileName: f.name,
        project: f.project!,
      })),
    ...docs
      .filter((d) => d.project != null)
      .map((d): ActivityItem => ({
        kind: "doc_created",
        id: `doc-${d.id}`,
        at: d.createdAt,
        actor: d.author,
        docTitle: d.title,
        emoji: d.emoji,
        project: d.project!,
        docId: d.id,
      })),

    ...submitted
      .filter((d) => d.submittedAt != null && d.submittedBy != null)
      .map((d): ActivityItem => ({
        kind: "deliverable_submitted",
        id: `deliv-sub-${d.id}`,
        at: d.submittedAt!,
        actor: d.submittedBy!,
        deliverableTitle: d.title,
        phaseOrder: d.phase.order,
        phaseName: d.phase.name,
        project: d.phase.project,
      })),

    ...reviewed
      .filter((d) => d.reviewedAt != null && d.reviewedBy != null)
      .map((d): ActivityItem => ({
        kind: "deliverable_reviewed",
        id: `deliv-rev-${d.id}`,
        at: d.reviewedAt!,
        actor: d.reviewedBy!,
        deliverableTitle: d.title,
        decision: d.status as "APPROVED" | "REVISION_NEEDED",
        note: d.reviewNote,
        phaseOrder: d.phase.order,
        phaseName: d.phase.name,
        project: d.phase.project,
      })),
  ];

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.filter((i) => !hiddenIds.has(i.id)).slice(0, limit);
}

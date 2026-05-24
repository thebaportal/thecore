"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export type AppNotification = {
  id: string;
  kind:
    | "DELIVERABLE_SUBMITTED"
    | "DELIVERABLE_APPROVED"
    | "DELIVERABLE_REVISION"
    | "PHASE_UNLOCKED"
    | "TASK_ASSIGNED"
    | "CHAT_MENTION"
    | "LIBRARY_UPLOAD"
    | "ping_message";
  read: boolean;
  at: Date;
  title: string;
  body?: string;
  href: string;
};

export async function getUserNotifications(): Promise<AppNotification[]> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return [];

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
  ]);
  if (!user || !org) return [];

  // DB notifications + unread ping messages merged
  const [dbNotifs, pingParticipants] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id, organizationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, kind: true, read: true, title: true, body: true, href: true, createdAt: true },
    }),

    db.pingParticipant.findMany({
      where: { userId: user.id, ping: { organizationId: org.id, type: { in: ["DIRECT", "GROUP"] } } },
      include: {
        ping: {
          include: {
            messages: {
              where: { deletedAt: null, authorId: { not: user.id } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { ping: { updatedAt: "desc" } },
      take: 20,
    }),
  ]);

  const items: AppNotification[] = dbNotifs.map((n) => ({
    id: n.id,
    kind: n.kind as AppNotification["kind"],
    read: n.read,
    at: n.createdAt,
    title: n.title,
    body: n.body ?? undefined,
    href: n.href,
  }));

  for (const p of pingParticipants) {
    const lastMsg = p.ping.messages[0];
    if (!lastMsg) continue;
    const isUnread = !p.lastReadAt || lastMsg.createdAt > p.lastReadAt;
    const pingTitle =
      p.ping.title ??
      (p.ping.type === "DIRECT" ? "Direct message" : "Group message");

    items.push({
      id: `ping-${p.pingId}`,
      kind: "ping_message",
      read: !isUnread,
      at: lastMsg.createdAt,
      title: `${lastMsg.author.name} in ${pingTitle}`,
      body: lastMsg.body.slice(0, 80),
      href: `/inbox/${p.pingId}`,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, 40);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  // ping-derived notifications (id starts with "ping-") aren't in the DB
  if (notificationId.startsWith("ping-")) return;

  const { userId } = await auth();
  if (!userId) return;
  const user = await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
  if (!user) return;

  await db.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return;

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
  ]);
  if (!user || !org) return;

  await db.notification.updateMany({
    where: { userId: user.id, organizationId: org.id, read: false },
    data: { read: true, readAt: new Date() },
  });
}

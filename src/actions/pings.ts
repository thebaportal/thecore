"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createPingSchema, sendMessageSchema, type CreatePingInput, type SendMessageInput } from "@/lib/validations/ping";
import { createNotificationsForUsers } from "@/lib/notifications";

// Converts @Name mentions to @[Name](userId) tokens and returns enriched body + mention IDs.
async function enrichMentions(body: string, orgId: string): Promise<{ enrichedBody: string; mentionIds: string[] }> {
  const names = [...body.matchAll(/@([\w\s]+?)(?=\s|$|@)/g)]
    .map((m) => m[1]?.trim())
    .filter((n): n is string => !!n);
  if (names.length === 0) return { enrichedBody: body, mentionIds: [] };

  const users = await db.user.findMany({
    where: { name: { in: names }, memberships: { some: { organizationId: orgId } } },
    select: { id: true, name: true },
  });
  if (users.length === 0) return { enrichedBody: body, mentionIds: [] };

  const nameToId = new Map(users.map((u) => [u.name, u.id]));
  const enrichedBody = body.replace(/@([\w\s]+?)(?=\s|$|@)/g, (match, rawName) => {
    const id = nameToId.get(rawName.trim());
    return id ? `@[${rawName.trim()}](${id})` : match;
  });
  return { enrichedBody, mentionIds: users.map((u) => u.id) };
}

async function getDbContext() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthenticated");

  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unauthenticated");

  const user = await db.user.upsert({
    where: { clerkUserId: userId },
    create: {
      clerkUserId: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Unknown",
      avatarUrl: clerkUser.imageUrl ?? null,
    },
    update: {
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Unknown",
      avatarUrl: clerkUser.imageUrl ?? null,
    },
  });

  const client = await clerkClient();
  const clerkOrg = await client.organizations.getOrganization({ organizationId: orgId });

  const org = await db.organization.upsert({
    where: { clerkOrgId: orgId },
    create: {
      clerkOrgId: orgId,
      name: clerkOrg.name,
      slug: clerkOrg.slug ?? orgId,
      logoUrl: clerkOrg.imageUrl ?? null,
    },
    update: { name: clerkOrg.name },
  });

  return { user, org };
}

export async function getMyPings() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { pings: [], currentDbUserId: null };

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) return { pings: [], currentDbUserId: null };

  const pings = await db.ping.findMany({
    where: {
      organizationId: org.id,
      participants: { some: { userId: user.id } },
      // Exclude project chat rooms — those live inside the project, not Messages
      OR: [
        { type: "DIRECT" },
        { type: "GROUP", projectId: null },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      project: { select: { id: true, name: true, color: true, iconEmoji: true } },
      task: { select: { id: true, title: true } },
      messages: {
        where: { deletedAt: null, threadParentId: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { name: true } } },
      },
      _count: { select: { messages: true } },
    },
  });

  // Attach lastReadAt for the current user per ping
  const participantRows = await db.pingParticipant.findMany({
    where: { userId: user.id, pingId: { in: pings.map((p) => p.id) } },
    select: { pingId: true, lastReadAt: true },
  });
  const lastReadMap = new Map(participantRows.map((r) => [r.pingId, r.lastReadAt]));

  const pingsWithRead = pings.map((p) => ({
    ...p,
    currentUserLastReadAt: lastReadMap.get(p.id) ?? null,
  }));

  return { pings: pingsWithRead, currentDbUserId: user.id };
}

export async function getPingMessages(pingId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  // Verify user is a participant
  const ping = await db.ping.findUnique({
    where: { id: pingId, organizationId: org.id },
  });
  if (!ping) return [];

  return db.message.findMany({
    where: { pingId, deletedAt: null, threadParentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
      threadReplies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          attachments: true,
          reactions: { include: { user: { select: { id: true, name: true } } } },
        },
      },
      attachments: true,
    },
  });
}

export async function getTaskPing(taskId: string) {
  const { orgId } = await auth();
  if (!orgId) return null;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;

  return db.ping.findFirst({
    where: { organizationId: org.id, taskId, type: "CONTEXTUAL" },
    select: { id: true },
  });
}

export async function getProjectDiscussions(projectId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.ping.findMany({
    where: { organizationId: org.id, projectId, type: "CONTEXTUAL" },
    orderBy: { createdAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, author: { select: { name: true } } },
      },
      _count: { select: { messages: true } },
    },
  });
}

export async function createPing(input: CreatePingInput) {
  const { user, org } = await getDbContext();
  const validated = createPingSchema.parse(input);

  // For DIRECT pings — check if one already exists between these two users
  if (validated.type === "DIRECT" && validated.participantIds.length === 1) {
    const otherId = validated.participantIds[0]!;
    const existing = await db.ping.findFirst({
      where: {
        organizationId: org.id,
        type: "DIRECT",
        participants: { every: { userId: { in: [user.id, otherId] } } },
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
    });
    if (existing) {
      revalidatePath("/inbox");
      return { success: true, ping: existing };
    }
  }

  const allParticipantIds = Array.from(new Set([user.id, ...validated.participantIds]));

  const ping = await db.ping.create({
    data: {
      organizationId: org.id,
      type: validated.type,
      title: validated.title,
      projectId: validated.projectId,
      taskId: validated.taskId,
      participants: {
        create: allParticipantIds.map((userId) => ({ userId })),
      },
    },
  });

  revalidatePath("/inbox");
  return { success: true, ping };
}

export async function sendMessage(input: SendMessageInput) {
  const { user, org } = await getDbContext();
  const validated = sendMessageSchema.parse(input);

  const ping = await db.ping.findUnique({
    where: { id: validated.pingId, organizationId: org.id },
    include: { participants: { select: { userId: true } } },
  });
  if (!ping) throw new Error("Ping not found");

  const isParticipant = ping.participants.some((p) => p.userId === user.id);
  if (!isParticipant) throw new Error("Not a participant");

  const { enrichedBody, mentionIds: rawMentionIds } = await enrichMentions(validated.body, org.id);

  const message = await db.message.create({
    data: {
      pingId: validated.pingId,
      authorId: user.id,
      body: enrichedBody,
      threadParentId: validated.threadParentId,
      attachments: validated.attachments?.length
        ? { create: validated.attachments.map((a) => ({ url: a.url, name: a.name, mimeType: a.mimeType, size: a.size })) }
        : undefined,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      reactions: true,
      threadReplies: true,
      attachments: true,
    },
  });

  // Bump ping updatedAt so it floats to top of list
  await db.ping.update({
    where: { id: validated.pingId },
    data: { updatedAt: new Date() },
  });

  // Mark as read for sender
  await db.pingParticipant.update({
    where: { pingId_userId: { pingId: validated.pingId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  // Fire CHAT_MENTION notifications
  const mentionIds = rawMentionIds.filter((uid) => uid !== user.id);
  if (mentionIds.length > 0) {
    const pingContext = ping.projectId
      ? { href: `/projects/${ping.projectId}/messages` }
      : { href: `/inbox/${validated.pingId}` };
    void createNotificationsForUsers(org.id, mentionIds, "CHAT_MENTION", {
      title: `${user.name} mentioned you in a message`,
      body: validated.body.slice(0, 100),
      href: pingContext.href,
    }, org.name);
  }

  revalidatePath(`/inbox/${validated.pingId}`);
  revalidatePath("/inbox");
  return { success: true, message };
}

export async function addReaction(messageId: string, emoji: string) {
  const { user, org } = await getDbContext();

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { pingId: true },
  });
  if (!message) throw new Error("Message not found");

  const ping = await db.ping.findUnique({
    where: { id: message.pingId, organizationId: org.id },
    include: { participants: { select: { userId: true } } },
  });
  if (!ping) throw new Error("Ping not found");

  const isParticipant = ping.participants.some((p) => p.userId === user.id);
  if (!isParticipant) throw new Error("Not a participant");

  const existing = await db.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
  });

  if (existing) {
    // Same emoji clicked again — toggle it off
    await db.reaction.delete({ where: { id: existing.id } });
  } else {
    // Different emoji — replace any prior reaction from this user on this message
    await db.reaction.deleteMany({ where: { messageId, userId: user.id } });
    await db.reaction.create({ data: { messageId, userId: user.id, emoji } });
  }

  revalidatePath(`/inbox/${message.pingId}`);
}

export async function getOrCreateProjectChat(projectId: string) {
  const { user, org } = await getDbContext();

  let ping = await db.ping.findFirst({
    where: { organizationId: org.id, projectId, type: "GROUP" },
    include: { participants: { select: { userId: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!ping) {
    ping = await db.ping.create({
      data: {
        organizationId: org.id,
        type: "GROUP",
        title: "Project Chat",
        projectId,
        participants: { create: [{ userId: user.id }] },
      },
      include: { participants: { select: { userId: true } } },
    });
  } else {
    const isParticipant = ping.participants.some((p) => p.userId === user.id);
    if (!isParticipant) {
      await db.pingParticipant.create({ data: { pingId: ping.id, userId: user.id } });
    }
  }

  return ping.id;
}

export async function deleteImportedPings(): Promise<{ deleted: number }> {
  const { user, org } = await getDbContext();
  void user;

  const result = await db.ping.deleteMany({
    where: {
      organizationId: org.id,
      id: { startsWith: "bc-chat-" },
    },
  });

  revalidatePath("/inbox");
  return { deleted: result.count };
}

export async function editMessage(messageId: string, body: string) {
  const { user, org } = await getDbContext();

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, pingId: true },
  });
  if (!message) throw new Error("Message not found");
  if (message.authorId !== user.id) throw new Error("Can only edit your own messages");

  const ping = await db.ping.findUnique({
    where: { id: message.pingId, organizationId: org.id },
    select: { id: true },
  });
  if (!ping) throw new Error("Not found");

  const { enrichedBody } = await enrichMentions(trimmed, org.id);

  await db.message.update({
    where: { id: messageId },
    data: { body: enrichedBody, editedAt: new Date() },
  });

  revalidatePath(`/inbox/${message.pingId}`);
}

export async function deleteMessage(messageId: string) {
  const { user, org } = await getDbContext();

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, pingId: true },
  });
  if (!message) throw new Error("Message not found");
  if (message.authorId !== user.id) throw new Error("Can only delete your own messages");

  // Verify the ping belongs to this org
  const ping = await db.ping.findUnique({
    where: { id: message.pingId, organizationId: org.id },
    select: { id: true },
  });
  if (!ping) throw new Error("Not found");

  await db.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/inbox/${message.pingId}`);
}

export async function deletePing(pingId: string) {
  const { user, org } = await getDbContext();

  const ping = await db.ping.findUnique({
    where: { id: pingId, organizationId: org.id },
    include: { participants: { select: { userId: true } } },
  });
  if (!ping) throw new Error("Conversation not found");

  const isParticipant = ping.participants.some((p) => p.userId === user.id);
  if (!isParticipant) throw new Error("Not a participant");

  // Remove only this user so other participants keep their thread.
  await db.pingParticipant.delete({
    where: { pingId_userId: { pingId, userId: user.id } },
  });

  // If nobody is left, clean up the ping entirely.
  const remainingCount = ping.participants.filter((p) => p.userId !== user.id).length;
  if (remainingCount === 0) {
    await db.ping.delete({ where: { id: pingId } });
  }

  revalidatePath("/inbox");
}

export async function markPingRead(pingId: string) {
  const { userId } = await auth();
  if (!userId) return;

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) return;

  await db.pingParticipant.updateMany({
    where: { pingId, userId: user.id },
    data: { lastReadAt: new Date() },
  });
}

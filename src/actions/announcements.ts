"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function assertAdmin() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthenticated");

  const [dbUser, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true, name: true } }),
  ]);
  if (!dbUser || !org) throw new Error("Not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Admins only");
  }

  return { dbUser, org };
}

export async function createAnnouncement(data: { title: string; body: string }) {
  const { dbUser, org } = await assertAdmin();

  const title = data.title.trim();
  const body  = data.body.trim();
  if (!title || !body) throw new Error("Title and body are required");

  const announcement = await db.announcement.create({
    data: { organizationId: org.id, authorId: dbUser.id, title, body },
  });

  // Notify every org member
  const members = await db.orgMembership.findMany({
    where: { organizationId: org.id },
    select: { userId: true },
  });

  if (members.length > 0) {
    await db.notification.createMany({
      data: members.map((m) => ({
        organizationId: org.id,
        userId:         m.userId,
        kind:           "ANNOUNCEMENT" as const,
        title:          `📣 ${title}`,
        body:           body.length > 120 ? body.slice(0, 120) + "…" : body,
        href:           "/announcements",
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/announcements");
  return announcement;
}

export async function getAnnouncements() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { announcements: [], isAdmin: false };

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true },
  });
  if (!org) return { announcements: [], isAdmin: false };

  const dbUser = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!dbUser) return { announcements: [], isAdmin: false };

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  const isAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";

  const announcements = await db.announcement.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, jobTitle: true } },
    },
  });

  return { announcements, isAdmin };
}

export async function deleteAnnouncement(id: string) {
  const { org } = await assertAdmin();
  await db.announcement.delete({ where: { id, organizationId: org.id } });
  revalidatePath("/announcements");
}

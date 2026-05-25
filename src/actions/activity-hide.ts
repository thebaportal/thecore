"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { syncCurrentIdentity } from "@/actions/projects";

export async function hideActivityItem(itemId: string) {
  const { userId } = await auth();
  if (!userId) return;

  const identity = await syncCurrentIdentity();
  if (!identity?.org) return;

  const dbUser = await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
  if (!dbUser) return;

  await db.activityHide.upsert({
    where: { userId_organizationId_itemId: { userId: dbUser.id, organizationId: identity.org.id, itemId } },
    create: { userId: dbUser.id, organizationId: identity.org.id, itemId },
    update: {},
  });
}

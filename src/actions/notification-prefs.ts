"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type NotifPrefs = {
  emailNotifEnabled: boolean;
  emailNotifTasks: boolean;
  emailNotifDeliverables: boolean;
  emailNotifMentions: boolean;
  emailNotifLibrary: boolean;
  emailDigest: boolean;
};

export async function getNotifPrefs(): Promise<NotifPrefs | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      emailNotifEnabled: true,
      emailNotifTasks: true,
      emailNotifDeliverables: true,
      emailNotifMentions: true,
      emailNotifLibrary: true,
      emailDigest: true,
    },
  });
  return user ?? null;
}

export async function updateNotifPrefs(prefs: Partial<NotifPrefs>): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;

  await db.user.update({
    where: { clerkUserId: userId },
    data: prefs,
  });

  revalidatePath("/settings/notifications");
}

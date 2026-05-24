"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateMyProfile(data: { jobTitle?: string }): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db.user.update({
    where: { clerkUserId: userId },
    data: { jobTitle: data.jobTitle?.trim() || null },
  });

  revalidatePath("/team");
  revalidatePath("/settings/profile");
}

export async function getMyProfile(): Promise<{ jobTitle: string | null }> {
  const { userId } = await auth();
  if (!userId) return { jobTitle: null };

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { jobTitle: true },
  });

  return { jobTitle: user?.jobTitle ?? null };
}

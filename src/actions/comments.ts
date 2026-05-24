"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const addCommentSchema = z.object({
  taskId: z.string().cuid(),
  body: z.string().min(1).max(4000),
});

export async function getTaskComments(taskId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.taskComment.findMany({
    where: { taskId, task: { organizationId: org.id } },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function addTaskComment(input: { taskId: string; body: string }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const validated = addCommentSchema.parse(input);

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("User not found");

  const task = await db.task.findUnique({
    where: { id: validated.taskId, organizationId: org.id },
    select: { id: true, projectId: true },
  });
  if (!task) throw new Error("Task not found");

  const comment = await db.taskComment.create({
    data: {
      taskId: validated.taskId,
      authorId: user.id,
      body: validated.body,
    },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  revalidatePath(`/projects/${task.projectId}/tasks`);
  return comment;
}

export async function deleteTaskComment(commentId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("User not found");

  const comment = await db.taskComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, task: { select: { organizationId: true, projectId: true } } },
  });
  if (!comment) throw new Error("Comment not found");
  if (comment.task.organizationId !== org.id) throw new Error("Unauthorized");
  if (comment.authorId !== user.id) throw new Error("Not your comment");

  await db.taskComment.delete({ where: { id: commentId } });
  revalidatePath(`/projects/${comment.task.projectId}/tasks`);
}

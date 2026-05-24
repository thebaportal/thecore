"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function getOrgAndUser() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;
  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return null;
  return { org, user: dbUser };
}

async function requireInstructor(orgId: string, userId: string) {
  const mem = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { role: true },
  });
  return mem?.role === "OWNER" || mem?.role === "ADMIN";
}

export async function getProjectPosts(projectId: string) {
  const ctx = await getOrgAndUser();
  if (!ctx) return [];
  return db.projectPost.findMany({
    where: { projectId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
    orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createProjectPost(projectId: string, data: { title: string; body: string }) {
  const ctx = await getOrgAndUser();
  if (!ctx) throw new Error("Unauthenticated");

  await db.projectPost.create({
    data: { projectId, authorId: ctx.user.id, title: data.title, body: data.body },
  });
  revalidatePath(`/projects/${projectId}/posts`);
}

export async function updateProjectPost(postId: string, data: { title: string; body: string }) {
  const ctx = await getOrgAndUser();
  if (!ctx) throw new Error("Unauthenticated");

  const post = await db.projectPost.findFirst({
    where: { id: postId, project: { organizationId: ctx.org.id } },
    select: { authorId: true, projectId: true },
  });
  if (!post) throw new Error("Not found");

  const isAuthor = post.authorId === ctx.user.id;
  const isInstructor = await requireInstructor(ctx.org.id, ctx.user.id);
  if (!isAuthor && !isInstructor) throw new Error("Forbidden");

  await db.projectPost.update({ where: { id: postId }, data });
  revalidatePath(`/projects/${post.projectId}/posts`);
}

export async function togglePinPost(projectId: string, postId: string) {
  const ctx = await getOrgAndUser();
  if (!ctx) throw new Error("Unauthenticated");
  const ok = await requireInstructor(ctx.org.id, ctx.user.id);
  if (!ok) throw new Error("Forbidden");

  const post = await db.projectPost.findUnique({ where: { id: postId }, select: { pinnedAt: true } });
  if (!post) throw new Error("Not found");

  await db.projectPost.update({
    where: { id: postId },
    data: { pinnedAt: post.pinnedAt ? null : new Date() },
  });
  revalidatePath(`/projects/${projectId}/posts`);
}

export async function deleteProjectPost(projectId: string, postId: string) {
  const ctx = await getOrgAndUser();
  if (!ctx) throw new Error("Unauthenticated");

  const post = await db.projectPost.findFirst({
    where: { id: postId, projectId },
    select: { authorId: true },
  });
  if (!post) throw new Error("Not found");

  const isAuthor = post.authorId === ctx.user.id;
  const isInstructor = await requireInstructor(ctx.org.id, ctx.user.id);
  if (!isAuthor && !isInstructor) throw new Error("Forbidden");

  await db.projectPost.delete({ where: { id: postId } });
  revalidatePath(`/projects/${projectId}/posts`);
}

"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createTaskSchema, updateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from "@/lib/validations/task";
import { createNotificationsForUsers } from "@/lib/notifications";

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

export async function getProjectTasks(projectId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.task.findMany({
    where: {
      projectId,
      organizationId: org.id,
      parentTaskId: null,
      status: { not: "CANCELLED" },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { subtasks: true } },
    },
  });
}

export async function getMyTasks() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return [];

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) return [];

  return db.task.findMany({
    where: {
      assigneeId: user.id,
      organizationId: org.id,
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
    include: {
      project: { select: { id: true, name: true, color: true, iconEmoji: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { subtasks: true } },
    },
  });
}

export async function createTask(input: CreateTaskInput) {
  const { user, org } = await getDbContext();
  const validated = createTaskSchema.parse(input);

  const project = await db.project.findUnique({
    where: { id: validated.projectId, organizationId: org.id },
  });
  if (!project) throw new Error("Project not found");

  const lastTask = await db.task.findFirst({
    where: { projectId: validated.projectId, status: "TODO" },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const task = await db.task.create({
    data: {
      ...validated,
      organizationId: org.id,
      creatorId: user.id,
      position: (lastTask?.position ?? 0) + 1000,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { subtasks: true } },
    },
  });

  // Notify assignee if someone else assigned them
  if (validated.assigneeId && validated.assigneeId !== user.id) {
    void createNotificationsForUsers(org.id, [validated.assigneeId], "TASK_ASSIGNED", {
      title: `You've been assigned a task`,
      body: validated.title,
      href: `/projects/${validated.projectId}/tasks`,
    }, org.name);
  }

  revalidatePath(`/projects/${validated.projectId}/tasks`);
  return { success: true, task };
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const { user, org } = await getDbContext();
  const validated = updateTaskSchema.parse(input);

  const task = await db.task.findUnique({
    where: { id, organizationId: org.id },
    select: { projectId: true, assigneeId: true, title: true },
  });
  if (!task) throw new Error("Task not found");

  const { projectId: _projectId, ...updateData } = validated;

  const updated = await db.task.update({
    where: { id },
    data: {
      ...updateData,
      completedAt:
        validated.status === "DONE" ? new Date()
        : validated.status !== undefined ? null
        : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { subtasks: true } },
    },
  });

  // Notify new assignee if they differ from the previous one and aren't self-assigning
  if (
    validated.assigneeId &&
    validated.assigneeId !== task.assigneeId &&
    validated.assigneeId !== user.id
  ) {
    void createNotificationsForUsers(org.id, [validated.assigneeId], "TASK_ASSIGNED", {
      title: `You've been assigned a task`,
      body: updated.title,
      href: `/projects/${task.projectId}/tasks`,
    }, org.name);
  }

  revalidatePath(`/projects/${task.projectId}/tasks`);
  revalidatePath("/tasks");
  return { success: true, task: updated };
}

export async function getTask(taskId: string) {
  const { orgId } = await auth();
  if (!orgId) return null;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;

  return db.task.findUnique({
    where: { id: taskId, organizationId: org.id },
    include: {
      project: { select: { id: true, name: true, color: true, iconEmoji: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true, avatarUrl: true } },
      subtasks: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, status: true, priority: true, assignee: { select: { id: true, name: true, avatarUrl: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      },
      _count: { select: { subtasks: true } },
    },
  });
}

export async function getSubtasks(parentTaskId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.task.findMany({
    where: { parentTaskId, organizationId: org.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function createSubtask(input: { parentTaskId: string; title: string; projectId: string }) {
  const { user, org } = await getDbContext();

  const parent = await db.task.findUnique({
    where: { id: input.parentTaskId, organizationId: org.id },
  });
  if (!parent) throw new Error("Parent task not found");

  const task = await db.task.create({
    data: {
      organizationId: org.id,
      projectId: input.projectId,
      creatorId: user.id,
      parentTaskId: input.parentTaskId,
      title: input.title.trim(),
      status: "TODO",
      priority: "MEDIUM",
      position: Date.now(),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  revalidatePath(`/projects/${input.projectId}/tasks`);
  return task;
}

export async function deleteTask(id: string) {
  const { org } = await getDbContext();

  const task = await db.task.findUnique({
    where: { id, organizationId: org.id },
    select: { projectId: true },
  });
  if (!task) throw new Error("Task not found");

  await db.task.delete({ where: { id } });

  revalidatePath(`/projects/${task.projectId}/tasks`);
  revalidatePath("/tasks");
}

export async function getProjectMembers(projectId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true },
  });
  if (!org) return [];

  const members = await db.projectMember.findMany({
    where: { projectId, project: { organizationId: org.id } },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return members.map((m) => m.user);
}

export async function getOrgMembers() {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    include: { memberships: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });

  return org?.memberships.map((m) => m.user) ?? [];
}

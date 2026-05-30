"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { UTApi } from "uploadthing/server";
import { createProjectSchema, updateProjectSchema, type CreateProjectInput, type UpdateProjectInput } from "@/lib/validations/project";

const utapi = new UTApi();

// Syncs the current Clerk user + org into our DB on first use.
// Replaces webhook dependency during development.
export async function syncCurrentIdentity() {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthenticated");

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

  let org = null;
  if (orgId) {
    const client = await clerkClient();
    const clerkOrg = await client.organizations.getOrganization({ organizationId: orgId });

    org = await db.organization.upsert({
      where: { clerkOrgId: orgId },
      create: {
        clerkOrgId: orgId,
        name: clerkOrg.name,
        slug: clerkOrg.slug ?? orgId,
        logoUrl: clerkOrg.imageUrl ?? null,
      },
      update: {
        name: clerkOrg.name,
        slug: clerkOrg.slug ?? orgId,
        logoUrl: clerkOrg.imageUrl ?? null,
      },
    });

    // Map Clerk org role to our DB role; never downgrade an existing OWNER
    const clerkRole = (sessionClaims as { org_role?: string })?.org_role;
    const mappedRole =
      clerkRole === "org:member" ? "MEMBER" :
      clerkRole === "org:admin"  ? "ADMIN"  :
      "MEMBER";

    await db.orgMembership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: { organizationId: org.id, userId: user.id, role: mappedRole },
      update: {}, // Preserve existing role (webhook handles intentional changes)
    });

    // Fulfil any pending project invitations — webhook fallback for dev/ngrok gaps
    const email = user.email.toLowerCase();
    const pendingInvitations = await db.projectInvitation.findMany({
      where: { email, project: { organizationId: org.id } },
      select: { id: true, projectId: true },
    });
    if (pendingInvitations.length > 0) {
      // Members should only be in one project — honour the first invitation only.
      // Admins and owners can be in all projects.
      const isMember = clerkRole === "org:member";
      const toFulfil = isMember ? pendingInvitations.slice(0, 1) : pendingInvitations;
      await Promise.all(
        toFulfil.map((inv) =>
          db.projectMember.upsert({
            where: { projectId_userId: { projectId: inv.projectId, userId: user.id } },
            create: { projectId: inv.projectId, userId: user.id },
            update: {},
          })
        )
      );
      await db.projectInvitation.deleteMany({
        where: { id: { in: pendingInvitations.map((i) => i.id) } },
      });
    }
  }

  return { user, org };
}

export async function getProjectPhases(projectId: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.projectPhase.findMany({
    where: { projectId, project: { organizationId: org.id } },
    include: {
      deliverables: {
        select: { id: true, status: true, title: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });
}

export async function getPhaseTemplates() {
  const { orgId } = await auth();
  if (!orgId) return [];

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return [];

  return db.phaseTemplate.findMany({
    where: { organizationId: org.id },
    include: { _count: { select: { phases: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createProject(input: CreateProjectInput) {
  const { user, org } = await syncCurrentIdentity();
  if (!org) throw new Error("No active organization");

  const validated = createProjectSchema.parse(input);
  const { templateId, ...projectFields } = validated;

  const project = await db.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        ...projectFields,
        organizationId: org.id,
        creatorId: user.id,
        templateId: templateId ?? null,
      },
    });

    if (templateId) {
      const templatePhases = await tx.phaseTemplatePhase.findMany({
        where: { templateId },
        include: { deliverables: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      });

      // Rolling cursor for computing phase due dates from startDate
      let cursor: Date | null = projectFields.startDate
        ? new Date(projectFields.startDate)
        : null;

      for (const tp of templatePhases) {
        const dueDate =
          cursor && tp.durationDays
            ? new Date(cursor.getTime() + tp.durationDays * 86_400_000)
            : null;

        const phase = await tx.projectPhase.create({
          data: {
            projectId: proj.id,
            name: tp.name,
            guidance: tp.guidance,
            order: tp.order,
            dueDate,
            isLocked: tp.order !== 1, // first phase unlocked immediately
          },
        });

        if (cursor && tp.durationDays) cursor = dueDate;

        for (const td of tp.deliverables) {
          await tx.phaseDeliverable.create({
            data: {
              phaseId: phase.id,
              title: td.title,
              description: td.description,
              order: td.order,
              requiresFileUpload: true,
              submissionKind: "INDIVIDUAL",
            },
          });
        }
      }
    }

    // Auto-create a project group chat so the team has a space from day one
    await tx.ping.create({
      data: {
        organizationId: org.id,
        type: "GROUP",
        title: `${proj.name} · General`,
        projectId: proj.id,
        participants: { create: { userId: user.id } },
      },
    });

    return proj;
  });

  revalidatePath("/projects");
  return { success: true, project };
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  const { org } = await syncCurrentIdentity();
  if (!org) throw new Error("No active organization");

  const validated = updateProjectSchema.parse(input);

  const project = await db.project.update({
    where: { id, organizationId: org.id },
    data: validated,
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, project };
}

export async function archiveProject(id: string) {
  const { org } = await syncCurrentIdentity();
  if (!org) throw new Error("No active organization");

  await db.project.update({
    where: { id, organizationId: org.id },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function bulkUpdateProjectStatus(
  ids: string[],
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED"
) {
  if (ids.length === 0) return;
  const { org } = await syncCurrentIdentity();
  if (!org) throw new Error("No active organization");

  await db.project.updateMany({
    where: { id: { in: ids }, organizationId: org.id },
    data: { status },
  });

  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  const { org } = await syncCurrentIdentity();
  if (!org) throw new Error("No active organization");

  const project = await db.project.findUnique({
    where: { id, organizationId: org.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");

  // Collect UploadThing keys before deletion so we can clean up storage
  const files = await db.projectFile.findMany({
    where: { projectId: id },
    select: { utKey: true },
  });
  const utKeys = files.map((f) => f.utKey).filter((k): k is string => !!k);

  // Pings linked to a project have no cascade — delete them explicitly
  // (cascades to PingParticipant, Message, Reaction, Attachment via their own cascades)
  await db.ping.deleteMany({ where: { projectId: id } });

  // Delete project — cascades to members, phases, deliverables, tasks, files, docs, posts
  await db.project.delete({ where: { id } });

  // Clean up uploaded files from storage after DB records are gone
  if (utKeys.length > 0) {
    await utapi.deleteFiles(utKeys);
  }

  revalidatePath("/projects");
}

export async function duplicateProject(id: string) {
  const { user, org } = await syncCurrentIdentity();
  if (!org) throw new Error("No active organization");

  const source = await db.project.findUnique({
    where: { id, organizationId: org.id },
    include: {
      tasks: {
        where: { parentTaskId: null },
        select: { title: true, description: true, status: true, priority: true, position: true },
      },
    },
  });
  if (!source) throw new Error("Project not found");

  const newProject = await db.project.create({
    data: {
      organizationId: org.id,
      creatorId: user.id,
      name: `${source.name} (copy)`,
      description: source.description,
      color: source.color,
      iconEmoji: source.iconEmoji,
      status: "ACTIVE",
    },
  });

  if (source.tasks.length > 0) {
    await db.task.createMany({
      data: source.tasks.map((t) => ({
        organizationId: org.id,
        projectId: newProject.id,
        creatorId: user.id,
        title: t.title,
        description: t.description,
        status: "TODO",
        priority: t.priority,
        position: t.position,
      })),
    });
  }

  revalidatePath("/projects");
  return newProject;
}

export async function getProjects() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return [];

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return [];

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  const isInstructor = membership?.role === "OWNER" || membership?.role === "ADMIN";

  const projectFilter = isInstructor
    ? { organizationId: org.id }
    : { organizationId: org.id, members: { some: { userId: dbUser.id } } };

  const projects = await db.project.findMany({
    where: projectFilter,
    orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    include: {
      _count: { select: { tasks: true } },
      creator: { select: { name: true, avatarUrl: true } },
    },
  });

  const completedCounts = await Promise.all(
    projects.map((p) => db.task.count({ where: { projectId: p.id, status: "DONE" } }))
  );

  return projects.map((p, i) => ({ ...p, completedTaskCount: completedCounts[i] }));
}

export async function getProject(id: string) {
  const { orgId } = await auth();
  if (!orgId) return null;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return null;

  const [project, completedCount, members] = await Promise.all([
    db.project.findUnique({
      where: { id, organizationId: org.id },
      include: {
        _count: { select: { tasks: true, phases: true, members: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        mandate: true,
        tasks: {
          where: { status: { not: "DONE" }, parentTaskId: null },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
          take: 5,
          include: { assignee: { select: { name: true, avatarUrl: true } } },
        },
      },
    }),
    db.task.count({ where: { projectId: id, status: "DONE" } }),
    db.user.findMany({
      where: {
        assignedTasks: { some: { projectId: id } },
      },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!project) return null;
  return { ...project, completedTaskCount: completedCount, members };
}

export async function toggleProjectPin(id: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthenticated");

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) throw new Error("Org not found");

  const project = await db.project.findUnique({
    where: { id, organizationId: org.id },
    select: { pinnedAt: true },
  });
  if (!project) throw new Error("Project not found");

  await db.project.update({
    where: { id },
    data: { pinnedAt: project.pinnedAt ? null : new Date() },
  });

  revalidatePath("/projects");
}

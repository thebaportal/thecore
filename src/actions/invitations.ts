"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type InviteeInput = { firstName: string; lastName: string; email: string };
export type InviteResult = { email: string; status: "sent" | "error"; error?: string };

export async function inviteToOrganization(
  invitees: InviteeInput[],
  role: "org:member" | "org:admin",
): Promise<InviteResult[]> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Not authenticated");

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) throw new Error("Not found");

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only admins can invite members.");
  }

  const client = await clerkClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const results: InviteResult[] = [];

  for (const invitee of invitees) {
    const email = invitee.email.toLowerCase().trim();
    if (!email) continue;
    try {
      await client.organizations.createOrganizationInvitation({
        organizationId: orgId,
        emailAddress: email,
        role,
        redirectUrl: appUrl,
        inviterUserId: userId,
        publicMetadata: { firstName: invitee.firstName.trim(), lastName: invitee.lastName.trim() },
      });
      results.push({ email, status: "sent" });
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message;
      results.push({ email, status: "error", error: msg ?? "Failed to send." });
    }
  }

  return results;
}

async function assertInstructorOnProject(projectId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) throw new Error("User not found");

  const [membership, project] = await Promise.all([
    db.orgMembership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
      select: { role: true },
    }),
    db.project.findUnique({ where: { id: projectId, organizationId: org.id }, select: { id: true, name: true } }),
  ]);

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new Error("Only instructors can manage project members");
  }
  if (!project) throw new Error("Project not found");

  return { org, dbUser, project };
}

export type ProjectInviteeInput = { firstName: string; lastName: string; email: string };
export type ProjectInviteResult = {
  email: string;
  status: "invited" | "added" | "already_member" | "already_in_project" | "error";
  error?: string;
};

export async function inviteToProject(
  projectId: string,
  invitees: ProjectInviteeInput[],
  role: "org:member" | "org:admin",
): Promise<ProjectInviteResult[]> {
  const { org, project } = await assertInstructorOnProject(projectId);

  const client = await clerkClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const results: ProjectInviteResult[] = [];

  for (const invitee of invitees) {
    const email = invitee.email.trim().toLowerCase();
    if (!email) continue;

    try {
      const existingUser = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          memberships: { where: { organizationId: org.id }, select: { id: true, role: true } },
          projectMembers: { where: { projectId }, select: { id: true } },
        },
      });

      if (existingUser?.projectMembers.length) {
        results.push({ email, status: "already_member" });
        continue;
      }

      if (existingUser?.memberships.length) {
        const orgRole = existingUser.memberships[0]?.role;
        // Members are limited to one project — block the add if they're already in one
        if (orgRole === "MEMBER") {
          const existingProject = await db.projectMember.findFirst({
            where: { userId: existingUser.id, project: { organizationId: org.id }, NOT: { projectId } },
            select: { project: { select: { name: true } } },
          });
          if (existingProject) {
            results.push({ email, status: "already_in_project", error: existingProject.project.name });
            continue;
          }
        }
        await db.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: existingUser.id } },
          create: { projectId, userId: existingUser.id },
          update: {},
        });
        results.push({ email, status: "added" });
        continue;
      }

      // Not yet in org — send Clerk invitation with role + name metadata
      let clerkInvitationId: string | undefined;
      try {
        const inv = await client.organizations.createOrganizationInvitation({
          organizationId: org.clerkOrgId,
          emailAddress: email,
          role,
          // Land new users on the sign-up page WITH the __clerk_ticket so Clerk
          // processes the invitation there (skipping the "Create Organization" wizard).
          // After sign-up, Clerk redirects to redirect_url → /accept-invite/[projectId].
          redirectUrl: `${appUrl}/sign-up?redirect_url=${encodeURIComponent(`/accept-invite/${projectId}`)}`,
          publicMetadata: {
            firstName: invitee.firstName.trim(),
            lastName: invitee.lastName.trim(),
          },
        });
        clerkInvitationId = inv.id;
      } catch {
        // Clerk may throw if already an org member at the Clerk level — still record the project invitation
      }

      await db.projectInvitation.upsert({
        where: { projectId_email: { projectId, email } },
        create: {
          projectId, email,
          clerkInvitationId: clerkInvitationId ?? null,
          firstName: invitee.firstName.trim() || null,
          lastName: invitee.lastName.trim() || null,
        },
        update: {
          clerkInvitationId: clerkInvitationId ?? null,
          firstName: invitee.firstName.trim() || null,
          lastName: invitee.lastName.trim() || null,
        },
      });

      results.push({ email, status: "invited" });
    } catch (err) {
      results.push({ email, status: "error", error: String(err) });
    }
  }

  revalidatePath(`/projects/${projectId}/members`);
  return results;
}

export type ProjectMembersData = {
  members: { id: string; userId: string; joinedAt: Date; isInstructor: boolean; user: { name: string; avatarUrl: string | null; jobTitle: string | null } }[];
  invitations: { id: string; email: string; createdAt: Date }[];
  isInstructor: boolean;
  currentDbUserId: string;
};

export async function getProjectMembersAndInvitations(projectId: string): Promise<ProjectMembersData | null> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const [org, dbUser] = await Promise.all([
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!org || !dbUser) return null;

  const project = await db.project.findUnique({ where: { id: projectId, organizationId: org.id }, select: { id: true } });
  if (!project) return null;

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
    select: { role: true },
  });
  const isInstructor = membership?.role === "OWNER" || membership?.role === "ADMIN";

  const [rawMembers, invitations] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
            jobTitle: true,
            memberships: { where: { organizationId: org.id }, select: { role: true }, take: 1 },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    isInstructor
      ? db.projectInvitation.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  const members = rawMembers.map((m) => ({
    id: m.id,
    userId: m.userId,
    joinedAt: m.joinedAt,
    isInstructor: m.user.memberships[0]?.role === "OWNER" || m.user.memberships[0]?.role === "ADMIN",
    user: { name: m.user.name, avatarUrl: m.user.avatarUrl, jobTitle: m.user.jobTitle },
  }));

  return { members, invitations, isInstructor, currentDbUserId: dbUser.id };
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const { org } = await assertInstructorOnProject(projectId);

  const member = await db.projectMember.findUnique({
    where: { id: memberId },
    select: { userId: true },
  });
  if (!member) return;

  await db.projectMember.delete({ where: { id: memberId } });

  // If the removed user is a MEMBER-role (student) with no remaining project
  // memberships in this org, remove them from the org entirely.
  const orgMembership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: member.userId } },
    select: { role: true },
  });

  if (orgMembership?.role === "MEMBER") {
    const remaining = await db.projectMember.count({
      where: { userId: member.userId, project: { organizationId: org.id } },
    });
    if (remaining === 0) {
      await db.orgMembership.delete({
        where: { organizationId_userId: { organizationId: org.id, userId: member.userId } },
      });
    }
  }

  revalidatePath(`/projects/${projectId}/members`);
  revalidatePath("/team");
}

export async function revokeProjectInvitation(projectId: string, invitationId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { org } = await assertInstructorOnProject(projectId);

  const invitation = await db.projectInvitation.findUnique({
    where: { id: invitationId, projectId },
    select: { clerkInvitationId: true },
  });
  if (!invitation) return;

  if (invitation.clerkInvitationId) {
    try {
      const client = await clerkClient();
      await client.organizations.revokeOrganizationInvitation({
        organizationId: org.clerkOrgId,
        invitationId: invitation.clerkInvitationId,
        requestingUserId: userId,
      });
    } catch {
      // Invitation may have already been accepted or expired — still delete our record
    }
  }

  await db.projectInvitation.delete({ where: { id: invitationId } });
  revalidatePath(`/projects/${projectId}/members`);
}

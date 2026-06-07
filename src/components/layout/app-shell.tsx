import { auth } from "@clerk/nextjs/server";
import { ShellLayout } from "./shell-layout";
import { CommandBarProvider } from "@/components/command-bar/command-bar-provider";
import { KeyboardShortcutsModal } from "./keyboard-shortcuts";
import { db } from "@/lib/db";
import { getUserNotifications } from "@/actions/notifications";

async function getCommandBarData(clerkUserId: string, clerkOrgId: string) {
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId } }),
    db.organization.findUnique({ where: { clerkOrgId } }),
  ]);
  type CmdData = {
    currentDbUserId: string;
    projects: { id: string; name: string; color: string | null; iconEmoji: string | null }[];
    tasks: { id: string; title: string; projectId: string; assigneeId: string | null; project: { name: string } }[];
    docs: { id: string; title: string; emoji: string | null; projectId: string | null; project: { name: string } | null }[];
  };
  if (!user || !org) return { currentDbUserId: "", projects: [], tasks: [], docs: [] };

  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  const isAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";

  // Members only see content from their own projects
  let memberProjectIds: string[] | null = null;
  if (!isAdmin) {
    const memberships = await db.projectMember.findMany({
      where: { userId: user.id, project: { organizationId: org.id } },
      select: { projectId: true },
    });
    memberProjectIds = memberships.map((m) => m.projectId);
  }

  const projectWhere = isAdmin
    ? { organizationId: org.id, status: { not: "ARCHIVED" as const } }
    : { organizationId: org.id, status: { not: "ARCHIVED" as const }, id: { in: memberProjectIds! } };

  const [projects, tasks, docs] = await Promise.all([
    db.project.findMany({
      where: projectWhere,
      select: { id: true, name: true, color: true, iconEmoji: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.task.findMany({
      where: {
        organizationId: org.id,
        status: { notIn: ["DONE", "CANCELLED"] },
        parentTaskId: null,
        ...(isAdmin ? {} : { projectId: { in: memberProjectIds! } }),
      },
      select: {
        id: true, title: true, projectId: true,
        assigneeId: true,
        project: { select: { name: true } },
      },
      // Assigned-to-user tasks first, then rest of project tasks
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 30,
    }),
    db.doc.findMany({
      where: {
        organizationId: org.id,
        ...(isAdmin ? {} : { projectId: { in: memberProjectIds! } }),
      },
      select: { id: true, title: true, emoji: true, projectId: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return { currentDbUserId: user.id, projects, tasks, docs };
}

async function getUnreadPingCount(clerkUserId: string, clerkOrgId: string) {
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId } }),
    db.organization.findUnique({ where: { clerkOrgId } }),
  ]);
  if (!user || !org) return 0;

  const participants = await db.pingParticipant.findMany({
    where: {
      userId: user.id,
      ping: {
        organizationId: org.id,
        OR: [{ type: "DIRECT" }, { type: "GROUP", projectId: null }],
      },
    },
    include: {
      ping: {
        include: {
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  return participants.filter((p) => {
    const lastMsg = p.ping.messages[0];
    if (!lastMsg) return false;
    if (!p.lastReadAt) return true;
    return lastMsg.createdAt > p.lastReadAt;
  }).length;
}

async function getOverdueTaskCount(clerkUserId: string, clerkOrgId: string) {
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId } }),
    db.organization.findUnique({ where: { clerkOrgId } }),
  ]);
  if (!user || !org) return 0;

  return db.task.count({
    where: {
      organizationId: org.id,
      assigneeId: user.id,
      status: { notIn: ["DONE", "CANCELLED"] },
      dueDate: { lt: new Date() },
    },
  });
}


async function getOrgBranding(clerkOrgId: string) {
  const org = await db.organization.findUnique({
    where: { clerkOrgId },
    select: { name: true, displayName: true, logoUrl: true, brandColor: true, secondaryColor: true },
  });
  const logoUrl = org?.logoUrl ?? null;
  return {
    orgName: org?.displayName ?? org?.name ?? "",
    orgLogoUrl: logoUrl,
    orgBrandColor: org?.brandColor ?? null,
    orgSecondaryColor: org?.secondaryColor ?? null,
  };
}

export async function AppShell({
  children,
  role = "ADMIN",
  studentProjectId = null,
}: {
  children: React.ReactNode;
  role?: "MEMBER" | "ADMIN";
  studentProjectId?: string | null;
}) {
  const { userId, orgId } = await auth();

  const [cmdData, unreadCount, notifications, overdueCount, branding] = await Promise.all([
    userId && orgId ? getCommandBarData(userId, orgId) : Promise.resolve({ projects: [], tasks: [], docs: [], currentDbUserId: "" }),
    userId && orgId ? getUnreadPingCount(userId, orgId) : Promise.resolve(0),
    getUserNotifications(),
    userId && orgId ? getOverdueTaskCount(userId, orgId) : Promise.resolve(0),
    orgId ? getOrgBranding(orgId) : Promise.resolve({ orgName: "", orgLogoUrl: null, orgBrandColor: null, orgSecondaryColor: null }),
  ]);

  return (
    <>
      <ShellLayout
        unreadPings={unreadCount}
        overdueTasks={overdueCount}
        notifications={notifications}
        role={role}
        studentProjectId={studentProjectId}
        orgLogoUrl={branding.orgLogoUrl}
        orgName={branding.orgName}
        orgBrandColor={branding.orgBrandColor}
        orgSecondaryColor={branding.orgSecondaryColor}
      >
        {children}
      </ShellLayout>
      <CommandBarProvider projects={cmdData.projects} tasks={cmdData.tasks} docs={cmdData.docs} role={role} currentDbUserId={cmdData.currentDbUserId} />
      <KeyboardShortcutsModal />
    </>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { StudentDashboard } from "@/components/student/student-dashboard";

export default async function StudentHomePage() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) redirect("/sign-in");
  if (orgRole !== "org:member") redirect("/dashboard");

  const [dbUser, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
  ]);
  if (!dbUser || !org) redirect("/sign-in");

  const pm = await db.projectMember.findFirst({
    where: { userId: dbUser.id },
    select: { projectId: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!pm) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
          <BookOpen className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="font-semibold text-lg text-foreground mb-2">You haven&apos;t been added to a project yet</h2>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Your instructor will add you to a project soon. In the meantime, feel free to explore the Library.
        </p>
      </div>
    );
  }

  const projectId = pm.projectId;

  const [project, phases, myTasks, posts, chatPing] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId, organizationId: org.id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        color: true,
        iconEmoji: true,
        targetDate: true,
        mandate: { select: { projectDescription: true } },
        _count: { select: { tasks: true, members: true } },
      },
    }),
    db.projectPhase.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        order: true,
        dueDate: true,
        isLocked: true,
        deliverables: {
          select: { id: true, status: true },
        },
      },
      orderBy: { order: "asc" },
    }),
    db.task.findMany({
      where: {
        projectId,
        assigneeId: dbUser.id,
        organizationId: org.id,
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: 10,
    }),
    db.projectPost.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        pinnedAt: true,
        author: { select: { name: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
    db.ping.findFirst({
      where: { organizationId: org.id, projectId, type: "GROUP" },
      select: { id: true },
    }),
  ]);

  if (!project) redirect("/projects");

  let chatMessages: Array<{
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; name: string; avatarUrl: string | null };
  }> = [];

  if (chatPing) {
    const msgs = await db.message.findMany({
      where: { pingId: chatPing.id, deletedAt: null, threadParentId: null },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    chatMessages = msgs.reverse();
  }

  return (
    <StudentDashboard
      userName={dbUser.name}
      currentUserId={dbUser.id}
      project={project}
      phases={phases}
      myTasks={myTasks}
      posts={posts}
      chatMessages={chatMessages}
      chatPingId={chatPing?.id ?? null}
    />
  );
}

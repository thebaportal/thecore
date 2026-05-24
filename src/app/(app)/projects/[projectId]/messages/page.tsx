import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProject } from "@/actions/projects";
import { getOrCreateProjectChat, getPingMessages, markPingRead } from "@/actions/pings";
import { PingThread } from "@/components/pings/ping-thread";
import { db } from "@/lib/db";

export default async function ProjectMessagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [project, dbUser] = await Promise.all([
    getProject(projectId),
    db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
  ]);
  if (!project) notFound();

  const pingId = await getOrCreateProjectChat(projectId);
  const [messages, members] = await Promise.all([
    getPingMessages(pingId),
    db.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
  ]);
  void markPingRead(pingId);

  const memberUsers = members.map((m) => m.user);

  return (
    <div className="-mx-6 -mt-6 h-[calc(100dvh-186px)]">
      <PingThread
        pingId={pingId}
        pingType="GROUP"
        projectId={projectId}
        projectName={project.name}
        members={memberUsers}
        messages={messages}
        currentUserId={dbUser?.id ?? ""}
      />
    </div>
  );
}

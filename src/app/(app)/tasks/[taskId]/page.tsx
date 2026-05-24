import { notFound } from "next/navigation";
import { getTask, getOrgMembers } from "@/actions/tasks";
import { syncCurrentIdentity } from "@/actions/projects";
import { getTaskPing, getPingMessages } from "@/actions/pings";
import { TaskPage } from "@/components/tasks/task-page";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;

  const [task, members, ctx, existingPing] = await Promise.all([
    getTask(taskId),
    getOrgMembers(),
    syncCurrentIdentity(),
    getTaskPing(taskId),
  ]);

  if (!task) notFound();

  const pingMessages = existingPing ? await getPingMessages(existingPing.id) : [];

  return (
    <TaskPage
      task={task}
      members={members}
      currentUserId={ctx?.user?.id}
      existingPingId={existingPing?.id ?? null}
      initialPingMessages={pingMessages}
    />
  );
}

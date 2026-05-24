import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, syncCurrentIdentity } from "@/actions/projects";
import { getProjectTasks, getOrgMembers } from "@/actions/tasks";
import { TaskList } from "@/components/tasks/task-list";

export const metadata: Metadata = { title: "Tasks" };

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project, tasks, members, ctx] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
    getOrgMembers(),
    syncCurrentIdentity(),
  ]);

  if (!project) notFound();

  return (
    <div className="pb-8">
      <TaskList
        tasks={tasks}
        projectId={projectId}
        members={members}
        currentUserId={ctx?.user?.id}
      />
    </div>
  );
}

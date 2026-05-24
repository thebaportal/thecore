import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { getProjectTasks } from "@/actions/tasks";
import { ProjectTimeline } from "@/components/projects/project-timeline";

export default async function ProjectTimelinePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getProjectTasks(projectId),
  ]);

  if (!project) notFound();

  return (
    <div className="pb-8">
      <ProjectTimeline tasks={tasks} projectId={projectId} />
    </div>
  );
}

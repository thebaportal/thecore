import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { getMyTasks, getOrgMembers } from "@/actions/tasks";
import { syncCurrentIdentity } from "@/actions/projects";
import { MyTasksList } from "@/components/tasks/my-tasks-list";

export const metadata: Metadata = { title: "My Tasks" };

export default async function TasksPage() {
  const { orgRole } = await auth();
  const isAdmin = orgRole !== "org:member";

  const [tasks, members, ctx] = await Promise.all([
    getMyTasks(),
    getOrgMembers(),
    syncCurrentIdentity(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tasks.length > 0
            ? `${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"} assigned to you`
            : "All clear"}
        </p>
      </div>

      <MyTasksList tasks={tasks} members={members} currentUserId={ctx?.user?.id} isAdmin={isAdmin} />
    </div>
  );
}

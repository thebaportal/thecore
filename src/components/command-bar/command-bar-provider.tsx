"use client";

import { useState } from "react";
import { CommandBar } from "./command-bar";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { NewPingDialog } from "@/components/pings/new-ping-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";

type Project = { id: string; name: string; color: string | null; iconEmoji: string | null };
type Task = { id: string; title: string; projectId: string; assigneeId?: string | null; project: { name: string } };
type Doc = { id: string; title: string; emoji: string | null; projectId: string | null; project: { name: string } | null };

export function CommandBarProvider({
  projects,
  tasks,
  docs = [],
  role = "ADMIN",
  currentDbUserId,
}: {
  projects: Project[];
  tasks: Task[];
  docs?: Doc[];
  role?: "MEMBER" | "ADMIN";
  currentDbUserId?: string;
}) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);

  return (
    <>
      <CommandBar
        projects={projects}
        tasks={tasks}
        docs={docs}
        role={role}
        currentDbUserId={currentDbUserId}
        onNewProject={() => setProjectOpen(true)}
        onNewTask={() => setTaskOpen(true)}
        onNewPing={() => setPingOpen(true)}
      />
      <NewProjectDialog open={projectOpen} onOpenChange={setProjectOpen} />
      <NewTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
      <NewPingDialog open={pingOpen} onOpenChange={setPingOpen} />
    </>
  );
}

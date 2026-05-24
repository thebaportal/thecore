"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Circle, CheckCircle2, Calendar, Plus } from "lucide-react";
import { updateTask } from "@/actions/tasks";
import { cn } from "@/lib/utils";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";

const PRIORITY_STYLES = {
  URGENT:      { dot: "bg-red-500",    badge: "text-red-500 bg-red-50 border-red-200"         },
  HIGH:        { dot: "bg-orange-500", badge: "text-orange-500 bg-orange-50 border-orange-200" },
  MEDIUM:      { dot: "bg-amber-400",  badge: "text-amber-600 bg-amber-50 border-amber-200"    },
  LOW:         { dot: "bg-blue-400",   badge: "text-blue-500 bg-blue-50 border-blue-200"       },
  NO_PRIORITY: { dot: "bg-gray-300",   badge: "text-gray-400 bg-gray-50 border-gray-200"       },
} as const;

type Priority = keyof typeof PRIORITY_STYLES;

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: Priority;
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { subtasks: number };
  project: { id: string; name: string; color: string | null; iconEmoji: string | null };
};

type Member = { id: string; name: string; avatarUrl: string | null };

function TaskRow({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const done = task.status === "DONE";
  const p = PRIORITY_STYLES[task.priority];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !done;
  const color = task.project.color ?? "#1E3A8A";

  function toggleDone(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await updateTask(task.id, { status: done ? "TODO" : "DONE" });
    });
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        "group flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors",
        isPending && "opacity-60"
      )}
    >
      <button
        onClick={toggleDone}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done
          ? <CheckCircle2 className="w-4 h-4 text-primary" />
          : <Circle className="w-4 h-4" />
        }
      </button>

      <span className={cn(
        "flex-1 text-sm truncate",
        done ? "line-through text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"
      )}>
        {task.title}
      </span>

      <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {task.project.iconEmoji && <span>{task.project.iconEmoji}</span>}
        <span className="max-w-[120px] truncate">{task.project.name}</span>
      </span>

      <span className={cn(
        "hidden md:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
        p.badge
      )}>
        {task.priority === "NO_PRIORITY" ? "—" : task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
      </span>

      {task.dueDate && (
        <span className={cn(
          "text-xs shrink-0",
          isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
        )}>
          <Calendar className="w-3 h-3 inline mr-1" />
          {format(new Date(task.dueDate), "MMM d")}
        </span>
      )}
    </Link>
  );
}

export function MyTasksList({
  tasks,
  isAdmin = false,
}: {
  tasks: Task[];
  members?: Member[];
  currentUserId?: string;
  isAdmin?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      {isAdmin && (
        <div className="flex items-center justify-between -mt-2 mb-2">
          <span />
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No tasks assigned to you</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Tasks assigned to you across all projects will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}

      <NewTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

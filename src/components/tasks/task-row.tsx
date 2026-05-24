"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Circle, CheckCircle2, Calendar } from "lucide-react";
import { updateTask } from "@/actions/tasks";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG = {
  URGENT:      { label: "Urgent",  class: "text-red-500 bg-red-50 border-red-200" },
  HIGH:        { label: "High",    class: "text-orange-500 bg-orange-50 border-orange-200" },
  MEDIUM:      { label: "Medium",  class: "text-amber-600 bg-amber-50 border-amber-200" },
  LOW:         { label: "Low",     class: "text-blue-500 bg-blue-50 border-blue-200" },
  NO_PRIORITY: { label: "—",       class: "text-gray-400 bg-gray-50 border-gray-200" },
} as const;

type Task = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: keyof typeof PRIORITY_CONFIG;
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { subtasks: number };
};

export function TaskRow({ task, projectId }: {
  task: Task;
  projectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const done = task.status === "DONE";
  const priority = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !done;

  function toggleDone(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await updateTask(task.id, {
        projectId,
        status: done ? "TODO" : "DONE",
      });
    });
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0",
        isPending && "opacity-60"
      )}
    >
      {/* Checkbox */}
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

      {/* Title */}
      <span className={cn(
        "flex-1 text-sm truncate",
        done ? "line-through text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"
      )}>
        {task.title}
      </span>

      {/* Subtask count */}
      {task._count.subtasks > 0 && (
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {task._count.subtasks}
        </span>
      )}

      {/* Priority */}
      <span className={cn(
        "hidden sm:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
        priority.class
      )}>
        {priority.label}
      </span>

      {/* Due date */}
      {task.dueDate && (
        <span className={cn(
          "hidden md:flex items-center gap-1 text-xs shrink-0",
          isOverdue ? "text-red-500" : "text-muted-foreground"
        )}>
          <Calendar className="w-3 h-3" />
          {format(new Date(task.dueDate), "MMM d")}
        </span>
      )}

      {/* Assignee */}
      {task.assignee ? (
        <div
          className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0"
          title={task.assignee.name}
        >
          {task.assignee.name[0]?.toUpperCase()}
        </div>
      ) : (
        <div className="w-5 h-5 shrink-0" />
      )}
    </Link>
  );
}

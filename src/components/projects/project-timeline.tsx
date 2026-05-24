"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, isAfter, startOfWeek, addWeeks, isBefore, startOfToday } from "date-fns";
import { CalendarX, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
};

const STATUS_STYLES = {
  TODO:        "bg-gray-100 text-gray-500",
  IN_PROGRESS: "bg-blue-100 text-blue-600",
  IN_REVIEW:   "bg-amber-100 text-amber-600",
  DONE:        "bg-emerald-100 text-emerald-600",
  CANCELLED:   "bg-gray-100 text-gray-400 line-through",
} as const;

const PRIORITY_DOT = {
  URGENT:      "bg-red-500",
  HIGH:        "bg-orange-400",
  MEDIUM:      "bg-amber-400",
  LOW:         "bg-blue-400",
  NO_PRIORITY: "bg-gray-300",
} as const;

function TaskRow({ task, projectId }: { task: Task; projectId: string }) {
  const today = startOfToday();
  const isOverdue = task.dueDate && isBefore(new Date(task.dueDate), today) && task.status !== "DONE";

  return (
    <Link
      href={`/projects/${projectId}/tasks`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
    >
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
      <span className="flex-1 text-sm text-foreground truncate">{task.title}</span>

      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0", STATUS_STYLES[task.status])}>
        {task.status.replace("_", " ")}
      </span>

      {task.assignee && (
        task.assignee.avatarUrl ? (
          <img
            src={task.assignee.avatarUrl}
            alt={task.assignee.name}
            title={task.assignee.name}
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            title={task.assignee.name}
            className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
          >
            <span className="text-[9px] font-semibold text-primary">
              {task.assignee.name[0]?.toUpperCase()}
            </span>
          </div>
        )
      )}

      {task.dueDate && (
        <span className={cn("text-xs shrink-0 w-16 text-right", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
          {format(new Date(task.dueDate), "MMM d")}
        </span>
      )}
    </Link>
  );
}

export function ProjectTimeline({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  const today = startOfToday();

  const { overdue, noDueDate, weeks } = useMemo(() => {
    const overdue: Task[] = [];
    const noDueDate: Task[] = [];
    const byWeek = new Map<string, Task[]>();

    for (const task of tasks) {
      if (!task.dueDate) { noDueDate.push(task); continue; }
      const d = new Date(task.dueDate);
      if (isBefore(d, today) && task.status !== "DONE") {
        overdue.push(task);
        continue;
      }
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const key = weekStart.toISOString();
      if (!byWeek.has(key)) byWeek.set(key, []);
      byWeek.get(key)!.push(task);
    }

    const sorted = Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, tasks]) => ({
        weekStart: new Date(key),
        tasks: tasks.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
      }));

    return { overdue, noDueDate, weeks: sorted };
  }, [tasks, today]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No tasks yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add tasks with due dates to see them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overdue */}
      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarX className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Overdue</span>
          </div>
          <div className="rounded-xl border border-red-200 bg-card divide-y divide-border overflow-hidden">
            {overdue.map((t) => <TaskRow key={t.id} task={t} projectId={projectId} />)}
          </div>
        </div>
      )}

      {/* By week */}
      {weeks.map(({ weekStart, tasks: weekTasks }) => {
        const weekEnd = addWeeks(weekStart, 1);
        const isCurrentWeek = !isAfter(weekStart, today) && isAfter(weekEnd, today);
        return (
          <div key={weekStart.toISOString()}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-1.5 h-1.5 rounded-full", isCurrentWeek ? "bg-primary" : "bg-muted-foreground/40")} />
              <span className={cn("text-xs font-semibold uppercase tracking-wider", isCurrentWeek ? "text-primary" : "text-muted-foreground")}>
                {isCurrentWeek ? "This week — " : ""}{format(weekStart, "MMM d")} – {format(addWeeks(weekStart, 1), "MMM d")}
              </span>
            </div>
            <div className={cn("rounded-xl border bg-card divide-y divide-border overflow-hidden", isCurrentWeek ? "border-primary/30" : "border-border")}>
              {weekTasks.map((t) => <TaskRow key={t.id} task={t} projectId={projectId} />)}
            </div>
          </div>
        );
      })}

      {/* No due date */}
      {noDueDate.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">No due date</span>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {noDueDate.map((t) => <TaskRow key={t.id} task={t} projectId={projectId} />)}
          </div>
        </div>
      )}
    </div>
  );
}

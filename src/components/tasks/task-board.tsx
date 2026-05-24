"use client";

import { useState, useTransition, useOptimistic } from "react";
import { format } from "date-fns";
import { Calendar, Circle, CheckCircle2 } from "lucide-react";
import { updateTask } from "@/actions/tasks";
import { InlineTaskInput } from "./inline-task-input";
import { TaskDetailDialog } from "./task-detail-dialog";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { status: "TODO" as const,        label: "To Do",       dotClass: "bg-gray-400",    headerClass: "text-gray-600"    },
  { status: "IN_PROGRESS" as const, label: "In Progress",  dotClass: "bg-blue-400",    headerClass: "text-blue-600"    },
  { status: "IN_REVIEW" as const,   label: "In Review",    dotClass: "bg-violet-400",  headerClass: "text-violet-600"  },
  { status: "DONE" as const,        label: "Done",         dotClass: "bg-emerald-400", headerClass: "text-emerald-600" },
] as const;

type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { subtasks: number };
};

type Member = { id: string; name: string; avatarUrl: string | null };

const PRIORITY_DOTS: Record<Priority, string> = {
  URGENT:      "bg-red-500",
  HIGH:        "bg-orange-500",
  MEDIUM:      "bg-amber-400",
  LOW:         "bg-blue-400",
  NO_PRIORITY: "bg-gray-300",
};

function TaskCard({
  task,
  onClick,
  onDragStart,
}: {
  task: Task;
  onClick: () => void;
  onDragStart: (taskId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const done = task.status === "DONE";
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !done;

  function toggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await updateTask(task.id, { status: done ? "TODO" : "DONE" });
    });
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart(task.id);
      }}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-border/80 transition-all space-y-2",
        isPending && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={toggleDone}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
          aria-label={done ? "Mark incomplete" : "Mark complete"}
        >
          {done
            ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            : <Circle className="w-3.5 h-3.5" />
          }
        </button>
        <p className={cn(
          "text-sm leading-snug flex-1 min-w-0",
          done ? "line-through text-muted-foreground" : "text-foreground"
        )}>
          {task.title}
        </p>
      </div>

      <div className="flex items-center gap-2 pl-5">
        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOTS[task.priority])} />

        {task.dueDate && (
          <span className={cn(
            "flex items-center gap-1 text-[10px]",
            isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
          )}>
            <Calendar className="w-2.5 h-2.5" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}

        <div className="flex-1" />

        {task._count.subtasks > 0 && (
          <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
            {task._count.subtasks}
          </span>
        )}

        {task.assignee && (
          <div
            className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0"
            title={task.assignee.name}
          >
            {task.assignee.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks: initialTasks,
  projectId,
  members,
}: {
  tasks: Task[];
  projectId: string;
  members?: Member[];
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  const [tasks, setTasks] = useOptimistic<Task[], { taskId: string; status: TaskStatus }>(
    initialTasks,
    (prev, { taskId, status }) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  function handleDrop(e: React.DragEvent, targetStatus: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) {
      setDraggingId(null);
      setOverColumn(null);
      return;
    }
    setOverColumn(null);
    setDraggingId(null);
    startTransition(async () => {
      setTasks({ taskId, status: targetStatus });
      await updateTask(taskId, { status: targetStatus, projectId });
    });
  }

  return (
    <>
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex gap-3" style={{ minWidth: "max-content" }}>
          {COLUMNS.map(({ status, label, dotClass, headerClass }) => {
            const col = tasks.filter((t) => t.status === status);
            const isOver = overColumn === status;

            return (
              <div
                key={status}
                className="w-[272px] flex flex-col gap-2"
                onDragOver={(e) => { e.preventDefault(); setOverColumn(status); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
                }}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="flex items-center gap-2 px-0.5 py-1">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} />
                  <span className={cn("text-xs font-semibold", headerClass)}>{label}</span>
                  <span className="text-xs text-muted-foreground">({col.length})</span>
                </div>

                <div className={cn(
                  "flex flex-col gap-2 min-h-[60px] rounded-xl transition-colors",
                  isOver && draggingId && "bg-primary/5 ring-2 ring-primary/20"
                )}>
                  {col.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTaskId(task.id)}
                      onDragStart={(id) => setDraggingId(id)}
                    />
                  ))}
                </div>

                {(status === "TODO" || status === "IN_PROGRESS") && (
                  <div className="rounded-xl border border-dashed border-border overflow-hidden">
                    <InlineTaskInput projectId={projectId} status={status} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetailDialog
        task={selectedTask}
        projectId={projectId}
        members={members}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
  );
}

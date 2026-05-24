"use client";

import { useState, useMemo } from "react";
import { List, Columns, Search, X, ChevronDown, Download } from "lucide-react";
import { TaskRow } from "./task-row";
import { TaskBoard } from "./task-board";
import { InlineTaskInput } from "./inline-task-input";
import { cn } from "@/lib/utils";

const STATUS_GROUPS = [
  { status: "TODO",        label: "To Do",       color: "text-gray-500",    dot: "bg-gray-300"    },
  { status: "IN_PROGRESS", label: "In Progress",  color: "text-blue-600",    dot: "bg-blue-400"    },
  { status: "IN_REVIEW",   label: "In Review",    color: "text-violet-600",  dot: "bg-violet-400"  },
  { status: "DONE",        label: "Done",         color: "text-emerald-600", dot: "bg-emerald-400" },
] as const;

type Status = typeof STATUS_GROUPS[number]["status"];

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: Status | "CANCELLED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { subtasks: number };
};

type Member = { id: string; name: string; avatarUrl: string | null };

export function TaskList({
  tasks,
  projectId,
  members,
  currentUserId,
}: {
  tasks: Task[];
  projectId: string;
  members?: Member[];
  currentUserId?: string;
}) {
  const [view, setView] = useState<"list" | "board">("board");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["DONE"]));
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const PRIORITIES = [
    { value: "all",         label: "All priorities" },
    { value: "URGENT",      label: "Urgent" },
    { value: "HIGH",        label: "High" },
    { value: "MEDIUM",      label: "Medium" },
    { value: "LOW",         label: "Low" },
    { value: "NO_PRIORITY", label: "No priority" },
  ];

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter === "unassigned" && t.assignee !== null) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && t.assignee?.id !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, search, priorityFilter, assigneeFilter]);

  function toggle(status: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  }

  return (
    <>
      {/* View toggle header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {filteredTasks.length !== tasks.length
            ? `${filteredTasks.length} of ${tasks.length} tasks`
            : `${tasks.length} tasks`}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={`/api/projects/${projectId}/tasks/export`}
            download
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Export tasks as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </a>
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md transition-all",
              view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView("board")}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md transition-all",
              view === "board" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Board view"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tasks..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 border border-border rounded-xl outline-none focus:border-primary/50 focus:bg-background transition-colors placeholder:text-muted-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority filter */}
        <div className="relative">
          {priorityOpen && <div className="fixed inset-0 z-40" onClick={() => setPriorityOpen(false)} />}
          <button
            onClick={() => setPriorityOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl transition-colors",
              priorityFilter !== "all"
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:text-foreground bg-muted/50"
            )}
          >
            Priority
            <ChevronDown className="w-3 h-3" />
          </button>
          {priorityOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 w-40 overflow-hidden">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setPriorityFilter(p.value); setPriorityOpen(false); }}
                  className={cn(
                    "flex items-center w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors",
                    priorityFilter === p.value ? "text-primary font-medium" : "text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignee filter */}
        {members && members.length > 0 && (
          <div className="relative">
            {assigneeOpen && <div className="fixed inset-0 z-40" onClick={() => setAssigneeOpen(false)} />}
            <button
              onClick={() => setAssigneeOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl transition-colors",
                assigneeFilter !== "all"
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground bg-muted/50"
              )}
            >
              Assignee
              <ChevronDown className="w-3 h-3" />
            </button>
            {assigneeOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 w-44 overflow-hidden">
                <button
                  onClick={() => { setAssigneeFilter("all"); setAssigneeOpen(false); }}
                  className={cn("flex items-center w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors", assigneeFilter === "all" ? "text-primary font-medium" : "text-foreground")}
                >
                  Everyone
                </button>
                <button
                  onClick={() => { setAssigneeFilter("unassigned"); setAssigneeOpen(false); }}
                  className={cn("flex items-center w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors", assigneeFilter === "unassigned" ? "text-primary font-medium" : "text-foreground")}
                >
                  Unassigned
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setAssigneeFilter(m.id); setAssigneeOpen(false); }}
                    className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/60 transition-colors", assigneeFilter === m.id ? "text-primary font-medium" : "text-foreground")}
                  >
                    <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-semibold shrink-0">
                      {m.name[0]?.toUpperCase()}
                    </div>
                    <span className="truncate">{m.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clear filters */}
        {(priorityFilter !== "all" || assigneeFilter !== "all") && (
          <button
            onClick={() => { setPriorityFilter("all"); setAssigneeFilter("all"); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Board view */}
      {view === "board" && (
        <TaskBoard tasks={filteredTasks} projectId={projectId} members={members} />
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-4">
          {STATUS_GROUPS.map(({ status, label, color, dot }) => {
            const group = filteredTasks.filter((t) => t.status === status);
            const isCollapsed = collapsed.has(status);

            return (
              <div key={status} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => toggle(status)}
                  className="flex items-center gap-2.5 w-full px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                  <span className={cn("text-sm font-medium", color)}>{label}</span>
                  <span className="text-xs text-muted-foreground">({group.length})</span>
                  <div className="ml-auto text-muted-foreground">
                    <svg
                      className={cn("w-3.5 h-3.5 transition-transform", isCollapsed && "-rotate-90")}
                      viewBox="0 0 16 16" fill="currentColor"
                    >
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {!isCollapsed && (
                  <>
                    {group.length === 0 && status !== "DONE" && (
                      <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border/50">
                        No tasks
                      </div>
                    )}
                    {group.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        projectId={projectId}
                      />
                    ))}
                    {(status === "TODO" || status === "IN_PROGRESS") && (
                      <div className="border-t border-border/50">
                        <InlineTaskInput projectId={projectId} status={status} />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

    </>
  );
}

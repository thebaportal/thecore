"use client";

import { useState, useTransition, useEffect } from "react";
import { Loader2, CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { createTask } from "@/actions/tasks";
import { getProjects } from "@/actions/projects";
import { getProjectMembers } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; color: string | null; iconEmoji: string | null };
type Member  = { id: string; name: string; avatarUrl: string | null };

const PRIORITIES = [
  { value: "URGENT", label: "Urgent", color: "text-red-500"    },
  { value: "HIGH",   label: "High",   color: "text-orange-500" },
  { value: "MEDIUM", label: "Medium", color: "text-amber-500"  },
  { value: "LOW",    label: "Low",    color: "text-blue-500"   },
] as const;

export function NewTaskDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [projectId,  setProjectId]  = useState(defaultProjectId ?? "");
  const [title,      setTitle]      = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority,   setPriority]   = useState<"URGENT" | "HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [dueDate,    setDueDate]    = useState("");

  // Load projects on open
  useEffect(() => {
    if (!open) return;
    getProjects().then((all) =>
      setProjects(all.map((p) => ({ id: p.id, name: p.name, color: p.color, iconEmoji: p.iconEmoji })))
    );
    setProjectId(defaultProjectId ?? "");
    setTitle("");
    setAssigneeId("");
    setPriority("MEDIUM");
    setDueDate("");
  }, [open, defaultProjectId]);

  // Load project members whenever project changes
  useEffect(() => {
    setAssigneeId("");
    setMembers([]);
    if (!projectId) return;
    getProjectMembers(projectId).then(setMembers);
  }, [projectId]);

  function handleClose() {
    onOpenChange(false);
  }

  function submit() {
    if (!title.trim() || !projectId) return;
    startTransition(async () => {
      await createTask({
        title: title.trim(),
        projectId,
        priority,
        status: "TODO",
        assigneeId: assigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      });
      handleClose();
    });
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="h-9 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          {/* Project picker */}
          {!defaultProjectId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">No projects</p>
                ) : (
                  projects.map((p) => {
                    const color = p.color ?? "#1E3A8A";
                    return (
                      <button
                        key={p.id}
                        onClick={() => setProjectId(p.id)}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors",
                          projectId === p.id ? "bg-accent" : "hover:bg-muted/50"
                        )}
                      >
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-sm"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          {p.iconEmoji ?? <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                        </div>
                        <span className="text-sm text-foreground">{p.name}</span>
                        {projectId === p.id && <span className="ml-auto text-primary text-xs">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Assignee — only shown once a project is selected */}
          {projectId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Assign to {selectedProject && <span className="normal-case font-normal">({selectedProject.name} team)</span>}
              </label>
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground">No team members on this project yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {/* Unassigned option */}
                  <button
                    onClick={() => setAssigneeId("")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                      !assigneeId
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border text-muted-foreground hover:border-border/80"
                    )}
                  >
                    Unassigned
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setAssigneeId(m.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                        assigneeId === m.id
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                      )}
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[9px] font-semibold shrink-0">
                        {m.avatarUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                          : m.name[0]?.toUpperCase()}
                      </div>
                      {m.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all",
                    priority === p.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due date <span className="normal-case font-normal">(optional)</span></label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            {dueDate && (
              <p className="text-xs text-muted-foreground">
                Due {format(new Date(dueDate), "MMMM d, yyyy")}
                <button onClick={() => setDueDate("")} className="ml-2 text-primary hover:underline">clear</button>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={!title.trim() || !projectId || isPending}
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Create Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

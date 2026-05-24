"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, List, Plus, Calendar,
  Archive, CheckCheck, CircleDot, X, Trash2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./project-card";
import { NewProjectDialog } from "./new-project-dialog";
import { bulkUpdateProjectStatus, deleteProject } from "@/actions/projects";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  ACTIVE:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  ON_HOLD:   "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
  ARCHIVED:  "bg-gray-50 text-gray-500 border-gray-200",
} as const;

const STATUS_LABELS = {
  ACTIVE: "Active", ON_HOLD: "On Hold", COMPLETED: "Completed", ARCHIVED: "Archived",
} as const;

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: keyof typeof STATUS_LABELS;
  color: string | null;
  iconEmoji: string | null;
  targetDate: Date | null;
  updatedAt: Date;
  pinnedAt: Date | null;
  _count: { tasks: number };
  completedTaskCount?: number;
  creator: { name: string; avatarUrl: string | null };
};

const STATUS_FILTER_OPTIONS = [
  { value: "active",   label: "Active",    statuses: ["ACTIVE", "ON_HOLD"] },
  { value: "done",     label: "Completed", statuses: ["COMPLETED"] },
  { value: "archived", label: "Archived",  statuses: ["ARCHIVED"] },
  { value: "all",      label: "All",       statuses: ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] },
] as const;

// ─── List row ─────────────────────────────────────────────────────────────────

function ProjectListRow({
  project,
  selected,
  selectionActive,
  onToggle,
}: {
  project: Project;
  selected: boolean;
  selectionActive: boolean;
  onToggle: () => void;
}) {
  const color = project.color ?? "#1E3A8A";

  return (
    <div className={cn(
      "group flex items-center border-b border-border/50 last:border-0 transition-colors",
      selected ? "bg-primary/5" : "hover:bg-muted/40"
    )}>
      {/* Checkbox */}
      <label
        className={cn(
          "flex items-center justify-center w-10 h-full py-3.5 cursor-pointer shrink-0 transition-opacity",
          selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 accent-primary rounded cursor-pointer"
        />
      </label>

      {/* Row content — navigates on click */}
      <a href={`/projects/${project.id}`} className="flex flex-1 items-center gap-4 pr-5 py-3.5 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
          style={{ backgroundColor: `${color}18` }}
        >
          {project.iconEmoji ?? (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {project.name}
          </p>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate">{project.description}</p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          {project.targetDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(project.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>

        <span className={cn(
          "hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0",
          STATUS_STYLES[project.status]
        )}>
          {STATUS_LABELS[project.status]}
        </span>
      </a>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

type PhaseTemplate = {
  id: string;
  name: string;
  description: string | null;
  _count: { phases: number };
};

export function ProjectsView({ projects, templates }: { projects: Project[]; templates: PhaseTemplate[] }) {
  const router = useRouter();
  const [view, setView]               = useState<"grid" | "list">("grid");
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "done" | "archived" | "all">("active");
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [bulkPending, startBulk]          = useTransition();

  const filtered = useMemo(() => {
    const opt = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter);
    if (!opt) return projects;
    return projects.filter((p) => (opt.statuses as readonly string[]).includes(p.status));
  }, [projects, statusFilter]);

  const selectionActive = selectedIds.size > 0;
  const allSelected     = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setConfirmingDelete(false);
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    startBulk(async () => {
      await Promise.all([...selectedIds].map((id) => deleteProject(id)));
      clearSelection();
      router.refresh();
    });
  }

  function handleBulk(status: "ACTIVE" | "COMPLETED" | "ARCHIVED") {
    if (selectedIds.size === 0) return;
    startBulk(async () => {
      await bulkUpdateProjectStatus([...selectedIds], status);
      clearSelection();
      router.refresh();
    });
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectionActive
                ? `${selectedIds.size} of ${filtered.length} selected`
                : `${filtered.length} ${filtered.length === 1 ? "project" : "projects"}`}
            </p>
          </div>

          {/* Select-all toggle — only when something is filtered */}
          {filtered.length > 0 && (
            <button
              onClick={toggleAll}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium transition-colors px-2.5 py-1.5 rounded-lg border",
                allSelected
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-border hover:text-foreground hover:bg-muted"
              )}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-3.5 h-3.5 accent-primary cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status filter */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); clearSelection(); }}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-all",
                  statusFilter === opt.value
                    ? "bg-background shadow-sm text-foreground font-semibold"
                    : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-md transition-all",
                view === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-md transition-all",
                view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button size="sm" className="gap-1.5 h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Projects */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <LayoutGrid className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            {projects.length === 0
              ? "No projects yet"
              : `No ${statusFilter === "active" ? "active" : statusFilter} projects`}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            {projects.length === 0
              ? "Create your first project to start organising work."
              : "Switch the filter above to see projects in other states."}
          </p>
          {projects.length === 0 && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Project
            </Button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((project) => {
            const selected = selectedIds.has(project.id);
            return (
              <div key={project.id} className="relative group/item">
                {/* Checkbox overlay */}
                <label
                  className={cn(
                    "absolute top-3 left-3 z-20 cursor-pointer transition-opacity",
                    selectionActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(project.id)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer shadow-sm"
                  />
                </label>
                {/* Selection ring */}
                {selected && (
                  <div className="absolute inset-0 z-10 rounded-xl ring-2 ring-primary bg-primary/5 pointer-events-none" />
                )}
                <ProjectCard project={project} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((project) => (
            <ProjectListRow
              key={project.id}
              project={project}
              selected={selectedIds.has(project.id)}
              selectionActive={selectionActive}
              onToggle={() => toggle(project.id)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selectionActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-foreground text-background rounded-2xl px-2 py-2 shadow-2xl shadow-black/20 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-xs font-semibold text-background/70 px-2 tabular-nums whitespace-nowrap">
            {selectedIds.size} selected
          </span>

          <div className="w-px h-5 bg-background/15 mx-1" />

          <button
            onClick={() => handleBulk("ACTIVE")}
            disabled={bulkPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-background/15 transition-colors disabled:opacity-50"
          >
            <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
            Set Active
          </button>

          <button
            onClick={() => handleBulk("COMPLETED")}
            disabled={bulkPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-background/15 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
            Mark Completed
          </button>

          <button
            onClick={() => handleBulk("ARCHIVED")}
            disabled={bulkPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-background/15 transition-colors disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5 text-background/60" />
            Archive
          </button>

          <div className="w-px h-5 bg-background/15 mx-1" />

          {confirmingDelete ? (
            <>
              <span className="text-xs font-medium text-red-400 px-2 whitespace-nowrap">
                Delete {selectedIds.size} project{selectedIds.size !== 1 ? "s" : ""}?
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-background/15 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-background/60" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={bulkPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-background/15 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Delete
            </button>
          )}

          <div className="w-px h-5 bg-background/15 mx-1" />

          <button
            onClick={clearSelection}
            className="flex items-center justify-center w-7 h-7 rounded-xl hover:bg-background/15 transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5 text-background/60" />
          </button>
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} templates={templates} />
    </>
  );
}

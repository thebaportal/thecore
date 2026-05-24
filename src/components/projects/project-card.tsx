"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Calendar, Pin } from "lucide-react";
import { toggleProjectPin } from "@/actions/projects";
import { cn } from "@/lib/utils";
import type { ProjectHealth } from "@/actions/dashboard";

const STATUS_STYLES = {
  ACTIVE:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  ON_HOLD:   "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
  ARCHIVED:  "bg-gray-50 text-gray-500 border-gray-200",
} as const;

const STATUS_LABELS = {
  ACTIVE: "Active", ON_HOLD: "On Hold", COMPLETED: "Completed", ARCHIVED: "Archived",
} as const;

const HEALTH_CONFIG: Record<ProjectHealth, { dot: string; label: string; text: string } | null> = {
  ON_TRACK:   { dot: "bg-emerald-500", label: "On track",   text: "text-emerald-600" },
  AT_RISK:    { dot: "bg-amber-500",   label: "At risk",    text: "text-amber-600"   },
  BEHIND:     { dot: "bg-red-500",     label: "Behind",     text: "text-red-600"     },
  NO_DEADLINE: null,
};

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
  health?: ProjectHealth;
  creator: { name: string; avatarUrl: string | null };
};

export function ProjectCard({ project }: { project: Project }) {
  const [isPending, startTransition] = useTransition();
  const color = project.color ?? "#1E3A8A";
  const total = project._count.tasks;
  const completed = project.completedTaskCount ?? 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pinned = !!project.pinnedAt;

  function handlePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => toggleProjectPin(project.id));
  }

  return (
    <div className="relative group">
      <Link href={`/projects/${project.id}`} className="block">
        <div className={cn(
          "relative bg-card border rounded-xl p-5 hover:shadow-sm transition-all duration-150 h-full flex flex-col",
          pinned ? "border-primary/30 ring-1 ring-primary/10" : "border-border hover:border-primary/30"
        )}>
          {/* Color accent bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: color }} />

          {/* Pin indicator */}
          {pinned && (
            <div className="absolute top-3 right-3">
              <Pin className="w-3 h-3 text-primary fill-primary" />
            </div>
          )}

          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg"
              style={{ backgroundColor: `${color}18` }}
            >
              {project.iconEmoji ?? <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />}
            </div>
            <div className="flex-1 min-w-0 pr-5">
              <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              {project.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {/* Progress bar */}
          {total > 0 && (
            <div className="mb-3 space-y-1">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: color }} />
              </div>
              <p className="text-[10px] text-muted-foreground">{completed}/{total} tasks · {progress}%</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60 mt-auto">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {project.targetDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {project.health && HEALTH_CONFIG[project.health] && (() => {
                const h = HEALTH_CONFIG[project.health!]!;
                return (
                  <span className={cn("flex items-center gap-1 text-[10px] font-medium", h.text)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", h.dot)} />
                    {h.label}
                  </span>
                );
              })()}
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border",
                STATUS_STYLES[project.status]
              )}>
                {STATUS_LABELS[project.status]}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Pin button — appears on hover, outside the Link to prevent navigation */}
      <button
        onClick={handlePin}
        disabled={isPending}
        title={pinned ? "Unpin project" : "Pin project"}
        className={cn(
          "absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center transition-all",
          pinned
            ? "opacity-100 text-primary"
            : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary hover:bg-muted"
        )}
      >
        <Pin className={cn("w-3 h-3", pinned && "fill-primary")} />
      </button>
    </div>
  );
}

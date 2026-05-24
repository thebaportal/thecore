"use client";

import { useState, useTransition } from "react";
import { format, isPast } from "date-fns";
import { CheckCircle2, Circle, Plus, Trash2, Loader2, Flag, X } from "lucide-react";
import { createMilestone, toggleMilestone, deleteMilestone } from "@/actions/milestones";
import { cn } from "@/lib/utils";

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export function MilestonesSection({
  projectId,
  initialMilestones,
}: {
  projectId: string;
  initialMilestones: Milestone[];
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleMilestone(id);
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, completedAt: m.completedAt ? null : new Date() } : m
        )
      );
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMilestone(id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    });
  }

  function handleCreate() {
    if (!newTitle.trim()) return;
    startTransition(async () => {
      const milestone = await createMilestone(projectId, {
        title: newTitle.trim(),
        dueDate: newDate ? new Date(newDate) : null,
      });
      setMilestones((prev) => [...prev, milestone as Milestone]);
      setNewTitle("");
      setNewDate("");
      setCreating(false);
    });
  }

  const open = milestones.filter((m) => !m.completedAt);
  const completed = milestones.filter((m) => m.completedAt);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Flag className="w-3 h-3" /> Milestones
        </h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          title="Add milestone"
        >
          {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* New milestone form */}
      {creating && (
        <div className="space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Milestone title..."
            autoFocus
            className="w-full text-sm bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/50 placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 text-xs bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/50 text-foreground [color-scheme:light]"
            />
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || isPending}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Add
            </button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !creating ? (
        <p className="text-xs text-muted-foreground py-1">No milestones yet.</p>
      ) : (
        <div className="space-y-1.5">
          {open.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
          {completed.length > 0 && open.length > 0 && (
            <div className="border-t border-border my-1" />
          )}
          {completed.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneRow({
  milestone,
  onToggle,
  onDelete,
  isPending,
}: {
  milestone: Milestone;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const done = !!milestone.completedAt;
  const overdue = milestone.dueDate && isPast(new Date(milestone.dueDate)) && !done;

  return (
    <div className="group flex items-start gap-2">
      <button
        onClick={() => onToggle(milestone.id)}
        disabled={isPending}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {done
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          : <Circle className="w-3.5 h-3.5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium leading-snug", done && "line-through text-muted-foreground")}>
          {milestone.title}
        </p>
        {milestone.dueDate && (
          <p className={cn("text-[10px] mt-0.5", overdue ? "text-red-500" : "text-muted-foreground")}>
            {overdue ? "Overdue · " : ""}{format(new Date(milestone.dueDate), "MMM d")}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(milestone.id)}
        disabled={isPending}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-red-500"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { addProjectSession, deleteProjectSession } from "@/actions/cohort-dashboard";
import type { SessionRow } from "@/actions/cohort-dashboard";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string };

function sessionDateLabel(date: Date): string {
  const d = new Date(date);
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  const days = differenceInDays(d, new Date());
  if (days <= 7)     return `In ${days} days`;
  return format(d, "EEE, MMM d");
}

export function SessionManager({ sessions, projectId, projects = [] }: {
  sessions: SessionRow[];
  projectId: string;
  projects?: Project[];
}) {
  const defaultProjectId = projectId;
  const [showForm, setShowForm]             = useState(false);
  const [title, setTitle]                   = useState("");
  const [date, setDate]                     = useState("");
  const [time, setTime]                     = useState("18:00");
  const [selectedProject, setSelectedProject] = useState(defaultProjectId);
  const [notes, setNotes]                   = useState("");
  const [isPending, start]                  = useTransition();
  const [deleting, setDeleting]             = useState<string | null>(null);

  function reset() {
    setTitle(""); setDate(""); setTime("18:00");
    setSelectedProject(defaultProjectId); setNotes("");
    setShowForm(false);
  }

  function handleAdd() {
    if (!title.trim() || !date || !selectedProject) return;
    const datetime = new Date(`${date}T${time}`).toISOString();
    start(async () => {
      await addProjectSession(selectedProject, { title: title.trim(), datetime, type: "class", notes });
      reset();
    });
  }

  function handleDelete(id: string) {
    setDeleting(id);
    start(async () => {
      await deleteProjectSession(id);
      setDeleting(null);
    });
  }

  const inputCls = "w-full text-sm px-3 py-2 rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50";

  return (
    <div className="space-y-2">
      {sessions.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground py-1">No upcoming sessions scheduled.</p>
      )}

      {sessions.map((s) => (
        <div
          key={s.id}
          className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors group"
        >
          <div className="shrink-0 text-center min-w-[36px]">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
              {format(new Date(s.datetime), "MMM")}
            </p>
            <p className="text-lg font-bold text-foreground leading-tight">
              {format(new Date(s.datetime), "d")}
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary truncate max-w-[120px]">
                {s.projectName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {sessionDateLabel(s.datetime)} · {format(new Date(s.datetime), "h:mm a")}
            </p>
            {s.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{s.notes}</p>}
          </div>
          <button
            onClick={() => handleDelete(s.id)}
            disabled={isPending}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted"
          >
            {deleting === s.id
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      ))}

      {showForm ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
          {/* Project picker */}
          {projects.length > 1 && (
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className={inputCls}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session title"
            className={inputCls}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(inputCls, "flex-1")}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-28 text-sm px-3 py-2 rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isPending || !title.trim() || !date || !selectedProject}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add session
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add session
        </button>
      )}
    </div>
  );
}

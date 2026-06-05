"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Clock, RotateCcw, Circle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DeliverableRow, StudentStatusRow } from "@/actions/cohort-dashboard";

const STATUS_CONFIG: Record<string, { label: string; dot: string; textCls: string }> = {
  NOT_SUBMITTED:   { label: "Not submitted",   dot: "bg-muted-foreground/25", textCls: "text-muted-foreground" },
  SUBMITTED:       { label: "Submitted",        dot: "bg-amber-400",           textCls: "text-amber-700" },
  UNDER_REVIEW:    { label: "Under review",     dot: "bg-blue-400",            textCls: "text-blue-700" },
  APPROVED:        { label: "Approved",         dot: "bg-emerald-400",         textCls: "text-emerald-700" },
  REVISION_NEEDED: { label: "Revision needed",  dot: "bg-red-400",             textCls: "text-red-700" },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_SUBMITTED!;
  return <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />;
}

function ProgressBar({ total, notSubmitted, submitted, approved, needsRevision }: {
  total: number; notSubmitted: number; submitted: number; approved: number; needsRevision: number;
}) {
  if (total === 0) return <div className="h-1.5 rounded-full bg-muted w-full" />;
  const approvedPct    = (approved / total) * 100;
  const submittedPct   = (submitted / total) * 100;
  const revisionPct    = (needsRevision / total) * 100;
  return (
    <div className="h-1.5 rounded-full bg-muted w-full overflow-hidden flex">
      <div className="bg-emerald-400 transition-all" style={{ width: `${approvedPct}%` }} />
      <div className="bg-amber-400 transition-all"   style={{ width: `${submittedPct}%` }} />
      <div className="bg-red-400 transition-all"     style={{ width: `${revisionPct}%` }} />
    </div>
  );
}

function StudentRow({ row }: { row: StudentStatusRow }) {
  const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.NOT_SUBMITTED!;
  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 transition-colors">
      {row.avatarUrl
        ? <img src={row.avatarUrl} alt={row.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
        : <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
            {row.name[0]?.toUpperCase()}
          </div>
      }
      <span className="flex-1 text-xs text-foreground truncate">{row.name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusDot status={row.status} />
        <span className={cn("text-[11px] font-medium", cfg.textCls)}>{cfg.label}</span>
      </div>
      {row.submittedAt && (
        <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
          {format(new Date(row.submittedAt), "MMM d")}
        </span>
      )}
    </div>
  );
}

function DeliverableRow({ d, projectId }: { d: DeliverableRow; projectId: string }) {
  const [open, setOpen] = useState(false);
  const donePct = d.total > 0 ? Math.round(((d.approved + d.submitted + d.needsRevision) / d.total) * 100) : 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        }
        <span className="flex-1 text-sm font-medium text-foreground truncate">{d.title}</span>

        {/* Counts */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs tabular-nums">
          {d.approved > 0 && (
            <span className="flex items-center gap-1 text-emerald-700">
              <Check className="w-3 h-3" /> {d.approved}
            </span>
          )}
          {d.submitted > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Clock className="w-3 h-3" /> {d.submitted}
            </span>
          )}
          {d.needsRevision > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <RotateCcw className="w-3 h-3" /> {d.needsRevision}
            </span>
          )}
          {d.notSubmitted > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Circle className="w-3 h-3" /> {d.notSubmitted}
            </span>
          )}
        </div>

        {/* Progress bar + pct */}
        <div className="flex items-center gap-2 w-28 shrink-0">
          <ProgressBar
            total={d.total}
            notSubmitted={d.notSubmitted}
            submitted={d.submitted}
            approved={d.approved}
            needsRevision={d.needsRevision}
          />
          <span className="text-[11px] text-muted-foreground tabular-nums w-7 text-right">
            {donePct}%
          </span>
        </div>

        {d.dueDate && (
          <span className="hidden lg:block text-[11px] text-muted-foreground tabular-nums w-14 text-right shrink-0">
            {format(new Date(d.dueDate), "MMM d")}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-muted/20 border-t border-border/40">
          {d.rows.length === 0
            ? <p className="px-4 py-3 text-xs text-muted-foreground">No students assigned.</p>
            : d.rows.map((row) => <StudentRow key={row.userId} row={row} />)
          }
        </div>
      )}
    </div>
  );
}

export function DeliverableTracker({ deliverables, projectId }: {
  deliverables: DeliverableRow[];
  projectId: string;
}) {
  if (deliverables.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1 py-4">
        No deliverables set for the current phase.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Legend */}
      <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-muted/30 border-b border-border/50 text-[11px] text-muted-foreground">
        <span className="flex-1 font-medium uppercase tracking-wider">Deliverable</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Approved</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> Awaiting review</span>
          <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3 text-red-500" /> Revision</span>
          <span className="flex items-center gap-1"><Circle className="w-3 h-3" /> Not submitted</span>
        </div>
        <span className="w-28 text-right">Progress</span>
        <span className="hidden lg:block w-14 text-right">Due</span>
      </div>
      {deliverables.map((d) => (
        <DeliverableRow key={d.id} d={d} projectId={projectId} />
      ))}
    </div>
  );
}

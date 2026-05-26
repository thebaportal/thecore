"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Trash2, Loader2, CalendarDays } from "lucide-react";
import { PhaseGuidanceEditor } from "@/components/phases/phase-guidance-editor";
import { PhaseTitleEditor } from "@/components/phases/phase-title-editor";
import { PhaseFooterControls, AddDeliverableForm } from "@/components/phases/phase-controls";
import { DeliverableCard, DeliverableCardData } from "@/components/phases/deliverable-card";
import { deletePhase, updatePhase } from "@/actions/phases";
import { cn } from "@/lib/utils";

function PhaseDeleteButton({ phaseId }: { phaseId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deletePhase(phaseId);
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
        <span className="text-muted-foreground">Delete?</span>
        <button onClick={() => setConfirm(false)} disabled={isPending} className="text-muted-foreground hover:text-foreground transition-colors">No</button>
        <button onClick={handleDelete} disabled={isPending} className="font-medium text-destructive hover:text-destructive/80 transition-colors">
          {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Yes"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirm(true); }}
      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

const DOT_CLS = {
  COMPLETED:   "bg-emerald-500",
  IN_PROGRESS: "bg-primary ring-2 ring-primary/25 ring-offset-1",
  NOT_STARTED: "border border-border bg-background",
} as const;

function PhaseDueDateEditor({ phaseId, dueDate }: { phaseId: string; dueDate: Date | string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(
    dueDate ? new Date(dueDate as string | Date).toISOString().split("T")[0]! : ""
  );
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    startTransition(async () => {
      await updatePhase(phaseId, { dueDate: next ? new Date(next) : null });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
      <CalendarDays className="w-3 h-3 text-muted-foreground/40 shrink-0" />
      <input
        type="date"
        value={value}
        onChange={handleChange}
        disabled={isPending}
        title="Phase due date"
        className="bg-transparent outline-none text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 w-[90px]"
      />
    </div>
  );
}

type Phase = {
  id: string;
  order: number;
  name: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  startedAt: Date | string | null;
  dueDate: Date | string | null;
  guidance: string | null;
  deliverables: DeliverableCardData[];
};

export function PhaseList({
  phases,
  projectId,
  isInstructor,
  currentUserRole,
  currentUserId,
  projectMembers,
  orgAdmins,
}: {
  phases: Phase[];
  projectId: string;
  isInstructor: boolean;
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  currentUserId: string;
  projectMembers: { id: string; name: string; avatarUrl: string | null }[];
  orgAdmins: { id: string; name: string }[];
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (phases.length === 0) return null;

  return (
    <div className="space-y-8">
      {phases.map((phase) => {
        const isCollapsed = !!collapsed[phase.id];
        const isCompleted = phase.status === "COMPLETED";
        const isActive    = phase.status === "IN_PROGRESS";
        const dotCls      = DOT_CLS[phase.status] ?? DOT_CLS.NOT_STARTED;

        return (
          <div key={phase.id}>
            {/* Phase header */}
            <div className="flex items-center gap-3 mb-5 cursor-pointer group" onClick={() => toggle(phase.id)}>
              <div className={cn("w-5 h-5 rounded-full shrink-0 flex items-center justify-center", dotCls)}>
                {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Phase {phase.order}</p>
                  {isCompleted && <span className="text-[10px] font-semibold text-emerald-600">Complete</span>}
                  {isActive    && <span className="text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded">Active</span>}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {isInstructor
                    ? <PhaseTitleEditor phaseId={phase.id} initialName={phase.name} />
                    : <h2 className="text-base font-semibold text-foreground leading-snug">{phase.name}</h2>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {phase.startedAt && (
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(phase.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                )}
                {isInstructor
                  ? <PhaseDueDateEditor phaseId={phase.id} dueDate={phase.dueDate} />
                  : phase.dueDate
                    ? <p className="text-xs text-muted-foreground">
                        Due {new Date(phase.dueDate as string | Date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    : null
                }
                {isInstructor && <PhaseDeleteButton phaseId={phase.id} />}
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground/40 transition-transform duration-200", isCollapsed && "-rotate-90")} />
              </div>
            </div>

            {/* Collapsible body */}
            {!isCollapsed && (
              <div className="ml-8 space-y-6">

                {/* Guidance — primary content */}
                {(phase.guidance || isInstructor) && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {isInstructor
                      ? <PhaseGuidanceEditor phaseId={phase.id} initialGuidance={phase.guidance ?? ""} />
                      : <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{phase.guidance}</p>
                    }
                  </div>
                )}

                {/* Deliverables — only when they exist */}
                {phase.deliverables.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                      Deliverable{phase.deliverables.length !== 1 ? "s" : ""}
                    </p>
                    {phase.deliverables.map((deliverable) => (
                      <DeliverableCard
                        key={deliverable.id}
                        deliverable={deliverable}
                        projectId={projectId}
                        isInstructor={isInstructor}
                        currentUserId={currentUserId}
                        projectMembers={projectMembers}
                        orgAdmins={orgAdmins}
                      />
                    ))}
                  </div>
                )}

                {/* Instructor: add deliverable to active phase */}
                {isInstructor && <AddDeliverableForm phaseId={phase.id} />}

                {/* Instructor: complete / reopen phase */}
                {isInstructor && (
                  <PhaseFooterControls phaseId={phase.id} phaseName={phase.name} status={phase.status} startedAt={phase.startedAt} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

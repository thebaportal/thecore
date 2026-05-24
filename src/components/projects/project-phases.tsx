import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { getProjectPhases } from "@/actions/projects";
import { cn } from "@/lib/utils";

const DELIVERABLE_DOT: Record<string, string> = {
  NOT_SUBMITTED:   "bg-muted-foreground/20",
  SUBMITTED:       "bg-amber-400",
  UNDER_REVIEW:    "bg-amber-400",
  APPROVED:        "bg-emerald-500",
  REVISION_NEEDED: "bg-red-400",
};

type Phase = Awaited<ReturnType<typeof getProjectPhases>>[number];

function DeliverableDots({ deliverables }: { deliverables: Phase["deliverables"] }) {
  if (deliverables.length === 0) return null;
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {deliverables.map((d) => (
        <div
          key={d.id}
          title={d.title}
          className={cn("w-2 h-2 rounded-full shrink-0", DELIVERABLE_DOT[d.status] ?? "bg-muted")}
        />
      ))}
    </div>
  );
}

function PhaseRow({ phase, isLast }: { phase: Phase; isLast: boolean }) {
  const isCompleted        = phase.status === "COMPLETED";
  const isActive           = phase.status === "IN_PROGRESS";
  const isUnlockedNotStart = phase.status === "NOT_STARTED" && !phase.isLocked;
  const isLocked           = phase.isLocked && phase.status === "NOT_STARTED";

  const total    = phase.deliverables.length;
  const approved = phase.deliverables.filter((d) => d.status === "APPROVED").length;

  return (
    <div className={cn("relative flex gap-3.5", !isLast && "pb-6")}>
      {/* Rail segment — drawn downward from this dot */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border/70" />
      )}

      {/* Status dot */}
      <div className="relative z-10 shrink-0 mt-0.5">
        {isCompleted ? (
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
        ) : isActive ? (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
        ) : isUnlockedNotStart ? (
          <div className="w-6 h-6 rounded-full border-2 border-primary bg-background" />
        ) : (
          <div className="w-6 h-6 rounded-full border-2 border-border/60 bg-background flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 pt-0.5", isLocked && "opacity-40")}>
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            "text-sm leading-snug truncate",
            isCompleted       ? "font-normal text-muted-foreground" :
            isLocked          ? "font-normal text-foreground"       :
                                "font-medium text-foreground"
          )}>
            {phase.name}
          </p>

          {isCompleted && (
            <span className="text-[10px] font-semibold text-emerald-600 shrink-0">Done</span>
          )}
          {isActive && (
            <span className="text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-md shrink-0">
              Active
            </span>
          )}
          {isUnlockedNotStart && (
            <span className="text-[10px] font-medium text-muted-foreground shrink-0">Not started</span>
          )}
        </div>

        {/* Deliverable dots + meta — only for unlocked phases */}
        {!isLocked && (
          <>
            <DeliverableDots deliverables={phase.deliverables} />

            {(total > 0 || phase.dueDate) && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                {total > 0 && (
                  <span>{approved}/{total} deliverable{total !== 1 ? "s" : ""}</span>
                )}
                {total > 0 && phase.dueDate && (
                  <span className="text-border">·</span>
                )}
                {phase.dueDate && (
                  <span>
                    Due{" "}
                    {new Date(phase.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export async function ProjectPhases({ projectId }: { projectId: string }) {
  const phases = await getProjectPhases(projectId);
  if (phases.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Phases
        </p>
        <Link
          href={`/projects/${projectId}/phases`}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="relative">
        {phases.map((phase, i) => (
          <PhaseRow key={phase.id} phase={phase} isLast={i === phases.length - 1} />
        ))}
      </div>
    </div>
  );
}

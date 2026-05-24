import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Check, Minus, Users } from "lucide-react";
import { getCohortData } from "@/actions/cohort";
import type { CohortPhase } from "@/actions/cohort";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cohort" };

// ─── Deliverable dot colours ─────────────────────────────────────────────────

const DOT: Record<string, string> = {
  NOT_SUBMITTED:   "bg-muted-foreground/25",
  SUBMITTED:       "bg-amber-400",
  UNDER_REVIEW:    "bg-blue-400",
  APPROVED:        "bg-emerald-500",
  REVISION_NEEDED: "bg-red-400",
};

// ─── Phase cell ───────────────────────────────────────────────────────────────

function PhaseCell({ phase, projectId }: { phase: CohortPhase | undefined; projectId: string }) {
  if (!phase) {
    return (
      <td className="px-3 py-3.5 text-center">
        <span className="text-muted-foreground/30 text-xs">—</span>
      </td>
    );
  }

  const href = `/projects/${projectId}/phases`;
  const approved = phase.deliverables.filter((d) => d.status === "APPROVED").length;
  const total    = phase.deliverables.length;

  if (phase.isLocked) {
    return (
      <td className="px-3 py-3.5">
        <div className="flex items-center justify-center">
          <Lock className="w-3.5 h-3.5 text-muted-foreground/25" />
        </div>
      </td>
    );
  }

  if (phase.status === "COMPLETED") {
    return (
      <td className="px-3 py-3.5">
        <Link href={href} className="flex flex-col items-center gap-1 group">
          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-3 h-3 text-emerald-600" strokeWidth={2.5} />
          </div>
          {total > 0 && (
            <span className="text-[10px] text-emerald-600 font-medium tabular-nums">
              {approved}/{total}
            </span>
          )}
        </Link>
      </td>
    );
  }

  // IN_PROGRESS or NOT_STARTED (unlocked)
  const hasDeliverables = total > 0;
  const needsAttention = phase.deliverables.some((d) => d.status === "REVISION_NEEDED");
  const hasPending = phase.deliverables.some((d) => d.status === "SUBMITTED" || d.status === "UNDER_REVIEW");

  return (
    <td className="px-3 py-3.5">
      <Link href={href} className="flex flex-col items-center gap-1.5 group">
        {hasDeliverables ? (
          <>
            {/* Deliverable dots */}
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {phase.deliverables.map((d) => (
                <div
                  key={d.id}
                  title={`${d.title}: ${d.status.replace("_", " ").toLowerCase()}`}
                  className={cn("w-2 h-2 rounded-full shrink-0", DOT[d.status] ?? DOT.NOT_SUBMITTED)}
                />
              ))}
            </div>
            {/* Summary fraction */}
            <span className={cn(
              "text-[10px] font-medium tabular-nums",
              needsAttention ? "text-red-500" :
              hasPending     ? "text-amber-500" :
              approved === total && total > 0 ? "text-emerald-600" :
                               "text-muted-foreground/60"
            )}>
              {approved}/{total}
            </span>
          </>
        ) : (
          <Minus className="w-3 h-3 text-muted-foreground/30" />
        )}
      </Link>
    </td>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { dot: "bg-emerald-500",       label: "Approved" },
    { dot: "bg-amber-400",         label: "Submitted" },
    { dot: "bg-blue-400",          label: "Under review" },
    { dot: "bg-red-400",           label: "Revision needed" },
    { dot: "bg-muted-foreground/25", label: "Not submitted" },
  ];
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {items.map(({ dot, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CohortPage() {
  const data = await getCohortData();

  if (!data || !data.isInstructor) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">Cohort view</h3>
        <p className="text-sm text-muted-foreground">
          This view is for instructors tracking student progress across all projects.
        </p>
      </div>
    );
  }

  const { projects, maxPhaseOrder } = data;
  const phaseOrders = Array.from({ length: maxPhaseOrder }, (_, i) => i + 1);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Cohort</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} active project{projects.length !== 1 ? "s" : ""}
            {maxPhaseOrder > 0 && ` · ${maxPhaseOrder} phase${maxPhaseOrder !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/reviews"
          className="text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          Review queue →
        </Link>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-14 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No active projects</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create projects to see cohort progress here.
            </p>
          </div>
          <Link
            href="/projects"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to projects →
          </Link>
        </div>
      )}

      {projects.length > 0 && (
        <>
          {/* Legend */}
          <Legend />

          {/* Matrix table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {/* Project column header */}
                  <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 min-w-[200px]">
                    Project
                  </th>
                  {phaseOrders.map((order) => (
                    <th
                      key={order}
                      className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 min-w-[100px]"
                    >
                      Phase {order}
                    </th>
                  ))}
                  {/* Actions */}
                  <th className="px-4 py-3 min-w-[80px]" />
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {projects.map((project) => {
                  const phaseByOrder = Object.fromEntries(
                    project.phases.map((ph) => [ph.order, ph])
                  );
                  const color = project.color ?? "#1E3A8A";

                  // Overall stats for the project row
                  const allDeliverables = project.phases.flatMap((ph) => ph.deliverables);
                  const approvedCount = allDeliverables.filter((d) => d.status === "APPROVED").length;
                  const totalRequired = allDeliverables.length;
                  const pendingCount  = allDeliverables.filter((d) =>
                    d.status === "SUBMITTED" || d.status === "UNDER_REVIEW"
                  ).length;

                  return (
                    <tr key={project.id} className="group hover:bg-muted/20 transition-colors">
                      {/* Sticky project name column */}
                      <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/20 transition-colors px-4 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0"
                            style={{ backgroundColor: `${color}18` }}
                          >
                            {project.iconEmoji ?? (
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[140px]">
                              {project.name}
                            </p>
                            {pendingCount > 0 && (
                              <p className="text-[10px] text-amber-600 font-medium">
                                {pendingCount} pending review
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phase cells */}
                      {phaseOrders.map((order) => (
                        <PhaseCell
                          key={order}
                          phase={phaseByOrder[order] as CohortPhase | undefined}
                          projectId={project.id}
                        />
                      ))}

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/projects/${project.id}/phases`}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-project summary cards below the table */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Submission breakdown
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => {
                const all = project.phases.flatMap((ph) => ph.deliverables);
                const color = project.color ?? "#1E3A8A";
                const counts = {
                  approved:        all.filter((d) => d.status === "APPROVED").length,
                  revision:        all.filter((d) => d.status === "REVISION_NEEDED").length,
                  pending:         all.filter((d) => d.status === "SUBMITTED" || d.status === "UNDER_REVIEW").length,
                  not_submitted:   all.filter((d) => d.status === "NOT_SUBMITTED").length,
                  total:           all.length,
                };
                const completedPhases = project.phases.filter((ph) => ph.status === "COMPLETED").length;
                const currentPhase = project.phases.find(
                  (ph) => ph.status === "IN_PROGRESS" && !ph.isLocked
                );

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}/phases`}
                    className="rounded-xl border border-border bg-card px-4 py-3.5 hover:bg-muted/30 transition-colors block"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        {project.iconEmoji ?? (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                    </div>

                    {currentPhase && (
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        <span className="font-medium text-foreground">Phase {currentPhase.order}:</span>{" "}
                        {currentPhase.name}
                      </p>
                    )}

                    {/* Status bar */}
                    {counts.total > 0 && (
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted gap-px mb-2">
                        {counts.approved > 0 && (
                          <div className="bg-emerald-500" style={{ width: `${(counts.approved / counts.total) * 100}%` }} />
                        )}
                        {counts.pending > 0 && (
                          <div className="bg-amber-400" style={{ width: `${(counts.pending / counts.total) * 100}%` }} />
                        )}
                        {counts.revision > 0 && (
                          <div className="bg-red-400" style={{ width: `${(counts.revision / counts.total) * 100}%` }} />
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {counts.approved}/{counts.total} approved
                      </span>
                      {counts.revision > 0 && (
                        <span className="text-red-500 font-medium">
                          {counts.revision} need revision
                        </span>
                      )}
                      {counts.pending > 0 && counts.revision === 0 && (
                        <span className="text-amber-600 font-medium">
                          {counts.pending} to review
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

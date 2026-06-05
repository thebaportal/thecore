import { notFound } from "next/navigation";
import { Layers, Lock } from "lucide-react";
import { getProjectPhasesWithDeliverables } from "@/actions/deliverables";
import { LockedPhaseRow, AddPhaseButton, SortableLockedPhaseList } from "@/components/phases/phase-controls";
import { PhaseList } from "@/components/phases/phase-list";
import { cn } from "@/lib/utils";

export default async function ProjectPhasesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const result = await getProjectPhasesWithDeliverables(projectId);
  if (!result) notFound();

  const { phases, currentUserRole, currentUserId, projectMembers, orgAdmins } = result;
  const isInstructor = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  if (phases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="max-w-sm w-full">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 mx-auto">
            <Layers className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No phases yet</h3>
          <p className="text-sm text-muted-foreground">
            {isInstructor
              ? "Add phases to structure this project's workflow."
              : "Phases will appear here once your instructor sets them up."}
          </p>
          {isInstructor && <div className="mt-6"><AddPhaseButton projectId={projectId} /></div>}
        </div>
      </div>
    );
  }

  const unlockedPhases = phases.filter((p) => !p.isLocked);
  const lockedPhases   = phases.filter((p) => p.isLocked);

  return (
    <div className="max-w-2xl pb-16 space-y-10">

      {/* Active / completed phases */}
      <PhaseList
        phases={unlockedPhases.map((p) => ({
          id: p.id,
          order: p.order,
          name: p.name,
          status: p.status,
          startedAt: p.startedAt,
          dueDate: p.dueDate,
          guidance: p.guidance,
          deliverables: p.deliverables,
        }))}
        projectId={projectId}
        isInstructor={isInstructor}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        projectMembers={projectMembers}
        orgAdmins={orgAdmins}
      />

      {/* Locked phases */}
      {lockedPhases.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
            Upcoming · {lockedPhases.length} phase{lockedPhases.length !== 1 ? "s" : ""}
          </p>

          {isInstructor ? (
            <SortableLockedPhaseList
              projectId={projectId}
              phases={lockedPhases.map((phase) => ({
                id: phase.id,
                order: phase.order,
                name: phase.name,
                deliverables: phase.deliverables.map((d) => ({
                  id: d.id,
                  title: d.title,
                  submissionKind: d.submissionKind,
                  requiresFileUpload: d.requiresFileUpload,
                  dueDate: d.dueDate,
                })),
              }))}
            />
          ) : (
            /* Students: placeholder rows — title + locked status only */
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
              {lockedPhases.map((phase, i) => (
                <div
                  key={phase.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm",
                    i < lockedPhases.length - 1 && "border-b border-border/40"
                  )}
                >
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                  <span className="text-[10px] font-medium text-muted-foreground/40 shrink-0">Phase {phase.order}</span>
                  <span className="text-sm text-muted-foreground/60 truncate">{phase.name}</span>
                  <span className="ml-auto text-[10px] font-medium text-muted-foreground/40 shrink-0">Upcoming</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add phase (instructor only) */}
      {isInstructor && <AddPhaseButton projectId={projectId} />}

    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { getReviewQueue } from "@/actions/deliverables";
import { ReviewCard } from "@/components/reviews/review-card";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  const result = await getReviewQueue();

  if (!result || !result.isInstructor) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">Nothing to review</h3>
        <p className="text-sm text-muted-foreground">
          This area is for instructors reviewing student deliverable submissions.
        </p>
      </div>
    );
  }

  const { deliverables } = result;

  // Group by project
  const byProject = new Map<
    string,
    { project: typeof deliverables[0]["phase"]["project"]; items: typeof deliverables }
  >();
  for (const d of deliverables) {
    const pid = d.phase.project.id;
    if (!byProject.has(pid)) byProject.set(pid, { project: d.phase.project, items: [] });
    byProject.get(pid)!.items.push(d);
  }

  return (
    <div className="max-w-2xl pb-16 space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Reviews</h1>
          {deliverables.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {deliverables.length} submission{deliverables.length !== 1 ? "s" : ""} awaiting review
            </p>
          )}
        </div>
      </div>

      {/* Empty state */}
      {deliverables.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-14 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No pending submissions across any active project.
            </p>
          </div>
        </div>
      )}

      {/* Grouped by project */}
      {[...byProject.values()].map(({ project, items }) => {
        const color = project.color ?? "#1E3A8A";
        return (
          <section key={project.id}>
            {/* Project label */}
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0"
                style={{ backgroundColor: `${color}18` }}
              >
                {project.iconEmoji ?? (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                )}
              </div>
              <h2 className="text-sm font-semibold text-foreground">{project.name}</h2>
              <span className="text-xs text-muted-foreground/60 ml-auto">
                {items.length} pending
              </span>
              <Link
                href={`/projects/${project.id}/phases`}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                View phases →
              </Link>
            </div>

            <div className="space-y-3">
              {items.map((d) => (
                <ReviewCard key={d.id} deliverable={d} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

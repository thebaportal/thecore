"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import {
  FileText, Download, ChevronDown, ChevronUp,
  CheckCircle2, RotateCcw, Loader2, Clock, Eye,
} from "lucide-react";
import { reviewDeliverable } from "@/actions/deliverables";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Deliverable = {
  id: string;
  title: string;
  status: string;
  submittedAt: Date | null;
  reviewNote: string | null;
  submittedBy: { id: string; name: string; avatarUrl: string | null } | null;
  submittedFile: { id: string; name: string; url: string; size: number; mimeType: string } | null;
  reviewedBy: { id: string; name: string } | null;
  versions: {
    versionNumber: number;
    file: { id: string; name: string; url: string; size: number } | null;
    uploadedBy: { id: string; name: string; avatarUrl: string | null };
  }[];
  phase: {
    id: string;
    order: number;
    name: string;
    project: { id: string; name: string; color: string | null; iconEmoji: string | null };
  };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReviewCard({ deliverable }: { deliverable: Deliverable }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "revision" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const color = deliverable.phase.project.color ?? "#1E3A8A";
  const latestVersion = deliverable.versions[0];

  function run(decision: "APPROVE" | "REVISION_NEEDED") {
    setAction(decision === "APPROVE" ? "approve" : "revision");
    startTransition(async () => {
      try {
        await reviewDeliverable(deliverable.id, decision, note.trim() || undefined);
        setDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setAction(null);
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-muted/30 text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="flex-1">{deliverable.title}</span>
        <span className="text-xs">Reviewed</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all",
      deliverable.status === "UNDER_REVIEW" ? "border-blue-200/60" : "border-border"
    )}>
      {/* Header row */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Project color dot */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
            style={{ backgroundColor: `${color}18` }}
          >
            {deliverable.phase.project.iconEmoji ?? (
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {deliverable.phase.project.name} · Phase {deliverable.phase.order}
              </span>
              {deliverable.status === "UNDER_REVIEW" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                  <Eye className="w-2.5 h-2.5" />
                  Under review
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{deliverable.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {deliverable.submittedBy && (
                <span className="text-xs text-muted-foreground">
                  by {deliverable.submittedBy.name}
                </span>
              )}
              {deliverable.submittedAt && (
                <span className="text-xs text-muted-foreground/60">
                  · {formatDistanceToNow(new Date(deliverable.submittedAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Submission preview */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <div className="h-px bg-border/50" />

          {/* Submitted file */}
          {deliverable.submittedFile && (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {deliverable.submittedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(deliverable.submittedFile.size)}
                    {deliverable.versions.length > 1 && (
                      <> · v{latestVersion?.versionNumber} of {deliverable.versions.length}</>
                    )}
                  </p>
                </div>
                <a
                  href={deliverable.submittedFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Open
                </a>
              </div>
            </div>
          )}

          {/* Submission date detail */}
          {deliverable.submittedAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Clock className="w-3 h-3" />
              Submitted {format(new Date(deliverable.submittedAt), "MMM d, yyyy 'at' h:mm a")}
            </div>
          )}

          {/* Review actions */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Feedback{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
                placeholder="Add a note for the team…"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => run("REVISION_NEEDED")}
                disabled={isPending}
                className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
              >
                {isPending && action === "revision"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RotateCcw className="w-3.5 h-3.5" />
                }
                Request Revision
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => run("APPROVE")}
                disabled={isPending}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending && action === "approve"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />
                }
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed quick action strip */}
      {!expanded && (
        <div className="px-4 pb-3 flex items-center justify-end gap-2">
          <button
            onClick={() => { setExpanded(true); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View submission
          </button>
          <span className="text-border">·</span>
          <button
            onClick={() => { run("APPROVE"); }}
            disabled={isPending}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {isPending && action === "approve"
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : null
            }
            Approve
          </button>
        </div>
      )}
    </div>
  );
}

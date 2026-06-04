"use client";

import { useState, useTransition } from "react";
import { BookOpen, LayoutTemplate, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { reclassifyProjectToLibrary, reclassifyProjectToTemplate } from "@/actions/org-settings";
import type { ProjectForReclassification } from "@/actions/org-settings";
import { cn } from "@/lib/utils";

type Result = { docs: number; files: number; folders: number; membersRemoved: number } | null;

function ProjectRow({ project, onConverted }: {
  project: ProjectForReclassification;
  onConverted: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  const [confirming, setConfirming] = useState<"library" | "template" | null>(null);

  function convert(to: "library" | "template") {
    startTransition(async () => {
      const fn = to === "library" ? reclassifyProjectToLibrary : reclassifyProjectToTemplate;
      const res = await fn(project.id);
      setResult({ ...res.moved, membersRemoved: res.membersRemoved });
      setConfirming(null);
      onConverted(project.id);
    });
  }

  if (result) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-800 truncate">{project.name}</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Moved {result.docs} docs, {result.files} files, {result.folders} folders · {result.membersRemoved} members removed · project archived
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card",
      project.suspect ? "border-amber-200" : "border-border"
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {project.suspect && (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {project.taskCount} tasks · {project.docCount} docs · {project.fileCount} files · {project.memberCount} members
          </p>
        </div>

        {confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Move to {confirming}?</span>
            <button
              onClick={() => convert(confirming)}
              disabled={isPending}
              className="px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              {isPending ? "Moving…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={isPending}
              className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setConfirming("library")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <BookOpen className="w-3 h-3" /> Library
            </button>
            <button
              onClick={() => setConfirming("template")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <LayoutTemplate className="w-3 h-3" /> Templates
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectReclassification({ projects: initial }: { projects: ProjectForReclassification[] }) {
  const [projects, setProjects] = useState(initial);
  const [showAll, setShowAll] = useState(false);

  const suspects = projects.filter((p) => p.suspect);
  const clean = projects.filter((p) => !p.suspect);
  const visible = showAll ? projects : suspects;

  function handleConverted(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">All projects are classified correctly.</p>
    );
  }

  return (
    <div className="space-y-3">
      {suspects.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>{suspects.length}</strong> project{suspects.length !== 1 ? "s" : ""} flagged as potential document repositories —
            no task-based work, and names suggest library or learning content.
            Review each and move to Library or Templates if appropriate.
          </span>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((p) => (
          <ProjectRow key={p.id} project={p} onConverted={handleConverted} />
        ))}
      </div>

      {clean.length > 0 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll
            ? <><ChevronUp className="w-3 h-3" /> Hide {clean.length} unflagged projects</>
            : <><ChevronDown className="w-3 h-3" /> Show {clean.length} unflagged project{clean.length !== 1 ? "s" : ""}</>}
        </button>
      )}
    </div>
  );
}

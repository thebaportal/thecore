"use client";

import { useState, useTransition, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2, AlertCircle, Loader2, ExternalLink, Unlink,
  Search, CheckSquare, Square, MinusSquare, ChevronDown, ChevronUp,
  XCircle, SkipForward, RefreshCw, FileX, RotateCcw, Clock,
} from "lucide-react";
import {
  getBasecampProjects,
  importBasecampProject,
  retryFailedFiles,
  disconnectBasecamp,
  backfillProjectMandates,
  backfillMessageBoardPosts,
  backfillTodos,
  unarchiveImportedProjects,
  importBasecampPrivatePings,
  type ImportResult,
  type ImportStatus,
  type PhaseResult,
  type FailedFile,
  type ProjectImportLog,
  type BCProjectWithStatus,
  type MandateBackfillResult,
  type MessageBoardBackfillResult,
  type TodosBackfillResult,
  type UnarchiveResult,
  type ImportPingsResult,
} from "@/actions/basecamp";
import { BasecampPeopleImport } from "@/components/settings/basecamp-people-import";
import { BasecampPeopleMapping } from "@/components/settings/basecamp-people-mapping";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RunStatus =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "running" }
  | { state: "done"; result: ImportResult }
  | { state: "error"; message: string };

// ── Plain-English error translator ───────────────────────────────────────────

function humanizePhaseError(raw: string): string {
  if (raw.includes("429")) return "Basecamp rate limit reached. Re-import in a few minutes.";
  if (raw.includes("401") || raw.includes("403")) return "Basecamp authorization error. Reconnect and try again.";
  if (raw.includes("404")) return "Content not found — may have been deleted in Basecamp.";
  if (/50[0-9]/.test(raw)) return "Basecamp server error. Try again later.";
  // Strip URLs and boilerplate prefix for anything else
  return raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^Error:\s*/i, "")
    .replace(/Basecamp API error:\s*\d+\s*/g, "")
    .trim() || "Unexpected error — try re-importing.";
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<ImportStatus, { label: string; cls: string; dot: string }> = {
  NOT_IMPORTED:            { label: "Not Imported",               cls: "bg-muted text-muted-foreground",         dot: "bg-muted-foreground" },
  IMPORTED:                { label: "Imported",                   cls: "bg-emerald-100 text-emerald-700",         dot: "bg-emerald-500"      },
  IMPORTED_WITH_WARNINGS:  { label: "Imported with Warnings",     cls: "bg-amber-100 text-amber-700",             dot: "bg-amber-500"        },
  PARTIALLY_IMPORTED:      { label: "Partially Imported",         cls: "bg-orange-100 text-orange-700",           dot: "bg-orange-500"       },
  IMPORT_FAILED:           { label: "Import Failed",              cls: "bg-red-100 text-red-700",                 dot: "bg-red-500"          },
  LEGACY_IMPORT:           { label: "Legacy Import",              cls: "bg-slate-100 text-slate-600",             dot: "bg-slate-400"        },
};

function StatusBadge({ status, failedFilesCount }: { status: ImportStatus; failedFilesCount?: number }) {
  if (status === "NOT_IMPORTED") return null;
  const m = STATUS_META[status];
  // When every file imported fine, "warnings" were just minor vault notes — use softer language.
  const label =
    status === "IMPORTED_WITH_WARNINGS" && failedFilesCount === 0
      ? "Imported, minor notes"
      : m.label;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", m.cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", m.dot)} />
      {label}
    </span>
  );
}

// ── Counts badge ──────────────────────────────────────────────────────────────

function CountsBadge({ counts }: { counts: { tasks: number; discussions: number; files: number; folders: number } }) {
  const parts = [
    counts.tasks > 0       && `${counts.tasks}t`,
    counts.discussions > 0 && `${counts.discussions}d`,
    counts.files > 0       && `${counts.files}f`,
    counts.folders > 0     && `${counts.folders} folders`,
  ].filter(Boolean);
  if (parts.length === 0) return <span className="text-xs text-muted-foreground/50">empty</span>;
  return <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>;
}

// ── Run-status icon (live import progress) ────────────────────────────────────

function runStatusIcon(s: RunStatus) {
  if (s.state === "running") return <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />;
  if (s.state === "error")   return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (s.state === "pending") return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
  if (s.state === "done") {
    const st  = s.result.importStatus;
    const ffc = s.result.importLog.failedFilesCount;
    if (st === "IMPORT_FAILED" || st === "PARTIALLY_IMPORTED") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    if (st === "IMPORTED_WITH_WARNINGS" && ffc > 0) return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  }
  return null;
}

// ── Per-project inline detail panel ──────────────────────────────────────────

function ProjectDetail({
  project,
  onRetry,
  retrying,
}: {
  project: BCProjectWithStatus;
  onRetry: () => void;
  retrying: boolean;
}) {
  const log = project.importLog;

  if (project.importStatus === "LEGACY_IMPORT") {
    return (
      <div className="px-4 pb-3 pt-1 pl-11 space-y-1.5">
        <p className="text-xs text-muted-foreground">
          This project was imported before detailed logging was introduced. No breakdown is available.
        </p>
        <p className="text-xs text-muted-foreground">
          Re-run the import to get a verified status and per-file report.
        </p>
      </div>
    );
  }

  if (!log) return null;

  const oversizedFiles  = log.failedFiles.filter((f) => f.isOversized);
  const notFoundFiles   = log.failedFiles.filter((f) => f.is404);
  const retryableFiles  = log.failedFiles.filter((f) => !f.is404 && !f.isOversized);

  return (
    <div className="px-4 pb-3 pt-0 pl-11 space-y-3">
      {/* Summary counts */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{log.tasksCount} tasks</span>
        <span>·</span>
        <span>{log.messagesCount} discussions</span>
        <span>·</span>
        <span>{log.filesCount} files stored</span>
        <span>·</span>
        <span>{log.foldersCount} folders</span>
        {oversizedFiles.length > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600 font-medium">{oversizedFiles.length} large file{oversizedFiles.length > 1 ? "s" : ""} skipped</span>
          </>
        )}
        {retryableFiles.length > 0 && (
          <>
            <span>·</span>
            <span className="text-red-600 font-medium">{retryableFiles.length} file{retryableFiles.length > 1 ? "s" : ""} failed</span>
          </>
        )}
      </div>

      {/* Phase errors — translated to plain language */}
      {log.phaseErrors.length > 0 && (
        <div className="space-y-1.5">
          {log.phaseErrors.map((pe) => (
            <div key={pe.phase} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-900">{pe.phase} did not complete</p>
                <p className="text-xs text-amber-800">{humanizePhaseError(pe.error)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Oversized files — friendly, not alarming */}
      {oversizedFiles.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 overflow-hidden">
          <div className="px-3 py-1.5 bg-amber-100/60 flex items-center gap-1.5">
            <SkipForward className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
              Large files skipped ({oversizedFiles.length})
            </span>
          </div>
          <div className="divide-y divide-amber-100 max-h-32 overflow-y-auto">
            {oversizedFiles.map((f: FailedFile, i: number) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2">
                <SkipForward className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{f.filename}</p>
                  <p className="text-xs text-amber-700">{Math.round(f.byteSize / 1024 / 1024)} MB — download manually from Basecamp</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed files (actual errors, retryable) */}
      {(retryableFiles.length > 0 || notFoundFiles.length > 0) && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-1.5 bg-muted/30 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Failed Files ({retryableFiles.length + notFoundFiles.length})
            </span>
            {retryableFiles.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                disabled={retrying}
                className="h-6 px-2 text-[10px] gap-1"
              >
                {retrying
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Retrying…</>
                  : <><RotateCcw className="w-3 h-3" /> Retry {retryableFiles.length} file{retryableFiles.length > 1 ? "s" : ""}</>}
              </Button>
            )}
          </div>
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {[...retryableFiles, ...notFoundFiles].map((f: FailedFile, i: number) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2">
                {f.is404
                  ? <FileX className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{f.filename}</p>
                  <p className="text-xs text-muted-foreground">{f.reason}</p>
                </div>
              </div>
            ))}
          </div>
          {notFoundFiles.length > 0 && retryableFiles.length === 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground">
                All failed files returned 404 — they no longer exist in Basecamp and cannot be recovered.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
        <Clock className="w-3 h-3" />
        Last imported {new Date(log.lastImportedAt).toLocaleString()}
      </div>
    </div>
  );
}

// ── Project row ───────────────────────────────────────────────────────────────

const ATTENTION_STATUSES_SET = new Set<ImportStatus>(["LEGACY_IMPORT", "PARTIALLY_IMPORTED", "IMPORT_FAILED"]);

function ProjectRow({
  project,
  runStatus,
  isSelected,
  isExpanded,
  importing,
  retrying,
  onToggle,
  onExpandToggle,
  onRetry,
  onReimport,
}: {
  project: BCProjectWithStatus;
  runStatus: RunStatus | undefined;
  isSelected: boolean;
  isExpanded: boolean;
  importing: boolean;
  retrying: boolean;
  onToggle: () => void;
  onExpandToggle: () => void;
  onRetry: () => void;
  onReimport: () => void;
}) {
  const isImported = project.importStatus !== "NOT_IMPORTED";
  const hasDetail  = isImported && !runStatus;

  return (
    <div>
      {/* Main row */}
      <div
        onClick={() => !importing && onToggle()}
        className={cn(
          "flex items-start gap-3 px-4 py-3 transition-colors",
          importing ? "cursor-default" : "cursor-pointer hover:bg-muted/40",
          isSelected && "bg-primary/5",
        )}
      >
        {/* Checkbox */}
        <div className="shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
          <div onClick={() => !importing && onToggle()} className="cursor-pointer">
            {isSelected
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
            {!runStatus && <StatusBadge status={project.importStatus} failedFilesCount={project.importLog?.failedFilesCount} />}
          </div>
          {/* DB-current counts + timestamp */}
          {isImported && project.counts && !runStatus && (
            <div className="flex items-center gap-2 mt-0.5">
              <CountsBadge counts={project.counts} />
              {project.importedAt && (
                <span className="text-[10px] text-muted-foreground/50">
                  · {new Date(project.importedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          {project.description && !isImported && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
          )}
        </div>

        {/* Inline Re-import button for attention projects */}
        {!runStatus && ATTENTION_STATUSES_SET.has(project.importStatus) && !importing && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onReimport(); }}
            className="h-6 px-2 text-[10px] gap-1 shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Re-import
          </Button>
        )}

        {/* Live run status */}
        {runStatus && (
          <div className="shrink-0 flex items-center gap-1.5">
            {runStatusIcon(runStatus)}
            <span className="text-xs text-muted-foreground">
              {runStatus.state === "running" && "Importing…"}
              {runStatus.state === "pending"  && "Queued"}
              {runStatus.state === "error"    && "Failed"}
              {runStatus.state === "done"     && (() => {
                const r = runStatus.result;
                return `${r.tasksImported}t · ${r.messagesImported}d · ${r.filesStored}f`;
              })()}
            </span>
          </div>
        )}

        {/* Detail toggle */}
        {hasDetail && (
          <button
            onClick={(e) => { e.stopPropagation(); onExpandToggle(); }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            {isExpanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Inline detail */}
      {isExpanded && hasDetail && (
        <ProjectDetail project={project} onRetry={onRetry} retrying={retrying} />
      )}
    </div>
  );
}

// ── Result card (live import run) ─────────────────────────────────────────────

function ResultCard({ id, status, name }: { id: number; status: RunStatus; name: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      status.state === "error"   && "border-red-200 bg-red-50",
      status.state === "done"    && status.result.importStatus === "IMPORT_FAILED"           && "border-red-200 bg-red-50",
      status.state === "done"    && status.result.importStatus === "PARTIALLY_IMPORTED"      && "border-orange-200 bg-orange-50",
      status.state === "done"    && status.result.importStatus === "IMPORTED_WITH_WARNINGS"  && "border-amber-200 bg-amber-50",
      status.state === "done"    && status.result.importStatus === "IMPORTED"                && "border-emerald-200 bg-emerald-50",
      (status.state === "pending" || status.state === "running") && "border-border bg-card",
    )}>
      <div className="flex items-center gap-2">
        {runStatusIcon(status)}
        <p className="text-sm font-medium text-foreground truncate flex-1">{name}</p>
        {status.state === "done" && (
          <StatusBadge
            status={status.result.importStatus}
            failedFilesCount={status.result.importLog.failedFilesCount}
          />
        )}
      </div>

      {status.state === "done" && (
        <div className="mt-2 pl-6 space-y-2">
          {/* Phase checklist */}
          {status.result.phases?.length > 0 && (
            <div className="space-y-1">
              {status.result.phases.map((p: PhaseResult) => (
                <div key={p.phase} className="flex items-start gap-2">
                  {p.status === "ok"      && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                  {p.status === "error"   && <XCircle      className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                  {p.status === "skipped" && <SkipForward  className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground">{p.phase}</span>
                    {p.count != null && p.status === "ok" && (
                      <span className="text-xs text-muted-foreground ml-1">({p.count})</span>
                    )}
                    {p.error && <p className="text-xs text-red-600 mt-0.5 break-words">{p.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Counts summary */}
          <p className="text-xs text-muted-foreground">
            {status.result.tasksImported} tasks · {status.result.messagesImported} discussions ·{" "}
            {status.result.commentsImported} replies · {status.result.docsImported} docs ·{" "}
            {status.result.foldersCreated} folders
          </p>
          {(status.result.filesStored + (status.result.filesMetadataOnly ?? 0)) > 0 && (
            <p className={cn("text-xs font-medium",
              (status.result.filesMetadataOnly ?? 0) > 0 ? "text-amber-700" : "text-emerald-700"
            )}>
              {status.result.filesStored > 0 && `${status.result.filesStored} files stored`}
              {status.result.filesStored > 0 && (status.result.filesMetadataOnly ?? 0) > 0 && " · "}
              {(status.result.filesMetadataOnly ?? 0) > 0 && `${status.result.filesMetadataOnly} metadata-only`}
            </p>
          )}

          {/* Skipped/failed files from this run */}
          {status.result.importLog.failedFiles.length > 0 && (() => {
            const ff           = status.result.importLog.failedFiles as FailedFile[];
            const oversized    = ff.filter((f) => f.isOversized);
            const notFound     = ff.filter((f) => f.is404);
            const errored      = ff.filter((f) => !f.is404 && !f.isOversized);
            return (
              <>
                {oversized.length > 0 && (
                  <p className="text-xs text-amber-700 font-medium">
                    {oversized.length} large file{oversized.length > 1 ? "s" : ""} skipped (too large to import via server — download manually from Basecamp)
                  </p>
                )}
                {(errored.length > 0 || notFound.length > 0) && (
                  <details>
                    <summary className={cn("text-xs cursor-pointer select-none font-medium",
                      errored.length > 0 ? "text-red-600" : "text-amber-600"
                    )}>
                      {errored.length + notFound.length} file{errored.length + notFound.length > 1 ? "s" : ""} failed — expand
                    </summary>
                    <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                      {[...errored, ...notFound].map((f: FailedFile, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs">
                          {f.is404
                            ? <FileX className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                            : <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                          <span className="text-muted-foreground"><span className="font-medium text-foreground">{f.filename}</span> — {f.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}
        </div>
      )}

      {status.state === "error" && (
        <p className="mt-1 pl-6 text-xs text-red-600 break-words">{status.message}</p>
      )}
      {status.state === "pending" && (
        <p className="mt-1 pl-6 text-xs text-muted-foreground">Waiting in queue…</p>
      )}
    </div>
  );
}

// ── Unarchive fix card ────────────────────────────────────────────────────────

function UnarchiveFix() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<UnarchiveResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try { setResult(await unarchiveImportedProjects()); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-amber-900">Fix: Projects hidden in Active view</h2>
          <p className="text-xs text-amber-800 mt-0.5">
            Projects imported from archived Basecamp projects were marked ARCHIVED in The Core and are invisible in the default Projects view. This resets them all to Active so they're visible.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={isPending || result?.fixed === 0} className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0">
          {isPending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fixing…</>
            : result
            ? result.fixed === 0 ? "Nothing to fix" : <><RefreshCw className="w-3.5 h-3.5" /> Run again</>
            : "Fix now"}
        </Button>
      </div>
      {error && <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {result && !error && (
        <div className="px-5 py-4 text-sm">
          {result.fixed > 0
            ? <p className="text-emerald-700 font-medium">✓ {result.fixed} project{result.fixed > 1 ? "s" : ""} made active — check your Projects page.</p>
            : <p className="text-muted-foreground">No archived imported projects found — nothing to fix.</p>}
        </div>
      )}
    </div>
  );
}

// ── Mandate backfill card ─────────────────────────────────────────────────────

function MandateBackfill() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MandateBackfillResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await backfillProjectMandates();
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Populate Project Mandates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fills the Project Mandate tab for all already-imported projects — no re-import needed.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={isPending} className="gap-1.5 shrink-0">
          {isPending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
            : result
            ? <><RefreshCw className="w-3.5 h-3.5" /> Run again</>
            : "Run backfill"}
        </Button>
      </div>

      {error && (
        <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {result && !error && (
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-5 py-3 text-center">
            <p className="text-xl font-semibold text-emerald-600">{result.filled}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Filled</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xl font-semibold text-foreground">{result.skipped}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Already had mandate</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xl font-semibold text-foreground">{result.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total projects</p>
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          Uses the project description and any vault doc named &quot;Project Mandate&quot; already in the database.
        </div>
      )}
    </div>
  );
}

// ── Message board backfill card ───────────────────────────────────────────────

function MessageBoardBackfill() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MessageBoardBackfillResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try { setResult(await backfillMessageBoardPosts()); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import Message Board Posts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pulls Basecamp message board posts into the Posts section for all already-imported projects.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={isPending} className="gap-1.5 shrink-0">
          {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</> : result ? <><RefreshCw className="w-3.5 h-3.5" /> Run again</> : "Run"}
        </Button>
      </div>
      {error && <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {result && !error && (
        <div className="grid grid-cols-4 divide-x divide-border">
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-emerald-600">{result.postsCreated}</p><p className="text-xs text-muted-foreground mt-0.5">Created</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-foreground">{result.postsUpdated}</p><p className="text-xs text-muted-foreground mt-0.5">Updated</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-foreground">{result.projectsProcessed}</p><p className="text-xs text-muted-foreground mt-0.5">Projects</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-muted-foreground">{result.projectsSkipped}</p><p className="text-xs text-muted-foreground mt-0.5">No board</p></div>
        </div>
      )}
      {result && result.errors.length > 0 && (
        <div className="px-5 py-3 border-t border-border text-xs text-amber-700">{result.errors.length} error{result.errors.length > 1 ? "s" : ""} — check server logs</div>
      )}
      {!result && !error && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">Runs against already-imported projects — no full re-import needed.</div>
      )}
    </div>
  );
}

// ── Private pings importer card ───────────────────────────────────────────────

function ClearImportedPings({ onClear }: { onClear: () => Promise<{ deleted: number }> }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try { setResult(await onClear()); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-card overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Clear Imported Messages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Removes all Basecamp-imported conversations from Messages. Use this to clean up failed or unwanted imports. Cannot be undone.
          </p>
        </div>
        <Button size="sm" variant="destructive" onClick={run} disabled={isPending} className="shrink-0">
          {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Clearing…</> : "Clear"}
        </Button>
      </div>
      {error && <div className="px-5 py-3 border-t border-border flex items-center gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {result && !error && (
        <div className="px-5 py-3 border-t border-border">
          <p className="text-sm text-emerald-600 font-medium">{result.deleted} conversation{result.deleted !== 1 ? "s" : ""} removed.</p>
        </div>
      )}
    </div>
  );
}

function PrivatePingsImport() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportPingsResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try { setResult(await importBasecampPrivatePings()); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import Private Messages (Pings)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Imports your Basecamp private 1-on-1 and group DMs into the Messages section. Only chats the connected account participated in are accessible.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={isPending} className="gap-1.5 shrink-0">
          {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</> : result ? <><RefreshCw className="w-3.5 h-3.5" /> Run again</> : "Run"}
        </Button>
      </div>
      {error && <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {result && !error && (
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-emerald-600">{result.chatsImported}</p><p className="text-xs text-muted-foreground mt-0.5">Conversations</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-foreground">{result.messagesImported}</p><p className="text-xs text-muted-foreground mt-0.5">Messages</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-muted-foreground">{result.skipped}</p><p className="text-xs text-muted-foreground mt-0.5">Already done</p></div>
        </div>
      )}
      {result && result.errors.length > 0 && (
        <div className="px-5 py-3 border-t border-border space-y-1">
          <p className="text-xs font-medium text-amber-700">{result.errors.length} error{result.errors.length > 1 ? "s" : ""}:</p>
          {result.errors.slice(0, 10).map((e, i) => (
            <p key={i} className="text-xs text-amber-700 font-mono break-all">{e}</p>
          ))}
          {result.errors.length > 10 && (
            <p className="text-xs text-muted-foreground">…and {result.errors.length - 10} more</p>
          )}
        </div>
      )}
      {!result && !error && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          Safe to run multiple times — existing conversations are skipped, but any missing messages will be backfilled.
        </div>
      )}
    </div>
  );
}

// ── To-dos backfill card ──────────────────────────────────────────────────────

function TodosBackfill() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TodosBackfillResult | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try { setResult(await backfillTodos()); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import To-dos as Tasks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pulls Basecamp to-do lists into Tasks for all already-imported projects. Adds list name as prefix and resolves assignees.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={isPending} className="gap-1.5 shrink-0">
          {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</> : result ? <><RefreshCw className="w-3.5 h-3.5" /> Run again</> : "Run"}
        </Button>
      </div>
      {error && <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {result && !error && (
        <div className="grid grid-cols-4 divide-x divide-border">
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-emerald-600">{result.tasksCreated}</p><p className="text-xs text-muted-foreground mt-0.5">Created</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-foreground">{result.tasksUpdated}</p><p className="text-xs text-muted-foreground mt-0.5">Updated</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-foreground">{result.projectsProcessed}</p><p className="text-xs text-muted-foreground mt-0.5">Projects</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-muted-foreground">{result.projectsSkipped}</p><p className="text-xs text-muted-foreground mt-0.5">No to-dos</p></div>
        </div>
      )}
      {result && result.errors.length > 0 && (
        <div className="px-5 py-3 border-t border-border text-xs text-amber-700">{result.errors.length} error{result.errors.length > 1 ? "s" : ""} — check server logs</div>
      )}
      {!result && !error && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">Runs against already-imported projects — no full re-import needed.</div>
      )}
    </div>
  );
}

// ── Project members backfill card ─────────────────────────────────────────────

function ProjectMembersBackfill() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ membershipsCreated: number; projectsProcessed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const { backfillProjectMembers } = await import("@/actions/basecamp");
        setResult(await backfillProjectMembers());
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Add Members to Projects</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assigns people to projects based on who created tasks, wrote messages, authored docs, or uploaded files. Populates the Team page grouped by project.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={isPending} className="gap-1.5 shrink-0">
          {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</> : result ? <><RefreshCw className="w-3.5 h-3.5" /> Run again</> : "Run"}
        </Button>
      </div>
      {error && <div className="px-5 py-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {result && !error && (
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-emerald-600">{result.membershipsCreated}</p><p className="text-xs text-muted-foreground mt-0.5">Memberships added</p></div>
          <div className="px-4 py-3 text-center"><p className="text-xl font-semibold text-foreground">{result.projectsProcessed}</p><p className="text-xs text-muted-foreground mt-0.5">Projects scanned</p></div>
        </div>
      )}
      {result && result.errors.length > 0 && (
        <div className="px-5 py-3 border-t border-border text-xs text-amber-700">{result.errors.length} error{result.errors.length > 1 ? "s" : ""} — check server logs</div>
      )}
      {!result && !error && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">Safe to run multiple times — existing memberships are skipped.</div>
      )}
    </div>
  );
}

// ── Setup instructions (shown when no credentials configured) ─────────────────

function SetupInstructions() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Setup required</h2>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>To connect Basecamp, register an OAuth application:</p>
        <ol className="list-decimal list-inside space-y-2 pl-1">
          <li>
            Go to{" "}
            <a href="https://launchpad.37signals.com/integrations" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1">
              37signals integrations <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            Create a new application with redirect URI:{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
              {"{YOUR_APP_URL}"}/api/basecamp/callback
            </code>
          </li>
          <li>
            Add to your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>:
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono mt-1.5 overflow-x-auto">
{`BASECAMP_CLIENT_ID=your_client_id
BASECAMP_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=https://your-domain.com`}
            </pre>
          </li>
        </ol>
      </div>
    </div>
  );
}

// ── Main importer component ───────────────────────────────────────────────────

export function BasecampImporter({
  connected,
  token,
  accountId,
  accountName,
  connectHref,
  storageConfigured,
  onClearPings,
}: {
  connected: boolean;
  token: string | null;
  accountId: string | null;
  accountName: string | null;
  connectHref: string | null;
  storageConfigured: boolean;
  onClearPings: () => Promise<{ deleted: number }>;
}) {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<BCProjectWithStatus[] | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [showAttention, setShowAttention] = useState(true);
  const [showWarnings,  setShowWarnings]  = useState(true);
  const [showClean,     setShowClean]     = useState(false);
  const [showArchived,  setShowArchived]  = useState(false);
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [retryingProject, setRetryingProject] = useState<number | null>(null);

  const [statuses, setStatuses] = useState<Map<number, RunStatus>>(new Map());
  const [importing, setImporting] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(true);

  const { newProjects, attentionProjects, warningProjects, importedProjects, archivedBcProjects } = useMemo(() => {
    if (!projects) return { newProjects: [], attentionProjects: [], warningProjects: [], importedProjects: [], archivedBcProjects: [] };
    const q = search.trim().toLowerCase();
    const all = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    const active   = all.filter((p) => p.bcStatus !== "archived");
    const archived = all.filter((p) => p.bcStatus === "archived");

    // A project with IMPORTED_WITH_WARNINGS is "actually imported" if it has no retryable failures
    // (only oversized/404 files or soft vault notes). Show it with the clean imports, not warnings.
    const hasRetryableFailures = (p: BCProjectWithStatus) =>
      (p.importLog?.failedFiles ?? []).some((f: FailedFile) => !f.is404 && !f.isOversized);

    return {
      newProjects:       active.filter((p) => p.importStatus === "NOT_IMPORTED"),
      attentionProjects: active.filter((p) => ATTENTION_STATUSES_SET.has(p.importStatus)),
      warningProjects:   active.filter((p) => p.importStatus === "IMPORTED_WITH_WARNINGS" && hasRetryableFailures(p)),
      importedProjects:  active.filter((p) =>
        p.importStatus === "IMPORTED" ||
        (p.importStatus === "IMPORTED_WITH_WARNINGS" && !hasRetryableFailures(p))
      ),
      archivedBcProjects: archived,
    };
  }, [projects, search]);

  function handleLoadProjects() {
    setLoadingProjects(true);
    setLoadError(null);
    startTransition(async () => {
      try {
        const data = await getBasecampProjects();
        setProjects(data);
        setSelected(new Set(data.filter((p) => p.importStatus === "NOT_IMPORTED").map((p) => p.id)));
      } catch (e) {
        setLoadError(String(e));
      } finally {
        setLoadingProjects(false);
      }
    });
  }

  function toggleProject(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectNewOnly() {
    if (!projects) return;
    setSelected(new Set(newProjects.map((p) => p.id)));
  }

  function selectNeedsReimport() {
    if (!projects) return;
    setSelected(new Set([...newProjects, ...attentionProjects].map((p) => p.id)));
  }

  function selectAllProjects() {
    if (!projects) return;
    setSelected(new Set(projects.map((p) => p.id)));
  }

  function toggleSectionAll(list: BCProjectWithStatus[]) {
    const allSelected = list.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((p) => (allSelected ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  async function handleImportSelected() {
    if (selected.size === 0 || importing) return;
    const queue = Array.from(selected);
    setImporting(true);
    setResultsOpen(true);
    setStatuses((prev) => {
      const next = new Map(prev);
      queue.forEach((id) => next.set(id, { state: "pending" }));
      return next;
    });

    // Worker pool: 3 projects in parallel. Each worker pulls the next project
    // from the shared queue until empty. JS single-thread makes this safe.
    const pending = [...queue];
    async function worker() {
      while (pending.length > 0) {
        const projectId = pending.shift()!;
        setStatuses((prev) => new Map(prev).set(projectId, { state: "running" }));
        try {
          const result = await importBasecampProject(projectId);
          setStatuses((prev) => new Map(prev).set(projectId, { state: "done", result }));
          setProjects((prev) =>
            prev
              ? prev.map((p) =>
                  p.id === projectId
                    ? {
                        ...p,
                        importStatus: result.importStatus,
                        importedAt: p.importedAt ?? new Date(),
                        importLog: result.importLog,
                        counts: {
                          tasks:       result.tasksImported,
                          discussions: result.messagesImported,
                          files:       result.filesStored + result.filesMetadataOnly,
                          folders:     result.foldersCreated,
                        },
                      }
                    : p
                )
              : prev
          );
        } catch (e) {
          setStatuses((prev) => new Map(prev).set(projectId, { state: "error", message: String(e) }));
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));

    setImporting(false);
    setSelected(new Set());
  }

  async function handleReimport(projectId: number) {
    if (importing) return;
    setImporting(true);
    setResultsOpen(true);
    setStatuses((prev) => new Map(prev).set(projectId, { state: "running" }));
    try {
      const result = await importBasecampProject(projectId);
      setStatuses((prev) => new Map(prev).set(projectId, { state: "done", result }));
      setProjects((prev) =>
        prev
          ? prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    importStatus: result.importStatus,
                    importedAt: p.importedAt ?? new Date(),
                    importLog: result.importLog,
                    counts: {
                      tasks:       result.tasksImported,
                      discussions: result.messagesImported,
                      files:       result.filesStored + result.filesMetadataOnly,
                      folders:     result.foldersCreated,
                    },
                  }
                : p
            )
          : prev
      );
    } catch (e) {
      setStatuses((prev) => new Map(prev).set(projectId, { state: "error", message: String(e) }));
    }
    setImporting(false);
  }

  async function handleRetry(bcProjectId: number) {
    const project = projects?.find((p) => p.id === bcProjectId);
    if (!project) return;
    const dbProjectId = `bc-${bcProjectId}`;
    setRetryingProject(bcProjectId);
    try {
      const result = await retryFailedFiles(dbProjectId);
      setProjects((prev) =>
        prev
          ? prev.map((p) =>
              p.id === bcProjectId
                ? { ...p, importStatus: result.newStatus, importLog: result.newImportLog }
                : p
            )
          : prev
      );
    } catch {
      // retry errors are surfaced in the detail panel on next expand
    } finally {
      setRetryingProject(null);
    }
  }

  function handleDisconnect() {
    startTransition(async () => { await disconnectBasecamp(); });
  }

  const importedCount    = Array.from(statuses.values()).filter((s) => s.state === "done" || s.state === "error").length;
  const runningCount     = Array.from(statuses.values()).filter((s) => s.state === "running" || s.state === "pending").length;
  const hasResults       = statuses.size > 0;
  const newSelected      = projects?.filter((p) => selected.has(p.id) && p.importStatus === "NOT_IMPORTED").length ?? 0;
  const reimportSelected = projects?.filter((p) => selected.has(p.id) && p.importStatus !== "NOT_IMPORTED").length ?? 0;

  return (
    <div className="space-y-6">
      {/* OAuth error */}
      {errorParam && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {errorParam === "auth_failed"    && "Authorization failed. Please try again."}
            {errorParam === "not_configured" && "Basecamp OAuth credentials are not configured."}
            {errorParam === "token_failed"   && "Failed to exchange the authorization code."}
            {errorParam === "no_account"     && "No Basecamp 3 account found for this user."}
            {errorParam === "unknown"        && "An unexpected error occurred. Please try again."}
          </span>
        </div>
      )}

      {/* Connection card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", connected ? "bg-emerald-50" : "bg-muted")}>
              <img src="https://basecamp.com/favicon.ico" alt="" className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Basecamp 3</p>
              <p className={cn("text-xs", connected ? "text-emerald-600" : "text-muted-foreground")}>
                {connected ? `Connected · ${accountName ?? accountId}` : "Not connected"}
              </p>
            </div>
          </div>
          {connected ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isPending} className="gap-1.5">
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </Button>
          ) : connectHref ? (
            <a href={connectHref}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Connect Basecamp
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Not configured</span>
          )}
        </div>
      </div>

      {!connected && !connectHref && <SetupInstructions />}

      {/* Storage warning */}
      {connected && !storageConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">File storage not configured</p>
            <p className="text-xs text-amber-800">
              <code className="font-mono bg-amber-100 px-1 rounded">UPLOADTHING_TOKEN</code> is missing —
              files will be saved as metadata only. Add the token and re-import to store actual file content.
            </p>
          </div>
        </div>
      )}

      {/* ── Project picker ─────────────────────────────────────────── */}
      {connected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Basecamp Projects</h2>
              {projects && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {newProjects.length} ready to import
                  {attentionProjects.length > 0 && ` · ${attentionProjects.length} need re-import`}
                  {warningProjects.length  > 0 && ` · ${warningProjects.length} with notes`}
                  {importedProjects.length > 0 && ` · ${importedProjects.length} fully imported`}
                  {archivedBcProjects.length > 0 && ` · ${archivedBcProjects.length} archived in Basecamp`}
                  {selected.size > 0 && ` · ${selected.size} selected`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!projects ? (
                <Button size="sm" variant="outline" onClick={handleLoadProjects} disabled={loadingProjects}>
                  {loadingProjects && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {loadingProjects ? "Loading…" : loadError ? "Retry" : "Load Projects"}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleLoadProjects} disabled={loadingProjects || importing} className="gap-1.5">
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingProjects && "animate-spin")} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImportSelected}
                    disabled={selected.size === 0 || importing}
                    className="gap-1.5 min-w-[160px]"
                  >
                    {importing ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {runningCount > 0 ? `Importing… (${importedCount}/${selected.size})` : "Starting…"}</>
                    ) : selected.size > 0 ? (
                      reimportSelected > 0
                        ? `Re-import ${reimportSelected} · Import ${newSelected}`
                        : `Import ${selected.size} project${selected.size > 1 ? "s" : ""}`
                    ) : "Select projects"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700 font-medium">Failed to load projects</p>
                <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
              </div>
            </div>
          )}

          {projects && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Search bar */}
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search projects…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors"
                  />
                </div>
                {search && <span className="text-xs text-muted-foreground shrink-0">{newProjects.length + attentionProjects.length + warningProjects.length + importedProjects.length} results</span>}
              </div>

              <div className="max-h-[600px] overflow-y-auto divide-y divide-border">

                {/* ── Not yet imported ── */}
                {newProjects.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/20 sticky top-0 z-10">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSectionAll(newProjects)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {newProjects.every((p) => selected.has(p.id))
                            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            : newProjects.some((p) => selected.has(p.id))
                            ? <MinusSquare className="w-3.5 h-3.5 text-primary" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
                          Ready to Import ({newProjects.length})
                        </span>
                      </div>
                    </div>
                    {newProjects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        runStatus={statuses.get(p.id)}
                        isSelected={selected.has(p.id)}
                        isExpanded={expandedProject === p.id}
                        importing={importing}
                        retrying={retryingProject === p.id}
                        onToggle={() => toggleProject(p.id)}
                        onExpandToggle={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                        onRetry={() => handleRetry(p.id)}
                        onReimport={() => handleReimport(p.id)}
                      />
                    ))}
                  </>
                )}

                {newProjects.length === 0 && attentionProjects.length === 0 && warningProjects.length === 0 && archivedBcProjects.filter(p => p.importStatus === "NOT_IMPORTED").length === 0 && !search && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    All active projects have been imported.
                  </div>
                )}

                {/* ── Needs re-import (legacy / partial / failed) ── */}
                {attentionProjects.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 bg-amber-50/60 sticky top-0 z-10 border-t border-border">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSectionAll(attentionProjects)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {attentionProjects.every((p) => selected.has(p.id))
                            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            : attentionProjects.some((p) => selected.has(p.id))
                            ? <MinusSquare className="w-3.5 h-3.5 text-primary" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setShowAttention((v) => !v)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showAttention
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            Needs re-import ({attentionProjects.length})
                          </span>
                        </button>
                      </div>
                      <span className="text-[10px] text-amber-600">Import did not complete — re-import to fix</span>
                    </div>
                    {showAttention && attentionProjects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        runStatus={statuses.get(p.id)}
                        isSelected={selected.has(p.id)}
                        isExpanded={expandedProject === p.id}
                        importing={importing}
                        retrying={retryingProject === p.id}
                        onToggle={() => toggleProject(p.id)}
                        onExpandToggle={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                        onRetry={() => handleRetry(p.id)}
                        onReimport={() => handleReimport(p.id)}
                      />
                    ))}
                  </>
                )}

                {/* ── Imported with warnings ── */}
                {warningProjects.length > 0 && (
                  <>
                    {(() => {
                      const hasRealFailures = warningProjects.some((p) =>
                        (p.importLog?.failedFilesCount ?? 0) > 0 &&
                        (p.importLog?.failedFiles ?? []).some((f: FailedFile) => !f.isOversized)
                      );
                      const hasOversized = warningProjects.some((p) =>
                        (p.importLog?.failedFiles ?? []).some((f: FailedFile) => f.isOversized)
                      );
                      return (
                    <div className="flex items-center justify-between px-4 py-2 bg-amber-50/40 sticky top-0 z-10 border-t border-border">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSectionAll(warningProjects)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {warningProjects.every((p) => selected.has(p.id))
                            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            : warningProjects.some((p) => selected.has(p.id))
                            ? <MinusSquare className="w-3.5 h-3.5 text-primary" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setShowWarnings((v) => !v)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showWarnings
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            Imported with Notes ({warningProjects.length})
                          </span>
                        </button>
                      </div>
                      <span className="text-[10px] text-amber-600">
                        {hasRealFailures
                          ? "Some files could not be imported — expand to retry"
                          : hasOversized
                          ? "Large files skipped — download manually from Basecamp"
                          : "Minor notes only — no action needed"}
                      </span>
                    </div>
                      );
                    })()}
                    {showWarnings && warningProjects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        runStatus={statuses.get(p.id)}
                        isSelected={selected.has(p.id)}
                        isExpanded={expandedProject === p.id}
                        importing={importing}
                        retrying={retryingProject === p.id}
                        onToggle={() => toggleProject(p.id)}
                        onExpandToggle={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                        onRetry={() => handleRetry(p.id)}
                        onReimport={() => handleReimport(p.id)}
                      />
                    ))}
                  </>
                )}

                {/* ── Fully imported (clean) ── */}
                {importedProjects.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/10 sticky top-0 z-10 border-t border-border">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowClean((v) => !v)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showClean
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                            Fully Imported ({importedProjects.length})
                          </span>
                        </button>
                      </div>
                      {!showClean && (
                        <span className="text-[10px] text-muted-foreground">Click to expand</span>
                      )}
                      {showClean && (
                        <button
                          onClick={() => toggleSectionAll(importedProjects)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {importedProjects.every((p) => selected.has(p.id))
                            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            : importedProjects.some((p) => selected.has(p.id))
                            ? <MinusSquare className="w-3.5 h-3.5 text-primary" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {showClean && importedProjects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        runStatus={statuses.get(p.id)}
                        isSelected={selected.has(p.id)}
                        isExpanded={expandedProject === p.id}
                        importing={importing}
                        retrying={retryingProject === p.id}
                        onToggle={() => toggleProject(p.id)}
                        onExpandToggle={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                        onRetry={() => handleRetry(p.id)}
                        onReimport={() => handleReimport(p.id)}
                      />
                    ))}
                  </>
                )}

                {/* ── Archived in Basecamp ── */}
                {archivedBcProjects.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50/60 sticky top-0 z-10 border-t border-border">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowArchived((v) => !v)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showArchived
                            ? <ChevronUp className="w-3.5 h-3.5" />
                            : <ChevronDown className="w-3.5 h-3.5" />}
                          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                            Archived in Basecamp ({archivedBcProjects.length})
                          </span>
                        </button>
                      </div>
                      {!showArchived && (
                        <span className="text-[10px] text-muted-foreground">Historical data — click to expand</span>
                      )}
                      {showArchived && (
                        <button
                          onClick={() => toggleSectionAll(archivedBcProjects)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {archivedBcProjects.every((p) => selected.has(p.id))
                            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            : archivedBcProjects.some((p) => selected.has(p.id))
                            ? <MinusSquare className="w-3.5 h-3.5 text-primary" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {showArchived && archivedBcProjects.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        runStatus={statuses.get(p.id)}
                        isSelected={selected.has(p.id)}
                        isExpanded={expandedProject === p.id}
                        importing={importing}
                        retrying={retryingProject === p.id}
                        onToggle={() => toggleProject(p.id)}
                        onExpandToggle={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                        onRetry={() => handleRetry(p.id)}
                        onReimport={() => handleReimport(p.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          {projects && (
            <div className="flex items-center gap-3 flex-wrap">
              {warningProjects.length > 0 && (
                <button
                  onClick={() => { toggleSectionAll(warningProjects); setShowWarnings(true); }}
                  className="text-xs text-amber-700 hover:opacity-70 transition-opacity font-medium"
                >
                  Select all with notes ({warningProjects.length})
                </button>
              )}
              {attentionProjects.length > 0 && (
                <button onClick={selectNeedsReimport} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Select needs re-import ({newProjects.length + attentionProjects.length})
                </button>
              )}
              {newProjects.length > 0 && attentionProjects.length > 0 && (
                <button onClick={selectNewOnly} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  New only
                </button>
              )}
              {archivedBcProjects.filter(p => p.importStatus === "NOT_IMPORTED").length > 0 && (
                <button
                  onClick={() => {
                    setShowArchived(true);
                    setSelected((prev) => {
                      const next = new Set(prev);
                      archivedBcProjects.filter(p => p.importStatus === "NOT_IMPORTED").forEach(p => next.add(p.id));
                      return next;
                    });
                  }}
                  className="text-xs text-slate-600 hover:text-foreground transition-colors"
                >
                  Select unimported archived ({archivedBcProjects.filter(p => p.importStatus === "NOT_IMPORTED").length})
                </button>
              )}
              <button
                onClick={() => { selectAllProjects(); setShowWarnings(true); setShowClean(true); setShowArchived(true); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Select all ({projects.length})
              </button>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unarchive fix */}
      {connected && <UnarchiveFix />}

      {/* Mandate backfill */}
      {connected && <MandateBackfill />}

      {/* Message board backfill */}
      {connected && <MessageBoardBackfill />}

      {/* Clear imported messages */}
      <ClearImportedPings onClear={onClearPings} />

      {/* Private pings (DMs) */}
      {connected && <PrivatePingsImport />}

      {/* To-dos backfill */}
      {connected && <TodosBackfill />}

      {/* Project members backfill */}
      {connected && <ProjectMembersBackfill />}

      {/* Step 1: Import members */}
      {connected && <BasecampPeopleImport />}

      {/* Step 2: Review mappings */}
      {connected && <BasecampPeopleMapping />}

      {/* Live import results panel */}
      {hasResults && (
        <div className="space-y-3">
          <button
            onClick={() => setResultsOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-foreground w-full"
          >
            Import Results
            {resultsOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {importedCount} / {statuses.size} complete
            </span>
          </button>

          {resultsOpen && (
            <div className="space-y-2">
              {Array.from(statuses.entries()).map(([id, status]) => {
                const project = projects?.find((p) => p.id === id);
                return (
                  <ResultCard key={id} id={id} status={status} name={project?.name ?? `Project ${id}`} />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

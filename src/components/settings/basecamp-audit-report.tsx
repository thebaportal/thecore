"use client";

import { useState } from "react";
import { Download, FolderOpen, BookOpen, LayoutTemplate, CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react";
import type { ProjectAuditRow } from "@/actions/basecamp-audit";
import { cn } from "@/lib/utils";

const IMPORT_STATUS_LABEL: Record<string, string> = {
  NOT_IMPORTED:           "Not imported",
  IMPORTED:               "Imported",
  IMPORTED_WITH_WARNINGS: "Imported (warnings)",
  PARTIALLY_IMPORTED:     "Partial",
  IMPORT_FAILED:          "Failed",
  LEGACY_IMPORT:          "Legacy import",
};

function StatusBadge({ status }: { status: string }) {
  const label = IMPORT_STATUS_LABEL[status] ?? status;
  const cls =
    status === "IMPORTED"               ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "IMPORTED_WITH_WARNINGS" ? "bg-amber-50 text-amber-700 border-amber-200" :
    status === "PARTIALLY_IMPORTED"     ? "bg-amber-50 text-amber-700 border-amber-200" :
    status === "IMPORT_FAILED"          ? "bg-red-50 text-red-700 border-red-200" :
    status === "LEGACY_IMPORT"          ? "bg-blue-50 text-blue-700 border-blue-200" :
                                          "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border", cls)}>
      {label}
    </span>
  );
}

function ClassificationBadge({ cls }: { cls: "Project" | "Library" | "Template" }) {
  if (cls === "Library")  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700"><BookOpen className="w-3 h-3" />Library</span>;
  if (cls === "Template") return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700"><LayoutTemplate className="w-3 h-3" />Template</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"><FolderOpen className="w-3 h-3" />Project</span>;
}

function ToolDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span title={label} className={cn(
      "w-1.5 h-1.5 rounded-full shrink-0",
      active ? "bg-foreground/50" : "bg-border"
    )} />
  );
}

function downloadCsv(rows: ProjectAuditRow[]) {
  const headers = [
    "BC ID", "Name", "BC Status",
    "Has Tasks", "Has Vault/Docs", "Has Campfire/Chat", "Has Message Board",
    "Classification", "Destination in The Core",
    "Import Status",
    "Tasks Imported", "Files Imported", "Folders Imported", "Messages Imported",
    "Description",
  ];

  const escape = (v: string | number | boolean | null) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csvRows = rows.map((r) => [
    r.bcId,
    r.name,
    r.bcStatus,
    r.hasTasks       ? "Yes" : "No",
    r.hasVault       ? "Yes" : "No",
    r.hasCampfire    ? "Yes" : "No",
    r.hasMessageBoard ? "Yes" : "No",
    r.classification,
    r.destination,
    IMPORT_STATUS_LABEL[r.importStatus] ?? r.importStatus,
    r.tasksImported,
    r.filesImported,
    r.foldersImported,
    r.messagesImported,
    r.description ?? "",
  ].map(escape).join(","));

  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `basecamp-project-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BasecampAuditReport({ rows }: { rows: ProjectAuditRow[] }) {
  const [filter, setFilter] = useState<"all" | "active" | "archived">("active");

  const visible = rows.filter((r) => filter === "all" ? true : r.bcStatus === filter);
  const projectCount  = visible.filter((r) => r.classification === "Project").length;
  const libraryCount  = visible.filter((r) => r.classification === "Library").length;
  const templateCount = visible.filter((r) => r.classification === "Template").length;
  const notImported   = visible.filter((r) => r.importStatus === "NOT_IMPORTED").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Real projects", value: projectCount, icon: FolderOpen, color: "text-emerald-700" },
          { label: "Library repos",  value: libraryCount,  icon: BookOpen,       color: "text-violet-700" },
          { label: "Template repos", value: templateCount, icon: LayoutTemplate,  color: "text-blue-700" },
          { label: "Not imported",   value: notImported,   icon: Clock,           color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className={cn("flex items-center gap-1.5 text-xs font-medium mb-1", color)}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Data mapping reference */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data mapping — Basecamp → The Core</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground">
          {[
            ["Todoset (tasks/todos)",    "→",  "Tasks"],
            ["Campfire (chat)",          "→",  "Pings (Inbox)"],
            ["Message Board (posts)",    "→",  "Project Discussions"],
            ["Vault (docs/files)",       "→",  "Docs & Files  OR  Library (if repository project)"],
            ["Project people",           "→",  "Project Members  (skipped for repository projects)"],
            ["Archived BC project",      "→",  "Archived project in The Core"],
          ].map(([from, arrow, to]) => (
            <div key={from} className="flex items-start gap-1.5">
              <span className="shrink-0 font-medium text-foreground/70">{from}</span>
              <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" />
              <span>{to}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
          {(["active", "archived", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? `All (${rows.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${rows.filter(r => r.bcStatus === f).length})`}
            </button>
          ))}
        </div>

        <button
          onClick={() => downloadCsv(visible)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Project name</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Tools</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Classification</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Destination</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Import</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Imported</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((row) => (
              <tr key={row.bcId} className={cn(
                "hover:bg-muted/20 transition-colors",
                row.bcStatus === "archived" && "opacity-60"
              )}>
                <td className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <div>
                      <p className="font-medium text-foreground text-sm leading-tight">{row.name}</p>
                      {row.bcStatus === "archived" && (
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Archived in BC</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <ToolDot active={row.hasTasks}        label="Tasks (Todoset)" />
                    <ToolDot active={row.hasVault}        label="Vault / Docs" />
                    <ToolDot active={row.hasCampfire}     label="Campfire / Chat" />
                    <ToolDot active={row.hasMessageBoard} label="Message Board" />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">T V C M</p>
                </td>
                <td className="px-3 py-2.5">
                  <ClassificationBadge cls={row.classification} />
                </td>
                <td className="px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{row.destination}</p>
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={row.importStatus} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {row.importStatus !== "NOT_IMPORTED" ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {row.tasksImported}t · {row.messagesImported}m · {row.filesImported}f
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40">—</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tools legend: <strong>T</strong> = Tasks · <strong>V</strong> = Vault/Docs · <strong>C</strong> = Campfire/Chat · <strong>M</strong> = Message Board.
        Filled dot = present in that project.
      </p>
    </div>
  );
}

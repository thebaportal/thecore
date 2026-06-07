"use client";

import { useState, useTransition, useRef } from "react";
import { Download, Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { inviteToProject, type ProjectInviteResult } from "@/actions/invitations";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ParsedRow = {
  firstName: string;
  lastName: string;
  email: string;
  error: string | null;
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).slice(1);
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      cols.push(current.trim());

      const firstName = cols[0] ?? "";
      const lastName  = cols[1] ?? "";
      const email     = (cols[2] ?? "").toLowerCase();

      let error: string | null = null;
      if (!firstName) error = "First name required";
      else if (!lastName) error = "Last name required";
      else if (!email) error = "Email required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "Invalid email";

      return { firstName, lastName, email, error };
    });
}

function downloadTemplate() {
  const csv = [
    "First Name,Last Name,Email Address",
    "Jane,Smith,jane.smith@example.com",
    "John,Doe,john.doe@example.com",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkInviteDialog({
  projectId, open, onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ProjectInviteResult[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => r.error).length;

  function reset() {
    setRows([]);
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRows(parseCSV(ev.target?.result as string));
      setResults(null);
    };
    reader.readAsText(file);
  }

  function handleSend() {
    const valid = rows.filter((r) => !r.error);
    if (!valid.length) return;
    startTransition(async () => {
      const res = await inviteToProject(
        projectId,
        valid.map((r) => ({ firstName: r.firstName, lastName: r.lastName, email: r.email })),
        "org:member",
      );
      setResults(res);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Students from CSV</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {!results ? (
            <>
              {/* Upload controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                  <Download className="w-3.5 h-3.5" />
                  Download template
                </Button>
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer text-sm font-medium">
                  <Upload className="w-3.5 h-3.5" />
                  Upload CSV
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
                </label>
              </div>

              <p className="text-xs text-muted-foreground">
                CSV columns: <span className="font-mono bg-muted px-1 py-0.5 rounded">First Name, Last Name, Email Address</span>.
                Download the template to get started.
              </p>

              {/* Preview */}
              {rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm">
                      <span className="font-medium">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
                      {validCount > 0 && <span className="text-emerald-600 ml-2">· {validCount} valid</span>}
                      {errorCount > 0 && <span className="text-red-600 ml-2">· {errorCount} with errors</span>}
                    </p>
                    <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Clear
                    </button>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">First Name</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Last Name</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Email</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {rows.map((row, i) => (
                          <tr key={i} className={cn(row.error ? "bg-red-50/40" : "")}>
                            <td className="px-3 py-2 text-sm">{row.firstName || <span className="text-muted-foreground/40 italic text-xs">empty</span>}</td>
                            <td className="px-3 py-2 text-sm">{row.lastName  || <span className="text-muted-foreground/40 italic text-xs">empty</span>}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.email || <span className="text-muted-foreground/40 italic">empty</span>}</td>
                            <td className="px-3 py-2">
                              {row.error ? (
                                <span className="flex items-center gap-1 text-xs text-red-600">
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />{row.error}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
                    <Button onClick={handleSend} disabled={validCount === 0 || isPending} className="gap-2">
                      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Send {validCount} invitation{validCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              )}

              {rows.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Upload a CSV file to preview students before sending invitations</p>
                </div>
              )}
            </>
          ) : (
            /* Results screen */
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Import complete —{" "}
                {results.filter((r) => r.status === "invited" || r.status === "added").length} of {results.length} successful
              </p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {results.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                        <td className="px-3 py-2 text-xs font-medium">
                          {r.status === "invited"          && <span className="text-primary">Invitation sent</span>}
                          {r.status === "added"            && <span className="text-emerald-600">Added to project</span>}
                          {r.status === "already_member"   && <span className="text-muted-foreground">Already a member</span>}
                          {r.status === "already_in_project" && <span className="text-amber-600">In another project: {r.error}</span>}
                          {r.status === "error"            && <span className="text-red-600">{r.error ?? "Failed"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { reset(); onClose(); }}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

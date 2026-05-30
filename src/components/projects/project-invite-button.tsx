"use client";

import { useState, useTransition } from "react";
import { UserPlus, Loader2, Plus, X, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { inviteToProject, type ProjectInviteeInput, type ProjectInviteResult } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Role = "org:member" | "org:admin";

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: "org:member",
    label: "A student or team member",
    description: "Can access this project, participate in discussions, complete tasks, and upload deliverables.",
  },
  {
    value: "org:admin",
    label: "An instructor or admin",
    description: "Full access — can manage members, unlock phases, review deliverables, and configure settings.",
  },
];

type Row = ProjectInviteeInput & { id: string };

function newRow(): Row {
  return { id: Math.random().toString(36).slice(2), firstName: "", lastName: "", email: "" };
}

type Step = "role" | "details" | "done";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  invited:            { label: "Invited",               icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />, cls: "text-emerald-600" },
  added:              { label: "Added",                 icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />, cls: "text-emerald-600" },
  already_member:     { label: "Already enrolled",      icon: <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />, cls: "text-muted-foreground" },
  already_in_project: { label: "Already in a project", icon: <AlertCircle className="w-4 h-4 text-destructive shrink-0" />, cls: "text-destructive" },
  error:              { label: "Failed",                icon: <AlertCircle className="w-4 h-4 text-destructive shrink-0" />, cls: "text-destructive" },
};

export function ProjectInviteButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role | null>(null);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [results, setResults] = useState<ProjectInviteResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    setStep("role");
    setRole(null);
    setRows([newRow()]);
    setResults([]);
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function updateRow(id: string, field: keyof ProjectInviteeInput, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  const validRows = rows.filter((r) => r.email.trim());

  function handleSend() {
    if (!role || validRows.length === 0 || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await inviteToProject(projectId, validRows, role);
        setResults(res);
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const selectedOption = ROLE_OPTIONS.find((r) => r.value === role);
  const successCount = results.filter((r) => r.status === "invited" || r.status === "added").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
        Invite
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-lg">

          {/* ── Step 1: Role ── */}
          {step === "role" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">Who are you inviting?</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Choose their role — you can change it later.</p>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className={cn(
                      "w-full text-left px-5 py-4 rounded-xl border transition-all",
                      role === opt.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                        role === opt.value ? "border-primary" : "border-muted-foreground/30"
                      )}>
                        {role === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className={cn("text-sm font-semibold", role === opt.value ? "text-primary" : "text-foreground")}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={() => { if (role) setStep("details"); }} disabled={!role}>
                  Next →
                </Button>
              </div>
            </>
          )}

          {/* ── Step 2: Details ── */}
          {step === "details" && (
            <>
              <DialogHeader>
                <button
                  onClick={() => setStep("role")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 -mt-1 w-fit"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
                <DialogTitle className="text-lg">Enter their details</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Inviting as{" "}
                  <span className="font-medium text-foreground">{selectedOption?.label}</span>.
                  They'll set up their password when they accept.
                </p>
              </DialogHeader>

              <div className="py-2 space-y-3">
                <div className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 px-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">First name</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Last name</span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Email address</span>
                  <span />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  {rows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-center">
                      <Input
                        placeholder="First"
                        value={row.firstName}
                        onChange={(e) => updateRow(row.id, "firstName", e.target.value)}
                        disabled={isPending}
                      />
                      <Input
                        placeholder="Last"
                        value={row.lastName}
                        onChange={(e) => updateRow(row.id, "lastName", e.target.value)}
                        disabled={isPending}
                      />
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={row.email}
                        onChange={(e) => updateRow(row.id, "email", e.target.value)}
                        disabled={isPending}
                      />
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1 || isPending}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addRow}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-primary hover:opacity-70 transition-opacity mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add another person
                </button>

                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
                <Button
                  onClick={handleSend}
                  disabled={validRows.length === 0 || isPending}
                  className="gap-2 min-w-[160px]"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isPending
                    ? "Sending…"
                    : `Send ${validRows.length > 1 ? `${validRows.length} invitations` : "invitation"}`}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Results ── */}
          {step === "done" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {errorCount === 0 ? "Done!" : "Invitations processed"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {successCount > 0 && `${successCount} ${successCount > 1 ? "people" : "person"} added or invited.`}
                  {errorCount > 0 && ` ${errorCount} failed.`}
                </p>
              </DialogHeader>

              <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
                {results.map((r) => {
                  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG["error"]!;
                  return (
                    <div key={r.email} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/40">
                      {cfg.icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{r.email}</p>
                        {r.status === "error" && r.error && (
                          <p className="text-xs text-destructive mt-0.5">{r.error}</p>
                        )}
                        {r.status === "already_in_project" && r.error && (
                          <p className="text-xs text-destructive mt-0.5">Already in: {r.error}</p>
                        )}
                      </div>
                      <span className={cn("text-xs font-medium shrink-0", cfg.cls)}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={handleClose}>Done</Button>
              </div>
            </>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}

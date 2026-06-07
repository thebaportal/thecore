"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { upsertProjectMandate, type MandateInput } from "@/actions/mandate";

type Mandate = {
  projectDescription?: string | null;
  timelineWeeks?: number | null;
  timelineTolerance?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  budget?: string | null;
  budgetTolerance?: string | null;
  scope?: string | null;
  keyDeliverables?: string | null;
  nextSteps?: string | null;
};

// Strip leading bullet/dash/number prefixes so auto-bullets don't double-render
function parseList(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((s) => s.trim().replace(/^[•\-\*]\s*/, "").replace(/^\d+[\.\)]\s*/, ""))
    .filter(Boolean);
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d as string | Date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Textarea that auto-continues bullet points on Enter
function BulletTextarea({
  value, onChange, rows, placeholder, autoFocus,
}: {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const val = el.value;

    if (e.key !== "Enter") return;
    e.preventDefault();

    const before = val.slice(0, pos);
    const after = val.slice(pos);
    const currentLine = before.split("\n").pop() ?? "";

    // If the current line is just a bullet with no content, remove it and break out
    if (/^•\s*$/.test(currentLine.trim()) || currentLine.trim() === "") {
      const stripped = before.replace(/\n?•\s*$/, "");
      const newVal = stripped + "\n" + after;
      onChange(newVal);
      const newPos = stripped.length + 1;
      requestAnimationFrame(() => el.setSelectionRange(newPos, newPos));
      return;
    }

    const insert = "\n• ";
    onChange(before + insert + after);
    requestAnimationFrame(() => el.setSelectionRange(pos + insert.length, pos + insert.length));
  }

  function handleFocus(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (!e.target.value.trim()) {
      onChange("• ");
      requestAnimationFrame(() => e.target.setSelectionRange(2, 2));
    }
  }

  return (
    <Textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="text-sm"
    />
  );
}

// ── Consistent list rendering ─────────────────────────────────────────────────

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-baseline gap-3 text-sm text-foreground leading-relaxed">
          <span className="text-sm font-semibold text-muted-foreground/25 tabular-nums shrink-0 w-5 text-right">
            {i + 1}.
          </span>
          {item}
        </li>
      ))}
    </ol>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectMandate({
  projectId,
  mandate,
  isInstructor,
}: {
  projectId: string;
  mandate: Mandate | null;
  isInstructor: boolean;
  showMetrics?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingNextSteps, setEditingNextSteps] = useState(false);
  const [nextStepsValue, setNextStepsValue] = useState(mandate?.nextSteps ?? "");
  const [isPending, startTransition] = useTransition();
  const [isSavingNextSteps, startNextStepsTransition] = useTransition();

  const [form, setForm] = useState({
    projectDescription: mandate?.projectDescription ?? "",
    timelineWeeks: mandate?.timelineWeeks?.toString() ?? "",
    timelineTolerance: mandate?.timelineTolerance ?? "",
    startDate: mandate?.startDate
      ? new Date(mandate.startDate as string | Date).toISOString().split("T")[0]!
      : "",
    endDate: mandate?.endDate
      ? new Date(mandate.endDate as string | Date).toISOString().split("T")[0]!
      : "",
    budget: mandate?.budget ?? "",
    budgetTolerance: mandate?.budgetTolerance ?? "",
    scope: mandate?.scope ?? "",
    keyDeliverables: mandate?.keyDeliverables ?? "",
    nextSteps: mandate?.nextSteps ?? "",
  });

  function handleSave() {
    startTransition(async () => {
      const data: MandateInput = {
        projectDescription: form.projectDescription || undefined,
        timelineWeeks: form.timelineWeeks ? parseInt(form.timelineWeeks) : null,
        timelineTolerance: form.timelineTolerance || undefined,
        startDate: form.startDate ? new Date(form.startDate) : null,
        endDate: form.endDate ? new Date(form.endDate) : null,
        budget: form.budget || undefined,
        budgetTolerance: form.budgetTolerance || undefined,
        scope: form.scope || undefined,
        keyDeliverables: form.keyDeliverables || undefined,
        nextSteps: form.nextSteps || undefined,
      };
      await upsertProjectMandate(projectId, data);
      setOpen(false);
    });
  }

  function handleSaveNextSteps() {
    startNextStepsTransition(async () => {
      await upsertProjectMandate(projectId, { nextSteps: nextStepsValue || undefined });
      setEditingNextSteps(false);
    });
  }

  const hasContent = mandate && (
    mandate.projectDescription || mandate.scope ||
    mandate.keyDeliverables || mandate.nextSteps ||
    mandate.timelineWeeks || mandate.budget ||
    mandate.startDate || mandate.endDate
  );

  const scopeItems       = parseList(mandate?.scope);
  const deliverableItems = parseList(mandate?.keyDeliverables);
  const nextStepItems    = parseList(nextStepsValue || mandate?.nextSteps);

  const hasStats = mandate && (
    mandate.timelineWeeks || mandate.startDate || mandate.endDate || mandate.budget
  );

  return (
    <>
      {!hasContent ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground/40 italic">
            {isInstructor ? "No mandate yet." : "The project mandate hasn't been added yet."}
          </p>
          {isInstructor && (
            <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <Plus className="h-3 w-3" /> Add mandate
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">

          {/* ── Top row: main content + sidebar ── */}
          <div className="flex gap-8 items-start">

            {/* Left: Goal + Scope + Deliverables */}
            <div className="flex-1 min-w-0 space-y-8">

              {mandate.projectDescription && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35">
                      Project Goal
                    </p>
                    {isInstructor && (
                      <button
                        onClick={() => setOpen(true)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                  <p className="text-base text-foreground leading-loose">{mandate.projectDescription}</p>
                </div>
              )}

              {scopeItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35 mb-4">
                    Scope
                  </p>
                  <BulletList items={scopeItems} />
                </div>
              )}

              {deliverableItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35 mb-4">
                    Expected Deliverables
                  </p>
                  <NumberedList items={deliverableItems} />
                </div>
              )}

            </div>

            {/* Right: Period + Next Steps */}
            {(hasStats || nextStepItems.length > 0 || isInstructor) && (
              <div className="w-[280px] shrink-0 space-y-4">

                {hasStats && (
                  <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35">
                      Period
                    </p>
                    <div className="space-y-4">
                      {mandate.timelineWeeks && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Duration</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                            {mandate.timelineWeeks}
                            <span className="text-sm font-normal text-muted-foreground ml-1">w</span>
                          </p>
                          {mandate.timelineTolerance && (
                            <p className="text-xs text-muted-foreground mt-0.5">±{mandate.timelineTolerance}</p>
                          )}
                        </div>
                      )}
                      {mandate.startDate && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Start</p>
                          <p className="text-sm font-semibold text-foreground">{fmtDate(mandate.startDate)}</p>
                        </div>
                      )}
                      {mandate.endDate && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">End</p>
                          <p className="text-sm font-semibold text-foreground">{fmtDate(mandate.endDate)}</p>
                        </div>
                      )}
                      {mandate.budget && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Budget</p>
                          <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{mandate.budget}</p>
                          {mandate.budgetTolerance && (
                            <p className="text-xs text-muted-foreground mt-0.5">±{mandate.budgetTolerance}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                {(nextStepItems.length > 0 || isInstructor) && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/35">
                        Next Steps
                      </p>
                      {isInstructor && !editingNextSteps && (
                        <button
                          onClick={() => { setNextStepsValue(mandate?.nextSteps ?? ""); setEditingNextSteps(true); }}
                          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      {editingNextSteps ? (
                        <div className="space-y-3">
                          <BulletTextarea
                            rows={5}
                            value={nextStepsValue}
                            onChange={setNextStepsValue}
                            placeholder="• Review project mandate&#10;• Join project chat&#10;• Complete first deliverable"
                            autoFocus
                          />
                          <p className="text-xs text-muted-foreground">Press Enter to add items automatically</p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveNextSteps} disabled={isSavingNextSteps}>
                              {isSavingNextSteps && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setNextStepsValue(mandate?.nextSteps ?? "");
                              setEditingNextSteps(false);
                            }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : nextStepItems.length > 0 ? (
                        <NumberedList items={nextStepItems} />
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic">None yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Project Mandate</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Goal</label>
              <Input
                placeholder="e.g. Build a web application for a fine dining restaurant"
                value={form.projectDescription}
                onChange={(e) => setForm((f) => ({ ...f, projectDescription: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration (weeks)</label>
                <Input type="number" placeholder="8" value={form.timelineWeeks}
                  onChange={(e) => setForm((f) => ({ ...f, timelineWeeks: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tolerance</label>
                <Input placeholder="1 week" value={form.timelineTolerance}
                  onChange={(e) => setForm((f) => ({ ...f, timelineTolerance: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</label>
                <Input type="date" value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date</label>
                <Input type="date" value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</label>
                <Input placeholder="$50,000" value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Tolerance</label>
                <Input placeholder="$5,000" value={form.budgetTolerance}
                  onChange={(e) => setForm((f) => ({ ...f, budgetTolerance: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scope</label>
              <p className="text-xs text-muted-foreground">Press Enter to add items — bullets are automatic</p>
              <BulletTextarea
                rows={4}
                placeholder={"• Online reservation system&#10;• Event booking&#10;• Chef profiles"}
                value={form.scope}
                onChange={(val) => setForm((f) => ({ ...f, scope: val }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected Key Deliverables</label>
              <p className="text-xs text-muted-foreground">Press Enter to add items — bullets are automatic</p>
              <BulletTextarea
                rows={6}
                placeholder={"• High Level Project Plan&#10;• Project Charter&#10;• Use Case Document&#10;• User Story Backlog&#10;• BRD&#10;• Testing Documents"}
                value={form.keyDeliverables}
                onChange={(val) => setForm((f) => ({ ...f, keyDeliverables: val }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next Steps</label>
              <p className="text-xs text-muted-foreground">Press Enter to add items — bullets are automatic</p>
              <BulletTextarea
                rows={3}
                placeholder={"• Review the project mandate&#10;• Join the project chat&#10;• Attend the kickoff session"}
                value={form.nextSteps}
                onChange={(val) => setForm((f) => ({ ...f, nextSteps: val }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Mandate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

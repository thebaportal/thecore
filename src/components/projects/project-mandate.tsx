"use client";

import { useState, useTransition } from "react";
import {
  Pencil, Plus, Loader2,
  FileText, List, ClipboardList,
  Clock, CalendarDays, DollarSign, ChevronRight,
  CheckCircle2, Circle, CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { upsertProjectMandate, type MandateInput } from "@/actions/mandate";
import { cn } from "@/lib/utils";

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

function formatCurrency(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const symbol = raw.includes("€") ? "€" : raw.includes("£") ? "£" : "$";
  const digits = raw.replace(/[^0-9.]/g, "");
  const num = parseFloat(digits);
  if (isNaN(num)) return raw;
  return symbol + num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

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

function CurrencyInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (val: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(value);

  function handleFocus() {
    setFocused(true);
    setRaw(value.replace(/[^0-9.]/g, ""));
  }

  function handleBlur() {
    setFocused(false);
    const formatted = formatCurrency(raw);
    const final = formatted || raw;
    setRaw(final);
    onChange(final);
  }

  return (
    <Input
      value={focused ? raw : (formatCurrency(value) || value)}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function BulletTextarea({ value, onChange, rows, placeholder, autoFocus }: {
  value: string; onChange: (val: string) => void;
  rows?: number; placeholder?: string; autoFocus?: boolean;
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
    if (/^•\s*$/.test(currentLine.trim()) || currentLine.trim() === "") {
      const stripped = before.replace(/\n?•\s*$/, "");
      onChange(stripped + "\n" + after);
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
      rows={rows} value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown} onFocus={handleFocus}
      placeholder={placeholder} autoFocus={autoFocus}
      className="text-sm"
    />
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, accent = "blue", onEdit, isInstructor, children, empty,
}: {
  icon: React.ElementType;
  title: string;
  accent?: "blue" | "amber" | "emerald" | "violet";
  onEdit?: () => void;
  isInstructor?: boolean;
  children: React.ReactNode;
  empty?: boolean;
}) {
  const colors = {
    blue:    { bg: "bg-primary/10",   icon: "text-primary" },
    amber:   { bg: "bg-amber-100",    icon: "text-amber-600" },
    emerald: { bg: "bg-emerald-100",  icon: "text-emerald-600" },
    violet:  { bg: "bg-violet-100",   icon: "text-violet-600" },
  }[accent];

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden shadow-sm", empty && "border-dashed")}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colors.bg)}>
            <Icon className={cn("w-4 h-4", colors.icon)} />
          </div>
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
        </div>
        {isInstructor && onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Two-column bullet grid ────────────────────────────────────────────────────

function BulletGrid({ items }: { items: string[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span className="text-sm text-foreground leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

function NumberedGrid({ items }: { items: string[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <FileText className="w-4 h-4 text-primary/60" />
            <span className="text-[10px] font-bold text-primary/50 tabular-nums">{i + 1}</span>
          </div>
          <span className="text-sm text-foreground leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectMandate({
  projectId, mandate, isInstructor,
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

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!hasContent) {
    return (
      <>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No mandate yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {isInstructor
                ? "Add the project goal, scope, deliverables, and timeline so students know exactly what to build."
                : "The project mandate hasn't been added yet. Check back soon."}
            </p>
          </div>
          {isInstructor && (
            <Button size="sm" onClick={() => setOpen(true)} className="mt-1">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add mandate
            </Button>
          )}
        </div>

        <EditDialog
          open={open} onOpenChange={setOpen}
          form={form} setForm={setForm}
          onSave={handleSave} isPending={isPending}
        />
      </>
    );
  }

  // ── Populated view ─────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Left: content sections ── */}
        <div className="space-y-4">

          {mandate.projectDescription && (
            <SectionCard icon={FileText} title="Project Goal" isInstructor={isInstructor} onEdit={() => setOpen(true)}>
              <p className="text-sm text-foreground leading-relaxed">{mandate.projectDescription}</p>
            </SectionCard>
          )}

          {scopeItems.length > 0 && (
            <SectionCard icon={List} title="Scope" isInstructor={isInstructor} onEdit={() => setOpen(true)}>
              <BulletGrid items={scopeItems} />
            </SectionCard>
          )}

          {deliverableItems.length > 0 && (
            <SectionCard icon={ClipboardList} title="Expected Deliverables" isInstructor={isInstructor} onEdit={() => setOpen(true)}>
              <NumberedGrid items={deliverableItems} />
            </SectionCard>
          )}

          {/* Instructor prompt when some sections are empty */}
          {isInstructor && (!mandate.projectDescription || scopeItems.length === 0 || deliverableItems.length === 0) && (
            <button
              onClick={() => setOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors group"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" />
                {!mandate.projectDescription ? "Add project goal, scope and deliverables" : "Fill in missing sections"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* ── Right: stats + next steps ── */}
        <div className="space-y-4">

          {/* Project Overview */}
          {hasStats && (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
                <h3 className="text-sm font-semibold text-primary">Project Overview</h3>
                {isInstructor && (
                  <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="divide-y divide-border/50">
                {mandate.timelineWeeks && (
                  <StatRow
                    icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600"
                    label="Duration"
                    value={`${mandate.timelineWeeks} week${mandate.timelineWeeks !== 1 ? "s" : ""}`}
                    sub={mandate.timelineTolerance ? `± ${mandate.timelineTolerance}` : undefined}
                  />
                )}
                {mandate.startDate && (
                  <StatRow
                    icon={CalendarDays} iconBg="bg-blue-50" iconColor="text-blue-600"
                    label="Start Date" value={fmtDate(mandate.startDate)!}
                  />
                )}
                {mandate.endDate && (
                  <StatRow
                    icon={CalendarDays} iconBg="bg-blue-50" iconColor="text-blue-600"
                    label="End Date" value={fmtDate(mandate.endDate)!}
                  />
                )}
                {mandate.budget && (
                  <StatRow
                    icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600"
                    label="Budget" value={formatCurrency(mandate.budget) || mandate.budget}
                    sub={mandate.budgetTolerance ? `± ${formatCurrency(mandate.budgetTolerance) || mandate.budgetTolerance}` : undefined}
                  />
                )}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {(nextStepItems.length > 0 || isInstructor) && (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
                <h3 className="text-sm font-semibold text-primary">Next Steps</h3>
                {isInstructor && !editingNextSteps && (
                  <button
                    onClick={() => { setNextStepsValue(mandate?.nextSteps ?? ""); setEditingNextSteps(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="px-5 py-4">
                {editingNextSteps ? (
                  <div className="space-y-3">
                    <BulletTextarea
                      rows={5} value={nextStepsValue}
                      onChange={setNextStepsValue} autoFocus
                      placeholder="• Review project mandate&#10;• Join project chat&#10;• Complete first deliverable"
                    />
                    <p className="text-xs text-muted-foreground">Press Enter to add items</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNextSteps} disabled={isSavingNextSteps}>
                        {isSavingNextSteps && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setNextStepsValue(mandate?.nextSteps ?? "");
                        setEditingNextSteps(false);
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : nextStepItems.length > 0 ? (
                  <div className="space-y-2.5">
                    {nextStepItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <Circle className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => { setNextStepsValue("• "); setEditingNextSteps(true); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add next steps
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <EditDialog
        open={open} onOpenChange={setOpen}
        form={form} setForm={setForm}
        onSave={handleSave} isPending={isPending}
      />
    </>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({ icon: Icon, iconBg, iconColor, label, value, sub }: {
  icon: React.ElementType;
  iconBg: string; iconColor: string;
  label: string; value: string; sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", iconBg,
        iconBg === "bg-amber-50" ? "border-amber-100" :
        iconBg === "bg-blue-50"  ? "border-blue-100"  :
        iconBg === "bg-emerald-50" ? "border-emerald-100" : "border-border"
      )}>
        <Icon className={cn("w-3.5 h-3.5", iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ── Edit dialog (unchanged logic) ─────────────────────────────────────────────

type FormState = {
  projectDescription: string; timelineWeeks: string; timelineTolerance: string;
  startDate: string; endDate: string; budget: string; budgetTolerance: string;
  scope: string; keyDeliverables: string; nextSteps: string;
};

function EditDialog({ open, onOpenChange, form, setForm, onSave, isPending }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void; isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <CurrencyInput
                placeholder="50000"
                value={form.budget}
                onChange={(val) => setForm((f) => ({ ...f, budget: val }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget Tolerance</label>
              <CurrencyInput
                placeholder="5000"
                value={form.budgetTolerance}
                onChange={(val) => setForm((f) => ({ ...f, budgetTolerance: val }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scope</label>
            <p className="text-xs text-muted-foreground">Press Enter to add items — bullets are automatic</p>
            <BulletTextarea rows={4}
              placeholder={"• Online reservation system\n• Event booking\n• Chef profiles"}
              value={form.scope}
              onChange={(val) => setForm((f) => ({ ...f, scope: val }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected Key Deliverables</label>
            <p className="text-xs text-muted-foreground">Press Enter to add items — bullets are automatic</p>
            <BulletTextarea rows={6}
              placeholder={"• High Level Project Plan\n• Project Charter\n• Use Case Document\n• BRD\n• Testing Documents"}
              value={form.keyDeliverables}
              onChange={(val) => setForm((f) => ({ ...f, keyDeliverables: val }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next Steps</label>
            <p className="text-xs text-muted-foreground">Press Enter to add items — bullets are automatic</p>
            <BulletTextarea rows={3}
              placeholder={"• Review the project mandate\n• Join the project chat\n• Attend the kickoff session"}
              value={form.nextSteps}
              onChange={(val) => setForm((f) => ({ ...f, nextSteps: val }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={onSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Mandate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

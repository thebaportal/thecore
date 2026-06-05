"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, CheckCircle2, RotateCcw, Loader2, ChevronRight, Plus, Trash2, GripVertical } from "lucide-react";
import { unlockPhase, completePhase, reopenPhase, createPhase, createDeliverable, updatePhase, updateDeliverable, deleteDeliverable, deletePhase, reorderPhases } from "@/actions/phases";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Add Phase Button ─────────────────────────────────────────────────────────

export function AddPhaseButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createPhase(projectId, name);
        setName("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add phase
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">New phase</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setOpen(false); setError(null); }
        }}
        placeholder="Phase name…"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        disabled={isPending}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={isPending || !name.trim()}
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add phase"}
        </Button>
      </div>
    </div>
  );
}

// ─── Add Deliverable Form ─────────────────────────────────────────────────────

export function AddDeliverableForm({ phaseId }: { phaseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submissionKind, setSubmissionKind] = useState<"INDIVIDUAL" | "GROUP" | null>(null);
  const [requiresFileUpload, setRequiresFileUpload] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);

  function submit() {
    const title = titleRef.current?.value?.trim() ?? "";
    const description = instructionsRef.current?.value?.trim() ?? "";
    const dueDate = dueDateRef.current?.value ?? "";
    if (!title) return;
    startTransition(async () => {
      try {
        await createDeliverable(phaseId, { title, description, submissionKind: submissionKind ?? undefined, requiresFileUpload, dueDate: dueDate || undefined });
        if (titleRef.current) titleRef.current.value = "";
        if (instructionsRef.current) instructionsRef.current.value = "";
        if (dueDateRef.current) dueDateRef.current.value = "";
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
        <Plus className="w-3.5 h-3.5" />
        Add deliverable
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">New deliverable</p>
      <input ref={titleRef} autoFocus type="text" placeholder="Title…" defaultValue="" disabled={isPending}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setError(null); } }}
        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
      <textarea ref={instructionsRef} placeholder="Instructions (optional)…" defaultValue="" disabled={isPending} rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
      />
      <div className="flex items-center gap-3 flex-wrap">
        {/* Submission kind */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSubmissionKind(submissionKind === "INDIVIDUAL" ? null : "INDIVIDUAL")} className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors", submissionKind === "INDIVIDUAL" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>Individual submission</button>
          <button type="button" onClick={() => setSubmissionKind(submissionKind === "GROUP" ? null : "GROUP")} className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors", submissionKind === "GROUP" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>Group submission</button>
        </div>
        {/* File upload toggle */}
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={requiresFileUpload} onChange={(e) => setRequiresFileUpload(e.target.checked)} />
          File upload required
        </label>
        {/* Due date */}
        <input ref={dueDateRef} type="date" disabled={isPending}
          className="h-6 rounded border border-input bg-background px-2 text-[10px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-1.5 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }} disabled={isPending} className="h-6 text-xs px-2">Cancel</Button>
        <Button type="button" size="sm" onClick={submit} disabled={isPending} className="h-6 text-xs px-3">{isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}</Button>
      </div>
    </div>
  );
}

// ─── Deliverable row (direct-edit) ───────────────────────────────────────────

type LockedDeliverableItem = {
  id: string;
  title: string;
  submissionKind: "INDIVIDUAL" | "GROUP" | null;
  requiresFileUpload: boolean;
  dueDate: Date | string | null;
};

function DeliverableRow({ d, onChanged }: { d: LockedDeliverableItem; onChanged: () => void }) {
  const [title, setTitle] = useState(d.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [submissionKind, setSubmissionKind] = useState<"INDIVIDUAL" | "GROUP" | null>(d.submissionKind);
  const [requiresFileUpload, setRequiresFileUpload] = useState(d.requiresFileUpload);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function saveTitle() {
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === d.title) { setTitle(d.title); return; }
    startTransition(async () => { await updateDeliverable(d.id, { title: trimmed }); onChanged(); });
  }

  function toggleKind() {
    const next = submissionKind === "INDIVIDUAL" ? "GROUP" : submissionKind === "GROUP" ? null : "INDIVIDUAL";
    setSubmissionKind(next);
    startTransition(async () => { await updateDeliverable(d.id, { submissionKind: next }); onChanged(); });
  }

  function toggleFileUpload() {
    const next = !requiresFileUpload;
    setRequiresFileUpload(next);
    startTransition(async () => { await updateDeliverable(d.id, { requiresFileUpload: next }); onChanged(); });
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 text-xs px-0.5 py-1">
        <span className="flex-1 text-muted-foreground truncate">Delete "{d.title}"?</span>
        <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button type="button" onClick={() => startTransition(async () => { await deleteDeliverable(d.id); onChanged(); })} disabled={isPending} className="text-destructive font-medium hover:text-destructive/80 transition-colors">
          {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 text-xs px-0.5 py-0.5 rounded hover:bg-muted/30 transition-colors">
      {editingTitle ? (
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitle(d.title); } }}
          disabled={isPending} className="flex-1 bg-transparent border-b border-primary outline-none text-sm text-foreground min-w-0"
        />
      ) : (
        <span className="flex-1 truncate text-foreground cursor-text" onClick={() => setEditingTitle(true)}>{title}</span>
      )}
      <button type="button" onClick={toggleKind} disabled={isPending} title="Click to toggle" className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 transition-colors", submissionKind === "GROUP" ? "bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100" : submissionKind === "INDIVIDUAL" ? "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100" : "border-border text-muted-foreground/50 hover:text-muted-foreground")}>
        {submissionKind === "GROUP" ? "Group submission" : submissionKind === "INDIVIDUAL" ? "Individual submission" : "No type"}
      </button>
      <button type="button" onClick={toggleFileUpload} disabled={isPending} title="Click to toggle" className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 transition-colors", requiresFileUpload ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100" : "border-border text-muted-foreground/50 hover:text-muted-foreground")}>
        {requiresFileUpload ? "File upload" : "No upload"}
      </button>
      <button type="button" onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Locked phase row ─────────────────────────────────────────────────────────

type DragHandle = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

type LockedPhaseRowProps = {
  phase: {
    id: string;
    order: number;
    name: string;
    deliverables: LockedDeliverableItem[];
  };
  isInstructor: boolean;
  isLast: boolean;
  dragHandle?: DragHandle;
};

export function LockedPhaseRow({ phase, isInstructor, isLast, dragHandle }: LockedPhaseRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [phaseName, setPhaseName] = useState(phase.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickedKind, setPickedKind] = useState<"INDIVIDUAL" | "GROUP" | null>(null);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivDesc, setDelivDesc] = useState("");
  const [delivDate, setDelivDate] = useState("");
  const [delivFileUpload, setDelivFileUpload] = useState(false);
  const deliverableCount = phase.deliverables.length;

  function savePhaseName() {
    const trimmed = phaseName.trim();
    setEditingName(false);
    if (!trimmed || trimmed === phase.name) { setPhaseName(phase.name); return; }
    startTransition(async () => {
      try { await updatePhase(phase.id, { name: trimmed }); router.refresh(); }
      catch { setPhaseName(phase.name); }
    });
  }

  function handleUnlock() {
    startTransition(async () => {
      try { await unlockPhase(phase.id, startDate ? new Date(startDate) : undefined); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try { await deletePhase(phase.id); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  function handleAddDeliverable() {
    if (!delivTitle.trim()) return;
    startTransition(async () => {
      try {
        await createDeliverable(phase.id, {
          title: delivTitle.trim(),
          description: delivDesc.trim() || undefined,
          submissionKind: pickedKind ?? undefined,
          requiresFileUpload: delivFileUpload,
          dueDate: delivDate || undefined,
        });
        setDelivTitle("");
        setDelivDesc("");
        setDelivDate("");
        setPickedKind(null);
        setDelivFileUpload(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className={cn("transition-colors", !isLast && "border-b border-border/40")}>
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {dragHandle ? (
          <button
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors touch-none shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Lock className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground/40 shrink-0">Phase {phase.order}</span>
          {editingName ? (
            <input
              autoFocus
              value={phaseName}
              onChange={(e) => setPhaseName(e.target.value)}
              onBlur={savePhaseName}
              onKeyDown={(e) => { if (e.key === "Enter") savePhaseName(); if (e.key === "Escape") { setEditingName(false); setPhaseName(phase.name); } }}
              disabled={isPending}
              className="text-sm font-medium text-foreground bg-transparent border-b border-primary outline-none min-w-0 flex-1"
            />
          ) : (
            <span
              className={cn("text-sm text-muted-foreground/60 truncate", isInstructor && "cursor-text hover:text-foreground transition-colors")}
              onClick={() => isInstructor && setEditingName(true)}
              title={isInstructor ? "Click to rename" : undefined}
            >
              {phaseName}
            </span>
          )}
        </div>
        {deliverableCount > 0 && !expanded && (
          <span className="text-xs text-muted-foreground/40 shrink-0">
            {deliverableCount} deliverable{deliverableCount !== 1 ? "s" : ""}
          </span>
        )}
        {isInstructor && (
          <button
            onClick={() => { setExpanded((v) => !v); setError(null); setConfirmDelete(false); }}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            {expanded ? "Done" : <><span>Set up</span><ChevronRight className="w-3 h-3" /></>}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && isInstructor && (
        <div className="pb-4 px-4 space-y-3">

          {/* Submission */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Submission</p>
            {deliverableCount > 0 ? (
              <div className="space-y-0.5">
                {phase.deliverables.map((d) => (
                  <DeliverableRow key={d.id} d={d} onChanged={() => router.refresh()} />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  {(["INDIVIDUAL", "GROUP"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setPickedKind(pickedKind === kind ? null : kind)}
                      disabled={isPending}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50",
                        pickedKind === kind
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                      )}
                    >
                      {kind === "INDIVIDUAL" ? "Individual submission" : "Group submission"}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                    <input
                      autoFocus
                      type="text"
                      value={delivTitle}
                      onChange={(e) => setDelivTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddDeliverable(); }}
                      placeholder="Title…"
                      disabled={isPending}
                      className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                    <textarea
                      value={delivDesc}
                      onChange={(e) => setDelivDesc(e.target.value)}
                      placeholder="Instructions (optional)…"
                      disabled={isPending}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setDelivFileUpload((v) => !v)}
                        disabled={isPending}
                        className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors shrink-0", delivFileUpload ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100" : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground")}
                      >
                        {delivFileUpload ? "File upload on" : "File upload off"}
                      </button>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[10px] text-muted-foreground/40 shrink-0">Due</span>
                        <input
                          type="date"
                          value={delivDate}
                          onChange={(e) => setDelivDate(e.target.value)}
                          disabled={isPending}
                          className="h-7 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddDeliverable}
                        disabled={isPending || !delivTitle.trim()}
                        className="h-7 text-xs shrink-0"
                      >
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                </div>
              </div>
            )}
          </div>

          {/* Unlock + Delete */}
          <div className="pt-3 border-t border-border/40 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/40 shrink-0">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
                className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <Button type="button" size="sm" onClick={handleUnlock} disabled={isPending} className="h-7 text-xs gap-1 shrink-0">
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                Unlock phase
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              {confirmDelete ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Delete this phase?</span>
                  <button onClick={() => setConfirmDelete(false)} disabled={isPending} className="text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button onClick={handleDelete} disabled={isPending} className="text-destructive hover:text-destructive/80 font-medium transition-colors">
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Delete"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                  Delete phase
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortable locked phase list ───────────────────────────────────────────────

type SortablePhaseType = {
  id: string;
  order: number;
  name: string;
  deliverables: LockedDeliverableItem[];
};

function SortablePhaseItem({ phase, isLast }: { phase: SortablePhaseType; isLast: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        zIndex: isDragging ? 1 : 0,
      }}
    >
      <LockedPhaseRow
        phase={phase}
        isInstructor={true}
        isLast={isLast}
        dragHandle={{ attributes, listeners }}
      />
    </div>
  );
}

export function SortableLockedPhaseList({
  phases: initialPhases,
  projectId,
}: {
  phases: SortablePhaseType[];
  projectId: string;
}) {
  const router = useRouter();
  const [phases, setPhases] = useState(initialPhases);
  const [, startTransition] = useTransition();

  useEffect(() => { setPhases(initialPhases); }, [initialPhases]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(phases, oldIndex, newIndex);

    setPhases(reordered);
    startTransition(async () => {
      await reorderPhases(projectId, reordered.map((p) => p.id));
      router.refresh();
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          {phases.map((phase, i) => (
            <SortablePhaseItem key={phase.id} phase={phase} isLast={i === phases.length - 1} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Active phase footer controls ────────────────────────────────────────────

type PhaseFooterControlsProps = {
  phaseId: string;
  phaseName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  startedAt?: Date | string | null;
};

export function PhaseFooterControls({ phaseId, phaseName, status, startedAt }: PhaseFooterControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [startDateVal, setStartDateVal] = useState(
    startedAt ? new Date(startedAt).toISOString().split("T")[0] : ""
  );

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try { await action(); router.refresh(); setConfirming(false); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  function saveStartDate() {
    setEditingStartDate(false);
    startTransition(async () => {
      try {
        await updatePhase(phaseId, { startedAt: startDateVal ? new Date(startDateVal) : null });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try { await deletePhase(phaseId); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  return (
    <div className="pt-4 border-t border-border/50 space-y-3">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Start date */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 shrink-0">Start date</span>
        {editingStartDate ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="date"
              value={startDateVal}
              onChange={(e) => setStartDateVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveStartDate(); if (e.key === "Escape") setEditingStartDate(false); }}
              disabled={isPending}
              autoFocus
              className="h-6 flex-1 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button onClick={saveStartDate} disabled={isPending} className="text-xs text-primary font-medium hover:opacity-80 transition-opacity">Save</button>
            <button onClick={() => setEditingStartDate(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingStartDate(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {startDateVal
              ? new Date(startDateVal).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : <span className="italic opacity-50">Set start date</span>
            }
          </button>
        )}
      </div>

      {/* Complete / Reopen */}
      {status === "COMPLETED" ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Phase marked as complete</span>
          <button
            onClick={() => run(() => reopenPhase(phaseId))}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reopen
          </button>
        </div>
      ) : confirming ? (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">
            Mark <span className="font-medium">{phaseName}</span> as complete?
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>Cancel</Button>
            <Button type="button" size="sm" onClick={() => run(() => completePhase(phaseId))} disabled={isPending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirm
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-emerald-600 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mark phase complete
          </button>
        </div>
      )}

      {/* Delete */}
      <div className="flex justify-end">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Delete this phase?</span>
            <button onClick={() => setConfirmDelete(false)} disabled={isPending} className="text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={isPending} className="text-destructive font-medium hover:text-destructive/80 transition-colors">
              {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Delete"}
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
            Delete phase
          </button>
        )}
      </div>
    </div>
  );
}

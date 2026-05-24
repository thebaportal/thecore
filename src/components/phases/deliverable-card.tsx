"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, AlertCircle, Clock, Download, History, ChevronDown, ChevronUp, Users, User, Paperclip, Loader2, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { reviewDeliverable, reviewStudentSubmission, assignDeliverableReviewer } from "@/actions/deliverables";
import { updateDeliverable, deleteDeliverable } from "@/actions/phases";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliverableStatus = "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REVISION_NEEDED";

export type StudentSubmissionData = {
  id: string;
  status: DeliverableStatus;
  submittedAt: Date | string | null;
  reviewNote: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
  file: { id: string; name: string; url: string; size: number } | null;
  reviewedBy: { id: string; name: string } | null;
};

export type DeliverableCardData = {
  id: string;
  title: string;
  description: string | null;
  submissionKind: "INDIVIDUAL" | "GROUP" | null;
  requiresFileUpload: boolean;
  dueDate: Date | string | null;
  status: DeliverableStatus;
  submittedFile: { id: string; name: string; url: string; mimeType: string; size: number } | null;
  submittedBy: { id: string; name: string; avatarUrl: string | null } | null;
  submittedAt: Date | string | null;
  reviewedBy: { id: string; name: string } | null;
  assignedReviewer: { id: string; name: string } | null;
  reviewNote: string | null;
  versions: {
    id: string;
    versionNumber: number;
    uploadedAt: Date | string;
    note: string | null;
    file: { id: string; name: string; url: string; size: number } | null;
    uploadedBy: { id: string; name: string; avatarUrl: string | null };
  }[];
  studentSubmissions: StudentSubmissionData[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DescriptionBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bucket: { type: "ul" | "ol"; items: string[] } | null = null;

  function flush() {
    if (!bucket) return;
    const Tag = bucket.type;
    nodes.push(
      <Tag key={nodes.length} className={bucket.type === "ul" ? "list-disc list-inside space-y-0.5" : "list-decimal list-inside space-y-0.5"}>
        {bucket.items.map((item, i) => <li key={i}>{item}</li>)}
      </Tag>
    );
    bucket = null;
  }

  for (const raw of lines) {
    const ul = raw.match(/^[-*]\s+(.+)/);
    const ol = raw.match(/^\d+\.\s+(.*)/);
    if (ul) {
      if (bucket?.type === "ol") flush();
      if (!bucket) bucket = { type: "ul", items: [] };
      bucket.items.push(ul[1] ?? "");
    } else if (ol) {
      if (bucket?.type === "ul") flush();
      if (!bucket) bucket = { type: "ol", items: [] };
      bucket.items.push(ol[1] ?? "");
    } else {
      flush();
      if (raw.trim()) nodes.push(<p key={nodes.length}>{raw}</p>);
      else if (nodes.length > 0) nodes.push(<br key={nodes.length} />);
    }
  }
  flush();

  return <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">{nodes}</div>;
}

const STATUS_CONFIG: Record<DeliverableStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  NOT_SUBMITTED:   { label: "Not submitted",   cls: "text-muted-foreground bg-muted border-border/40",     icon: <Clock className="w-3 h-3" /> },
  SUBMITTED:       { label: "Submitted",        cls: "text-amber-600 bg-amber-50 border-amber-200",          icon: <Clock className="w-3 h-3" /> },
  UNDER_REVIEW:    { label: "Under review",     cls: "text-blue-600 bg-blue-50 border-blue-200",             icon: <Clock className="w-3 h-3" /> },
  APPROVED:        { label: "Approved",         cls: "text-emerald-600 bg-emerald-50 border-emerald-100",    icon: <Check className="w-3 h-3" /> },
  REVISION_NEEDED: { label: "Revision needed",  cls: "text-red-600 bg-red-50 border-red-200",               icon: <AlertCircle className="w-3 h-3" /> },
};

// ─── Version history ──────────────────────────────────────────────────────────

function VersionHistory({ versions }: { versions: DeliverableCardData["versions"] }) {
  const [open, setOpen] = useState(false);
  if (versions.length <= 1) return null;
  return (
    <div>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <History className="w-3.5 h-3.5" />
        {versions.length} versions
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 pl-5 border-l border-border/60">
          {versions.map((v) => (
            <div key={v.id} className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground/60 font-medium w-4 shrink-0">v{v.versionNumber}</span>
                {v.file ? (
                  <a href={v.file.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-foreground hover:text-primary transition-colors truncate">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{v.file.name}</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground italic">No file</span>
                )}
                <span className="text-muted-foreground/60 shrink-0 ml-auto">{v.uploadedBy.name} · {formatDate(v.uploadedAt)}</span>
              </div>
              {v.note && (
                <p className="text-xs text-muted-foreground/70 pl-6 italic">"{v.note}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File upload area ─────────────────────────────────────────────────────────

function FileUploadArea({ projectId, deliverableId, hasExisting, onComplete }: {
  projectId: string;
  deliverableId: string;
  hasExisting: boolean;
  onComplete: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("deliverableUploader", {
    onClientUploadComplete: () => { setError(null); setNote(""); onComplete(); },
    onUploadError: (err) => setError(err.message),
  });

  function handleFiles(files: File[]) {
    if (!files[0]) return;
    setError(null);
    void startUpload([files[0]], { projectId, deliverableId, note: note.trim() || undefined })?.catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Upload failed");
    });
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" className="hidden"
        accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.txt,.csv,.zip"
        onChange={(e) => handleFiles([...e.target.files ?? []])}
      />
      {hasExisting && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about your resubmission (optional)…"
          rows={2}
          disabled={isUploading}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
        />
      )}
      <button
        onClick={() => !isUploading && inputRef.current?.click()}
        disabled={isUploading}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors",
          isUploading
            ? "border-primary/30 bg-primary/5 text-primary cursor-wait"
            : "border-border/50 hover:border-primary/40 hover:bg-muted/40 text-muted-foreground hover:text-foreground cursor-pointer"
        )}
      >
        {isUploading
          ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Uploading…</>
          : <><Paperclip className="w-4 h-4 shrink-0" /> {hasExisting ? "Upload new version" : "Attach file"}</>
        }
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Instructor review panel ──────────────────────────────────────────────────

function ReviewPanel({ deliverableId, existingNote, onReviewed }: {
  deliverableId: string;
  existingNote: string | null;
  onReviewed: () => void;
}) {
  const [note, setNote] = useState(existingNote ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(decision: "APPROVE" | "REVISION_NEEDED") {
    startTransition(async () => {
      try { await reviewDeliverable(deliverableId, decision, note); onReviewed(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  return (
    <div className="pt-3 border-t border-border/50 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Facilitator review</p>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Feedback for the group (optional)…" className="h-20 text-sm resize-none" disabled={isPending} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => submit("REVISION_NEEDED")} disabled={isPending} className="text-red-600 border-red-200 hover:bg-red-50">
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Request revision
        </Button>
        <Button type="button" size="sm" onClick={() => submit("APPROVE")} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
        </Button>
      </div>
    </div>
  );
}

// ─── Individual submissions panel (instructor) ────────────────────────────────

const SUB_STATUS: Record<DeliverableStatus, { label: string; cls: string }> = {
  NOT_SUBMITTED:   { label: "Not submitted",  cls: "text-muted-foreground/50" },
  SUBMITTED:       { label: "Submitted",       cls: "text-amber-600 font-medium" },
  UNDER_REVIEW:    { label: "Under review",    cls: "text-blue-600 font-medium" },
  APPROVED:        { label: "Approved",        cls: "text-emerald-600 font-medium" },
  REVISION_NEEDED: { label: "Revision needed", cls: "text-red-600 font-medium" },
};

function IndividualSubmissionsPanel({
  deliverableId,
  submissions,
  projectMembers,
  onReviewed,
}: {
  deliverableId: string;
  submissions: StudentSubmissionData[];
  projectMembers: { id: string; name: string; avatarUrl: string | null }[];
  onReviewed: () => void;
}) {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const submissionMap = new Map(submissions.map((s) => [s.user.id, s]));
  const submitted = submissions.filter((s) => s.status !== "NOT_SUBMITTED").length;

  function openReview(subId: string, existingNote: string | null) {
    setReviewingId(subId);
    setNote(existingNote ?? "");
  }

  function submitReview(decision: "APPROVE" | "REVISION_NEEDED") {
    if (!reviewingId) return;
    const id = reviewingId;
    startTransition(async () => {
      await reviewStudentSubmission(id, decision, note);
      setReviewingId(null);
      setNote("");
      onReviewed();
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Submissions</p>
        <span className="text-[11px] text-muted-foreground">{submitted} / {projectMembers.length} submitted</span>
      </div>

      <div className="rounded-lg border border-border/50 divide-y divide-border/40 overflow-hidden">
        {projectMembers.map((member) => {
          const sub = submissionMap.get(member.id);
          const status = sub?.status ?? "NOT_SUBMITTED";
          const sc = SUB_STATUS[status];
          const isReviewing = reviewingId === sub?.id;

          return (
            <div key={member.id}>
              <div className="flex items-center gap-3 px-3 py-2 text-sm bg-card hover:bg-muted/30 transition-colors">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", status === "NOT_SUBMITTED" ? "bg-border" : status === "APPROVED" ? "bg-emerald-500" : status === "REVISION_NEEDED" ? "bg-red-400" : "bg-amber-400")} />
                <span className="flex-1 text-sm text-foreground truncate">{member.name}</span>
                <span className={cn("text-[11px] shrink-0", sc.cls)}>{sc.label}</span>
                {sub?.submittedAt && (
                  <span className="text-[11px] text-muted-foreground/50 shrink-0 hidden sm:block">{formatDate(sub.submittedAt)}</span>
                )}
                {sub?.file && (
                  <a href={sub.file.url} target="_blank" rel="noreferrer" title="Download" className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                {sub && (status === "SUBMITTED" || status === "UNDER_REVIEW") && !isReviewing && (
                  <button onClick={() => openReview(sub.id, sub.reviewNote)} className="shrink-0 text-[11px] text-primary hover:text-primary/70 font-medium transition-colors">
                    Review
                  </button>
                )}
              </div>

              {isReviewing && (
                <div className="px-3 py-2.5 bg-muted/30 border-t border-border/40 space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Feedback (optional)…"
                    rows={2}
                    disabled={isPending}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => setReviewingId(null)} disabled={isPending} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                    <button onClick={() => submitReview("REVISION_NEEDED")} disabled={isPending}
                      className="text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50">
                      {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Request revision"}
                    </button>
                    <button onClick={() => submitReview("APPROVE")} disabled={isPending}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50">
                      {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Approve"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function DeliverableCard({
  deliverable: d,
  projectId,
  isInstructor,
  currentUserId,
  projectMembers,
  orgAdmins,
}: {
  deliverable: DeliverableCardData;
  projectId: string;
  isInstructor: boolean;
  currentUserId: string;
  projectMembers: { id: string; name: string; avatarUrl: string | null }[];
  orgAdmins: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(d.title);
  const [editDesc, setEditDesc] = useState(d.description ?? "");
  const [editKind, setEditKind] = useState<"INDIVIDUAL" | "GROUP" | null>(d.submissionKind);
  const [editFileUpload, setEditFileUpload] = useState(d.requiresFileUpload);
  const [editDueDate, setEditDueDate] = useState(
    d.dueDate ? new Date(d.dueDate).toISOString().split("T")[0] : ""
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const config = STATUS_CONFIG[d.status];
  const isIndividual = d.submissionKind === "INDIVIDUAL";
  // For individual deliverables, find the current student's own submission
  const mySubmission = isIndividual
    ? d.studentSubmissions.find((s) => s.user.id === currentUserId) ?? null
    : null;
  const canSubmit = d.requiresFileUpload && !isInstructor &&
    (!isIndividual ? d.status !== "APPROVED" : mySubmission?.status !== "APPROVED");

  function openEdit() {
    setEditTitle(d.title);
    setEditDesc(d.description ?? "");
    setEditKind(d.submissionKind);
    setEditFileUpload(d.requiresFileUpload);
    setEditDueDate(d.dueDate ? new Date(d.dueDate).toISOString().split("T")[0] : "");
    setEditing(true);
  }

  function saveEdits() {
    startTransition(async () => {
      await updateDeliverable(d.id, {
        title: editTitle.trim() || d.title,
        description: editDesc.trim() || null,
        submissionKind: editKind,
        requiresFileUpload: editFileUpload,
        dueDate: editDueDate || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteDeliverable(d.id);
      router.refresh();
    });
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card p-5 space-y-4",
      d.status === "REVISION_NEEDED" && "border-red-200 bg-red-50/20",
      d.status === "APPROVED" && "border-emerald-100",
    )}>

      {/* Header */}
      {editing ? (
        <div className="space-y-2.5">
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
            disabled={isPending}
            className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {(["INDIVIDUAL", "GROUP"] as const).map((kind) => (
              <button key={kind} type="button" onClick={() => setEditKind(editKind === kind ? null : kind)} disabled={isPending}
                className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors disabled:opacity-50",
                  editKind === kind ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                )}>
                {kind === "INDIVIDUAL" ? "Individual submission" : "Group submission"}
              </button>
            ))}
            <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={isPending}
              className="h-6 rounded border border-input bg-background px-2 text-[10px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button type="button" onClick={() => setEditFileUpload(v => !v)} disabled={isPending}
              className={cn("px-2 py-0.5 rounded text-[10px] font-medium border transition-colors disabled:opacity-50",
                editFileUpload ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100" : "border-border text-muted-foreground/50 hover:text-muted-foreground"
              )}>
              {editFileUpload ? "File upload" : "No upload"}
            </button>
          </div>
          <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Instructions (optional)…"
            disabled={isPending} className="h-16 text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={isPending}>Cancel</Button>
            <Button type="button" size="sm" onClick={saveEdits} disabled={isPending || !editTitle.trim()}>
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{d.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {d.submissionKind && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {d.submissionKind === "GROUP"
                    ? <><Users className="w-3 h-3" /> Group submission</>
                    : <><User className="w-3 h-3" /> Individual submission</>
                  }
                </span>
              )}
              {d.dueDate && (
                <span className="text-[11px] text-muted-foreground">{d.submissionKind ? "· " : ""}Due {formatDate(d.dueDate)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {d.requiresFileUpload && !isIndividual && (
              <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold", config.cls)}>
                {config.icon} {config.label}
              </span>
            )}
            {isIndividual && !isInstructor && mySubmission && (
              <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold", STATUS_CONFIG[mySubmission.status].cls)}>
                {STATUS_CONFIG[mySubmission.status].icon} {STATUS_CONFIG[mySubmission.status].label}
              </span>
            )}
            {isInstructor && (
              <>
                <button onClick={openEdit} title="Edit" disabled={isPending}
                  className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-50">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(true)} title="Delete" disabled={isPending}
                  className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assign reviewer (instructor only, non-individual) */}
      {isInstructor && !editing && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 shrink-0">Reviewer</span>
          <select
            defaultValue={d.assignedReviewer?.id ?? ""}
            disabled={isPending}
            onChange={(e) => {
              const val = e.target.value;
              startTransition(async () => {
                await assignDeliverableReviewer(d.id, val || null);
                router.refresh();
              });
            }}
            className="flex-1 h-6 rounded border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {orgAdmins.map((admin) => (
              <option key={admin.id} value={admin.id}>{admin.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs">
          <span className="flex-1 text-red-700">Delete this deliverable?</span>
          <button onClick={() => setConfirmDelete(false)} disabled={isPending} className="text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={isPending} className="font-medium text-red-600 hover:text-red-700 transition-colors">
            {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Delete"}
          </button>
        </div>
      )}

      {/* Instructions */}
      {!editing && d.description && (
        <DescriptionBody text={d.description} />
      )}

      {/* INDIVIDUAL deliverable — instructor sees roster table, student sees own row */}
      {isIndividual && isInstructor && (
        <IndividualSubmissionsPanel
          deliverableId={d.id}
          submissions={d.studentSubmissions}
          projectMembers={projectMembers}
          onReviewed={() => router.refresh()}
        />
      )}

      {isIndividual && !isInstructor && (
        <>
          {mySubmission?.file && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{mySubmission.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(mySubmission.file.size)}{mySubmission.submittedAt && ` · ${formatDate(mySubmission.submittedAt)}`}</p>
              </div>
              <a href={mySubmission.file.url} target="_blank" rel="noreferrer" title="Download" className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
          {mySubmission && (mySubmission.status === "APPROVED" || mySubmission.status === "REVISION_NEEDED") && mySubmission.reviewedBy && (
            <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs", mySubmission.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              {mySubmission.status === "APPROVED" ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <div>
                <span className="font-medium">{mySubmission.status === "APPROVED" ? "Approved" : "Revision requested"}</span>
                {" by "}{mySubmission.reviewedBy.name}
                {mySubmission.reviewNote && <p className="mt-0.5 opacity-80">{mySubmission.reviewNote}</p>}
              </div>
            </div>
          )}
        </>
      )}

      {/* GROUP / no-kind deliverable — single submission flow */}
      {!isIndividual && (
        <>
          {d.submittedFile && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.submittedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(d.submittedFile.size)}
                  {d.submittedBy && ` · ${d.submittedBy.name}`}
                  {d.submittedAt && ` · ${formatDate(d.submittedAt)}`}
                </p>
              </div>
              <a href={d.submittedFile.url} target="_blank" rel="noreferrer" title="Download" className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
          {(d.status === "APPROVED" || d.status === "REVISION_NEEDED") && d.reviewedBy && (
            <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs", d.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              {d.status === "APPROVED" ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <div>
                <span className="font-medium">{d.status === "APPROVED" ? "Approved" : "Revision requested"}</span>
                {" by "}{d.reviewedBy.name}
                {d.reviewNote && <p className="mt-0.5 opacity-80">{d.reviewNote}</p>}
              </div>
            </div>
          )}
          <VersionHistory versions={d.versions} />
          {isInstructor && d.requiresFileUpload && (d.status === "SUBMITTED" || d.status === "UNDER_REVIEW") && (
            <ReviewPanel deliverableId={d.id} existingNote={d.reviewNote} onReviewed={() => router.refresh()} />
          )}
        </>
      )}

      {/* File upload area */}
      {canSubmit && (
        <FileUploadArea
          projectId={projectId}
          deliverableId={d.id}
          hasExisting={isIndividual ? !!mySubmission?.file : !!d.submittedFile}
          onComplete={() => router.refresh()}
        />
      )}
    </div>
  );
}

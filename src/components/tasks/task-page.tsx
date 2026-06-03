"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Flag, User, Loader2, Send, Trash2,
  CheckSquare, Square, Plus, Pencil, Link2, Check, MessageCircle,
} from "lucide-react";
import { updateTask, createSubtask, deleteTask } from "@/actions/tasks";
import { addTaskComment, deleteTaskComment } from "@/actions/comments";
import { createPing, sendMessage } from "@/actions/pings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/shared/rich-text";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "TODO",        label: "To Do",       cls: "bg-gray-100 text-gray-600"       },
  { value: "IN_PROGRESS", label: "In Progress",  cls: "bg-blue-100 text-blue-700"       },
  { value: "IN_REVIEW",   label: "In Review",    cls: "bg-violet-100 text-violet-700"   },
  { value: "DONE",        label: "Done",         cls: "bg-emerald-100 text-emerald-700" },
] as const;

const PRIORITIES = [
  { value: "URGENT",      label: "Urgent", cls: "text-red-500"    },
  { value: "HIGH",        label: "High",   cls: "text-orange-500" },
  { value: "MEDIUM",      label: "Medium", cls: "text-amber-600"  },
  { value: "LOW",         label: "Low",    cls: "text-blue-500"   },
  { value: "NO_PRIORITY", label: "None",   cls: "text-gray-400"   },
] as const;

type Subtask = {
  id: string; title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
};

type Comment = {
  id: string; body: string; createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

type Task = {
  id: string; title: string; description: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
  dueDate: Date | null; createdAt: Date;
  project: { id: string; name: string; color: string | null; iconEmoji: string | null };
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  creator: { id: string; name: string; avatarUrl: string | null };
  subtasks: Subtask[];
  comments: Comment[];
  _count: { subtasks: number };
};

type Member = { id: string; name: string; avatarUrl: string | null };

type PingMessage = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

export function TaskPage({
  task: initial,
  members = [],
  currentUserId,
  existingPingId,
  initialPingMessages = [],
}: {
  task: Task;
  members?: Member[];
  currentUserId?: string;
  existingPingId?: string | null;
  initialPingMessages?: PingMessage[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Task fields
  const [title, setTitle] = useState(initial.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [status, setStatus] = useState(initial.status);
  const [priority, setPriority] = useState(initial.priority);
  const [assigneeId, setAssigneeId] = useState(initial.assignee?.id ?? null);
  const [dueDate, setDueDate] = useState(
    initial.dueDate ? format(new Date(initial.dueDate), "yyyy-MM-dd") : ""
  );
  const [description, setDescription] = useState(initial.description ?? "");
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial.subtasks);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtaskPending, startSubtaskTransition] = useTransition();

  // Comments
  const [comments, setComments] = useState<Comment[]>(initial.comments);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, startCommentTransition] = useTransition();

  // Copy link
  const [copied, setCopied] = useState(false);

  // Discussion ping
  const [pingId, setPingId] = useState(existingPingId ?? null);
  const [pingMessages, setPingMessages] = useState<PingMessage[]>(initialPingMessages);
  const [pingInput, setPingInput] = useState("");
  const [sendingMessage, startSendTransition] = useTransition();
  const [creatingPing, startPingTransition] = useTransition();

  const titleRef = useRef<HTMLInputElement>(null);

  const currentAssignee = members.find((m) => m.id === assigneeId) ?? initial.assignee ?? null;
  const color = initial.project.color ?? "#1E3A8A";

  function update(field: string, value: unknown) {
    startTransition(async () => {
      await updateTask(initial.id, { projectId: initial.project.id, [field]: value });
    });
  }

  function handleStatus(val: typeof status) {
    setStatus(val);
    update("status", val);
  }

  function handlePriority(val: typeof priority) {
    setPriority(val);
    update("priority", val);
  }

  function saveTitle() {
    if (!title.trim() || title === initial.title) { setEditingTitle(false); return; }
    setEditingTitle(false);
    update("title", title.trim());
  }

  function saveDescription() {
    if (description === (initial.description ?? "")) return;
    update("description", description || null);
  }

  function handleDueDate(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setDueDate(val);
    startTransition(async () => {
      await updateTask(initial.id, { projectId: initial.project.id, dueDate: val ? new Date(val) : null });
    });
  }

  function handleAssignee(id: string | null) {
    setAssigneeId(id);
    setAssigneeOpen(false);
    update("assigneeId", id);
  }

  function addSubtask() {
    if (!subtaskInput.trim()) return;
    const t = subtaskInput.trim();
    setSubtaskInput("");
    startSubtaskTransition(async () => {
      const sub = await createSubtask({ parentTaskId: initial.id, title: t, projectId: initial.project.id });
      setSubtasks((prev) => [...prev, sub as Subtask]);
    });
  }

  function toggleSubtask(sub: Subtask) {
    const next = sub.status === "DONE" ? "TODO" : "DONE";
    setSubtasks((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: next } : s));
    startSubtaskTransition(async () => {
      await updateTask(sub.id, { projectId: initial.project.id, status: next });
    });
  }

  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    startSubtaskTransition(async () => { await deleteTask(id); });
  }

  function submitComment() {
    if (!commentBody.trim()) return;
    const body = commentBody.trim();
    setCommentBody("");
    startCommentTransition(async () => {
      const c = await addTaskComment({ taskId: initial.id, body });
      setComments((prev) => [...prev, c as Comment]);
    });
  }

  function handleDeleteComment(id: string) {
    startCommentTransition(async () => {
      await deleteTaskComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function handleDelete() {
    if (!confirm("Delete this task permanently?")) return;
    router.push(`/projects/${initial.project.id}/tasks`);
    deleteTask(initial.id);
  }

  function startDiscussion() {
    startPingTransition(async () => {
      const result = await createPing({
        type: "CONTEXTUAL",
        projectId: initial.project.id,
        taskId: initial.id,
        participantIds: [],
      });
      setPingId(result.ping.id);
    });
  }

  function sendPingMessage() {
    if (!pingId || !pingInput.trim()) return;
    const body = pingInput.trim();
    setPingInput("");
    startSendTransition(async () => {
      const result = await sendMessage({ pingId, body, attachments: [] });
      setPingMessages((prev) => [...prev, result.message as PingMessage]);
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const doneSubs = subtasks.filter((s) => s.status === "DONE").length;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${initial.project.id}`} className="hover:text-foreground transition-colors">
          {initial.project.name}
        </Link>
        <span>/</span>
        <Link href={`/projects/${initial.project.id}/tasks`} className="hover:text-foreground transition-colors">
          Tasks
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px]">{initial.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link
          href={`/projects/${initial.project.id}/tasks`}
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") { setTitle(initial.title); setEditingTitle(false); }
              }}
              className="w-full text-2xl font-semibold text-foreground bg-muted rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="group flex items-center gap-2 text-left w-full"
            >
              <h1 className="text-2xl font-semibold text-foreground tracking-tight leading-snug">
                {title}
              </h1>
              <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity mt-0.5 shrink-0" />
            </button>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Created by {initial.creator.name.split(" ")[0]} · {formatDistanceToNow(new Date(initial.createdAt), { addSuffix: true })}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left: main content */}
        <div className="space-y-6">
          {/* Status */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatus(s.value)}
                    disabled={isPending}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      status === s.value
                        ? s.cls + " ring-2 ring-offset-1 ring-current/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Flag className="w-3 h-3" /> Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => handlePriority(p.value)}
                    disabled={isPending}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      priority === p.value
                        ? "border-current/30 bg-current/5 " + p.cls
                        : "border-border text-muted-foreground hover:border-border/80"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Description */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="Add a description..."
              className="resize-none min-h-[120px] text-sm"
              disabled={isPending}
            />
          </section>

          {/* Subtasks */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Subtasks {subtasks.length > 0 && `(${doneSubs}/${subtasks.length})`}
              </label>
              {subtasks.length > 0 && (
                <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(doneSubs / subtasks.length) * 100}%` }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-0.5">
              {subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 group py-1.5 px-1 rounded-lg hover:bg-muted/40 -mx-1">
                  <button
                    onClick={() => toggleSubtask(sub)}
                    disabled={subtaskPending}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {sub.status === "DONE"
                      ? <CheckSquare className="w-4 h-4 text-emerald-500" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                  <span className={cn(
                    "flex-1 text-sm",
                    sub.status === "DONE" ? "line-through text-muted-foreground" : "text-foreground"
                  )}>
                    {sub.title}
                  </span>
                  <button
                    onClick={() => removeSubtask(sub.id)}
                    disabled={subtaskPending}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSubtask(); }
                  if (e.key === "Escape") setSubtaskInput("");
                }}
                placeholder="Add a subtask…"
                disabled={subtaskPending}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-60 py-1"
              />
              {subtaskInput.trim() && (
                <button onClick={addSubtask} disabled={subtaskPending} className="text-xs text-primary font-medium hover:text-primary/80 shrink-0">
                  Add
                </button>
              )}
            </div>
          </section>

          {/* Comments */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-4">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Comments {comments.length > 0 && `(${comments.length})`}
            </label>

            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-primary">{c.author.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-foreground">{c.author.name.split(" ")[0]}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words leading-relaxed"><RichText text={c.body} /></p>
                    </div>
                    {currentUserId === c.author.id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        disabled={commentPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-border/50">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); }
                }}
                placeholder="Write a comment… (⌘Enter to send)"
                className="resize-none h-20 text-sm flex-1"
                disabled={commentPending}
              />
              <Button
                size="icon"
                className="h-20 w-10 shrink-0"
                onClick={submitComment}
                disabled={!commentBody.trim() || commentPending}
              >
                {commentPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </section>
        </div>

        {/* Right: meta */}
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4 space-y-4">
            {/* Project */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Project</label>
              <Link
                href={`/projects/${initial.project.id}`}
                className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
              >
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0" style={{ backgroundColor: `${color}20` }}>
                  {initial.project.iconEmoji ?? <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                </div>
                {initial.project.name}
              </Link>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <User className="w-3 h-3" /> Assignee
              </label>
              <div className="relative">
                <button
                  onClick={() => setAssigneeOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  {currentAssignee ? (
                    <>
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                        {currentAssignee.name[0]?.toUpperCase()}
                      </div>
                      <span>{currentAssignee.name.split(" ")[0]}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </button>
                {assigneeOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAssigneeOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden">
                      <button
                        onClick={() => handleAssignee(null)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                      >Unassign</button>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleAssignee(m.id)}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/60 transition-colors",
                            assigneeId === m.id ? "text-primary font-medium" : "text-foreground"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                            {m.name[0]?.toUpperCase()}
                          </div>
                          {m.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={handleDueDate}
                disabled={isPending}
                className="block text-sm text-foreground bg-transparent border-0 p-0 outline-none cursor-pointer hover:text-primary transition-colors [color-scheme:light]"
              />
              {!dueDate && <span className="text-sm text-muted-foreground block">No date</span>}
            </div>
          </section>

          {/* Discussion — inline ping thread */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3" /> Discussion
              </label>
              {pingId && (
                <Link href={`/inbox/${pingId}`} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                  Full thread →
                </Link>
              )}
            </div>

            {!pingId ? (
              <button
                onClick={startDiscussion}
                disabled={creatingPing}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-60"
              >
                {creatingPing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Start a discussion
              </button>
            ) : (
              <>
                {/* Messages */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {pingMessages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No messages yet. Start the conversation.</p>
                  ) : (
                    pingMessages.map((m) => (
                      <div key={m.id} className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[8px] font-semibold text-primary">{m.author.name[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-foreground">{m.author.name.split(" ")[0]} </span>
                          <span className="text-xs text-foreground break-words">{m.body}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Send input */}
                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <input
                    type="text"
                    value={pingInput}
                    onChange={(e) => setPingInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendPingMessage(); } }}
                    placeholder="Reply…"
                    disabled={sendingMessage}
                    className="flex-1 text-xs bg-muted rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  <button
                    onClick={sendPingMessage}
                    disabled={!pingInput.trim() || sendingMessage}
                    className="shrink-0 text-primary disabled:opacity-40 hover:text-primary/80 transition-colors"
                  >
                    {sendingMessage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </>
            )}
          </section>

          {isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

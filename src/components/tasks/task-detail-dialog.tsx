"use client";

import { useTransition, useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Flag, User, X, Send, Trash2, CheckSquare, Square, Plus, Pencil, ExternalLink } from "lucide-react";
import Link from "next/link";
import { updateTask, getSubtasks, createSubtask, deleteTask } from "@/actions/tasks";
import { getTaskComments, addTaskComment, deleteTaskComment } from "@/actions/comments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "TODO",        label: "To Do",       cls: "bg-gray-100 text-gray-600"        },
  { value: "IN_PROGRESS", label: "In Progress",  cls: "bg-blue-100 text-blue-700"        },
  { value: "IN_REVIEW",   label: "In Review",    cls: "bg-violet-100 text-violet-700"    },
  { value: "DONE",        label: "Done",         cls: "bg-emerald-100 text-emerald-700"  },
] as const;

const PRIORITIES = [
  { value: "URGENT",      label: "Urgent",  cls: "text-red-500"    },
  { value: "HIGH",        label: "High",    cls: "text-orange-500" },
  { value: "MEDIUM",      label: "Medium",  cls: "text-amber-600"  },
  { value: "LOW",         label: "Low",     cls: "text-blue-500"   },
  { value: "NO_PRIORITY", label: "None",    cls: "text-gray-400"   },
] as const;

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
  dueDate: Date | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { subtasks: number };
};

type Member = { id: string; name: string; avatarUrl: string | null };

type Subtask = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
};

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

function CommentAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-6 h-6 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <span className="text-[9px] font-semibold text-primary">{name[0]?.toUpperCase()}</span>
    </div>
  );
}

export function TaskDetailDialog({
  task,
  projectId,
  members,
  currentUserId,
  onClose,
}: {
  task: Task | null;
  projectId: string;
  members?: Member[];
  currentUserId?: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task?.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""
  );
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtaskPending, startSubtaskTransition] = useTransition();
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, startCommentTransition] = useTransition();
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setEditingTitle(false);
    setDescription(task?.description ?? "");
    setDueDate(task?.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
    setAssigneeOpen(false);
    setCommentBody("");
    setSubtaskInput("");

    if (task?.id) {
      setSubtasksLoading(true);
      setCommentsLoading(true);
      Promise.all([
        getSubtasks(task.id),
        getTaskComments(task.id),
      ]).then(([subs, cmts]) => {
        setSubtasks(subs as Subtask[]);
        setComments(cmts as Comment[]);
      }).finally(() => {
        setSubtasksLoading(false);
        setCommentsLoading(false);
      });
    } else {
      setSubtasks([]);
      setComments([]);
    }
  }, [task?.id]);

  function update(field: string, value: unknown) {
    if (!task) return;
    startTransition(async () => {
      await updateTask(task.id, { projectId, [field]: value });
    });
  }

  function saveTitle() {
    if (!task || !title.trim() || title === task.title) { setEditingTitle(false); return; }
    setEditingTitle(false);
    update("title", title.trim());
  }

  function saveDescription() {
    if (!task || description === (task.description ?? "")) return;
    update("description", description || null);
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setDueDate(val);
    if (!task) return;
    startTransition(async () => {
      await updateTask(task.id, { projectId, dueDate: val ? new Date(val) : null });
    });
  }

  function handleAssignee(memberId: string | null) {
    setAssigneeOpen(false);
    update("assigneeId", memberId);
  }

  function addSubtask() {
    if (!task || !subtaskInput.trim()) return;
    const title = subtaskInput.trim();
    setSubtaskInput("");
    startSubtaskTransition(async () => {
      const sub = await createSubtask({ parentTaskId: task.id, title, projectId });
      setSubtasks((prev) => [...prev, sub as Subtask]);
    });
  }

  function toggleSubtask(sub: Subtask) {
    const nextStatus = sub.status === "DONE" ? "TODO" : "DONE";
    setSubtasks((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: nextStatus } : s));
    startSubtaskTransition(async () => {
      await updateTask(sub.id, { projectId, status: nextStatus });
    });
  }

  function removeSubtask(subId: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== subId));
    startSubtaskTransition(async () => {
      await deleteTask(subId);
    });
  }

  function submitComment() {
    if (!task || !commentBody.trim()) return;
    const body = commentBody.trim();
    setCommentBody("");
    startCommentTransition(async () => {
      const comment = await addTaskComment({ taskId: task.id, body });
      setComments((prev) => [...prev, comment as Comment]);
    });
  }

  function handleDeleteComment(commentId: string) {
    startCommentTransition(async () => {
      await deleteTaskComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  }

  const currentAssignee = members?.find((m) => m.id === task?.assignee?.id) ?? task?.assignee ?? null;

  return (
    <Dialog open={task !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        {task && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-2 pr-8">
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle();
                      if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); }
                    }}
                    className="flex-1 text-base font-semibold text-foreground bg-muted rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 leading-snug"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 0); }}
                    className="flex-1 text-left text-base font-semibold text-foreground leading-snug hover:text-primary transition-colors group flex items-center gap-1.5"
                  >
                    <DialogTitle className="text-base font-semibold leading-snug">{title || task.title}</DialogTitle>
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 mt-0.5" />
                  </button>
                )}
                <Link
                  href={`/tasks/${task.id}`}
                  className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                  title="Open full page"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => {
                    if (!confirm("Delete this task?")) return;
                    onClose();
                    deleteTask(task.id);
                  }}
                  className="shrink-0 mt-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-5 mt-1 pr-1">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => update("status", s.value)}
                      disabled={isPending}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                        task.status === s.value
                          ? s.cls + " ring-2 ring-offset-1 ring-current/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Flag className="w-3 h-3" /> Priority
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => update("priority", p.value)}
                      disabled={isPending}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                        task.priority === p.value
                          ? "border-current/30 bg-current/5 " + p.cls
                          : "border-border text-muted-foreground hover:border-border/80"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee + Due date */}
              <div className="grid grid-cols-2 gap-3 py-3 border-t border-border">
                {/* Assignee */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <User className="w-3 h-3" /> Assignee
                  </label>
                  {members && members.length > 0 ? (
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
                            <span className="truncate max-w-[100px]">{currentAssignee.name.split(" ")[0]}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </button>

                      {assigneeOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setAssigneeOpen(false)} />
                          <div className="absolute top-full left-0 mt-1 z-50 w-44 rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden">
                            <button
                              onClick={() => handleAssignee(null)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
                            >
                              <X className="w-3.5 h-3.5 shrink-0" />
                              Unassign
                            </button>
                            {members.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => handleAssignee(m.id)}
                                className={cn(
                                  "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/60 transition-colors",
                                  task.assignee?.id === m.id ? "text-primary font-medium" : "text-foreground"
                                )}
                              >
                                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                                  {m.name[0]?.toUpperCase()}
                                </div>
                                <span className="truncate">{m.name.split(" ")[0]}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">
                      {currentAssignee?.name ?? <span className="text-muted-foreground">Unassigned</span>}
                    </p>
                  )}
                </div>

                {/* Due date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={handleDueDateChange}
                    disabled={isPending}
                    className="block text-sm text-foreground bg-transparent border-0 p-0 outline-none cursor-pointer hover:text-primary transition-colors disabled:opacity-60 [color-scheme:light]"
                  />
                  {!dueDate && <span className="text-sm text-muted-foreground -mt-1 block">No date</span>}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  placeholder="Add a description..."
                  className="resize-none h-20 text-sm"
                  disabled={isPending}
                />
              </div>

              {isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                </div>
              )}

              {/* Subtasks */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Subtasks {subtasks.length > 0 && `(${subtasks.filter(s => s.status === "DONE").length}/${subtasks.length})`}
                  </h4>
                </div>

                {subtasksLoading ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {subtasks.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 group py-1 rounded-lg hover:bg-muted/40 px-1 -mx-1">
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
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline subtask input */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addSubtask(); }
                      if (e.key === "Escape") setSubtaskInput("");
                    }}
                    placeholder="Add a subtask…"
                    disabled={subtaskPending}
                    className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  {subtaskInput.trim() && (
                    <button
                      onClick={addSubtask}
                      disabled={subtaskPending}
                      className="text-xs text-primary font-medium hover:text-primary/80 transition-colors shrink-0"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div className="border-t border-border pt-4 space-y-3">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Comments {comments.length > 0 && `(${comments.length})`}
                </h4>

                {commentsLoading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5 group">
                        <CommentAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-foreground">{c.author.name.split(" ")[0]}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                            {c.body}
                          </p>
                        </div>
                        {currentUserId === c.author.id && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            disabled={commentPending}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 text-muted-foreground hover:text-red-500"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* New comment input */}
                <div className="flex gap-2 pt-1">
                  <Textarea
                    ref={commentInputRef}
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitComment();
                      }
                    }}
                    placeholder="Write a comment… (⌘Enter to send)"
                    className="resize-none h-16 text-xs flex-1"
                    disabled={commentPending}
                  />
                  <Button
                    size="icon"
                    className="h-16 w-9 shrink-0"
                    onClick={submitComment}
                    disabled={!commentBody.trim() || commentPending}
                  >
                    {commentPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

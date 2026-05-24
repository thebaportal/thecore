"use client";

import Link from "next/link";
import { format, isAfter } from "date-fns";
import {
  CheckCircle2, Circle, ChevronRight, Pin,
  Calendar, MessageSquare, Lock, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliverableStatus = "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REVISION_NEEDED";
type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NO_PRIORITY";
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";

type Phase = {
  id: string;
  name: string;
  order: number;
  dueDate: Date | null;
  isLocked: boolean;
  deliverables: { id: string; status: DeliverableStatus }[];
};

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  _count: { subtasks: number };
};

type Post = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  pinnedAt: Date | null;
  author: { name: string; avatarUrl: string | null };
  _count: { replies: number };
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  color: string | null;
  iconEmoji: string | null;
  targetDate: Date | null;
  mandate: { projectDescription: string | null } | null;
  _count: { tasks: number; members: number };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<Priority, string> = {
  URGENT:      "bg-red-500",
  HIGH:        "bg-orange-500",
  MEDIUM:      "bg-amber-400",
  LOW:         "bg-blue-400",
  NO_PRIORITY: "bg-gray-300",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  URGENT: "Urgent", HIGH: "High", MEDIUM: "Medium", LOW: "Low", NO_PRIORITY: "",
};

const STATUS_BADGE: Record<Project["status"], { label: string; className: string }> = {
  ACTIVE:    { label: "Active",    className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ON_HOLD:   { label: "On Hold",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ARCHIVED:  { label: "Archived",  className: "bg-gray-50 text-gray-500 border-gray-200" },
};

function phaseProgress(phase: Phase) {
  const total = phase.deliverables.length;
  if (total === 0) return { approved: 0, total: 0, pct: 0 };
  const approved = phase.deliverables.filter((d) => d.status === "APPROVED").length;
  return { approved, total, pct: Math.round((approved / total) * 100) };
}

function activePhaseIndex(phases: Phase[]): number {
  const idx = phases.findIndex((phase) => {
    if (phase.isLocked) return false;
    const { approved, total } = phaseProgress(phase);
    return approved < total || total === 0;
  });
  return idx === -1 ? phases.length - 1 : idx;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return format(new Date(date), "MMM d");
}

// ─── Section card wrapper ──────────────────────────────────────────────────────

function Panel({
  title, href, linkLabel, children, className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
        {href && linkLabel && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {linkLabel}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </div>
  );
}

// ─── Phases panel ─────────────────────────────────────────────────────────────

function PhasesPanel({ phases, projectId }: { phases: Phase[]; projectId: string }) {
  const activeIdx = activePhaseIndex(phases);

  if (phases.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">No phases set up yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {phases.map((phase, idx) => {
        const { approved, total, pct } = phaseProgress(phase);
        const isCurrent = idx === activeIdx && !phase.isLocked;
        const isDone = !phase.isLocked && total > 0 && approved === total;

        return (
          <Link
            key={phase.id}
            href={`/projects/${projectId}/phases`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group",
              isCurrent
                ? "bg-primary/5 hover:bg-primary/10"
                : "hover:bg-muted/60"
            )}
          >
            {/* Status icon */}
            <div className="shrink-0 mt-0.5">
              {phase.isLocked ? (
                <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
              ) : isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Circle className={cn("w-3.5 h-3.5", isCurrent ? "text-primary" : "text-muted-foreground/40")} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  "text-xs font-medium truncate",
                  phase.isLocked ? "text-muted-foreground/50"
                    : isCurrent ? "text-primary"
                    : isDone ? "text-foreground"
                    : "text-muted-foreground"
                )}>
                  {phase.name}
                </p>
                {isCurrent && (
                  <span className="shrink-0 text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    Current
                  </span>
                )}
              </div>
              {total > 0 && !phase.isLocked && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isDone ? "bg-emerald-500" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {approved}/{total}
                  </span>
                </div>
              )}
            </div>

            {phase.dueDate && !phase.isLocked && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {format(new Date(phase.dueDate), "MMM d")}
              </span>
            )}

            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 transition-colors" />
          </Link>
        );
      })}
    </div>
  );
}

// ─── Tasks panel ──────────────────────────────────────────────────────────────

function TasksPanel({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
        <p className="text-sm font-medium text-foreground">All caught up!</p>
        <p className="text-xs text-muted-foreground mt-0.5">No open tasks assigned to you.</p>
      </div>
    );
  }

  const visible = tasks.slice(0, 6);
  const overflow = tasks.length - visible.length;

  return (
    <div className="space-y-1">
      {visible.map((task) => {
        const overdue = task.dueDate && isAfter(new Date(), new Date(task.dueDate));
        return (
          <Link
            key={task.id}
            href={`/projects/${projectId}/tasks`}
            className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
          >
            <Circle className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-snug truncate group-hover:text-primary transition-colors">
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[task.priority])} />
                {PRIORITY_LABEL[task.priority] && (
                  <span className="text-[10px] text-muted-foreground">{PRIORITY_LABEL[task.priority]}</span>
                )}
                {task.dueDate && (
                  <span className={cn("flex items-center gap-0.5 text-[10px]", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                    <Calendar className="w-2.5 h-2.5" />
                    {format(new Date(task.dueDate), "MMM d")}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
      {overflow > 0 && (
        <Link
          href={`/projects/${projectId}/tasks`}
          className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors py-2"
        >
          +{overflow} more task{overflow !== 1 ? "s" : ""}
        </Link>
      )}
    </div>
  );
}

// ─── Posts panel ──────────────────────────────────────────────────────────────

function PostsPanel({ posts, projectId }: { posts: Post[]; projectId: string }) {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">No posts yet.</p>
    );
  }

  return (
    <div className="space-y-1">
      {posts.map((post, idx) => (
        <div key={post.id}>
          <Link
            href={`/projects/${projectId}/posts`}
            className="block px-2 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
          >
            <div className="flex items-start gap-2">
              {post.pinnedAt && <Pin className="w-2.5 h-2.5 text-primary shrink-0 mt-1" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-snug">
                  {post.title}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                  {post.body.replace(/<[^>]*>/g, "").slice(0, 100)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{post.author.name}</span>
                  <span className="text-muted-foreground/30 text-[10px]">·</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
                  {post._count.replies > 0 && (
                    <>
                      <span className="text-muted-foreground/30 text-[10px]">·</span>
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {post._count.replies}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
          {idx < posts.length - 1 && <div className="border-b border-border/50 mx-2" />}
        </div>
      ))}
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  messages, projectId, currentUserId,
}: {
  messages: ChatMessage[];
  projectId: string;
  currentUserId: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No messages yet.</p>
        <Link
          href={`/projects/${projectId}/messages`}
          className="mt-3 text-xs text-primary hover:underline"
        >
          Start the conversation →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const isMe = msg.author.id === currentUserId;
        return (
          <div key={msg.id} className={cn("flex items-start gap-2", isMe && "flex-row-reverse")}>
            <div
              className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0"
              title={msg.author.name}
            >
              {msg.author.name[0]?.toUpperCase()}
            </div>
            <div className={cn("max-w-[80%]", isMe && "items-end flex flex-col")}>
              <div className={cn(
                "px-3 py-2 rounded-2xl text-xs leading-relaxed",
                isMe
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              )}>
                {msg.body}
              </div>
              <div className={cn("flex items-center gap-1 mt-0.5", isMe && "flex-row-reverse")}>
                <span className="text-[9px] text-muted-foreground">{!isMe && `${msg.author.name.split(" ")[0]} · `}{timeAgo(msg.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function StudentDashboard({
  userName,
  currentUserId,
  project,
  phases,
  myTasks,
  posts,
  chatMessages,
  chatPingId,
}: {
  userName: string;
  currentUserId: string;
  project: Project;
  phases: Phase[];
  myTasks: Task[];
  posts: Post[];
  chatMessages: ChatMessage[];
  chatPingId: string | null;
}) {
  const color = project.color ?? "#1E3A8A";
  const badge = STATUS_BADGE[project.status];
  const firstName = userName.split(" ")[0];
  const totalPhaseDone = phases.filter((p) => {
    const { approved, total } = phaseProgress(p);
    return !p.isLocked && total > 0 && approved === total;
  }).length;
  const activePhasesCount = phases.filter((p) => !p.isLocked).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        {/* Project icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          {project.iconEmoji ?? <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-0.5">Welcome back, {firstName}</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight truncate">
            {project.name}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border",
              badge.className
            )}>
              {badge.label}
            </span>
            {activePhasesCount > 0 && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {totalPhaseDone}/{activePhasesCount} phases complete
                </span>
              </>
            )}
            {project.targetDate && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Due {format(new Date(project.targetDate), "MMM d, yyyy")}
                </span>
              </>
            )}
          </div>
        </div>

        <Link
          href={`/projects/${project.id}/phases`}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 px-3 py-2 rounded-lg transition-colors"
        >
          Open Project
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Top row: Phases + Tasks ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel
          title="Project Journey"
          href={`/projects/${project.id}/phases`}
          linkLabel="View phases"
        >
          <PhasesPanel phases={phases} projectId={project.id} />
        </Panel>

        <Panel
          title="My To-Dos"
          href={`/projects/${project.id}/tasks`}
          linkLabel="View all"
        >
          <TasksPanel tasks={myTasks} projectId={project.id} />
        </Panel>
      </div>

      {/* ── Bottom row: Posts + Chat ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel
          title="Posts"
          href={`/projects/${project.id}/posts`}
          linkLabel="View all"
        >
          <PostsPanel posts={posts} projectId={project.id} />
        </Panel>

        <Panel
          title="Chat"
          href={`/projects/${project.id}/messages`}
          linkLabel="Open chat"
        >
          <ChatPanel
            messages={chatMessages}
            projectId={project.id}
            currentUserId={currentUserId}
          />
        </Panel>
      </div>
    </div>
  );
}

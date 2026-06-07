import type { Metadata } from "next";
import Link from "next/link";
import { format, differenceInDays, formatDistanceToNow, isToday, isTomorrow, isPast } from "date-fns";
import {
  ArrowRight, RotateCcw, Check, Clock,
  MessageSquare, AlertCircle, Upload, CalendarDays,
  Users, Settings2, Layers, Plus, FileText,
  CheckCircle2, BookOpen,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCohortDashboardData } from "@/actions/cohort-dashboard";
import { getStudentDashboardData } from "@/actions/student-dashboard";
import type { ProjectCard } from "@/actions/cohort-dashboard";
import type { StudentDashboardData } from "@/actions/student-dashboard";
import { AIBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { Greeting } from "@/components/dashboard/greeting";
import { DashboardDate } from "@/components/dashboard/dashboard-date";
import { DeliverableTracker } from "@/components/dashboard/deliverable-tracker";
import { SessionManager } from "@/components/dashboard/session-manager";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

// ── Student home ──────────────────────────────────────────────────────────────

function greeting(name: string) {
  const h = new Date().getHours();
  const salutation = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${salutation}, ${name.split(" ")[0]}`;
}

function DeliverableStatusRow({ title, status, dueDate }: {
  title: string; status: string; dueDate: Date | null;
}) {
  const cfg =
    status === "APPROVED"        ? { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", label: "Approved" } :
    status === "REVISION_NEEDED" ? { icon: RotateCcw,    color: "text-red-600",     bg: "bg-red-100",     label: "Revision needed" } :
    status === "SUBMITTED" || status === "UNDER_REVIEW"
                                 ? { icon: Clock,        color: "text-amber-600",   bg: "bg-amber-100",   label: "Awaiting review" } :
                                   { icon: Clock,        color: "text-muted-foreground", bg: "bg-muted", label: dueDate ? `Due ${format(new Date(dueDate), "MMM d")}` : "Not submitted" };

  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", cfg.bg)}>
        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
      </div>
      <span className="flex-1 text-sm text-foreground truncate">{title}</span>
      <span className={cn("text-xs font-medium shrink-0", cfg.color)}>{cfg.label}</span>
    </div>
  );
}

function StudentHome({ data }: { data: StudentDashboardData }) {
  const { project, projectId, totalPhases, completedPhases, currentPhase, myDeliverables } = data;
  const pct = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
  const nextSession = data.upcomingSessions[0] ?? null;

  const orgName = data.org.displayName ?? data.org.name;
  const orgLogo = data.org.logoUrl && !data.org.logoUrl.includes("clerk") ? data.org.logoUrl : null;
  const brandColor = project.color ?? "#1E3A8A";

  function sessionLabel(dt: Date) {
    if (isToday(new Date(dt))) return "Today";
    if (isTomorrow(new Date(dt))) return "Tomorrow";
    const d = differenceInDays(new Date(dt), new Date());
    return d <= 7 ? `In ${d} days` : format(new Date(dt), "EEE, MMM d");
  }

  return (
    <div className="space-y-5 pb-16">

      {/* Grand hero — two-tone: white org identity top, navy project bottom */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-border/40">

        {/* ── White org identity section — balanced two-column ── */}
        <div className="bg-white px-6 sm:px-8 py-5">
          <div className="flex items-center gap-5 sm:gap-8">
            {/* Logo — left */}
            <div className="shrink-0">
              {orgLogo ? (
                <img
                  src={orgLogo}
                  alt={orgName}
                  className="h-11 sm:h-14 w-auto max-w-[220px] object-contain"
                />
              ) : (
                <p className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "#1E3A8A" }}>
                  {orgName}
                </p>
              )}
            </div>

            {/* Vertical divider */}
            <div className="hidden sm:block w-px self-stretch bg-gray-200 shrink-0" />

            {/* Greeting — right */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                Your workspace
              </p>
              <p className="text-lg sm:text-xl font-bold text-gray-800 leading-tight truncate">
                {greeting(data.user.name)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{orgName}</p>
            </div>
          </div>
        </div>

        {/* ── Amber gradient divider ── */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />

        {/* ── Navy project section ── */}
        <div style={{ background: "linear-gradient(135deg, #0f2160 0%, #1E3A8A 60%, #2563eb 100%)" }}>
          <div className="px-4 sm:px-6 pt-5 pb-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">
                  {project.name}
                </h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">
                    {project.status}
                  </span>
                  {project.targetDate && (
                    <span className="text-white/50 text-xs">
                      Due {format(new Date(project.targetDate), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/projects/${projectId}`}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors"
              >
                My Project <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Phase progress */}
          <div className="px-4 sm:px-6 pb-5 pt-3">
            <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
              <span>{currentPhase?.name ?? (totalPhases > 0 ? "No active phase yet" : "No phases configured")}</span>
              {totalPhases > 0 && (
                <span className="tabular-nums font-medium text-white/80">{completedPhases}/{totalPhases} phases</span>
              )}
            </div>
            {totalPhases > 0 && (
              <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main two-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Left — primary content */}
        <div className="xl:col-span-3 space-y-5">

          {/* Current phase deliverables */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {currentPhase ? currentPhase.name : "Current Phase"}
                </h2>
                {currentPhase && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Phase {currentPhase.order} of {totalPhases}
                  </p>
                )}
              </div>
              <Link
                href={`/projects/${projectId}/phases`}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                View phases <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="px-5 py-1">
              {!currentPhase ? (
                <p className="text-sm text-muted-foreground py-4">
                  No phase has been unlocked yet. Check back after your next session.
                </p>
              ) : myDeliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No deliverables in this phase yet.</p>
              ) : (
                myDeliverables.map((d) => (
                  <DeliverableStatusRow key={d.id} title={d.title} status={d.status} dueDate={d.dueDate} />
                ))
              )}
            </div>
          </div>

          {/* Latest posts */}
          {data.latestPosts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Latest Posts</h2>
                </div>
                <Link
                  href={`/projects/${projectId}/posts`}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  All posts <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-border/50">
                {data.latestPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/projects/${projectId}/posts`}
                    className="block px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {post.authorName.split(" ")[0]} · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — sidebar */}
        <div className="xl:col-span-2 space-y-5">

          {/* Next session — amber accent */}
          {nextSession ? (
            <div className="rounded-2xl overflow-hidden border border-amber-200">
              <div className="h-1 bg-amber-400" />
              <div className="px-5 py-4 bg-amber-50/60">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Next Session</p>
                <p className="text-xl font-bold text-foreground">
                  {format(new Date(nextSession.datetime), "EEEE, MMM d")}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(nextSession.datetime), "h:mm a")} · {nextSession.title}
                </p>
                <p className="text-xs text-amber-600 font-medium mt-1.5">
                  {sessionLabel(nextSession.datetime)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Next Session</h2>
              </div>
              <p className="text-xs text-muted-foreground">No sessions scheduled yet.</p>
            </div>
          )}

          {/* Team */}
          {data.teamMembers.length > 0 && (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Your Team</h2>
                </div>
                <Link
                  href={`/projects/${projectId}/members`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {data.teamMembers.length} members
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 text-xs text-foreground">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-card" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-card"
                        style={{ backgroundColor: brandColor }}
                      >
                        {m.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{m.name.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent chat */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Project Chat</h2>
              </div>
              <Link
                href={`/projects/${projectId}/messages`}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                Open <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.chatMessages.length === 0 ? (
              <div className="px-5 py-4">
                <p className="text-xs text-muted-foreground">No messages yet. Start the conversation.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {data.chatMessages.map((m) => (
                  <Link
                    key={m.id}
                    href={`/projects/${projectId}/messages`}
                    className="flex items-start gap-2.5 px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {m.authorAvatar ? (
                      <img src={m.authorAvatar} alt={m.authorName} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: brandColor }}
                      >
                        {m.authorName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{m.authorName.split(" ")[0]}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatDistanceToNow(new Date(m.createdAt), { addSuffix: false })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {m.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 70)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Mandate",   href: `/projects/${projectId}/mandate`,  icon: BookOpen },
              { label: "Files",     href: `/projects/${projectId}/files`,     icon: Upload },
              { label: "To-dos",    href: `/projects/${projectId}/tasks`,     icon: Check },
              { label: "Team",      href: `/projects/${projectId}/members`,   icon: Users },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card hover:border-foreground/20 hover:bg-muted/30 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phase progress bar ────────────────────────────────────────────────────────

function PhaseProgressBar({ completed, total, currentName }: {
  completed: number;
  total: number;
  currentName: string | null;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const label =
    total === 0        ? "No phases configured" :
    completed === total && total > 0 ? "All phases complete" :
    currentName        ? currentName :
                         "Not started";

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        {total > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
            {completed}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Projects grid row ─────────────────────────────────────────────────────────

function ProjectRow({ p }: { p: ProjectCard }) {
  const now = new Date();
  const daysLeft = p.nextDueDate ? differenceInDays(new Date(p.nextDueDate), now) : null;

  return (
    <Link
      href={`/projects/${p.id}`}
      className="flex items-center gap-4 px-5 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors group"
    >
      {/* Icon + name */}
      <div className="flex items-center gap-2.5 w-[180px] shrink-0 min-w-0">
        {p.iconEmoji ? (
          <span className="text-lg leading-none shrink-0">{p.iconEmoji}</span>
        ) : (
          <div
            className="w-7 h-7 rounded-lg shrink-0"
            style={{ backgroundColor: `${p.color ?? "#1E3A8A"}20` }}
          />
        )}
        <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <PhaseProgressBar
          completed={p.completedPhases}
          total={p.totalPhases}
          currentName={p.currentPhaseName}
        />
      </div>

      {/* Students */}
      <div className="w-16 shrink-0 text-right">
        <span className="text-sm tabular-nums text-muted-foreground">{p.studentCount}</span>
        <span className="text-xs text-muted-foreground/50 ml-1 hidden md:inline">
          {p.studentCount === 1 ? "student" : "students"}
        </span>
      </div>

      {/* Awaiting review */}
      {p.awaitingReview > 0 ? (
        <div className="w-20 shrink-0 text-right hidden lg:block">
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md tabular-nums">
            {p.awaitingReview} review
          </span>
        </div>
      ) : (
        <div className="w-20 shrink-0 hidden lg:block" />
      )}

      {/* Next due */}
      <div className="w-20 shrink-0 text-right">
        {p.nextDueDate ? (
          <span className={cn(
            "text-sm tabular-nums font-medium",
            daysLeft !== null && daysLeft < 0  ? "text-red-600" :
            daysLeft !== null && daysLeft <= 3  ? "text-amber-600" :
            "text-foreground"
          )}>
            {format(new Date(p.nextDueDate), "MMM d")}
          </span>
        ) : (
          <span className="text-muted-foreground/30 text-sm">—</span>
        )}
      </div>

      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
    </Link>
  );
}

// ── Team roster (empty-state) ─────────────────────────────────────────────────

function TeamRoster({ students }: {
  students: { id: string; name: string; avatarUrl: string | null }[]
}) {
  if (students.length === 0) return (
    <p className="text-sm text-muted-foreground py-4">No students assigned yet.</p>
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {students.map((s) => (
        <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card">
          {s.avatarUrl
            ? <img src={s.avatarUrl} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            : <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                {s.name[0]?.toUpperCase()}
              </div>
          }
          <p className="text-xs font-medium text-foreground truncate">{s.name.split(" ")[0]}</p>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { orgRole } = await auth();

  // ── Student home ──────────────────────────────────────────────────────────
  if (orgRole === "org:member") {
    const studentData = await getStudentDashboardData();
    if (!studentData) {
      return (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
        </div>
      );
    }
    return <StudentHome data={studentData} />;
  }

  const data = await getCohortDashboardData();

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
      </div>
    );
  }

  const {
    user, orgName, allProjects, totalStudents,
    project, phases, currentPhase, studentMembers,
    deliverableTracker, awaitingReview, studentsWithNoSubmissions,
    upcomingSessions, recentSubmissions, recentPings, unreadPingCount,
  } = data;

  const now = new Date();
  const totalPhases        = phases.length;
  const completedCount     = phases.filter((p) => p.status === "COMPLETED").length;
  const phasesConfigured   = totalPhases > 0;
  const totalAwaitingReview = allProjects.reduce((s, p) => s + p.awaitingReview, 0);

  const daysLeft = currentPhase?.dueDate
    ? differenceInDays(new Date(currentPhase.dueDate), now)
    : null;

  const pendingReviewTotal     = awaitingReview.reduce((s, d) => s + d.count, 0);
  const needsAttentionCount    = awaitingReview.length + studentsWithNoSubmissions.length;

  const briefingInput = {
    userName: user.name.split(" ")[0] ?? user.name,
    orgName,
    overdueTasks: [],
    dueTodayTasks: [],
    atRiskProjects: [],
    unreadPings: unreadPingCount,
    isAdminView: true,
    activeProjects: allProjects.length,
    activeProjectNames: allProjects.map((p) => p.name),
    pendingReviews: totalAwaitingReview,
    overdueTaskCount: 0,
    activePhaseSummary: currentPhase ? [{
      projectName: project.name,
      phaseName: currentPhase.name,
      submitted: deliverableTracker.reduce((s, d) => s + d.submitted + d.approved + d.needsRevision, 0),
      revisionNeeded: deliverableTracker.reduce((s, d) => s + d.needsRevision, 0),
      notSubmitted: deliverableTracker.reduce((s, d) => s + d.notSubmitted, 0),
      daysLeft,
    }] : [],
  };

  return (
    <div className="space-y-6 pb-16">

      {/* Greeting */}
      <div>
        <p className="text-xs text-muted-foreground">
          <DashboardDate orgName={orgName} />
        </p>
        <h1 className="text-lg font-semibold text-foreground mt-0.5">
          <Greeting name={user.name} />
        </h1>
      </div>

      {/* Org snapshot — compact text stats */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-sm">
        <span className="font-semibold text-foreground">{orgName}</span>
        <span className="text-border">·</span>
        <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-semibold text-foreground">{allProjects.length}</span>
          {" "}active project{allProjects.length !== 1 ? "s" : ""}
        </Link>
        <span className="text-border">·</span>
        <Link href="/team" className="text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-semibold text-foreground">{totalStudents}</span>
          {" "}student{totalStudents !== 1 ? "s" : ""}
        </Link>
        {totalAwaitingReview > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-amber-600">{totalAwaitingReview}</span>
              {" "}awaiting review
            </span>
          </>
        )}
        {unreadPingCount > 0 && (
          <>
            <span className="text-border">·</span>
            <Link href="/inbox" className="text-muted-foreground hover:text-foreground transition-colors">
              <span className="font-semibold text-primary">{unreadPingCount}</span>
              {" "}unread
            </Link>
          </>
        )}
      </div>

      {/* All Projects grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-border/50 bg-muted/20">
          <span className="w-[180px] shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Project
          </span>
          <span className="flex-1 min-w-0 hidden sm:block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Progress
          </span>
          <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Students
          </span>
          <span className="w-20 shrink-0 hidden lg:block text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Review
          </span>
          <span className="w-20 shrink-0 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Next due
          </span>
          <span className="w-3.5 shrink-0" />
        </div>

        {allProjects.map((p) => (
          <ProjectRow key={p.id} p={p} />
        ))}

        {/* New project CTA */}
        <div className="px-5 py-3 bg-muted/10">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New project
          </Link>
        </div>
      </div>

      {/* ── Two-column detailed section ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Left — operational detail for focused project */}
        <div className="xl:col-span-3 space-y-5">

          {/* Focus label when multiple projects exist */}
          {allProjects.length > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Detail view for{" "}
                <Link href={`/projects/${project.id}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                  {project.name}
                </Link>
              </p>
              <Link href={`/projects/${project.id}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                Open project <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {phasesConfigured ? (
            <>
              {/* Deliverable tracker */}
              {currentPhase && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Deliverable tracker</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentPhase.name} — click a row to see per-student status
                      </p>
                    </div>
                    <Link
                      href={`/projects/${project.id}/phases`}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      Full view <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <DeliverableTracker deliverables={deliverableTracker} projectId={project.id} />
                </section>
              )}

              {/* Needs attention */}
              {needsAttentionCount > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Needs attention
                  </h2>
                  <div className="space-y-2">
                    {awaitingReview.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                        <div className="px-4 py-2 border-b border-amber-200/60">
                          <p className="text-xs font-semibold text-amber-800">Awaiting your review</p>
                        </div>
                        {awaitingReview.map((d) => (
                          <Link key={d.id} href={`/projects/${project.id}/phases`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/80 transition-colors">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="flex-1 text-sm text-foreground truncate">{d.title}</span>
                            <span className="text-xs font-semibold text-amber-700 shrink-0">
                              {d.count} {d.count === 1 ? "submission" : "submissions"}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          </Link>
                        ))}
                      </div>
                    )}
                    {studentsWithNoSubmissions.length > 0 && (
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-4 py-2 border-b border-border/60 bg-muted/30">
                          <p className="text-xs font-semibold text-muted-foreground">
                            No submissions yet — {currentPhase?.name}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 px-4 py-3">
                          {studentsWithNoSubmissions.map((s) => (
                            <div key={s.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 text-xs font-medium text-foreground">
                              {s.avatarUrl
                                ? <img src={s.avatarUrl} alt={s.name} className="w-4 h-4 rounded-full object-cover" />
                                : <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                                    {s.name[0]?.toUpperCase()}
                                  </div>
                              }
                              {s.name.split(" ")[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Recent submissions */}
              {recentSubmissions.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">Recent submissions</h2>
                    <Link href={`/projects/${project.id}/phases`}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                      All phases <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
                    {recentSubmissions.map((s) => (
                      <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          s.status === "APPROVED"        ? "bg-emerald-100 text-emerald-600" :
                          s.status === "REVISION_NEEDED" ? "bg-red-100 text-red-600" :
                                                           "bg-amber-100 text-amber-600"
                        )}>
                          {s.status === "APPROVED"        ? <Check className="w-3.5 h-3.5" /> :
                           s.status === "REVISION_NEEDED" ? <RotateCcw className="w-3.5 h-3.5" /> :
                                                            <Upload className="w-3.5 h-3.5" />}
                        </div>
                        <p className="flex-1 text-sm text-foreground leading-snug">
                          <span className="font-medium">{s.userName.split(" ")[0]}</span>
                          {" "}<span className="text-muted-foreground">
                            {s.status === "APPROVED"        ? "approved" :
                             s.status === "REVISION_NEEDED" ? "needs revision on" : "submitted"}{" "}
                            &ldquo;{s.deliverableTitle}&rdquo;
                          </span>
                        </p>
                        {s.submittedAt && (
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums mt-0.5">
                            {formatDistanceToNow(new Date(s.submittedAt), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              {/* Empty state: phases not configured */}
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No phases configured</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Add phases and deliverables to unlock the tracker, submission status, and needs-attention alerts.
                  </p>
                </div>
                <Link
                  href={`/projects/${project.id}/phases`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Set up phases
                </Link>
              </div>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    Cohort team
                  </h2>
                  <Link href={`/projects/${project.id}/members`}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                    Manage <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <TeamRoster students={studentMembers} />
              </section>

              {recentPings.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
                    <Link href="/inbox" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                      All <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {recentPings.slice(0, 5).map((ping) => {
                      const lastMsg  = ping.messages[0];
                      const other    = ping.participants.find((p) => p.user.id !== user.id);
                      const name     = ping.type === "DIRECT"
                        ? (other?.user.name ?? "Direct Message")
                        : ping.project?.name ?? ping.title ?? "Conversation";
                      const me       = ping.participants.find((p) => p.user.id === user.id);
                      const isUnread = !!lastMsg && (!me?.lastReadAt || new Date(lastMsg.createdAt) > new Date(me.lastReadAt));
                      return (
                        <Link key={ping.id} href={`/inbox/${ping.id}`}
                          className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                              {name[0]?.toUpperCase()}
                            </div>
                            {isUnread && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm truncate", isUnread ? "font-semibold" : "font-medium")}>{name}</p>
                            {lastMsg && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {lastMsg.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 60)}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {formatDistanceToNow(new Date(ping.updatedAt), { addSuffix: false })}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right — context */}
        <div className="xl:col-span-2 space-y-5">

          {/* Upcoming sessions */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Upcoming sessions</h2>
            </div>
            <SessionManager sessions={upcomingSessions} projectId={project.id} />
          </section>

          {/* Conversations */}
          {phasesConfigured && recentPings.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Conversations
                    {unreadPingCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {unreadPingCount}
                      </span>
                    )}
                  </h2>
                </div>
                <Link href="/inbox" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                  All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {recentPings.slice(0, 4).map((ping) => {
                  const lastMsg  = ping.messages[0];
                  const other    = ping.participants.find((p) => p.user.id !== user.id);
                  const name     = ping.type === "DIRECT"
                    ? (other?.user.name ?? "Direct Message")
                    : ping.project?.name ?? ping.title ?? "Conversation";
                  const me       = ping.participants.find((p) => p.user.id === user.id);
                  const isUnread = !!lastMsg && (!me?.lastReadAt || new Date(lastMsg.createdAt) > new Date(me.lastReadAt));
                  return (
                    <Link key={ping.id} href={`/inbox/${ping.id}`}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {name[0]?.toUpperCase()}
                        </div>
                        {isUnread && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", isUnread ? "font-semibold" : "font-medium")}>{name}</p>
                        {lastMsg && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {lastMsg.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 60)}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {formatDistanceToNow(new Date(ping.updatedAt), { addSuffix: false })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* AI Briefing */}
          <AIBriefingCard input={briefingInput} />
        </div>
      </div>
    </div>
  );
}

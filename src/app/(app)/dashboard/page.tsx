import type { Metadata } from "next";
import Link from "next/link";
import {
  format, differenceInDays, formatDistanceToNow,
  isToday, isTomorrow,
} from "date-fns";
import {
  ArrowRight, RotateCcw, Check, Clock,
  MessageSquare, AlertCircle, Upload, CalendarDays,
  Users, Layers, Plus, FileText,
  CheckCircle2, BookOpen, Megaphone,
  FolderKanban, ClipboardCheck, Zap, UserPlus, Activity,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCohortDashboardData } from "@/actions/cohort-dashboard";
import { getStudentDashboardData } from "@/actions/student-dashboard";
import type { CohortDashboardData, ProjectCard } from "@/actions/cohort-dashboard";
import type { StudentDashboardData } from "@/actions/student-dashboard";
import { Greeting } from "@/components/dashboard/greeting";
import { DashboardDate } from "@/components/dashboard/dashboard-date";
import { DeliverableTracker } from "@/components/dashboard/deliverable-tracker";
import { SessionManager } from "@/components/dashboard/session-manager";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

// ─── Shared constants ─────────────────────────────────────────────────────────

const NAVY = "#1E3A8A";
const GOLD = "#F59E0B";

// ── Student home ──────────────────────────────────────────────────────────────

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
  const brandColor = project.color ?? data.org.brandColor ?? "#1E3A8A";
  const orgName = data.org.displayName ?? data.org.name;
  const watermark = orgName[0]?.toUpperCase() ?? "";

  function sessionLabel(dt: Date) {
    if (isToday(new Date(dt))) return "Today";
    if (isTomorrow(new Date(dt))) return "Tomorrow";
    const d = differenceInDays(new Date(dt), new Date());
    return d <= 7 ? `In ${d} days` : format(new Date(dt), "EEE, MMM d");
  }

  return (
    <div className="space-y-5 pb-16">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-md">
        <div className="h-[5px]" style={{ backgroundColor: "#FFC400" }} />
        <div
          className="relative overflow-hidden px-5 sm:px-7 pt-5 pb-5"
          style={{ background: "linear-gradient(135deg, #0f2160 0%, #1E3A8A 60%, #2563eb 100%)" }}
        >
          <span
            className="absolute right-3 bottom-0 text-[130px] font-black leading-none select-none pointer-events-none"
            style={{ color: "rgba(255,255,255,0.05)" }}
            aria-hidden
          >
            {watermark}
          </span>
          <p className="text-white/50 text-sm mb-3 relative">
            <Greeting name={data.user.name} />
          </p>
          <div className="flex items-start justify-between gap-3 relative">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-tight">
                {project.name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: "#FFC400", color: "#78350f" }}
                >
                  {project.status}
                </span>
                {project.targetDate && (
                  <span className="text-white/50 text-xs">
                    Due {format(new Date(project.targetDate), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              <p className="text-white/40 text-xs mt-2">
                {currentPhase?.name ?? "No active phase yet"}
              </p>
            </div>
            <Link
              href={`/projects/${projectId}`}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors"
            >
              My Project <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex items-center gap-3 mt-4 relative">
            {totalPhases > 0 ? (
              <>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: "#FFC400" }}
                    />
                  </div>
                </div>
                <span className="text-white/60 text-xs tabular-nums shrink-0">
                  {completedPhases}/{totalPhases} phases
                </span>
              </>
            ) : (
              <span className="text-white/30 text-xs">No phases configured</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        <div className="xl:col-span-3">
          <div className="rounded-2xl border border-border bg-card overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  {currentPhase ? currentPhase.name : "Current Phase"}
                </h2>
                {currentPhase && (
                  <span className="text-xs text-muted-foreground/60">
                    · Phase {currentPhase.order} of {totalPhases}
                  </span>
                )}
              </div>
              <Link
                href={`/projects/${projectId}/phases`}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                View phases <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {!currentPhase ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-20 rounded-lg border-2 border-border bg-muted/20 flex flex-col justify-start pt-2.5 px-2.5 gap-1.5 mx-auto">
                    <div className="h-1.5 rounded-full bg-muted-foreground/25 w-full" />
                    <div className="h-1.5 rounded-full bg-muted-foreground/20 w-3/4" />
                    <div className="h-1.5 rounded-full bg-muted-foreground/15 w-5/6" />
                    <div className="h-1.5 rounded-full bg-muted-foreground/10 w-2/3" />
                    <div className="h-1.5 rounded-full bg-muted-foreground/10 w-4/5" />
                  </div>
                  <div className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1.5">No phase has been unlocked yet.</p>
                <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">Check back after your next session.</p>
              </div>
            ) : myDeliverables.length === 0 ? (
              <div className="flex items-center justify-center px-6 py-12">
                <p className="text-sm text-muted-foreground">No deliverables in this phase yet.</p>
              </div>
            ) : (
              <div className="px-5 py-1">
                {myDeliverables.map((d) => (
                  <DeliverableStatusRow key={d.id} title={d.title} status={d.status} dueDate={d.dueDate} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          {nextSession ? (
            <div className="rounded-2xl overflow-hidden border border-amber-200">
              <div className="h-1 bg-amber-400" />
              <div className="px-5 py-4 bg-amber-50/60">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Next Session</p>
                <p className="text-xl font-bold text-foreground">{format(new Date(nextSession.datetime), "EEEE, MMM d")}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(nextSession.datetime), "h:mm a")} · {nextSession.title}
                </p>
                <p className="text-xs text-amber-600 font-medium mt-1.5">{sessionLabel(nextSession.datetime)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Next Session</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No sessions scheduled yet.</p>
                </div>
              </div>
              <Plus className="w-4 h-4 text-muted-foreground/30 shrink-0" />
            </div>
          )}

          {data.teamMembers.length > 0 && (
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Your Team</h2>
                </div>
                <span className="text-xs text-muted-foreground">{data.teamMembers.length} members</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {data.teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-card" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-card" style={{ backgroundColor: brandColor }}>
                        {m.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{m.name.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Project Chat</h2>
              </div>
              <Link href={`/projects/${projectId}/messages`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                Open <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {data.chatMessages.length === 0 ? (
              <div className="px-5 py-4">
                <p className="text-xs text-muted-foreground">No messages yet. Start the conversation.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {data.chatMessages.slice(0, 3).map((m) => (
                  <Link key={m.id} href={`/projects/${projectId}/messages`}
                    className="flex items-start gap-2.5 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {m.authorAvatar ? (
                      <img src={m.authorAvatar} alt={m.authorName} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: brandColor }}>
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

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Mandates",      href: `/projects/${projectId}/mandate`, icon: BookOpen },
              { label: "Files",         href: `/projects/${projectId}/files`,   icon: Upload },
              { label: "Announcements", href: `/projects/${projectId}/posts`,   icon: Megaphone },
              { label: "Resources",     href: `/library`,                       icon: FileText },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={label} href={href}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card hover:border-foreground/20 hover:bg-muted/30 transition-all text-sm font-medium text-muted-foreground hover:text-foreground">
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

// ── Admin home ────────────────────────────────────────────────────────────────

function AdminHome({ data }: { data: CohortDashboardData }) {
  const {
    user, allProjects, totalStudents, upcomingSessions,
    project, deliverableTracker, studentMembers,
    studentsWithNoSubmissions, recentSubmissions,
  } = data;

  const totalAwaitingReview = allProjects.reduce((s, p) => s + p.awaitingReview, 0);
  const nextSession = upcomingSessions[0] ?? null;

  // Students needing attention: revision first, then no submissions
  const studentsWithRevision = studentMembers.filter((s) =>
    deliverableTracker.some((d) => d.rows.find((r) => r.userId === s.id)?.status === "REVISION_NEEDED")
  );
  const revisionIds = new Set(studentsWithRevision.map((s) => s.id));
  const attentionStudents = [
    ...studentsWithRevision.map((s) => ({ ...s, issue: "Revision needed" })),
    ...studentsWithNoSubmissions
      .filter((s) => !revisionIds.has(s.id))
      .map((s) => ({ ...s, issue: "No submissions yet" })),
  ].slice(0, 6);

  return (
    <div className="space-y-5 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          <Greeting name={user.name} /> 👋
        </h1>
        <span className="text-sm text-muted-foreground shrink-0">
          <DashboardDate />
        </span>
      </div>

      {/* ── Summary banner ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f2160 0%, #1E3A8A 55%, #1d4ed8 100%)" }}
      >
        <div className="flex items-center px-6 py-5 gap-0">
          {/* 4 stats */}
          <div className="flex flex-1 min-w-0 divide-x divide-white/10">
            {([
              { Icon: FolderKanban, value: allProjects.length, label: allProjects.length === 1 ? "Active Project" : "Active Projects" },
              { Icon: Users,        value: totalStudents,         label: "Students" },
              { Icon: CalendarDays, value: upcomingSessions.length, label: "Upcoming Sessions" },
              { Icon: ClipboardCheck, value: totalAwaitingReview, label: "Pending Reviews" },
            ] as const).map(({ Icon, value, label }) => (
              <div key={label} className="flex-1 px-4 first:pl-0 last:pr-4">
                <Icon className="w-4 h-4 text-white/40 mb-2" />
                <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
                <p className="text-xs text-white/50 mt-0.5 leading-snug">{label}</p>
              </div>
            ))}
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch bg-white/10 mx-6 shrink-0" />

          {/* Next session */}
          <div className="shrink-0 w-44">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Next Session</p>
            {nextSession ? (
              <>
                <p className="text-sm font-bold text-white leading-tight">
                  {format(new Date(nextSession.datetime), "MMMM d, yyyy")}
                </p>
                <p className="text-xs text-white/50 mt-0.5 line-clamp-2 leading-snug">{nextSession.title}</p>
              </>
            ) : (
              <p className="text-xs text-white/30">No sessions scheduled</p>
            )}
            <Link
              href={`/projects/${project.id}`}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: GOLD, color: "#78350f" }}
            >
              View Project
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2×2 dashboard grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Upcoming Sessions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Upcoming Sessions</span>
            </div>
            <Link href={`/projects/${project.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View all
            </Link>
          </div>
          <div className="px-4 py-3 space-y-3">
            {upcomingSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No sessions scheduled.</p>
            ) : (
              upcomingSessions.slice(0, 3).map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      backgroundColor: i % 2 === 0 ? `${NAVY}18` : `${GOLD}25`,
                      color: i % 2 === 0 ? NAVY : "#D97706",
                    }}
                  >
                    {format(new Date(s.datetime), "d")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(s.datetime), "MMM d · h:mm a")}
                    </p>
                  </div>
                </div>
              ))
            )}
            <Link
              href={`/projects/${project.id}`}
              className="flex items-center gap-1.5 pt-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <CalendarDays className="w-3 h-3" /> View Calendar
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-border/50">
            <Zap className="w-3.5 h-3.5 text-muted-foreground mr-2" />
            <span className="text-sm font-semibold text-foreground">Quick Actions</span>
          </div>
          <div className="px-4 py-1 divide-y divide-border/40">
            {([
              { Icon: Plus,        label: "New Project",          href: "/projects" },
              { Icon: UserPlus,    label: "Invite Student",        href: "/team" },
              { Icon: CalendarDays, label: "Schedule Session",    href: `/projects/${project.id}` },
              { Icon: Megaphone,   label: "Create Announcement",  href: "/announcements" },
              { Icon: Upload,      label: "Upload Resource",       href: "/library" },
            ] as const).map(({ Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-primary transition-colors group"
              >
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                {label}
                <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Recent Activity</span>
            </div>
            <Link href={`/projects/${project.id}/phases`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {recentSubmissions.length === 0 ? (
              <p className="text-xs text-muted-foreground px-4 py-6 text-center">No recent activity.</p>
            ) : (
              recentSubmissions.slice(0, 5).map((s) => {
                const actionWord =
                  s.status === "APPROVED"        ? "approved" :
                  s.status === "REVISION_NEEDED" ? "returned for revision" :
                  "submitted";
                return (
                  <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: NAVY }}
                    >
                      {s.userName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        <span className="font-medium">{s.userName.split(" ")[0]}</span>{" "}
                        <span className="text-muted-foreground">{actionWord}</span>{" "}
                        <span className="font-medium">&ldquo;{s.deliverableTitle}&rdquo;</span>
                      </p>
                      {s.submittedAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(s.submittedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Students Needing Attention */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Students Needing Attention</span>
            </div>
            <Link href={`/projects/${project.id}/phases`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {attentionStudents.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6">
                <Check className="w-4 h-4 text-emerald-500" />
                <p className="text-xs text-muted-foreground">All students on track.</p>
              </div>
            ) : (
              attentionStudents.map((s) => (
                <Link
                  key={s.id}
                  href={`/projects/${project.id}/phases`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                >
                  {s.avatarUrl ? (
                    <img src={s.avatarUrl} alt={s.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: NAVY }}
                    >
                      {s.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.name.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">{s.issue}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Projects table ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Projects</h2>
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            View all projects
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_100px_160px_90px_170px_110px] items-center px-5 py-2.5 border-b border-border/50 bg-muted/20 gap-4">
            {(["Name", "Status", "Progress", "Students", "Next Session", ""] as const).map((h) => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{h}</span>
            ))}
          </div>

          {allProjects.map((p) => {
            const pct = p.totalPhases > 0 ? Math.round((p.completedPhases / p.totalPhases) * 100) : 0;
            const displayStatus =
              p.completedPhases === p.totalPhases && p.totalPhases > 0 ? "Complete" :
              p.completedPhases > 0 ? "In Progress" : "Planning";
            const statusCls =
              displayStatus === "Complete"    ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              displayStatus === "In Progress" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                               "bg-muted text-muted-foreground border-border";
            return (
              <div
                key={p.id}
                className="hidden md:grid grid-cols-[1fr_100px_160px_90px_170px_110px] items-center px-5 py-4 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors gap-4"
              >
                {/* Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {p.iconEmoji ? (
                    <span className="text-lg leading-none shrink-0">{p.iconEmoji}</span>
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: `${p.color ?? NAVY}18` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color ?? NAVY }} />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
                </div>

                {/* Status */}
                <span className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full border w-fit whitespace-nowrap", statusCls)}>
                  {displayStatus}
                </span>

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: NAVY }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-8 text-right">{pct}%</span>
                </div>

                {/* Students */}
                <span className="text-sm text-muted-foreground tabular-nums">
                  {p.studentCount}
                  <span className="text-xs ml-1">students</span>
                </span>

                {/* Next session */}
                <div className="min-w-0">
                  {p.nextSession ? (
                    <>
                      <p className="text-xs font-medium text-foreground truncate">
                        {format(new Date(p.nextSession.datetime), "MMM d, yyyy")}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.nextSession.title}</p>
                    </>
                  ) : p.nextDueDate ? (
                    <p className="text-xs text-muted-foreground">{format(new Date(p.nextDueDate), "MMM d")}</p>
                  ) : (
                    <span className="text-muted-foreground/30 text-xs">—</span>
                  )}
                </div>

                {/* Action */}
                <Link
                  href={`/projects/${p.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  Open Project
                </Link>
              </div>
            );
          })}

          {/* Mobile rows */}
          {allProjects.map((p) => (
            <Link
              key={`mob-${p.id}`}
              href={`/projects/${p.id}`}
              className="md:hidden flex items-center gap-3 px-4 py-3.5 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
            >
              {p.iconEmoji ? (
                <span className="text-lg leading-none shrink-0">{p.iconEmoji}</span>
              ) : (
                <div className="w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: `${p.color ?? NAVY}18` }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.studentCount} students</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
            </Link>
          ))}

          {/* New project */}
          <div className="px-5 py-3 bg-muted/10">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { orgRole, orgId } = await auth();

  // No active org in session — send to org-selection to activate one first.
  if (!orgId) {
    const { redirect } = await import("next/navigation");
    redirect("/organization-selection?redirect_url=%2Fdashboard");
  }

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

  return <AdminHome data={data} />;
}

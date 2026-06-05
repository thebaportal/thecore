import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import {
  ArrowRight, RotateCcw, Check, Clock, MessageSquare,
  AlertCircle, Upload, CalendarDays, Users, Settings2,
  CheckCircle2, Layers,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getCohortDashboardData } from "@/actions/cohort-dashboard";
import { AIBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { Greeting } from "@/components/dashboard/greeting";
import { DashboardDate } from "@/components/dashboard/dashboard-date";
import { DeliverableTracker } from "@/components/dashboard/deliverable-tracker";
import { SessionManager } from "@/components/dashboard/session-manager";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

// ── Phase progress dots ───────────────────────────────────────────────────────

function PhaseStrip({ phases }: {
  phases: { id: string; order: number; name: string; status: string; isLocked: boolean }[]
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {phases.map((p) => {
        const done   = p.status === "COMPLETED";
        const active = p.status === "IN_PROGRESS";
        const ready  = !p.isLocked && p.status === "NOT_STARTED";
        return (
          <div
            key={p.id}
            title={`Phase ${p.order}: ${p.name}`}
            className={cn(
              "rounded-full transition-all",
              done   ? "w-2 h-2 bg-emerald-500" :
              active ? "w-2.5 h-2.5 bg-primary ring-2 ring-primary/30 ring-offset-1" :
              ready  ? "w-2 h-2 border-2 border-primary/50" :
                       "w-2 h-2 bg-muted-foreground/20"
            )}
          />
        );
      })}
    </div>
  );
}

// ── Student avatar strip ──────────────────────────────────────────────────────

function StudentAvatarStrip({ students }: {
  students: { id: string; name: string; avatarUrl: string | null }[]
}) {
  const visible = students.slice(0, 7);
  const overflow = students.length - visible.length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {visible.map((s) => (
          s.avatarUrl
            ? <img key={s.id} src={s.avatarUrl} alt={s.name} title={s.name}
                className="w-6 h-6 rounded-full ring-2 ring-card object-cover shrink-0" />
            : <div key={s.id} title={s.name}
                className="w-6 h-6 rounded-full ring-2 ring-card bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                {s.name[0]?.toUpperCase()}
              </div>
        ))}
        {overflow > 0 && (
          <div className="w-6 h-6 rounded-full ring-2 ring-card bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-semibold shrink-0">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{students.length} students</span>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent, href }: {
  label: string; value: number | string; accent?: string; href?: string;
}) {
  const inner = (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card",
      href && "hover:border-foreground/20 transition-colors cursor-pointer"
    )}>
      <span className={cn("text-xl font-bold tabular-nums leading-none", accent ?? "text-foreground")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Team roster (empty-state left col) ───────────────────────────────────────

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
  const { userId, orgId, orgRole } = await auth();
  if (orgRole === "org:member" && userId && orgId) {
    const [dbUser, org] = await Promise.all([
      db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
      db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
    ]);
    if (dbUser && org) {
      const pm = await db.projectMember.findFirst({
        where: { userId: dbUser.id, project: { organizationId: org.id } },
        select: { projectId: true },
        orderBy: { joinedAt: "asc" },
      });
      if (pm) redirect(`/projects/${pm.projectId}`);
    }
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
    user, orgName, project, phases, currentPhase, studentMembers,
    deliverableTracker, awaitingReview, studentsWithNoSubmissions,
    upcomingSessions, recentSubmissions, recentPings, unreadPingCount,
  } = data;

  const now = new Date();
  const totalPhases     = phases.length;
  const completedCount  = phases.filter((p) => p.status === "COMPLETED").length;
  const currentPhaseNum = completedCount + (currentPhase ? 1 : 0);
  const phasesConfigured = totalPhases > 0;

  const daysLeft = currentPhase?.dueDate
    ? differenceInDays(new Date(currentPhase.dueDate), now)
    : null;

  const pendingReviewTotal = awaitingReview.reduce((s, d) => s + d.count, 0);
  const needsAttentionCount = awaitingReview.length + studentsWithNoSubmissions.length;
  const nextSession = upcomingSessions[0] ?? null;

  const briefingInput = {
    userName: user.name.split(" ")[0] ?? user.name,
    orgName,
    overdueTasks: [],
    dueTodayTasks: [],
    atRiskProjects: [],
    unreadPings: unreadPingCount,
    isAdminView: true,
    activeProjects: 1,
    activeProjectNames: [project.name],
    pendingReviews: pendingReviewTotal,
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
    <div className="space-y-5 pb-16">

      {/* Greeting */}
      <div>
        <p className="text-xs text-muted-foreground">
          <DashboardDate orgName={orgName} />
        </p>
        <h1 className="text-lg font-semibold text-foreground mt-0.5">
          <Greeting name={user.name} />
        </h1>
      </div>

      {/* ── Cohort Hero ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="h-0.5 w-full bg-primary" />
        <div className="px-6 py-5 space-y-4">

          {/* Top row: project identity + next session + phase due */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                {project.iconEmoji
                  ? <span className="text-xl">{project.iconEmoji}</span>
                  : <div className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: `${project.color ?? "#1E3A8A"}20` }} />
                }
                <div>
                  <h2 className="text-xl font-bold text-foreground leading-tight">{project.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {phasesConfigured
                      ? `Phase ${currentPhaseNum} of ${totalPhases}`
                      : "No phases configured yet"}
                    {studentMembers.length > 0 && ` · ${studentMembers.length} students`}
                  </p>
                </div>
              </div>
              {phasesConfigured && <PhaseStrip phases={phases} />}
              {currentPhase && (
                <p className="text-sm font-semibold text-foreground pt-0.5">{currentPhase.name}</p>
              )}
            </div>

            {/* Right stats */}
            <div className="flex items-start gap-5 flex-wrap text-right">
              {nextSession && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Next session
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {format(new Date(nextSession.datetime), "EEE, MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(nextSession.datetime), "h:mm a")} · {nextSession.title}
                  </p>
                </div>
              )}
              {currentPhase?.dueDate && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Phase due
                  </p>
                  <p className={cn(
                    "text-sm font-bold",
                    daysLeft != null && daysLeft < 0 ? "text-red-600" :
                    daysLeft != null && daysLeft <= 3 ? "text-amber-600" : "text-foreground"
                  )}>
                    {format(new Date(currentPhase.dueDate), "MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {daysLeft != null && daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` :
                     daysLeft != null ? `${daysLeft}d left` : ""}
                  </p>
                </div>
              )}
              {pendingReviewTotal > 0 && (
                <Link href={`/projects/${project.id}/phases`} className="group">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Awaiting review
                  </p>
                  <p className="text-sm font-bold text-amber-600 group-hover:text-amber-700 transition-colors">
                    {pendingReviewTotal}
                  </p>
                  <p className="text-xs text-muted-foreground">submissions</p>
                </Link>
              )}
            </div>
          </div>

          {/* Student avatar strip — always visible */}
          {studentMembers.length > 0 && (
            <div className="pt-1 border-t border-border/40">
              <StudentAvatarStrip students={studentMembers} />
            </div>
          )}
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatPill
          label="students"
          value={studentMembers.length}
          href={`/projects/${project.id}/members`}
        />
        <StatPill
          label="submissions this week"
          value={recentSubmissions.length}
          accent={recentSubmissions.length > 0 ? "text-primary" : undefined}
        />
        <StatPill
          label="awaiting review"
          value={pendingReviewTotal}
          accent={pendingReviewTotal > 0 ? "text-amber-600" : undefined}
          href={pendingReviewTotal > 0 ? `/projects/${project.id}/phases` : undefined}
        />
        <StatPill
          label="unread messages"
          value={unreadPingCount}
          accent={unreadPingCount > 0 ? "text-primary" : undefined}
          href={unreadPingCount > 0 ? "/inbox" : undefined}
        />
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Left column — operational (3/5) */}
        <div className="xl:col-span-3 space-y-5">

          {phasesConfigured ? (
            <>
              {/* Deliverable Tracker */}
              {currentPhase && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Deliverable tracker</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentPhase.name} — click a row to see per-student status
                      </p>
                    </div>
                    <Link href={`/projects/${project.id}/phases`}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                      Full view <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <DeliverableTracker deliverables={deliverableTracker} projectId={project.id} />
                </section>
              )}

              {/* Needs Attention */}
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
                          s.status === "APPROVED" ? "bg-emerald-100 text-emerald-600" :
                          s.status === "REVISION_NEEDED" ? "bg-red-100 text-red-600" :
                          "bg-amber-100 text-amber-600"
                        )}>
                          {s.status === "APPROVED" ? <Check className="w-3.5 h-3.5" /> :
                           s.status === "REVISION_NEEDED" ? <RotateCcw className="w-3.5 h-3.5" /> :
                           <Upload className="w-3.5 h-3.5" />}
                        </div>
                        <p className="flex-1 text-sm text-foreground leading-snug">
                          <span className="font-medium">{s.userName.split(" ")[0]}</span>
                          {" "}<span className="text-muted-foreground">
                            {s.status === "APPROVED" ? "approved" :
                             s.status === "REVISION_NEEDED" ? "needs revision on" : "submitted"}{" "}
                            "{s.deliverableTitle}"
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
                    Add phases and deliverables to this project to unlock the deliverable tracker, submission status, and needs-attention alerts.
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

              {/* Team roster — always useful */}
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

              {/* Conversations in left col when no phases */}
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

        {/* Right column — context (2/5) */}
        <div className="xl:col-span-2 space-y-5">

          {/* Upcoming Sessions */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Upcoming sessions</h2>
            </div>
            <SessionManager sessions={upcomingSessions} projectId={project.id} />
          </section>

          {/* Conversations — only in right col when phases exist */}
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

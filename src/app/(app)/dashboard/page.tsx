import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, differenceInDays, isPast, formatDistanceToNow } from "date-fns";
import {
  ArrowRight, CheckSquare, RotateCcw, Check, Clock, MessageSquare,
  Users, AlertCircle, Upload, CalendarDays,
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

// ── Phase progress strip ──────────────────────────────────────────────────────

function PhaseStrip({ phases }: {
  phases: { id: string; order: number; status: string; isLocked: boolean }[]
}) {
  return (
    <div className="flex items-center gap-1.5">
      {phases.map((p) => {
        const done   = p.status === "COMPLETED";
        const active = p.status === "IN_PROGRESS";
        const ready  = !p.isLocked && p.status === "NOT_STARTED";
        return (
          <div
            key={p.id}
            title={`Phase ${p.order}`}
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // Students go directly to their project — they don't use this dashboard
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
  const totalPhases    = phases.length;
  const completedCount = phases.filter((p) => p.status === "COMPLETED").length;
  const currentPhaseNum = completedCount + (currentPhase ? 1 : 0);

  const daysLeft = currentPhase?.dueDate
    ? differenceInDays(new Date(currentPhase.dueDate), now)
    : null;

  const needsAttentionCount = awaitingReview.length + studentsWithNoSubmissions.length;

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
    pendingReviews: awaitingReview.reduce((sum, d) => sum + d.count, 0),
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

      {/* ── Cohort Hero ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Brand accent top line */}
        <div className="h-0.5 w-full bg-primary" />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Left: project + phase info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                {project.iconEmoji ? (
                  <span className="text-xl">{project.iconEmoji}</span>
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg shrink-0"
                    style={{ backgroundColor: `${project.color ?? "#1E3A8A"}20` }}
                  />
                )}
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">{project.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Phase {currentPhaseNum} of {totalPhases}
                    {studentMembers.length > 0 && ` · ${studentMembers.length} students`}
                  </p>
                </div>
              </div>

              {totalPhases > 0 && <PhaseStrip phases={phases} />}

              {currentPhase && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Current phase
                  </p>
                  <p className="text-base font-semibold text-foreground">{currentPhase.name}</p>
                </div>
              )}
            </div>

            {/* Right: phase due + stats */}
            <div className="flex items-start gap-6 flex-wrap">
              {currentPhase?.dueDate && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Phase due
                  </p>
                  <p className={cn(
                    "text-base font-bold",
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

              {awaitingReview.length > 0 && (
                <Link href={`/projects/${project.id}/phases`} className="text-right group">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Awaiting review
                  </p>
                  <p className="text-base font-bold text-amber-600 group-hover:text-amber-700 transition-colors">
                    {awaitingReview.reduce((s, d) => s + d.count, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">submissions</p>
                </Link>
              )}

              {completedCount > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                    Progress
                  </p>
                  <p className="text-base font-bold text-emerald-600">
                    {totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">{completedCount} phases done</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Left column — operational (60%) */}
        <div className="xl:col-span-3 space-y-6">

          {/* Deliverable Tracker */}
          {currentPhase && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Deliverable tracker</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{currentPhase.name} · click a row to see per-student status</p>
                </div>
                <Link
                  href={`/projects/${project.id}/phases`}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  Full view <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <DeliverableTracker
                deliverables={deliverableTracker}
                projectId={project.id}
              />
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

                {/* Awaiting review */}
                {awaitingReview.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                    <div className="px-4 py-2 border-b border-amber-200/60 bg-amber-50">
                      <p className="text-xs font-semibold text-amber-800">Awaiting review</p>
                    </div>
                    {awaitingReview.map((d) => (
                      <Link
                        key={d.id}
                        href={`/projects/${project.id}/phases`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/80 transition-colors"
                      >
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

                {/* Students with no submissions */}
                {studentsWithNoSubmissions.length > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-2 border-b border-border/60 bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground">
                        No submissions yet in {currentPhase?.name ?? "current phase"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 px-4 py-3">
                      {studentsWithNoSubmissions.map((s) => (
                        <Link
                          key={s.id}
                          href={`/inbox`}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors text-xs font-medium text-foreground"
                        >
                          {s.avatarUrl
                            ? <img src={s.avatarUrl} alt={s.name} className="w-4 h-4 rounded-full object-cover" />
                            : <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">{s.name[0]?.toUpperCase()}</div>
                          }
                          {s.name.split(" ")[0]}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Recent activity (submissions + reviews) */}
          {recentSubmissions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Recent submissions</h2>
                <Link href={`/projects/${project.id}/phases`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
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
                      {s.status === "APPROVED"
                        ? <Check className="w-3.5 h-3.5" />
                        : s.status === "REVISION_NEEDED"
                          ? <RotateCcw className="w-3.5 h-3.5" />
                          : <Upload className="w-3.5 h-3.5" />}
                    </div>
                    <p className="flex-1 text-sm text-foreground leading-snug">
                      <span className="font-medium">{s.userName.split(" ")[0]}</span>
                      {" "}<span className="text-muted-foreground">
                        {s.status === "APPROVED" ? "approved" :
                         s.status === "REVISION_NEEDED" ? "needs revision on" :
                         "submitted"} "{s.deliverableTitle}"
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
        </div>

        {/* Right column — context (40%) */}
        <div className="xl:col-span-2 space-y-6">

          {/* Upcoming Sessions */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Upcoming sessions</h2>
            </div>
            <SessionManager sessions={upcomingSessions} projectId={project.id} />
          </section>

          {/* Conversations */}
          {recentPings.length > 0 && (
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
                    <Link
                      key={ping.id}
                      href={`/inbox/${ping.id}`}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {name[0]?.toUpperCase()}
                        </div>
                        {isUnread && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", isUnread ? "font-semibold" : "font-medium")}>
                          {name}
                        </p>
                        {lastMsg && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {lastMsg.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1")}
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

          {/* AI Briefing — moved below operational content */}
          <AIBriefingCard input={briefingInput} />
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  format, isPast, formatDistanceToNow, differenceInDays,
} from "date-fns";
import {
  ArrowRight, CheckSquare, RotateCcw,
  Check, Clock, MessageSquare, FolderKanban,
  Plus, FileText, Paperclip, Upload, CheckCircle2,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getDashboardData } from "@/actions/dashboard";
import { getActivityFeed, type ActivityItem } from "@/actions/activity";
import { ProjectCard } from "@/components/projects/project-card";
import { AIBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { Greeting } from "@/components/dashboard/greeting";
import { DashboardDate } from "@/components/dashboard/dashboard-date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

// ─── Helpers ─────────────────────────────────────────────────────────────────


type DeliverableStatus = "NOT_SUBMITTED" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REVISION_NEEDED";

const DELIV_STATUS: Record<DeliverableStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  NOT_SUBMITTED:   { label: "Not submitted",   cls: "text-muted-foreground",  icon: <div className="w-2 h-2 rounded-full border border-muted-foreground/40" /> },
  SUBMITTED:       { label: "Submitted",        cls: "text-amber-600",         icon: <div className="w-2 h-2 rounded-full bg-amber-400" /> },
  UNDER_REVIEW:    { label: "Under review",     cls: "text-blue-600",          icon: <Clock className="w-3 h-3" /> },
  APPROVED:        { label: "Approved",         cls: "text-emerald-600",       icon: <Check className="w-3 h-3" /> },
  REVISION_NEEDED: { label: "Revision needed",  cls: "text-red-600",           icon: <RotateCcw className="w-3 h-3" /> },
};

// ─── Phase progress strip ─────────────────────────────────────────────────────

function PhaseStrip({
  phases,
}: {
  phases: { id: string; order: number; status: string; isLocked: boolean }[];
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // Students always land on their project — never the dashboard
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

  const [data, activityItems] = await Promise.all([
    getDashboardData(),
    getActivityFeed(30),
  ]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
      </div>
    );
  }

  const {
    user, currentUserRole,
    projects, recentPings, unreadPingCount,
    stats, unlockedPhases, allPhases, revisionDeliverables,
  } = data;

  const isStudent = currentUserRole === "MEMBER" || currentUserRole === "GUEST";
  const now = new Date();

  // ── STUDENT VIEW ────────────────────────────────────────────────────────────

  if (isStudent) {
    const phasesByProject = new Map<string, typeof allPhases>();
    for (const p of allPhases) {
      if (!phasesByProject.has(p.projectId)) phasesByProject.set(p.projectId, []);
      phasesByProject.get(p.projectId)!.push(p);
    }

    const activePhasesMap = new Map<string, typeof unlockedPhases>();
    for (const p of unlockedPhases) {
      if (p.status === "COMPLETED") continue;
      if (!activePhasesMap.has(p.projectId)) activePhasesMap.set(p.projectId, []);
      activePhasesMap.get(p.projectId)!.push(p);
    }

    const projectIds = [...new Set(allPhases.map((p) => p.projectId))];

    return (
      <div className="max-w-2xl space-y-10 pb-16">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          <Greeting name={user.name} />
        </h1>

        {projectIds.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You haven't been added to any projects yet. Check back once your instructor sets things up.
            </p>
          </div>
        )}

        {projectIds.map((projectId) => {
          const projectPhases = phasesByProject.get(projectId) ?? [];
          const activePhases  = activePhasesMap.get(projectId) ?? [];
          const projectMeta   = unlockedPhases.find((p) => p.projectId === projectId)?.project
                              ?? allPhases.find((p) => p.projectId === projectId) as { id: string; name: string; color: string | null; iconEmoji: string | null } | undefined;

          if (!projectMeta) return null;

          const totalPhases    = projectPhases.length;
          const completedCount = projectPhases.filter((p) => p.status === "COMPLETED").length;
          const currentPhase   = activePhases[0] ?? null;
          const color          = (projectMeta as { color?: string | null }).color ?? "#1E3A8A";

          const allLocked = activePhases.length === 0 && completedCount === 0;
          const allDone   = completedCount === totalPhases && totalPhases > 0;

          return (
            <div key={projectId} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-border/50">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    {(projectMeta as { iconEmoji?: string | null }).iconEmoji ?? (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {(projectMeta as { name: string }).name}
                    </p>
                    {totalPhases > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Phase {completedCount + (currentPhase ? 1 : 0)} of {totalPhases}
                        {allDone ? " · Complete" : ""}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/projects/${projectId}/phases`}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 shrink-0"
                  >
                    All phases <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {totalPhases > 0 && (
                  <div className="mt-3">
                    <PhaseStrip phases={projectPhases} />
                  </div>
                )}
              </div>

              <div className="px-5 py-4">
                {allDone ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <Check className="w-4 h-4" />
                    All phases complete. Great work!
                  </div>
                ) : allLocked || !currentPhase ? (
                  <p className="text-sm text-muted-foreground">
                    Waiting for your instructor to unlock the first phase.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-0.5">
                          Current phase
                        </p>
                        <p className="text-base font-semibold text-foreground leading-snug">
                          {currentPhase.name}
                        </p>
                      </div>
                      {currentPhase.dueDate && (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                            Due
                          </p>
                          <p className={cn(
                            "text-sm font-semibold",
                            isPast(new Date(currentPhase.dueDate))
                              ? "text-red-600"
                              : differenceInDays(new Date(currentPhase.dueDate), now) <= 3
                                ? "text-amber-600"
                                : "text-foreground"
                          )}>
                            {format(new Date(currentPhase.dueDate), "MMM d")}
                          </p>
                        </div>
                      )}
                    </div>

                    {currentPhase.deliverables.length > 0 && (
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        {currentPhase.deliverables.map((d, i) => {
                          const cfg = DELIV_STATUS[d.status as DeliverableStatus] ?? DELIV_STATUS.NOT_SUBMITTED;
                          return (
                            <div
                              key={d.id}
                              className={cn(
                                "flex items-center gap-3 px-3.5 py-2.5 text-sm",
                                i < currentPhase.deliverables.length - 1 && "border-b border-border/40"
                              )}
                            >
                              <span className={cn("shrink-0 flex items-center", cfg.cls)}>
                                {cfg.icon}
                              </span>
                              <span className="flex-1 min-w-0 text-foreground truncate">{d.title}</span>
                              <span className={cn("text-xs shrink-0", cfg.cls)}>{cfg.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Link
                        href={`/projects/${projectId}/phases`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        Submit deliverables
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {revisionDeliverables.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">
              Needs attention
            </h2>
            <div className="rounded-xl border border-red-200 bg-red-50/40 divide-y divide-red-100 overflow-hidden">
              {revisionDeliverables.map((d) => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <RotateCcw className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Phase {d.phase.order} · {d.phase.name}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/projects/${d.phase.project.id}/phases`}
                      className="text-xs font-medium text-red-600 hover:underline shrink-0"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recentPings.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Conversations
              </h2>
              <Link href="/inbox" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {recentPings.map((ping) => {
                const lastMsg = ping.messages[0];
                const other   = ping.participants.find((p) => p.user.id !== user.id);
                const name =
                  ping.type === "DIRECT"
                    ? (other?.user.name ?? "Direct Message")
                    : ping.project?.name ?? ping.task?.title ?? ping.title ?? "Conversation";
                const me       = ping.participants.find((p) => p.user.id === user.id) as { lastReadAt?: Date | null } | undefined;
                const isUnread = !!lastMsg && (!me?.lastReadAt || new Date(lastMsg.createdAt) > new Date(me.lastReadAt));
                return (
                  <Link
                    key={ping.id}
                    href={`/inbox/${ping.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {name[0]?.toUpperCase()}
                      </div>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", isUnread ? "font-semibold text-foreground" : "text-foreground")}>
                        {name}
                      </p>
                      {lastMsg && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          <span className="font-medium">{lastMsg.author.name.split(" ")[0]}: </span>
                          {lastMsg.body}
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
      </div>
    );
  }

  // ── INSTRUCTOR / ADMIN VIEW ─────────────────────────────────────────────────

  const { activeProjects, pendingReviews, overdueTaskCount } = stats;

  const atRiskProjects = projects.filter((p) => p.health === "AT_RISK" || p.health === "BEHIND");

  const activePhaseSummary = unlockedPhases
    .filter((p) => p.status !== "COMPLETED")
    .map((p) => ({
      projectName: p.project.name,
      phaseName:   p.name,
      submitted:      p.deliverables.filter((d) => ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(d.status)).length,
      revisionNeeded: p.deliverables.filter((d) => d.status === "REVISION_NEEDED").length,
      notSubmitted:   p.deliverables.filter((d) => d.status === "NOT_SUBMITTED").length,
      daysLeft:       p.dueDate ? differenceInDays(new Date(p.dueDate), now) : null,
    }));

  const briefingInput = {
    userName:           user.name.split(" ")[0] ?? user.name,
    orgName:            data.orgName,
    overdueTasks:       [],
    dueTodayTasks:      [],
    atRiskProjects:     atRiskProjects.slice(0, 3).map((p) => ({
      name:          p.name,
      completionPct: p._count.tasks > 0 ? Math.round((p.completedTaskCount / p._count.tasks) * 100) : 0,
      daysLeft:      p.targetDate ? differenceInDays(new Date(p.targetDate), now) : 0,
    })),
    unreadPings:        unreadPingCount,
    isAdminView:        true,
    activeProjects,
    activeProjectNames: projects.map((p) => p.name),
    pendingReviews,
    overdueTaskCount,
    activePhaseSummary,
  };

  const orgActivity = activityItems
    .filter((i) => i.kind !== "message_sent")
    .slice(0, 8);

  const kpiCards = [
    {
      label: "Pending Reviews",
      value: pendingReviews,
      href:  "/projects",
      Icon:  CheckSquare,
      accent: pendingReviews > 0 ? "#d97706" : "#9ca3af",
    },
    {
      label: "Overdue Tasks",
      value: overdueTaskCount,
      href:  "/tasks",
      Icon:  Clock,
      accent: overdueTaskCount > 0 ? "#dc2626" : "#9ca3af",
    },
    {
      label: unreadPingCount === 1 ? "Unread Message" : "Unread Messages",
      value: unreadPingCount,
      href:  "/inbox",
      Icon:  MessageSquare,
      accent: "#7c3aed",
    },
    {
      label: "Active Projects",
      value: activeProjects,
      href:  "/projects",
      Icon:  FolderKanban,
      accent: "#2563eb",
    },
  ] as const;

  return (
    <div className="space-y-8 pb-16">

      {/* ── Greeting ── */}
      <div>
        <p className="text-xs text-muted-foreground">
          <DashboardDate orgName={data.orgName} />
        </p>
        <h1 className="text-lg font-semibold text-foreground mt-0.5">
          <Greeting name={user.name} />
        </h1>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(({ label, value, href, Icon, accent }) => (
          <Link
            key={label}
            href={href}
            className="group relative bg-card rounded-xl border border-border p-5 overflow-hidden hover:border-foreground/20 transition-colors"
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: accent }} />
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: `${accent}18` }}
            >
              <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Active Projects — primary section ── */}
      {projects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Active Projects</h2>
            <Link
              href="/projects"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              All projects <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* ── AI Briefing ── */}
      <AIBriefingCard input={briefingInput} />

      {/* ── Conversations + Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {recentPings.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
              <Link href="/inbox" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {recentPings.slice(0, 4).map((ping) => {
                const lastMsg = ping.messages[0];
                const other   = ping.participants.find((p) => p.user.id !== user.id);
                const name =
                  ping.type === "DIRECT"
                    ? (other?.user.name ?? "Direct Message")
                    : ping.project?.name ?? ping.task?.title ?? ping.title ?? "Conversation";
                const me       = ping.participants.find((p) => p.user.id === user.id) as { lastReadAt?: Date | null } | undefined;
                const isUnread = !!lastMsg && (!me?.lastReadAt || new Date(lastMsg.createdAt) > new Date(me.lastReadAt));

                return (
                  <Link
                    key={ping.id}
                    href={`/inbox/${ping.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                        {name[0]?.toUpperCase()}
                      </div>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <p className={cn(
                          "text-sm truncate",
                          isUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                        )}>
                          {name}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                          {formatDistanceToNow(new Date(ping.updatedAt), { addSuffix: false })}
                        </span>
                      </div>
                      {lastMsg && (
                        <p className={cn(
                          "text-xs truncate",
                          isUnread ? "text-foreground/70" : "text-muted-foreground"
                        )}>
                          <span className={cn(isUnread && "font-medium")}>
                            {lastMsg.author.name.split(" ")[0]}:
                          </span>{" "}
                          {lastMsg.body}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {orgActivity.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              <Link href="/activity" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
              {orgActivity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

function getActivityMeta(item: ActivityItem): {
  icon: React.ReactNode;
  iconCls: string;
  text: string;
  href: string;
} {
  switch (item.kind) {
    case "project_created":
      return {
        icon:    <FolderKanban className="w-3.5 h-3.5" />,
        iconCls: "bg-blue-100 text-blue-600",
        text:    `created project "${item.project.name}"`,
        href:    `/projects/${item.project.id}`,
      };
    case "task_created":
      return {
        icon:    <Plus className="w-3.5 h-3.5" />,
        iconCls: "bg-muted text-muted-foreground",
        text:    `added task "${item.task.title}" · ${item.project.name}`,
        href:    `/projects/${item.project.id}/tasks`,
      };
    case "task_done":
      return {
        icon:    <CheckCircle2 className="w-3.5 h-3.5" />,
        iconCls: "bg-emerald-100 text-emerald-600",
        text:    `completed "${item.task.title}" · ${item.project.name}`,
        href:    `/projects/${item.project.id}/tasks`,
      };
    case "file_uploaded":
      return {
        icon:    <Paperclip className="w-3.5 h-3.5" />,
        iconCls: "bg-muted text-muted-foreground",
        text:    `uploaded "${item.fileName}" to ${item.project.name}`,
        href:    `/projects/${item.project.id}/files`,
      };
    case "doc_created":
      return {
        icon:    <FileText className="w-3.5 h-3.5" />,
        iconCls: "bg-amber-100 text-amber-600",
        text:    `created doc "${item.docTitle}" · ${item.project.name}`,
        href:    `/projects/${item.project.id}/docs/${item.docId}`,
      };
    case "deliverable_submitted":
      return {
        icon:    <Upload className="w-3.5 h-3.5" />,
        iconCls: "bg-cyan-100 text-cyan-600",
        text:    `submitted "${item.deliverableTitle}" · Phase ${item.phaseOrder}: ${item.phaseName} · ${item.project.name}`,
        href:    `/projects/${item.project.id}/phases`,
      };
    case "deliverable_reviewed":
      return {
        icon:    item.decision === "APPROVED"
          ? <Check className="w-3.5 h-3.5" />
          : <RotateCcw className="w-3.5 h-3.5" />,
        iconCls: item.decision === "APPROVED"
          ? "bg-emerald-100 text-emerald-600"
          : "bg-red-100 text-red-600",
        text:    `${item.decision === "APPROVED" ? "approved" : "requested revision on"} "${item.deliverableTitle}" · ${item.project.name}`,
        href:    `/projects/${item.project.id}/phases`,
      };
    case "message_sent":
      return {
        icon:    <MessageSquare className="w-3.5 h-3.5" />,
        iconCls: "bg-violet-100 text-violet-600",
        text:    `sent a message in ${item.ping.title ?? "a conversation"}`,
        href:    `/inbox/${item.ping.id}`,
      };
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon, iconCls, text, href } = getActivityMeta(item);
  const firstName = item.actor.name.split(" ")[0];

  return (
    <Link
      href={href}
      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
    >
      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", iconCls)}>
        {icon}
      </div>
      <p className="flex-1 text-sm text-foreground min-w-0 leading-snug">
        <span className="font-medium">{firstName}</span>
        {" "}<span className="text-muted-foreground">{text}</span>
      </p>
      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums whitespace-nowrap mt-0.5">
        {formatDistanceToNow(new Date(item.at), { addSuffix: false })}
      </span>
    </Link>
  );
}

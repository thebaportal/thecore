import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { format, formatDistanceToNow, differenceInDays, isToday, isTomorrow } from "date-fns";
import {
  BookOpen, Layers, CheckSquare, FolderOpen,
  MessageSquare, Users, FileText, ArrowRight,
  Upload, Activity, CalendarDays,
} from "lucide-react";
import { getStudentProjectHub } from "@/actions/student-project-hub";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

// ── Nav card ──────────────────────────────────────────────────────────────────

function HubCard({
  href, icon: Icon, title, subtitle, badge, color,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  badge?: number;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 hover:border-foreground/20 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: color ? `${color}18` : undefined }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: color ?? "currentColor" }} />
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground tabular-nums">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 absolute bottom-4 right-4 transition-colors" />
    </Link>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function MiniProgress({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{completed}/{total}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProjectRootPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { orgRole } = await auth();

  // Admins go straight to the mandate
  if (orgRole !== "org:member") {
    redirect(`/projects/${projectId}/mandate`);
  }

  // Student hub
  const [hub, project] = await Promise.all([
    getStudentProjectHub(projectId),
    db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, color: true, targetDate: true, status: true },
    }),
  ]);

  if (!hub || !project) notFound();

  const color = project.color ?? "#1E3A8A";
  const now = new Date();

  const phaseSubtitle =
    hub.totalPhases === 0
      ? "No phases yet"
      : hub.currentPhaseName
        ? `Phase ${hub.currentPhaseOrder} · ${hub.currentPhaseName}`
        : hub.completedPhases === hub.totalPhases
          ? "All phases complete"
          : "Not started";

  function sessionLabel(dt: Date) {
    if (isToday(dt)) return "Today";
    if (isTomorrow(dt)) return "Tomorrow";
    const d = differenceInDays(dt, now);
    return d <= 7 ? `In ${d} days` : format(dt, "MMM d");
  }

  return (
    <div className="space-y-6 pb-16">

      {/* Phase progress strip */}
      {hub.totalPhases > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {hub.currentPhaseName ?? "No active phase"}
            </p>
            <Link
              href={`/projects/${projectId}/phases`}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              View phases <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <MiniProgress completed={hub.completedPhases} total={hub.totalPhases} />
        </div>
      )}

      {/* Nav cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <HubCard
          href={`/projects/${projectId}/mandate`}
          icon={BookOpen}
          title="Project Mandate"
          subtitle="Overview, objectives & scope"
          color={color}
        />
        <HubCard
          href={`/projects/${projectId}/phases`}
          icon={Layers}
          title="Phases"
          subtitle={phaseSubtitle}
          color={color}
        />
        <HubCard
          href={`/projects/${projectId}/tasks`}
          icon={CheckSquare}
          title="To-dos"
          subtitle={hub.taskCount > 0 ? `${hub.taskCount} open task${hub.taskCount !== 1 ? "s" : ""}` : "No open tasks"}
          badge={hub.taskCount || undefined}
          color={color}
        />
        <HubCard
          href={`/projects/${projectId}/files`}
          icon={FolderOpen}
          title="Files"
          subtitle={hub.fileCount > 0 ? `${hub.fileCount} file${hub.fileCount !== 1 ? "s" : ""}` : "No files yet"}
          color={color}
        />
        <HubCard
          href={`/projects/${projectId}/posts`}
          icon={FileText}
          title="Posts"
          subtitle={hub.postCount > 0 ? `${hub.postCount} post${hub.postCount !== 1 ? "s" : ""}` : "No posts yet"}
          color={color}
        />
        <HubCard
          href={`/projects/${projectId}/messages`}
          icon={MessageSquare}
          title="Chat"
          subtitle={hub.unreadMessageCount > 0 ? `${hub.unreadMessageCount} unread` : "Project conversation"}
          badge={hub.unreadMessageCount || undefined}
          color={color}
        />
        <HubCard
          href={`/projects/${projectId}/members`}
          icon={Users}
          title="Team"
          subtitle={`${hub.memberCount} member${hub.memberCount !== 1 ? "s" : ""}`}
          color={color}
        />
      </div>

      {/* Lower section */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Recent activity */}
        <div className="xl:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
          </div>
          {hub.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recent activity.</p>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
              {hub.recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    item.type === "submission" ? "bg-amber-100 text-amber-600" :
                    item.type === "file"       ? "bg-blue-100 text-blue-600" :
                                                 "bg-violet-100 text-violet-600"
                  )}>
                    {item.type === "submission" ? <Upload className="w-3 h-3" /> :
                     item.type === "file"       ? <FolderOpen className="w-3 h-3" /> :
                                                  <FileText className="w-3 h-3" />}
                  </div>
                  <p className="flex-1 text-sm text-foreground min-w-0 truncate">
                    <span className="font-medium">{item.authorName.split(" ")[0]}</span>
                    {" "}<span className="text-muted-foreground">{item.label}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {formatDistanceToNow(item.createdAt, { addSuffix: false })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="xl:col-span-2 space-y-5">

          {/* Upcoming sessions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Upcoming sessions</h2>
            </div>
            {hub.upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">No sessions scheduled.</p>
            ) : (
              <div className="space-y-2">
                {hub.upcomingSessions.map((s) => (
                  <div key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                    <div className="shrink-0 text-center min-w-[36px]">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
                        {format(new Date(s.datetime), "MMM")}
                      </p>
                      <p className="text-lg font-bold text-foreground leading-tight">
                        {format(new Date(s.datetime), "d")}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {sessionLabel(new Date(s.datetime))} · {format(new Date(s.datetime), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest messages */}
          {hub.latestMessages.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Latest messages</h2>
                </div>
                <Link
                  href={`/projects/${projectId}/messages`}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  Open chat <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="rounded-xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
                {hub.latestMessages.map((m) => (
                  <Link
                    key={m.id}
                    href={`/projects/${projectId}/messages`}
                    className="block px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {m.authorName.split(" ")[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDistanceToNow(new Date(m.createdAt), { addSuffix: false })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 80)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

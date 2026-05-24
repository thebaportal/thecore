import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProject } from "@/actions/projects";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { ProjectHeaderActions } from "@/components/projects/project-header-actions";
import { db } from "@/lib/db";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, { userId, orgId }] = await Promise.all([getProject(projectId), auth()]);
  if (!project) notFound();

  let isInstructor = false;
  if (userId && orgId) {
    const [org, dbUser] = await Promise.all([
      db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
      db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
    ]);
    if (org && dbUser) {
      const mem = await db.orgMembership.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
        select: { role: true },
      });
      isInstructor = mem?.role === "OWNER" || mem?.role === "ADMIN";
    }
  }

  const color = project.color ?? "#1E3A8A";
  const memberCount = project._count.members;

  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: "Active", ON_HOLD: "On Hold", COMPLETED: "Completed", ARCHIVED: "Archived",
  };
  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: "text-emerald-500", ON_HOLD: "text-amber-500",
    COMPLETED: "text-blue-500", ARCHIVED: "text-muted-foreground",
  };

  return (
    <div className="space-y-0 -mt-8 -mx-6">
      {/* Project header */}
      <div className="px-6 pt-7 pb-0 bg-card border-b border-border">
        <div className="max-w-[1440px] mx-auto">

          {/* Title row */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 mt-0.5"
              style={{ backgroundColor: `${color}20` }}
            >
              {project.iconEmoji ?? (
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight truncate">
                {project.name}
              </h1>

              {/* Stat bar */}
              <div className="flex items-center gap-2 mt-1.5">
                {memberCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {memberCount} {memberCount === 1 ? "person" : "people"}
                  </span>
                )}
                {memberCount > 0 && (
                  <span className="text-muted-foreground/30 text-xs">·</span>
                )}
                <span className={`text-xs font-medium ${STATUS_COLOR[project.status] ?? "text-emerald-500"}`}>
                  {STATUS_LABEL[project.status] ?? "Active"}
                </span>
              </div>
            </div>

            <ProjectHeaderActions project={{ ...project, pinnedAt: project.pinnedAt ?? null }} />
          </div>

          {/* Tabs */}
          <ProjectTabs projectId={projectId} isInstructor={isInstructor} />
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 pt-6 max-w-[1440px] mx-auto w-full">
        {children}
      </div>
    </div>
  );
}

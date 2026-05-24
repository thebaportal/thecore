import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getProjects, getPhaseTemplates } from "@/actions/projects";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { userId, orgId, orgRole } = await auth();

  // Students have exactly one project — send them there directly
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
      if (pm) redirect(`/projects/${pm.projectId}/phases`);
    }
  }

  const [projects, templates] = await Promise.all([getProjects(), getPhaseTemplates()]);

  return (
    <div className="space-y-6">
      <ProjectsView projects={projects} templates={templates} />
    </div>
  );
}

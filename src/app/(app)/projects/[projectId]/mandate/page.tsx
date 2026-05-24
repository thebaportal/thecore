import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProject } from "@/actions/projects";
import { ProjectMandate } from "@/components/projects/project-mandate";
import { db } from "@/lib/db";

export default async function ProjectMandatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { userId, orgId } = await auth();

  const project = await getProject(projectId);
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

  return (
    <div className="pb-20 pt-2">
      <ProjectMandate
        projectId={projectId}
        mandate={project.mandate ?? null}
        isInstructor={isInstructor}
      />
    </div>
  );
}

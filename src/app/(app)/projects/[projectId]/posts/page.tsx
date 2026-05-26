import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getProject } from "@/actions/projects";
import { getProjectPosts, getOrgPostCategories } from "@/actions/posts";
import { ProjectPosts } from "@/components/projects/project-posts";
import { db } from "@/lib/db";

export default async function ProjectPostsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { userId, orgId } = await auth();

  const [project, posts, clerkUser, categories] = await Promise.all([
    getProject(projectId),
    getProjectPosts(projectId),
    currentUser(),
    getOrgPostCategories(),
  ]);
  if (!project) notFound();

  let isInstructor = false;
  let currentUserId = "";

  if (userId && orgId) {
    const [org, dbUser] = await Promise.all([
      db.organization.findUnique({ where: { clerkOrgId: orgId }, select: { id: true } }),
      db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
    ]);
    if (org && dbUser) {
      currentUserId = dbUser.id;
      const mem = await db.orgMembership.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId: dbUser.id } },
        select: { role: true },
      });
      isInstructor = mem?.role === "OWNER" || mem?.role === "ADMIN";
    }
  }

  return (
    <ProjectPosts
      projectId={projectId}
      initialPosts={posts}
      isInstructor={isInstructor}
      currentUserId={currentUserId}
      currentUserAvatarUrl={clerkUser?.imageUrl ?? null}
      categories={categories}
    />
  );
}

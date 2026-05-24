import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function ProjectRootPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { orgRole } = await auth();

  // Students land on phases (their active work); admins on the project mandate
  if (orgRole === "org:member") {
    redirect(`/projects/${projectId}/phases`);
  }
  redirect(`/projects/${projectId}/mandate`);
}

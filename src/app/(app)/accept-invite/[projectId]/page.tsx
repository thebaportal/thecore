import { redirect } from "next/navigation";
import { syncCurrentIdentity } from "@/actions/projects";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Process any pending ProjectInvitation for this user's email → creates ProjectMember
  await syncCurrentIdentity();

  redirect(`/projects/${projectId}`);
}

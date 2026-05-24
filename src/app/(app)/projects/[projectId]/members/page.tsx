import { notFound } from "next/navigation";
import { getProjectMembersAndInvitations } from "@/actions/invitations";
import { MembersClient } from "@/components/projects/members-client";

export default async function MembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = await getProjectMembersAndInvitations(projectId);
  if (!data) notFound();

  return <MembersClient projectId={projectId} data={data} />;
}

import type { Metadata } from "next";
import { getTeamByProject } from "@/actions/team";
import { getPendingOrgInvitations } from "@/actions/invitations";
import { TeamShell } from "@/components/team/team-shell";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const [{ orgName, orgLogoUrl, people, projects, currentDbUserId }, pendingInvitations] =
    await Promise.all([getTeamByProject(), getPendingOrgInvitations()]);

  return (
    <TeamShell
      orgName={orgName}
      orgLogoUrl={orgLogoUrl}
      people={people}
      projects={projects}
      currentDbUserId={currentDbUserId}
      pendingInvitations={pendingInvitations}
    />
  );
}

import type { Metadata } from "next";
import { getTeamByProject } from "@/actions/team";
import { TeamShell } from "@/components/team/team-shell";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { orgName, projects, currentDbUserId } = await getTeamByProject();

  return (
    <TeamShell
      orgName={orgName}
      projects={projects}
      currentDbUserId={currentDbUserId}
    />
  );
}

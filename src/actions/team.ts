"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Projects that are not real cohort/client projects — excluded from filters and badges
const EXCLUDED_PROJECT_NAMES = new Set([
  "Coming Soon  - Data Migration Project",
  "Coming Soon  - System Integration Project",
  "Coming Soon  - Upgrade Management Project",
  "Coming soon- Process Improvement Project",
  "Mentoring Tuesday",
  "Managers",
  "BA Interview Prep Materials",
  "Templates for Project Deliverables",
  "Project X",
  "Project Z",
  "Community Food Bank Volunteer Portal -{{{{{ UAT}}}}}",
  "TEzstimg new admin",
]);

function isExcluded(name: string) {
  return EXCLUDED_PROJECT_NAMES.has(name.trim());
}

export type TeamProject = {
  id: string;
  name: string;
  color: string | null;
  status: string;
};

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  orgRole: string;
  joinedAt: Date;
  projects: TeamProject[];
};

export async function getTeamByProject() {
  const { userId, orgId } = await auth();
  if (!orgId) return { orgName: "", orgLogoUrl: null, people: [] as TeamMember[], projects: [] as TeamProject[], currentDbUserId: null };

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      projects: {
        include: {
          members: {
            select: { userId: true },
          },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!org) return { orgName: "", orgLogoUrl: null, people: [] as TeamMember[], projects: [] as TeamProject[], currentDbUserId: null };

  const dbUser = userId
    ? await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } })
    : null;

  // Real projects only (no fake/system ones)
  const realProjects = org.projects.filter((p) => !isExcluded(p.name));

  // Build map: userId → all real projects they belong to
  const projectsByUser = new Map<string, TeamProject[]>();
  for (const p of realProjects) {
    for (const m of p.members) {
      const list = projectsByUser.get(m.userId) ?? [];
      list.push({ id: p.id, name: p.name, color: p.color, status: p.status });
      projectsByUser.set(m.userId, list);
    }
  }

  const logoUrl = org.logoUrl && !org.logoUrl.includes("clerk") ? org.logoUrl : null;

  return {
    orgName: org.displayName ?? org.name,
    orgLogoUrl: logoUrl,
    currentDbUserId: dbUser?.id ?? null,
    // All org members — the full roster of everyone who has ever been in the org
    people: org.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      jobTitle: m.user.jobTitle,
      orgRole: m.role,
      joinedAt: m.joinedAt,
      projects: projectsByUser.get(m.userId) ?? [],
    })),
    // Real projects for filter dropdown
    projects: realProjects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
    })),
  };
}

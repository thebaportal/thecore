import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// ONE-TIME route — delete after running.
// Fixes org migration: links production Clerk org to the existing data org.

export async function POST() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Find the org the current Clerk session is using
  const currentOrg = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true, name: true, _count: { select: { projects: true, memberships: true } } },
  });

  // Find all orgs and their data counts to identify the real one
  const allOrgs = await db.organization.findMany({
    select: {
      id: true,
      clerkOrgId: true,
      name: true,
      _count: { select: { projects: true, memberships: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // The "real" org is the one with the most data
  const realOrg = allOrgs.reduce((best, org) =>
    (org._count.projects + org._count.memberships) >
    (best._count.projects + best._count.memberships) ? org : best
  );

  // If the current session's org is already the real one — nothing to do
  if (realOrg.clerkOrgId === orgId) {
    return NextResponse.json({ message: "Already correct — no migration needed", org: realOrg });
  }

  // Update the real org to use the production Clerk org ID
  await db.organization.update({
    where: { id: realOrg.id },
    data: { clerkOrgId: orgId },
  });

  // Delete the empty new org that was auto-created on first login
  if (currentOrg && currentOrg.id !== realOrg.id) {
    await db.organization.delete({ where: { id: currentOrg.id } });
  }

  return NextResponse.json({
    message: "Migration complete — your existing data is now linked to production Clerk.",
    updatedOrg: realOrg.name,
    newClerkOrgId: orgId,
    deletedEmptyOrg: currentOrg?.id,
  });
}

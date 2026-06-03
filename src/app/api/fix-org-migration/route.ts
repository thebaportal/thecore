import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const { orgId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // All orgs in the database
    const allOrgs = await db.organization.findMany({
      select: {
        id: true,
        clerkOrgId: true,
        name: true,
        _count: { select: { projects: true, memberships: true } },
      },
    });

    if (allOrgs.length === 0) {
      return NextResponse.json({ error: "No orgs in database" }, { status: 400 });
    }

    // The current (new, empty) org linked to this Clerk session
    const currentOrg = allOrgs.find((o) => o.clerkOrgId === orgId);

    // The real org is whichever has the most data
    const realOrg = allOrgs.sort(
      (a, b) => (b._count.projects + b._count.memberships) - (a._count.projects + a._count.memberships)
    )[0]!;

    // Debug info
    const debug = allOrgs.map((o) => ({
      id: o.id,
      clerkOrgId: o.clerkOrgId,
      name: o.name,
      projects: o._count.projects,
      memberships: o._count.memberships,
    }));

    if (realOrg.clerkOrgId === orgId) {
      return NextResponse.json({ message: "Already correct — no migration needed", debug });
    }

    // Delete the empty shell org FIRST (frees up the clerkOrgId unique constraint)
    if (currentOrg) {
      await db.organization.delete({ where: { id: currentOrg.id } });
    }

    // Now point the real org to the production Clerk org ID
    await db.organization.update({
      where: { id: realOrg.id },
      data: { clerkOrgId: orgId },
    });

    return NextResponse.json({
      success: true,
      message: "Migration complete. Refresh the page.",
      linkedOrg: realOrg.name,
      projects: realOrg._count.projects,
      memberships: realOrg._count.memberships,
      debug,
    });

  } catch (err) {
    console.error("fix-org-migration error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

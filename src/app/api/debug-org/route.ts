import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { orgId, userId } = await auth();
  const orgs = await db.organization.findMany({
    select: { id: true, clerkOrgId: true, name: true, _count: { select: { projects: true, memberships: true } } },
  });
  return NextResponse.json({ sessionOrgId: orgId, sessionUserId: userId, orgs });
}

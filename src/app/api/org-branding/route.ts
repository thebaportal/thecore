import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({});

  const orgs = await db.organization.findMany({
    where: { clerkOrgId: { in: ids } },
    select: { clerkOrgId: true, logoUrl: true, brandColor: true, displayName: true, name: true },
  });

  const result: Record<string, { logoUrl: string | null; brandColor: string | null; displayName: string | null; name: string }> = {};
  for (const org of orgs) {
    const logoUrl = org.logoUrl && !org.logoUrl.includes("clerk") ? org.logoUrl : null;
    result[org.clerkOrgId] = { logoUrl, brandColor: org.brandColor, displayName: org.displayName, name: org.name };
  }

  return NextResponse.json(result);
}

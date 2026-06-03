"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function requireAdminOrg() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthenticated");
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    db.organization.findUnique({ where: { clerkOrgId: orgId } }),
  ]);
  if (!user || !org) throw new Error("Not found");
  const membership = await db.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    select: { role: true },
  });
  if (membership?.role !== "OWNER" && membership?.role !== "ADMIN") {
    throw new Error("Only admins can update org branding");
  }
  return { user, org };
}

export async function updateOrgBranding(data: {
  brandColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
}) {
  const { org } = await requireAdminOrg();
  await db.organization.update({
    where: { id: org.id },
    data: {
      ...(data.brandColor !== undefined && { brandColor: data.brandColor || null }),
      ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor || null }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
    },
  });
  revalidatePath("/settings/organization");
  revalidatePath("/");
}

export async function getOrgBrandingSettings() {
  const { orgId } = await auth();
  if (!orgId) return null;
  return db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: { logoUrl: true, brandColor: true, secondaryColor: true, name: true },
  });
}

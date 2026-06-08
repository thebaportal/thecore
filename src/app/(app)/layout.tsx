import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";

function clerkRoleToDb(orgRole: string | null | undefined): "OWNER" | "ADMIN" | "MEMBER" {
  if (orgRole === "org:admin") return "ADMIN";
  return "MEMBER";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) redirect("/sign-in");
  if (!orgId) {
    // Preserve the intended destination so the student lands on the right project
    // after selecting (or auto-activating) their org. Critical for invite flow.
    const headersList = await headers();
    const pathname = headersList.get("x-invoke-path") ?? headersList.get("x-pathname") ?? "";
    const dest = pathname && pathname !== "/" ? `?redirect_url=${encodeURIComponent(pathname)}` : "";
    redirect(`/organization-selection${dest}`);
  }

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;

  // Find existing record by clerkUserId or email (handles mismatched records from webhooks)
  let dbUser = await db.user.findUnique({ where: { clerkUserId: userId } });

  if (!dbUser && email) {
    dbUser = await db.user.findUnique({ where: { email } });
    if (dbUser) {
      // Link the existing email record to this Clerk user
      dbUser = await db.user.update({
        where: { id: dbUser.id },
        data: { clerkUserId: userId, avatarUrl: clerkUser.imageUrl },
      });
    }
  }

  if (!dbUser) {
    dbUser = await db.user.create({
      data: { clerkUserId: userId, email, name, avatarUrl: clerkUser.imageUrl },
    });
  } else {
    await db.user.update({
      where: { id: dbUser.id },
      data: { avatarUrl: clerkUser.imageUrl },
    });
  }

  // Resolve org — lazy-create if webhook hasn't fired yet
  let dbOrg = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true },
  });

  if (!dbOrg) {
    const clerkOrg = await (await clerkClient()).organizations.getOrganization({ organizationId: orgId });
    dbOrg = await db.organization.create({
      data: {
        clerkOrgId: orgId,
        name: clerkOrg.name,
        slug: clerkOrg.slug ?? orgId,
        logoUrl: null,
      },
      select: { id: true },
    });
  }

  const dbRole = clerkRoleToDb(orgRole);
  // Atomic insert-if-not-exists (ON CONFLICT DO NOTHING)
  await db.orgMembership.createMany({
    data: [{ organizationId: dbOrg.id, userId: dbUser.id, role: dbRole }],
    skipDuplicates: true,
  });
  // Upgrade MEMBER → ADMIN if Clerk says so; never touches OWNER
  if (dbRole === "ADMIN") {
    await db.orgMembership.updateMany({
      where: { organizationId: dbOrg.id, userId: dbUser.id, role: "MEMBER" },
      data: { role: "ADMIN" },
    });
  }

  const isStudent = orgRole === "org:member";
  let studentProjectId: string | null = null;

  if (isStudent) {
    const pm = await db.projectMember.findFirst({
      where: { userId: dbUser.id },
      select: { projectId: true },
      orderBy: { joinedAt: "asc" },
    });
    studentProjectId = pm?.projectId ?? null;
  }

  return (
    <AppShell role={isStudent ? "MEMBER" : "ADMIN"} studentProjectId={studentProjectId}>
      {children}
    </AppShell>
  );
}

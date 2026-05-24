import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Returns the internal User record for the currently authenticated Clerk user.
 * Throws if unauthenticated.
 */
export async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found in database");

  return user;
}

/**
 * Returns the internal Organization record for the currently active Clerk org.
 * Throws if no org is selected or the user is not a member.
 */
export async function getAuthOrg() {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No active organization");

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) throw new Error("Organization not found in database");

  return org;
}

/**
 * Returns a Prisma client extension that automatically scopes all queries
 * to the given organizationId, preventing cross-tenant data leaks.
 */
export function scopedDb(organizationId: string) {
  return db.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args["where"] = { ...(args["where"] as Record<string, unknown> ?? {}), organizationId };
          return query(args);
        },
        async findFirst({ args, query }: { args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
          args["where"] = { ...(args["where"] as Record<string, unknown> ?? {}), organizationId };
          return query(args);
        },
      },
    },
  });
}

export { auth, currentUser };

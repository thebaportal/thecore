import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getMyPings } from "@/actions/pings";
import { PingsShell } from "@/components/pings/pings-shell";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();

  const [{ pings, currentDbUserId }, orgMembers] = await Promise.all([
    getMyPings(),
    (async () => {
      if (!orgId) return [];
      const org = await db.organization.findUnique({
        where: { clerkOrgId: orgId },
        include: {
          memberships: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      });
      // Exclude self from the people list
      const selfUser = userId
        ? await db.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } })
        : null;
      return (org?.memberships.map((m) => m.user) ?? []).filter(
        (u) => u.id !== selfUser?.id
      );
    })(),
  ]);

  return (
    <PingsShell pings={pings} currentDbUserId={currentDbUserId ?? ""} orgMembers={orgMembers}>
      {children}
    </PingsShell>
  );
}

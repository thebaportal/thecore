import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Users, Hash } from "lucide-react";
import { getPingMessages, markPingRead } from "@/actions/pings";
import { PingThread } from "@/components/pings/ping-thread";
import { db } from "@/lib/db";

export default async function PingDetailPage({
  params,
}: {
  params: Promise<{ pingId: string }>;
}) {
  const { pingId } = await params;
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { clerkUserId: userId } }),
    orgId ? db.organization.findUnique({ where: { clerkOrgId: orgId } }) : null,
  ]);
  if (!org) redirect("/sign-in");

  const [ping] = await Promise.all([
    db.ping.findUnique({
      where: { id: pingId, organizationId: org.id },
      include: {
        participants: { include: { user: { select: { id: true, name: true } } } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    markPingRead(pingId),
  ]);

  if (!ping) notFound();

  const messages = await getPingMessages(pingId);

  const otherParticipants = ping.participants.filter((p) => p.user.id !== user?.id);

  let headerTitle = ping.title ?? "";
  let headerSub = "";
  if (ping.type === "DIRECT") {
    headerTitle = otherParticipants[0]?.user.name ?? "Direct Message";
    headerSub = "Direct message";
  } else if (ping.type === "GROUP") {
    headerTitle = ping.title ?? "Group";
    headerSub = `${ping.participants.length} members`;
  } else if (ping.type === "CONTEXTUAL") {
    headerTitle = ping.task?.title ?? ping.project?.name ?? "Discussion";
    headerSub = ping.project?.name ?? "";
  }

  const HeaderIcon =
    ping.type === "DIRECT"     ? MessageCircle :
    ping.type === "GROUP"      ? Users :
                                 Hash;

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border bg-card shrink-0">
        {/* Back — mobile only */}
        <Link
          href="/inbox"
          className="md:hidden shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to messages"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <HeaderIcon className="w-4 h-4 text-muted-foreground shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{headerTitle}</p>
          {headerSub && (
            <p className="text-[11px] text-muted-foreground leading-tight">{headerSub}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {otherParticipants.slice(0, 4).map((p) => (
            <div
              key={p.user.id}
              className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold border border-background"
              title={p.user.name}
            >
              {p.user.name[0]?.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Thread content — fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PingThread
          pingId={pingId}
          pingType={ping.type}
          projectId={ping.project?.id ?? null}
          messages={messages}
          currentUserId={user?.id ?? ""}
        />
      </div>
    </>
  );
}

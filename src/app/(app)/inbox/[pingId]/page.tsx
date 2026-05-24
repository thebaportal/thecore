import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowLeft, Hash } from "lucide-react";
import { getPingMessages, markPingRead } from "@/actions/pings";
import { PingThread } from "@/components/pings/ping-thread";
import { DeleteConversationButton } from "@/components/pings/delete-conversation-button";
import { db } from "@/lib/db";

export default async function InboxThreadPage({
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
        participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    markPingRead(pingId),
  ]);

  if (!ping) notFound();

  const messages = await getPingMessages(pingId);

  const memberUsers = ping.participants.map((p) => p.user);
  const otherParticipants = ping.participants.filter((p) => p.user.id !== user?.id);
  const otherUser = ping.type === "DIRECT" ? otherParticipants[0]?.user : null;

  let headerTitle = ping.title ?? "";
  let headerSub = "";
  if (ping.type === "DIRECT") {
    headerTitle = otherUser?.name ?? "Direct Message";
    headerSub = "Direct message";
  } else if (ping.type === "GROUP") {
    const groupNames = otherParticipants
      .slice(0, 3)
      .map((p) => p.user.name.split(" ")[0])
      .join(", ");
    headerTitle = ping.title ?? groupNames ?? "Group";
    headerSub = `${ping.participants.length} people`;
  } else if (ping.type === "CONTEXTUAL") {
    headerTitle = ping.task?.title ?? ping.project?.name ?? "Discussion";
    headerSub = ping.project?.name ?? "";
  }

  const headerAvatar =
    ping.type === "DIRECT" && otherUser ? (
      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
        {otherUser.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-primary">{otherUser.name[0]?.toUpperCase()}</span>
        )}
      </div>
    ) : ping.type === "GROUP" ? (
      <div className="flex -space-x-1.5 shrink-0">
        {otherParticipants.slice(0, 3).map((p) => (
          <div
            key={p.user.id}
            className="w-6 h-6 rounded-full ring-1 ring-background overflow-hidden bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground"
          >
            {p.user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.user.avatarUrl} alt={p.user.name} className="w-full h-full object-cover" />
            ) : (
              p.user.name[0]?.toUpperCase()
            )}
          </div>
        ))}
      </div>
    ) : (
      <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
    );

  return (
    <>
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border bg-card shrink-0">
        <Link
          href="/inbox"
          className="md:hidden shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {headerAvatar}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{headerTitle}</p>
          {headerSub && (
            <p className="text-[11px] text-muted-foreground leading-tight">{headerSub}</p>
          )}
        </div>

        <DeleteConversationButton pingId={pingId} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <PingThread
          pingId={pingId}
          pingType={ping.type}
          projectId={ping.project?.id ?? null}
          members={memberUsers}
          messages={messages}
          currentUserId={user?.id ?? ""}
        />
      </div>
    </>
  );
}

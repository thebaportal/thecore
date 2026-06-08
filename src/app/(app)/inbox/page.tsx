import { redirect } from "next/navigation";
import { getMyPings } from "@/actions/pings";
import { InboxEmptyState } from "@/components/pings/inbox-empty-state";

export default async function InboxPage() {
  const { pings } = await getMyPings();

  if (pings.length > 0) {
    // Prefer the most recent unread, otherwise just the most recent
    const unread = pings.find((p) => {
      const lastMsg = p.messages[0];
      if (!lastMsg) return false;
      if (!p.currentUserLastReadAt) return true;
      return new Date(lastMsg.createdAt) > new Date(p.currentUserLastReadAt);
    });
    redirect(`/inbox/${(unread ?? pings[0]!).id}`);
  }

  return <InboxEmptyState />;
}

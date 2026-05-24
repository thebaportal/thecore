import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { getMyPings } from "@/actions/pings";

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

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 select-none">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Mail className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">No messages yet</p>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        Click the <span className="font-medium text-foreground">+</span> in the left panel to start a conversation.
      </p>
    </div>
  );
}

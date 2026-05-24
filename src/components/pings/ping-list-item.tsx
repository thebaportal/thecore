"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Hash, MessageCircle, Trash2, Loader2 } from "lucide-react";
import { deletePing } from "@/actions/pings";
import { cn } from "@/lib/utils";

type Participant = { user: { id: string; name: string; avatarUrl: string | null } };

type PingItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "CONTEXTUAL";
  title: string | null;
  project: { id: string; name: string; color: string | null; iconEmoji: string | null } | null;
  task: { id: string; title: string } | null;
  participants: Participant[];
  messages: { body: string; author: { name: string } }[];
  updatedAt: Date | string;
};

function getPingName(ping: PingItem, currentUserId: string): string {
  if (ping.type === "CONTEXTUAL") {
    if (ping.task) return ping.task.title;
    if (ping.project) return ping.project.name;
  }
  if (ping.type === "DIRECT") {
    const other = ping.participants.find((p) => p.user.id !== currentUserId);
    return other?.user.name ?? "Direct Message";
  }
  // For GROUP pings, prefer custom title, then participant first names
  if (ping.title) return ping.title;
  if (ping.project) return ping.project.name;
  const names = ping.participants
    .filter((p) => p.user.id !== currentUserId)
    .slice(0, 3)
    .map((p) => p.user.name.split(" ")[0])
    .join(", ");
  return names || "Group";
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
      {name[0]?.toUpperCase()}
    </div>
  );
}

export function PingListItem({
  ping,
  currentUserId,
  active,
  isUnread = false,
}: {
  ping: PingItem;
  currentUserId: string;
  active: boolean;
  isUnread?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await deletePing(ping.id);
      if (active) router.push("/inbox");
    });
  }

  const name = getPingName(ping, currentUserId);
  const lastMessage = ping.messages[0];
  const color = ping.project?.color ?? "#1E3A8A";

  const otherForDM = ping.participants.find((p) => p.user.id !== currentUserId);
  const groupOthers = ping.participants.filter((p) => p.user.id !== currentUserId).slice(0, 3);

  const icon = (ping.type === "CONTEXTUAL" || ping.project) ? (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {ping.project?.iconEmoji ?? <Hash className="w-3.5 h-3.5" />}
    </div>
  ) : ping.type === "GROUP" ? (
    <div className="w-8 h-8 relative shrink-0">
      {groupOthers.length >= 2 ? (
        <>
          <div className="absolute bottom-0 left-0 w-5 h-5 rounded-full ring-1 ring-background overflow-hidden bg-muted flex items-center justify-center text-[8px] font-semibold text-muted-foreground">
            {groupOthers[0]?.user.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={groupOthers[0].user.avatarUrl} alt="" className="w-full h-full object-cover" />
              : groupOthers[0]?.user.name[0]?.toUpperCase()}
          </div>
          <div className="absolute top-0 right-0 w-5 h-5 rounded-full ring-1 ring-background overflow-hidden bg-muted flex items-center justify-center text-[8px] font-semibold text-muted-foreground">
            {groupOthers[1]?.user.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={groupOthers[1].user.avatarUrl} alt="" className="w-full h-full object-cover" />
              : groupOthers[1]?.user.name[0]?.toUpperCase()}
          </div>
        </>
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  ) : (
    <Avatar name={otherForDM?.user.name ?? "?"} avatarUrl={otherForDM?.user.avatarUrl} />
  );

  return (
    <div className="relative group">
      <Link
        href={`/inbox/${ping.id}`}
        className={cn(
          "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
          active ? "bg-accent" : "hover:bg-muted/60"
        )}
      >
        <div className="relative shrink-0">
          {icon}
          {isUnread && !active && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary border-2 border-sidebar" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn(
              "text-sm truncate",
              isUnread && !active ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}>
              {name}
            </span>
            <span className={cn(
              "text-[10px] shrink-0",
              isUnread && !active ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              {formatDistanceToNow(new Date(ping.updatedAt), { addSuffix: false })}
            </span>
          </div>
          {lastMessage && (
            <p className={cn(
              "text-xs truncate mt-0.5",
              isUnread && !active ? "text-foreground" : "text-muted-foreground"
            )}>
              <span className="font-medium">{lastMessage.author.name.split(" ")[0]}: </span>
              {lastMessage.body}
            </p>
          )}
        </div>
      </Link>

      {/* Delete control — revealed on hover */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirm ? (
          <div className="flex items-center gap-1 bg-card border border-border rounded-md px-1.5 py-1 shadow-sm text-xs">
            <button
              onClick={(e) => { e.preventDefault(); setConfirm(false); }}
              disabled={isPending}
              className="text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              No
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="font-medium text-destructive hover:text-destructive/80 transition-colors px-1"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(true); }}
            className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-muted transition-colors"
            title="Delete conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

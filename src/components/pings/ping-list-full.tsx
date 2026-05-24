"use client";

import { useState } from "react";
import { Plus, Search, MessageCircle } from "lucide-react";
import { PingListItem } from "./ping-list-item";
import { NewPingDialog } from "./new-ping-dialog";
import { Button } from "@/components/ui/button";

type Participant = { user: { id: string; name: string; avatarUrl: string | null } };
type PingItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "CONTEXTUAL";
  title: string | null;
  project: { id: string; name: string; color: string | null; iconEmoji: string | null } | null;
  task: { id: string; title: string } | null;
  participants: Participant[];
  messages: { body: string; author: { name: string }; createdAt: Date }[];
  updatedAt: Date;
  currentUserLastReadAt: Date | null;
};

export function PingListFull({
  pings,
  currentDbUserId,
}: {
  pings: PingItem[];
  currentDbUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [newPingOpen, setNewPingOpen] = useState(false);

  const filtered = pings.filter((p) => {
    if (!search) return true;
    const name =
      p.title ??
      p.project?.name ??
      p.task?.title ??
      p.participants.find((pt) => pt.user.id !== currentDbUserId)?.user.name ??
      "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const unreadCount = pings.filter((p) => {
    const lastMsg = p.messages[0];
    const lastReadAt = p.currentUserLastReadAt;
    return !!lastMsg && (lastReadAt === null || new Date(lastMsg.createdAt) > new Date(lastReadAt));
  }).length;

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted/60 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <Button size="sm" onClick={() => setNewPingOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            New Message
          </Button>
        </div>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{unreadCount}</span>{" "}
            unread {unreadCount === 1 ? "conversation" : "conversations"}
          </p>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {search ? "No conversations match your search" : "No messages yet"}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground mt-1">
                Start a direct message or group conversation with your team.
              </p>
            )}
            {!search && (
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-1.5"
                onClick={() => setNewPingOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-card">
            {filtered.map((ping) => {
              const lastMsg = ping.messages[0];
              const lastReadAt = ping.currentUserLastReadAt;
              const isUnread =
                !!lastMsg &&
                (lastReadAt === null || new Date(lastMsg.createdAt) > new Date(lastReadAt));

              return (
                <PingListItem
                  key={ping.id}
                  ping={ping}
                  currentUserId={currentDbUserId}
                  active={false}
                  isUnread={isUnread}
                />
              );
            })}
          </div>
        )}
      </div>

      <NewPingDialog open={newPingOpen} onOpenChange={setNewPingOpen} />
    </>
  );
}

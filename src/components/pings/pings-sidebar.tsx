"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
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

export function PingsSidebar({
  pings,
  currentDbUserId,
}: {
  pings: PingItem[];
  currentDbUserId: string;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [newPingOpen, setNewPingOpen] = useState(false);

  const filtered = pings.filter((p) => {
    if (!search) return true;
    const name = p.title ?? p.project?.name ?? p.task?.title ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-sidebar overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-foreground">Messages</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setNewPingOpen(true)}
              title="New Message"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Ping list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">
                {search ? "No messages match your search" : "No messages yet"}
              </p>
              {!search && (
                <button
                  onClick={() => setNewPingOpen(true)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Start one →
                </button>
              )}
            </div>
          ) : (
            filtered.map((ping) => {
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
                  active={pathname === `/pings/${ping.id}`}
                  isUnread={isUnread}
                />
              );
            })
          )}
        </div>
      </aside>

      <NewPingDialog open={newPingOpen} onOpenChange={setNewPingOpen} />
    </>
  );
}

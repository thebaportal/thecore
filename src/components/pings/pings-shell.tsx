"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, Plus } from "lucide-react";
import { PingListItem } from "./ping-list-item";
import { NewPingDialog } from "./new-ping-dialog";
import { createPing } from "@/actions/pings";
import { cn } from "@/lib/utils";

type OrgMember = { id: string; name: string; avatarUrl: string | null };

type PingShellItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "CONTEXTUAL";
  title: string | null;
  project: { id: string; name: string; color: string | null; iconEmoji: string | null } | null;
  task: { id: string; title: string } | null;
  participants: { user: { id: string; name: string; avatarUrl: string | null } }[];
  messages: { body: string; author: { name: string }; createdAt: Date | string }[];
  updatedAt: Date | string;
  currentUserLastReadAt: Date | string | null;
};

function MemberButton({
  m,
  openingMemberId,
  onClick,
}: {
  m: OrgMember;
  openingMemberId: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={openingMemberId === m.id}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left disabled:opacity-60"
    >
      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
        {m.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
        ) : (
          m.name[0]?.toUpperCase()
        )}
      </div>
      <span className="text-sm text-foreground truncate">{m.name}</span>
      {openingMemberId === m.id && (
        <span className="ml-auto text-[10px] text-muted-foreground">Opening…</span>
      )}
    </button>
  );
}

export function PingsShell({
  pings,
  currentDbUserId,
  orgMembers = [],
  children,
}: {
  pings: PingShellItem[];
  currentDbUserId: string;
  orgMembers?: OrgMember[];
  children: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [newPingOpen, setNewPingOpen] = useState(false);
  const [openingMemberId, setOpeningMemberId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  const activePingId = pathname.startsWith("/inbox/") ? pathname.split("/")[2] : null;
  const hasActiveThread = Boolean(activePingId);

  const q = search.trim().toLowerCase();

  // ── List mode ────────────────────────────────────────────────────────────────
  const filteredPings = pings.filter((p) => {
    if (!q) return true;
    const name =
      p.title ??
      p.project?.name ??
      p.task?.title ??
      p.participants.find((pt) => pt.user.id !== currentDbUserId)?.user.name ??
      "";
    const lastMsg = p.messages[0]?.body ?? "";
    return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
  });

  // ── Compose mode ─────────────────────────────────────────────────────────────
  // Build a recency map: memberId → updatedAt of their most recent DM
  const dmRecencyMap = new Map<string, number>();
  for (const p of pings) {
    if (p.type !== "DIRECT") continue;
    const other = p.participants.find((pt) => pt.user.id !== currentDbUserId);
    if (!other) continue;
    const t = new Date(p.updatedAt).getTime();
    const existing = dmRecencyMap.get(other.user.id) ?? 0;
    if (t > existing) dmRecencyMap.set(other.user.id, t);
  }

  const filteredMembers = orgMembers
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const ta = dmRecencyMap.get(a.id) ?? 0;
      const tb = dmRecencyMap.get(b.id) ?? 0;
      if (ta !== tb) return tb - ta; // most recent first
      return a.name.localeCompare(b.name); // then alphabetical
    });

  function openOrCreateDM(member: OrgMember) {
    const existing = pings.find(
      (p) =>
        p.type === "DIRECT" &&
        p.participants.some((pt) => pt.user.id === member.id)
    );
    if (existing) {
      router.push(`/inbox/${existing.id}`);
      setSearch("");
      return;
    }
    setOpeningMemberId(member.id);
    startTransition(async () => {
      const result = await createPing({ type: "DIRECT", participantIds: [member.id] });
      if (result.success) {
        router.push(`/inbox/${result.ping.id}`);
        setSearch("");
      }
      setOpeningMemberId(null);
    });
  }

  return (
    <>
      <div
        className="-mt-6 sm:-mt-8 -mx-4 sm:-mx-6 flex overflow-hidden bg-background"
        style={{ height: "calc(100vh - 56px)" }}
      >
        {/* ── Left panel ── */}
        <div
          className={cn(
            "w-full md:w-72 shrink-0 flex flex-col overflow-hidden bg-background border-r border-border",
            hasActiveThread && "hidden md:flex"
          )}
        >
          <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Inbox</h2>
                <button
                  onClick={() => setNewPingOpen(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="New conversation"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Search — always visible */}
              <div className="px-3 py-2 border-b border-border/60 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search people or conversations…"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/60 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1.5 px-2">
                {/* People suggestions — shown when searching */}
                {q && filteredMembers.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      People
                    </p>
                    {filteredMembers.slice(0, 5).map((m) => (
                      <MemberButton key={m.id} m={m} openingMemberId={openingMemberId} onClick={() => openOrCreateDM(m)} />
                    ))}
                    {filteredPings.length > 0 && (
                      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Conversations
                      </p>
                    )}
                  </div>
                )}

                {/* Conversation list */}
                {filteredPings.length === 0 && !q ? (
                  <p className="text-xs text-muted-foreground text-center py-10 px-4">
                    Search above to find someone and start a conversation.
                  </p>
                ) : filteredPings.length === 0 && q && filteredMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No results for &ldquo;{search}&rdquo;</p>
                ) : (
                  filteredPings.map((ping) => {
                    const lastMsg = ping.messages[0];
                    const isUnread =
                      !!lastMsg &&
                      (!ping.currentUserLastReadAt ||
                        new Date(lastMsg.createdAt) > new Date(ping.currentUserLastReadAt));
                    return (
                      <PingListItem
                        key={ping.id}
                        ping={ping}
                        currentUserId={currentDbUserId}
                        active={ping.id === activePingId}
                        isUnread={isUnread}
                      />
                    );
                  })
                )}
              </div>
            </>

        </div>

        {/* ── Right: thread content ── */}
        <div
          className={cn(
            "flex-1 min-w-0 overflow-hidden flex flex-col",
            !hasActiveThread && "hidden md:flex"
          )}
        >
          {children}
        </div>
      </div>

      <NewPingDialog open={newPingOpen} onOpenChange={setNewPingOpen} />
    </>
  );
}

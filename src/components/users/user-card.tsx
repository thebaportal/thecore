"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { getUserCard } from "@/actions/users";
import { createPing } from "@/actions/pings";

type UserCardData = Awaited<ReturnType<typeof getUserCard>>;

export function UserCard({
  userId,
  children,
  side = "bottom",
  align = "start",
}: {
  userId: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserCardData>(null);
  const [loading, setLoading] = useState(false);
  const [isPinging, startPingTransition] = useTransition();

  async function handleOpen(open: boolean) {
    if (open && !user) {
      setLoading(true);
      try {
        const data = await getUserCard(userId);
        setUser(data);
      } finally {
        setLoading(false);
      }
    }
  }

  function handleMessage() {
    startPingTransition(async () => {
      const result = await createPing({ type: "DIRECT", participantIds: [userId] });
      if (result.success) router.push(`/inbox/${result.ping.id}`);
    });
  }

  const role = user?.memberships?.[0]?.role ?? null;
  void role;

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger render={<span className="inline-flex cursor-pointer" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} sideOffset={8} className="w-64 p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <div className="text-center">
            {/* Avatar */}
            <div className="bg-muted/60 pt-6 pb-5 px-6 flex flex-col items-center gap-2.5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-background shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-semibold ring-2 ring-background shadow-sm">
                  {user.name[0]?.toUpperCase()}
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-foreground leading-snug">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user.jobTitle ? `${user.jobTitle} at ${user.orgName}` : `at ${user.orgName}`}
                </p>
              </div>

              {user.bio && (
                <p className="text-xs text-foreground/60 leading-relaxed line-clamp-2">
                  {user.bio}
                </p>
              )}
            </div>

            {/* Stats */}
            {user.projectCount > 0 && (
              <div className="flex justify-center py-3 border-b border-border/60 mx-4">
                <div>
                  <p className="text-sm font-semibold text-foreground tabular-nums">{user.projectCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {user.projectCount === 1 ? "Project" : "Projects"}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={handleMessage}
                disabled={isPinging}
                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isPinging
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <MessageCircle className="w-4 h-4" />}
                Message {firstName}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">Could not load profile.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

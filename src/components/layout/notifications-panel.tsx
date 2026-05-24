"use client";

import { useState, useTransition, useOptimistic, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, CheckCircle2, MessageCircle, FolderKanban, X,
  Upload, RotateCcw, Unlock, CheckSquare, AtSign, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import type { AppNotification } from "@/actions/notifications";
import { cn } from "@/lib/utils";

// Re-export for the topbar import
export type Notification = AppNotification;

const KIND_ICON: Record<AppNotification["kind"], React.ReactNode> = {
  DELIVERABLE_SUBMITTED: <Upload        className="w-3.5 h-3.5 text-amber-500"   />,
  DELIVERABLE_APPROVED:  <CheckCircle2  className="w-3.5 h-3.5 text-emerald-500" />,
  DELIVERABLE_REVISION:  <RotateCcw     className="w-3.5 h-3.5 text-amber-500"   />,
  PHASE_UNLOCKED:        <Unlock        className="w-3.5 h-3.5 text-blue-500"    />,
  TASK_ASSIGNED:         <CheckSquare   className="w-3.5 h-3.5 text-violet-500"  />,
  CHAT_MENTION:          <AtSign        className="w-3.5 h-3.5 text-primary"     />,
  LIBRARY_UPLOAD:        <BookOpen      className="w-3.5 h-3.5 text-emerald-500" />,
  ping_message:          <MessageCircle className="w-3.5 h-3.5 text-violet-500"  />,
};

export function NotificationsPanel({
  notifications: initial,
}: {
  notifications: Notification[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Poll every 30 s — background refresh keeps bell count current without WebSockets
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  // Optimistic read state: track IDs marked read locally before server confirms
  const [optimisticRead, addOptimisticRead] = useOptimistic<Set<string>, string>(
    new Set(),
    (prev, id) => new Set([...prev, id]),
  );

  // Merge DB + local optimistic state
  const notifications = initial.map((n) => ({
    ...n,
    read: n.read || optimisticRead.has(n.id) || optimisticRead.has("__all__"),
  }));

  const unread = notifications.filter((n) => !n.read).length;

  function handleMarkRead(id: string) {
    startTransition(async () => {
      addOptimisticRead(id);
      await markNotificationRead(id);
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      addOptimisticRead("__all__");
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <>
      {/* Trigger */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Notifications"
          onClick={() => setOpen((v) => !v)}
        >
          <Bell className="w-4 h-4" />
        </Button>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center pointer-events-none">
            <span className="text-[9px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          </span>
        )}
      </div>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOpen(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center gap-2">
                <Bell className="w-5 h-5 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">You're all caught up</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onRead={() => handleMarkRead(n.id)}
                  onNavigate={() => setOpen(false)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NotificationRow({
  notification: n,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  onRead: () => void;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={n.href}
      onClick={() => {
        if (!n.read) onRead();
        onNavigate();
      }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors",
        !n.read && "bg-primary/5",
      )}
    >
      <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
        {KIND_ICON[n.kind]}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs text-foreground leading-snug",
          !n.read && "font-medium",
        )}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(n.at, { addSuffix: true })}
        </p>
      </div>
      {!n.read && (
        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
      )}
    </Link>
  );
}

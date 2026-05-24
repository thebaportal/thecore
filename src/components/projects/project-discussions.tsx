"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { format, formatDistanceToNow, isThisYear } from "date-fns";
import { MessageCircle, Plus, CheckSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewPingDialog } from "@/components/pings/new-ping-dialog";
import { createTask } from "@/actions/tasks";
import { cn } from "@/lib/utils";

type Discussion = {
  id: string;
  title: string | null;
  createdAt: Date;
  _count: { messages: number };
  participants: { user: { id: string; name: string; avatarUrl: string | null } }[];
  messages: { author: { name: string }; body?: string; createdAt: Date }[];
};

function formatDiscussionDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / 3_600_000;
  if (diffHours < 24) return formatDistanceToNow(d, { addSuffix: true });
  if (isThisYear(d)) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

function AvatarStack({ participants }: { participants: Discussion["participants"] }) {
  const shown = participants.slice(0, 4);
  return (
    <div className="flex -space-x-1.5">
      {shown.map((p) => (
        p.user.avatarUrl ? (
          <img
            key={p.user.id}
            src={p.user.avatarUrl}
            alt={p.user.name}
            title={p.user.name}
            className="w-5 h-5 rounded-full border border-card object-cover"
          />
        ) : (
          <div
            key={p.user.id}
            title={p.user.name}
            className="w-5 h-5 rounded-full border border-card bg-primary/10 flex items-center justify-center"
          >
            <span className="text-[8px] font-semibold text-primary">
              {p.user.name[0]?.toUpperCase()}
            </span>
          </div>
        )
      ))}
      {participants.length > 4 && (
        <div className="w-5 h-5 rounded-full border border-card bg-muted flex items-center justify-center">
          <span className="text-[8px] text-muted-foreground">+{participants.length - 4}</span>
        </div>
      )}
    </div>
  );
}

function TurnIntoTaskButton({
  title,
  projectId,
}: {
  title: string;
  projectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (done || isPending) return;
    startTransition(async () => {
      await createTask({ projectId, title, status: "TODO", priority: "MEDIUM" });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-all shrink-0",
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
      )}
    >
      {isPending ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      ) : (
        <CheckSquare className="w-2.5 h-2.5" />
      )}
      {done ? "Task added" : "→ Task"}
    </button>
  );
}

export function ProjectDiscussions({
  projectId,
  discussions,
}: {
  projectId: string;
  discussions: Discussion[];
}) {
  const [newOpen, setNewOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" className="gap-1.5 h-8" onClick={() => setNewOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      {discussions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground/40">No conversations yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
          {discussions.map((d) => {
            const lastMsg = d.messages[0];
            return (
              <Link
                key={d.id}
                href={`/inbox/${d.id}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {d.title ?? "Untitled discussion"}
                  </p>
                  {lastMsg && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lastMsg.author.name} · {formatDiscussionDate(lastMsg.createdAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TurnIntoTaskButton
                    title={d.title ?? "Task from discussion"}
                    projectId={projectId}
                  />
                  <AvatarStack participants={d.participants} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {d._count.messages}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NewPingDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultProjectId={projectId}
        defaultType="CONTEXTUAL"
      />
    </>
  );
}

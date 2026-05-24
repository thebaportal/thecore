"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { createPing } from "@/actions/pings";
import { cn } from "@/lib/utils";

export function MessageButton({
  targetUserId,
  targetName,
  variant = "icon",
}: {
  targetUserId: string;
  targetName: string;
  variant?: "icon" | "outline";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createPing({ type: "DIRECT", participantIds: [targetUserId] });
        if (result.success) {
          router.push(`/inbox/${result.ping.id}`);
        }
      } catch {
        setError("Could not open conversation");
      }
    });
  }

  if (variant === "outline") {
    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        title={error ?? undefined}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors disabled:opacity-50 w-full justify-center",
          error && "border-destructive/40 text-destructive"
        )}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <MessageCircle className="w-3 h-3" />
        )}
        {error ?? "Message"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={error ?? `Message ${targetName}`}
      className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <MessageCircle className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

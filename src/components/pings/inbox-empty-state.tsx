"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { NewPingDialog } from "./new-ping-dialog";

export function InboxEmptyState() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 select-none gap-3">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        <MessageCircle className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Your inbox is empty</p>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Start a direct message or create a group conversation.
        </p>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="mt-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        New Conversation
      </button>
      <NewPingDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

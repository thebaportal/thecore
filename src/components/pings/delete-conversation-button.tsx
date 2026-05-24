"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, Trash2, Loader2 } from "lucide-react";
import { deletePing } from "@/actions/pings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DeleteConversationButton({ pingId }: { pingId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deletePing(pingId);
      router.push("/inbox");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              title="More options"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1"
            />
          }
        >
          <Ellipsis className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the conversation and all its messages for everyone. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={isPending} onClick={handleConfirm}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

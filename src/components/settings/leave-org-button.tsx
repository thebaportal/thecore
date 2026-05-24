"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveOrganization } from "@/actions/users";

export function LeaveOrgButton({ orgName }: { orgName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLeave() {
    setError(null);
    startTransition(async () => {
      try {
        await leaveOrganization();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not leave organization.");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Are you sure you want to leave{orgName ? ` ${orgName}` : " this organization"}?
          This cannot be undone.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleLeave} disabled={isPending}>
            {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Yes, remove me
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      Leave{orgName ? ` ${orgName}` : " organization"}
    </Button>
  );
}

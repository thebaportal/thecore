"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createPing } from "@/actions/pings";
import { getOrgMembers } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; avatarUrl: string | null };
type PingType = "DIRECT" | "GROUP" | "CONTEXTUAL";

export function NewPingDialog({
  open,
  onOpenChange,
  defaultProjectId,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  defaultType?: PingType;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isDiscussion = defaultType === "CONTEXTUAL";
  const [pingType, setPingType] = useState<PingType>(defaultType ?? "DIRECT");
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    if (open) {
      setPingType(defaultType ?? "DIRECT");
      if (!isDiscussion) getOrgMembers().then(setMembers);
    }
  }, [open, defaultType, isDiscussion]);

  function toggleMember(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleClose() {
    onOpenChange(false);
    setSelected([]);
    setTitle("");
    setMemberSearch("");
    setPingType(defaultType ?? "DIRECT");
  }

  function submit() {
    if (!isDiscussion && selected.length === 0) return;
    if (isDiscussion && !title.trim()) return;

    startTransition(async () => {
      const result = await createPing({
        type: pingType,
        title: title.trim() || undefined,
        participantIds: selected,
        projectId: defaultProjectId,
      });
      if (result.success) {
        handleClose();
        router.push(`/inbox/${result.ping.id}`);
      }
    });
  }

  const dialogTitle = isDiscussion ? "New Discussion" : "New Message";
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Type toggle — only for non-discussion pings */}
          {!isDiscussion && (
            <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 gap-0.5">
              {(["DIRECT", "GROUP"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPingType(t)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                    pingType === t
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "DIRECT" ? "Direct" : "Group"}
                </button>
              ))}
            </div>
          )}

          {/* Title — always shown for CONTEXTUAL, for GROUP too */}
          {(isDiscussion || pingType === "GROUP") && (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isDiscussion ? "Discussion title" : "Group name (optional)"}
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus={isDiscussion}
            />
          )}

          {/* Member list — not shown for contextual discussions */}
          {!isDiscussion && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {pingType === "DIRECT" ? "Select person" : "Add people"}
              </label>
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search people…"
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">No members found</p>
                ) : (
                  filteredMembers.map((m) => {
                    const isSelected = selected.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (pingType === "DIRECT") setSelected([m.id]);
                          else toggleMember(m.id);
                        }}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors",
                          isSelected ? "bg-accent" : "hover:bg-muted/50"
                        )}
                      >
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {m.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-foreground">{m.name}</span>
                        {isSelected && <span className="ml-auto text-primary text-xs">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={(isDiscussion ? !title.trim() : selected.length === 0) || isPending}
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isDiscussion ? "Start Discussion" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

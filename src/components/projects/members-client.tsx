"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Mail, Clock, Loader2, UserMinus, RefreshCw, FileUp } from "lucide-react";
import { MessageButton } from "@/components/pings/message-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProjectInviteButton } from "@/components/projects/project-invite-button";
import {
  removeProjectMember,
  revokeProjectInvitation,
  resendProjectInvitation,
  type ProjectMembersData,
} from "@/actions/invitations";
import { BulkInviteDialog } from "@/components/projects/bulk-invite-dialog";
import { cn } from "@/lib/utils";

type ConfirmState =
  | { kind: "remove"; memberId: string; name: string }
  | { kind: "revoke"; invitationId: string; email: string }
  | null;

type ResendState = { id: string } | null;

function Avatar({ name, avatarUrl, size = "lg" }: { name: string; avatarUrl: string | null; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 text-xl" : "w-8 h-8 text-sm";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn("rounded-full bg-muted overflow-hidden flex items-center justify-center font-semibold text-muted-foreground shrink-0", dim)}>
      {avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : initials}
    </div>
  );
}

export function MembersClient({
  projectId,
  data,
}: {
  projectId: string;
  data: ProjectMembersData;
}) {
  const { currentDbUserId } = data;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [resending, setResending] = useState<ResendState>(null);
  const [removingInvite, setRemovingInvite] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  function handleResend(invitationId: string) {
    setResending({ id: invitationId });
    startTransition(async () => {
      await resendProjectInvitation(projectId, invitationId);
      setResending(null);
      router.refresh();
    });
  }

  function handleConfirmAction() {
    if (!confirm) return;
    if (confirm.kind === "revoke") {
      // Optimistic: hide immediately, confirm with server in background
      setRemovingInvite(confirm.invitationId);
      setConfirm(null);
      startTransition(async () => {
        await revokeProjectInvitation(projectId, confirm.invitationId);
        setRemovingInvite(null);
        router.refresh();
      });
      return;
    }
    startTransition(async () => {
      await removeProjectMember(projectId, confirm.memberId);
      setConfirm(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground">
            {data.members.length} {data.members.length === 1 ? "person" : "people"} on this team
            {data.invitations.length > 0 && `, ${data.invitations.length} pending`}
          </p>
        </div>
        {data.isInstructor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <FileUp className="w-3.5 h-3.5" />
              Import CSV
            </button>
            <ProjectInviteButton projectId={projectId} />
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "remove" ? `Remove ${confirm.name}?` : "Revoke invitation?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirm?.kind === "remove"
              ? "They will lose access to this project but remain in the organisation."
              : `The invitation to ${confirm?.kind === "revoke" ? confirm.email : ""} will be cancelled.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={isPending} onClick={handleConfirmAction}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirm?.kind === "remove" ? "Remove" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member cards */}
      {data.members.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground rounded-xl border border-border border-dashed">
          No one on this team yet. Use the Invite button to add people.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.members.map((m) => {
            const isSelf = m.userId === currentDbUserId;
            return (
              <div
                key={m.id}
                className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center hover:shadow-sm transition-shadow"
              >
                {/* Instructor remove button — top-right, visible on hover */}
                {data.isInstructor && !isSelf && (
                  <button
                    onClick={() => setConfirm({ kind: "remove", memberId: m.id, name: m.user.name })}
                    className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove member"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                )}

                <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="lg" />

                <div className="space-y-1 min-w-0 w-full">
                  <p className="text-sm font-semibold text-foreground truncate">{m.user.name}</p>
                  {m.user.jobTitle && (
                    <p className="text-xs text-muted-foreground truncate">{m.user.jobTitle}</p>
                  )}
                  {isSelf && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                      You
                    </span>
                  )}
                </div>

                {!isSelf && (
                  <MessageButton
                    targetUserId={m.userId}
                    targetName={m.user.name}
                    variant="outline"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending invitations — instructor only */}
      {data.isInstructor && data.invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Pending Invitations</h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {data.invitations.filter((inv) => inv.id !== removingInvite).map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      Invited {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                    Pending
                  </span>
                  <button
                    onClick={() => handleResend(inv.id)}
                    disabled={isPending && resending?.id === inv.id}
                    className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Resend invitation"
                  >
                    {isPending && resending?.id === inv.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setConfirm({ kind: "revoke", invitationId: inv.id, email: inv.email })}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Revoke invitation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <BulkInviteDialog
        projectId={projectId}
        open={bulkOpen}
        onClose={() => { setBulkOpen(false); router.refresh(); }}
      />
    </div>
  );
}

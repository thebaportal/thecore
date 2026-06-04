"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Users } from "lucide-react";
import { removeRepositoryMemberships } from "@/actions/org-settings";
import type { MultiProjectUser } from "@/actions/org-settings";
import { cn } from "@/lib/utils";

export function MultiProjectReport({ users: initial }: { users: MultiProjectUser[] }) {
  const [users, setUsers] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ membershipsRemoved: number; orgMembershipsRemoved: number } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const totalRepoMemberships = users.reduce((sum, u) => sum + u.repoCount, 0);

  function handleRemove() {
    startTransition(async () => {
      const res = await removeRepositoryMemberships();
      setResult(res);
      // Remove users who now have no repo memberships (all were cleaned)
      setUsers((prev) => prev.map((u) => ({
        ...u,
        projects: u.projects.filter((p) => !p.isRepo),
        repoCount: 0,
      })).filter((u) => u.realCount > 1)); // keep only those still with 2+ real projects (for info)
      setConfirming(false);
    });
  }

  if (initial.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No users have repository project memberships.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary + action */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{initial.length}</span> {initial.length === 1 ? "user has" : "users have"} repository project memberships
            {" "}({totalRepoMemberships} total memberships to remove)
          </p>
          <p className="text-xs text-muted-foreground">
            Repository projects are flagged based on name patterns — Materials, Learning, HQ, etc.
            Real projects are unaffected.
          </p>
        </div>

        {result ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {result.membershipsRemoved} memberships removed · {result.orgMembershipsRemoved} users removed from org
          </div>
        ) : confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Remove {totalRepoMemberships} repo memberships?</span>
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              {isPending ? "Removing…" : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/5 transition-colors"
          >
            Remove all repo memberships
          </button>
        )}
      </div>

      {/* User list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">User</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Projects</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Repo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.userId} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-foreground text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {user.projects.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                          p.isRepo
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {p.isRepo && <AlertTriangle className="w-2.5 h-2.5" />}
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color ?? "#6366f1" }}
                        />
                        {p.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {user.repoCount > 0 ? (
                    <span className="text-xs font-semibold text-amber-600">{user.repoCount}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Users with only repository memberships will also be removed from the organisation.
        Users with at least one real project remain as org members.
      </p>
    </div>
  );
}

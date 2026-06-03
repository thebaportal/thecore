"use client";

import { useState } from "react";
import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrgSwitcher({
  orgLogoUrl,
  orgName,
}: {
  orgLogoUrl: string | null;
  orgName: string;
}) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: currentOrg } = useOrganization();

  const orgs = userMemberships.data ?? [];
  const initials = orgName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function handleSwitch(orgId: string) {
    if (!setActive) return;
    setSwitching(orgId);
    await setActive({ organization: orgId });
    setSwitching(null);
    setOpen(false);
    window.location.href = "/dashboard";
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-sidebar-foreground"
      >
        {orgLogoUrl ? (
          <img
            src={orgLogoUrl}
            alt={orgName}
            className="h-5 w-auto max-w-[20px] rounded object-contain bg-white shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-primary-foreground text-[8px] font-bold shrink-0">
            {initials}
          </div>
        )}
        <span className="flex-1 text-sm truncate text-left">{orgName}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
      </button>

      {open && isLoaded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-border/60">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Workspaces
              </span>
            </div>
            {orgs.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">No other workspaces.</div>
            ) : (
              orgs.map(({ organization }) => {
                const isCurrent = organization.id === currentOrg?.id;
                const isSwitching = switching === organization.id;
                return (
                  <button
                    key={organization.id}
                    onClick={() => !isCurrent && handleSwitch(organization.id)}
                    disabled={isSwitching}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left",
                      isCurrent
                        ? "bg-primary/8 text-primary cursor-default"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <img
                      src={organization.imageUrl}
                      alt={organization.name}
                      className="w-6 h-6 rounded-md object-cover shrink-0"
                    />
                    <span className="flex-1 truncate">{organization.name}</span>
                    {isCurrent && <Check className="w-3.5 h-3.5 shrink-0" />}
                    {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type OrgBranding = {
  logoUrl: string | null;
  brandColor: string | null;
  displayName: string | null;
  name: string;
};

export default function OrganizationSelectionPage() {
  const { user } = useUser();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({ userMemberships: true });
  const router = useRouter();
  const [branding, setBranding] = useState<Record<string, OrgBranding>>({});

  const memberships = userMemberships?.data ?? [];

  useEffect(() => {
    if (!isLoaded || memberships.length === 0) return;
    const ids = memberships.map((m) => m.organization.id).join(",");
    fetch(`/api/org-branding?ids=${ids}`)
      .then((r) => r.json())
      .then((data: Record<string, OrgBranding>) => setBranding(data))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, memberships.length]);

  async function select(orgId: string) {
    await setActive!({ organization: orgId });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-white border border-border shadow-sm">
            <div className="w-4 h-4 rounded bg-[#1E3A8A] flex items-center justify-center shrink-0">
              <span className="text-[8px] font-black text-white">TC</span>
            </div>
            <span className="text-xs font-medium text-foreground">The Core</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Welcome{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select your workspace to continue.
          </p>
        </div>

        {!isLoaded ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : memberships.length === 0 ? (
          <div className="rounded-xl border border-border bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-foreground mb-1">No workspace found</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You haven&apos;t been added to a workspace yet. Ask your admin to invite you, then refresh this page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-xs text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {memberships.map((mem) => {
              const b = branding[mem.organization.id];
              const logoUrl = b?.logoUrl ?? null;
              const displayName = b?.displayName ?? b?.name ?? mem.organization.name;
              const brandColor = b?.brandColor ?? "#1E3A8A";
              const initials = displayName
                .split(" ")
                .slice(0, 2)
                .map((w: string) => w[0])
                .join("")
                .toUpperCase();

              return (
                <button
                  key={mem.organization.id}
                  onClick={() => select(mem.organization.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-white hover:shadow-md transition-all text-left group"
                  style={{ "--org-color": brandColor } as React.CSSProperties}
                >
                  {/* Logo or branded initials */}
                  {logoUrl ? (
                    <div className="w-12 h-12 rounded-xl border border-border bg-white flex items-center justify-center p-1.5 shrink-0">
                      <img src={logoUrl} alt={displayName} className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: brandColor }}
                    >
                      {initials}
                    </div>
                  )}

                  {/* Org info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {mem.role.replace("org:", "")}
                    </p>
                  </div>

                  {/* Brand color accent bar + arrow */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="w-1 h-8 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: brandColor }}
                    />
                    <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-sm">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground/40 mt-8">
          Powered by The Core
        </p>
      </div>
    </div>
  );
}

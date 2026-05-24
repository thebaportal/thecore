"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function OrganizationSelectionPage() {
  const { user } = useUser();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({ userMemberships: true });
  const router = useRouter();

  async function select(orgId: string) {
    await setActive!({ organization: orgId });
    router.push("/dashboard");
  }

  const memberships = userMemberships?.data ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
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
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground mb-1">No workspace found</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You haven't been added to a workspace yet. Ask your admin to invite you, then refresh this page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-xs text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {memberships.map((mem) => (
              <button
                key={mem.organization.id}
                onClick={() => select(mem.organization.id)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
              >
                {mem.organization.imageUrl ? (
                  <img
                    src={mem.organization.imageUrl}
                    alt={mem.organization.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {mem.organization.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{mem.organization.name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{mem.role.replace("org:", "")}</p>
                </div>
                <span className="text-muted-foreground/40 text-sm">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

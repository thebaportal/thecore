import type { Metadata } from "next";
import { OrganizationProfile } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Organization Settings" };

export default function OrganizationSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <a href="/settings" className="hover:text-foreground transition-colors">Settings</a>
          <span>/</span>
          <span className="text-foreground">Organization</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Organization</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organization profile and members.</p>
      </div>

      <OrganizationProfile
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "border border-border rounded-xl shadow-none",
          },
        }}
      />
    </div>
  );
}

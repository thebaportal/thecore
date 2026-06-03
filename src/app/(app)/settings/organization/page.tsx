import type { Metadata } from "next";
import { OrganizationProfile } from "@clerk/nextjs";
import { getOrgPostCategories } from "@/actions/posts";
import { getOrgBrandingSettings } from "@/actions/org-branding";
import { PostCategoriesEditor } from "@/components/settings/post-categories-editor";
import { OrgBrandingForm } from "@/components/settings/org-branding-form";

export const metadata: Metadata = { title: "Organization Settings" };

export default async function OrganizationSettingsPage() {
  const [categories, branding] = await Promise.all([
    getOrgPostCategories(),
    getOrgBrandingSettings(),
  ]);

  return (
    <div className="space-y-8 max-w-2xl">
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
        routing="path"
        path="/settings/organization"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "border border-border rounded-xl shadow-none",
          },
        }}
      />

      {/* Workspace branding */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Workspace branding</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logo and brand colors appear in the sidebar, library, and across the workspace.
          </p>
        </div>
        <OrgBrandingForm
          initialLogoUrl={branding?.logoUrl ?? null}
          initialBrandColor={branding?.brandColor ?? null}
          initialSecondaryColor={branding?.secondaryColor ?? null}
          orgName={branding?.name ?? ""}
        />
      </div>

      {/* Post categories */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Post categories</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown as badges on the message board. Instructors choose a category when writing a post.
          </p>
        </div>
        <PostCategoriesEditor initial={categories} />
      </div>
    </div>
  );
}

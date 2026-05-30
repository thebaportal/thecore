import type { Metadata } from "next";
import { OrganizationProfile } from "@clerk/nextjs";
import { getOrgPostCategories } from "@/actions/posts";
import { PostCategoriesEditor } from "@/components/settings/post-categories-editor";

export const metadata: Metadata = { title: "Organization Settings" };

export default async function OrganizationSettingsPage() {
  const categories = await getOrgPostCategories();

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

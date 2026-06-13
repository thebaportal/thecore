import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Users, ShieldCheck, BookOpen, FolderKanban,
  ArrowRight, Download, ChevronRight,
} from "lucide-react";
import { getOrgPostCategories } from "@/actions/posts";
import { getOrgBrandingSettings } from "@/actions/org-branding";
import { getProjectsForReclassification, getMultiProjectReport, getOrgMemberStats } from "@/actions/org-settings";
import { PostCategoriesEditor } from "@/components/settings/post-categories-editor";
import { OrgBrandingForm } from "@/components/settings/org-branding-form";
import { ProjectReclassification } from "@/components/settings/project-reclassification";
import { MultiProjectReport } from "@/components/settings/multi-project-report";
import { OrgSettingsTabs, type OrgSettingsTab } from "@/components/settings/org-settings-tabs";

export const metadata: Metadata = { title: "Organization Settings" };

const ROLES = [
  {
    icon: ShieldCheck,
    name: "Admin",
    description: "Full access — manage members, review deliverables, configure settings.",
  },
  {
    icon: Users,
    name: "Member",
    description: "Standard access — complete tasks, submit deliverables, join discussions.",
  },
  {
    icon: BookOpen,
    name: "Student",
    description: "Assigned to one project — follows their cohort's phase and deliverables.",
  },
];

export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab = "overview" } = await searchParams;
  const tab = (["overview", "categories", "advanced"].includes(rawTab)
    ? rawTab
    : "overview") as OrgSettingsTab;

  const [categories, branding, reclassProjects, multiProjectUsers, memberStats] = await Promise.all([
    getOrgPostCategories(),
    getOrgBrandingSettings(),
    getProjectsForReclassification(),
    getMultiProjectReport(),
    getOrgMemberStats(),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Link href="/settings" className="hover:text-foreground transition-colors">Settings</Link>
          <span>/</span>
          <span className="text-foreground">Organization</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Organization Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your workspace profile, members, and enterprise settings.
            </p>
          </div>
          <Link
            href="/team"
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View team <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Tab navigation */}
      <Suspense fallback={null}>
        <OrgSettingsTabs active={tab} />
      </Suspense>

      {/* ── OVERVIEW tab ──────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Branding (2/3) */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-foreground">Workspace Identity</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How your organization appears across the platform — sidebar, library, and student-facing screens.
                </p>
              </div>
              <OrgBrandingForm
                initialLogoUrl={branding?.logoUrl ?? null}
                initialBrandColor={branding?.brandColor ?? null}
                initialSecondaryColor={branding?.secondaryColor ?? null}
                initialDisplayName={branding?.displayName ?? null}
                orgName={branding?.name ?? ""}
              />
            </div>
          </div>

          {/* Right: Stats + Roles (1/3) */}
          <div className="space-y-5">

            {/* Member stats */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Members</h2>
                <Link href="/team" className="text-xs text-primary hover:underline">
                  Manage →
                </Link>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border">
                <div className="pr-4 text-center">
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {memberStats?.total ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">Total</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {memberStats?.pendingInvitations ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">Pending</p>
                </div>
                <div className="pl-4 text-center">
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {memberStats?.admins ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">Admins</p>
                </div>
              </div>
            </div>

            {/* Roles & Permissions */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Roles & Permissions</h2>
              <div className="space-y-0 divide-y divide-border/50">
                {ROLES.map(({ icon: Icon, name, description }) => (
                  <div key={name} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Basecamp integration quick link */}
            <Link
              href="/settings/import/basecamp"
              className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Basecamp Import</p>
                <p className="text-xs text-muted-foreground mt-0.5">Connect and sync your projects</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </Link>

          </div>
        </div>
      )}

      {/* ── CATEGORIES tab ────────────────────────────────────────────── */}
      {tab === "categories" && (
        <div className="max-w-2xl space-y-5">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-foreground">Post Categories</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Labels shown as badges on the message board. Instructors choose a category when publishing a post.
              </p>
            </div>
            <PostCategoriesEditor initial={categories} />
          </div>
        </div>
      )}

      {/* ── ADVANCED tab ──────────────────────────────────────────────── */}
      {tab === "advanced" && (
        <div className="max-w-2xl space-y-5">
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 flex items-start gap-3">
            <FolderKanban className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              These tools modify project membership and classification in bulk. Changes are reversible from the Projects page but may affect student visibility. Use with care.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Project membership report</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Students assigned to more than one project. Repository memberships can be removed in bulk.
              </p>
            </div>
            <MultiProjectReport users={multiProjectUsers} />
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Project classification</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Move Basecamp-imported repositories to Library or Templates so they don&apos;t appear as active projects.
              </p>
            </div>
            <ProjectReclassification projects={reclassProjects} />
          </div>
        </div>
      )}

    </div>
  );
}

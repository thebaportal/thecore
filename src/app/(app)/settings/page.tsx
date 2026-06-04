import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, Building2, User, Bell } from "lucide-react";
import { getOrgBrandingSettings } from "@/actions/org-branding";
import { WorkspaceLabel } from "@/components/shared/workspace-banner";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  {
    title: "Account",
    description: "Manage your personal account and preferences.",
    items: [
      {
        icon: User,
        label: "Profile",
        description: "Update your name, avatar, email, and security settings.",
        href: "/settings/profile",
        badge: null,
      },
      {
        icon: Bell,
        label: "Notifications",
        description: "Choose which events send you an email. Opt out any time.",
        href: "/settings/notifications",
        badge: null,
      },
    ],
  },
  {
    title: "Organization",
    description: "Manage your organization settings.",
    items: [
      {
        icon: Building2,
        label: "Organization Profile",
        description: "Update your organization name, logo, and preferences.",
        href: "/settings/organization",
        badge: null,
      },
    ],
  },
  {
    title: "Integrations",
    description: "Connect your other tools and bring your data in.",
    items: [
      {
        icon: Download,
        label: "Basecamp",
        description: "Connect Basecamp to sync your projects, tasks, and conversations.",
        href: "/settings/import/basecamp",
        badge: null,
      },
    ],
  },
] as const;

export default async function SettingsPage() {
  const branding = await getOrgBrandingSettings();
  const orgName = branding?.displayName ?? branding?.name ?? "";
  const logoUrl = branding?.logoUrl && !branding.logoUrl.includes("clerk") ? branding.logoUrl : null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        {orgName && (
          <WorkspaceLabel orgLogoUrl={logoUrl} orgName={orgName} className="mb-2" />
        )}
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your workspace and organization.</p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {section.items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-4 px-4 py-4 hover:bg-muted/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

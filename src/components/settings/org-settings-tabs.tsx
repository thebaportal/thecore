"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview",    label: "Overview" },
  { id: "categories",  label: "Categories" },
  { id: "advanced",    label: "Advanced" },
] as const;

export type OrgSettingsTab = typeof TABS[number]["id"];

export function OrgSettingsTabs({ active }: { active: OrgSettingsTab }) {
  const searchParams = useSearchParams();

  function href(tab: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    return `/settings/organization?${p.toString()}`;
  }

  return (
    <div className="flex gap-1 border-b border-border pb-0">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px",
            active === t.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

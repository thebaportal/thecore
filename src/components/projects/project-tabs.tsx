"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { label: "Project Mandate", suffix: "/mandate" },
  { label: "Phases",          suffix: "/phases" },
  { label: "To-dos",          suffix: "/tasks" },
  { label: "Files",           suffix: "/files" },
  { label: "Posts",           suffix: "/posts" },
  { label: "Chat",            suffix: "/messages" },
  { label: "Team",         suffix: "/members" },
] as const;

const STUDENT_TABS = [
  { label: "Project Mandate", suffix: "/mandate" },
  { label: "Phases",          suffix: "/phases" },
  { label: "To-dos",          suffix: "/tasks" },
  { label: "Files",           suffix: "/files" },
  { label: "Posts",           suffix: "/posts" },
  { label: "Chat",            suffix: "/messages" },
  { label: "Team",            suffix: "/members" },
] as const;

export function ProjectTabs({ projectId, isInstructor }: { projectId: string; isInstructor?: boolean }) {
  const pathname = usePathname();
  const basePath = `/projects/${projectId}`;

  const tabs = isInstructor ? ADMIN_TABS : STUDENT_TABS;

  return (
    <nav className="flex gap-0">
      {tabs.map(({ label, suffix }) => {
        const href = `${basePath}${suffix}`;
        const active = pathname.startsWith(href);

        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              active
                ? "text-primary border-primary"
                : "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

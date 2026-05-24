"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home, FolderKanban, CheckSquare,
  Activity, Users2, Settings, ChevronLeft, ChevronRight, BookOpen, LayoutTemplate, MessageCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { UserButton } from "@clerk/nextjs";

const OrganizationSwitcher = dynamic(
  () => import("@clerk/nextjs").then((m) => ({ default: m.OrganizationSwitcher })),
  { ssr: false, loading: () => <div className="h-8 w-full rounded-lg bg-muted animate-pulse" /> }
);
import { cn } from "@/lib/utils";

function NavItem({
  href, label, icon: Icon, badge, collapsed, onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors relative",
        active
          ? "bg-accent text-primary"
          : "text-sidebar-foreground hover:bg-muted/60 hover:text-foreground",
        collapsed && "justify-center w-10 h-10 mx-auto px-0"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {collapsed && badge != null && badge > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
      )}
    </Link>
  );
}

export function Sidebar({
  overdueTasks = 0,
  unreadPings = 0,
  role = "ADMIN",
  studentProjectId = null,
  onClose,
}: {
  overdueTasks?: number;
  unreadPings?: number;
  role?: "MEMBER" | "ADMIN";
  studentProjectId?: string | null;
  onClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isStudent = role === "MEMBER";

  const Logo = (
    <div className={cn(
      "flex items-center h-14 px-4 border-b border-sidebar-border shrink-0",
      collapsed && "justify-center px-0"
    )}>
      {collapsed ? (
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">TC</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-xs font-bold">TC</span>
          </div>
          <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">The Core</span>
        </div>
      )}
    </div>
  );

  return (
    <aside className={cn(
      "relative flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-in-out shrink-0",
      collapsed ? "w-14" : "w-56"
    )}>
      {Logo}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {isStudent ? (
          <>
            <NavItem href="/student-home" label="Home"     icon={Home}           collapsed={collapsed} onClick={onClose} />
            {studentProjectId ? (
              <>
                <NavItem href={`/projects/${studentProjectId}/phases`}  label="My Project" icon={FolderKanban}  collapsed={collapsed} onClick={onClose} />
                <NavItem href={`/projects/${studentProjectId}/members`} label="Team"       icon={Users2}        collapsed={collapsed} onClick={onClose} />
              </>
            ) : (
              <NavItem href="/projects" label="Projects" icon={FolderKanban} collapsed={collapsed} onClick={onClose} />
            )}
            <NavItem href="/tasks"   label="My Tasks" icon={CheckSquare}    collapsed={collapsed} badge={overdueTasks} onClick={onClose} />
            <NavItem href="/inbox"   label="Inbox"    icon={MessageCircle}  collapsed={collapsed} badge={unreadPings} onClick={onClose} />
            <NavItem href="/library" label="Library"  icon={BookOpen}       collapsed={collapsed} onClick={onClose} />
          </>
        ) : (
          <>
            <NavItem href="/dashboard"  label="Home"      icon={Home}           collapsed={collapsed} onClick={onClose} />
            <NavItem href="/projects"   label="Projects"  icon={FolderKanban}   collapsed={collapsed} onClick={onClose} />
            <NavItem href="/library"    label="Library"   icon={BookOpen}       collapsed={collapsed} onClick={onClose} />
            <NavItem href="/templates"  label="Templates" icon={LayoutTemplate} collapsed={collapsed} onClick={onClose} />
            <NavItem href="/tasks"      label="My Tasks"  icon={CheckSquare}    collapsed={collapsed} badge={overdueTasks} onClick={onClose} />
            <NavItem href="/inbox"      label="Inbox"     icon={MessageCircle}  collapsed={collapsed} onClick={onClose} />
            <NavItem href="/activity"   label="Activity"  icon={Activity}       collapsed={collapsed} onClick={onClose} />
            <NavItem href="/team"       label="Team"      icon={Users2}         collapsed={collapsed} onClick={onClose} />
            <NavItem href="/settings"   label="Settings"  icon={Settings}       collapsed={collapsed} onClick={onClose} />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className={cn(
        "px-2 py-3 border-t border-sidebar-border space-y-2 shrink-0",
        collapsed && "flex flex-col items-center space-y-2"
      )}>
        {!isStudent && !collapsed && (
          <div className="px-1">
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: "w-full",
                  organizationSwitcherTrigger:
                    "w-full justify-start px-2 py-1.5 rounded-lg hover:bg-muted text-sidebar-foreground text-sm",
                },
              }}
            />
          </div>
        )}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-1")}>
          <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-sidebar-foreground" />
          : <ChevronLeft className="w-3 h-3 text-sidebar-foreground" />
        }
      </button>
    </aside>
  );
}

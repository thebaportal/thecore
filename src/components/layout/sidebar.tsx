"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home, FolderKanban, CheckSquare,
  Activity, Users2, Settings, ChevronLeft, ChevronRight,
  BookOpen, LayoutTemplate, MessageCircle, HelpCircle, Megaphone,
} from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { cn } from "@/lib/utils";

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 border-t border-white/10" />;
  return (
    <p className="px-2.5 pt-4 pb-1 text-[10px] font-semibold tracking-widest uppercase text-white/30 select-none">
      {label}
    </p>
  );
}

function NavItem({
  href, label, icon: Icon, badge, collapsed, onClick, activeWhen,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  collapsed: boolean;
  onClick?: () => void;
  activeWhen?: (pathname: string) => boolean;
}) {
  const pathname = usePathname();
  const active = activeWhen
    ? activeWhen(pathname)
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors relative",
        active
          ? "bg-white/15 text-white font-medium before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-white/70"
          : "font-normal text-white/60 hover:bg-white/10 hover:text-white",
        collapsed && "justify-center w-10 h-10 mx-auto px-0"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {collapsed && badge != null && badge > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white/70" />
      )}
    </Link>
  );
}

export function Sidebar({
  overdueTasks = 0,
  unreadPings = 0,
  role = "ADMIN",
  studentProjectId = null,
  orgLogoUrl = null,
  orgName = "",
  onClose,
}: {
  overdueTasks?: number;
  unreadPings?: number;
  role?: "MEMBER" | "ADMIN";
  studentProjectId?: string | null;
  orgLogoUrl?: string | null;
  orgName?: string;
  onClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isStudent = role === "MEMBER";
  const { user } = useUser();

  const initials = orgName
    ? orgName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "TC";

  const Header = (
    <div className={cn(
      "flex shrink-0 border-b border-white/10",
      collapsed
        ? "flex-col items-center gap-1 pt-2.5 pb-2 px-2"
        : "flex-row items-center h-[52px] px-3 gap-2"
    )}>
      {/* Logo / org identity */}
      {collapsed ? (
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">{initials}</span>
        </div>
      ) : orgLogoUrl ? (
        <div className="flex-1 min-w-0 flex items-center">
          <img
            src={orgLogoUrl}
            alt={orgName}
            className="h-7 w-auto max-w-[140px] object-contain"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-xs font-bold">{initials}</span>
          </div>
          <span className="font-semibold text-sm tracking-tight text-sidebar-foreground truncate">
            {orgName || "The Core"}
          </span>
        </div>
      )}

      {/* Collapse toggle — lives in header, never floats */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors shrink-0"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <ChevronLeft className="w-3.5 h-3.5" />
        }
      </button>
    </div>
  );

  return (
    <aside className={cn(
      "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-in-out shrink-0",
      collapsed ? "w-14" : "w-56"
    )}>
      {Header}

      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {isStudent ? (
          <>
            <SectionLabel label="Work" collapsed={collapsed} />
            <NavItem href="/dashboard" label="Home" icon={Home} collapsed={collapsed} onClick={onClose} />
            {studentProjectId ? (
              <>
                <NavItem
                  href={`/projects/${studentProjectId}`}
                  label="My Project"
                  icon={FolderKanban}
                  collapsed={collapsed}
                  onClick={onClose}
                  activeWhen={(p) => p.startsWith(`/projects/${studentProjectId}`) && !p.startsWith(`/projects/${studentProjectId}/members`)}
                />
                <NavItem href={`/projects/${studentProjectId}/members`} label="Team" icon={Users2} collapsed={collapsed} onClick={onClose} />
              </>
            ) : (
              <NavItem href="/projects" label="Projects" icon={FolderKanban} collapsed={collapsed} onClick={onClose} />
            )}
            <NavItem href="/tasks"   label="My Tasks" icon={CheckSquare}   collapsed={collapsed} badge={overdueTasks} onClick={onClose} />
            <NavItem href="/inbox"   label="Inbox"    icon={MessageCircle} collapsed={collapsed} badge={unreadPings}  onClick={onClose} />
            <SectionLabel label="Knowledge" collapsed={collapsed} />
            <NavItem href="/library" label="Library"  icon={BookOpen}      collapsed={collapsed} onClick={onClose} />
          </>
        ) : (
          <>
            <SectionLabel label="Work" collapsed={collapsed} />
            <NavItem href="/dashboard" label="Home"      icon={Home}           collapsed={collapsed} onClick={onClose} />
            <NavItem href="/projects"  label="Projects"  icon={FolderKanban}   collapsed={collapsed} onClick={onClose} />
            <NavItem href="/tasks"     label="My Tasks"  icon={CheckSquare}    collapsed={collapsed} badge={overdueTasks} onClick={onClose} />
            <NavItem href="/inbox"          label="Inbox"          icon={MessageCircle}  collapsed={collapsed} badge={unreadPings}  onClick={onClose} />
            <NavItem href="/announcements" label="Announcements"  icon={Megaphone}      collapsed={collapsed} onClick={onClose} />

            <SectionLabel label="Knowledge" collapsed={collapsed} />
            <NavItem href="/library"   label="Library"   icon={BookOpen}       collapsed={collapsed} onClick={onClose} />
            <NavItem href="/templates" label="Templates"  icon={LayoutTemplate} collapsed={collapsed} onClick={onClose} />

            <SectionLabel label="People" collapsed={collapsed} />
            <NavItem href="/team"      label="Team"      icon={Users2}         collapsed={collapsed} onClick={onClose} />

            <SectionLabel label="System" collapsed={collapsed} />
            <NavItem href="/activity"  label="Activity"  icon={Activity}       collapsed={collapsed} onClick={onClose} />
            <NavItem href="/settings"  label="Settings"  icon={Settings}       collapsed={collapsed} onClick={onClose} />
            <NavItem href="/help"      label="Help"       icon={HelpCircle}     collapsed={collapsed} onClick={onClose} />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className={cn(
        "px-2 py-3 border-t border-sidebar-border shrink-0",
        collapsed ? "flex flex-col items-center space-y-2" : "space-y-2"
      )}>
        {!isStudent && !collapsed && (
          <div className="px-1">
            <OrgSwitcher orgLogoUrl={orgLogoUrl} orgName={orgName} />
          </div>
        )}
        {isStudent && !collapsed ? (
          <div className="px-1 flex items-center gap-2.5">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {user?.fullName ?? user?.firstName ?? "Student"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50">Student</p>
            </div>
          </div>
        ) : (
          <div className={cn("flex items-center", collapsed ? "justify-center" : "px-1")}>
            <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
          </div>
        )}
      </div>

    </aside>
  );
}

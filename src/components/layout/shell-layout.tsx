"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { Notification } from "@/components/layout/notifications-panel";

export function ShellLayout({
  children,
  unreadPings,
  overdueTasks,
  notifications,
  role = "ADMIN",
  studentProjectId = null,
  orgLogoUrl = null,
  orgName = "",
}: {
  children: React.ReactNode;
  unreadPings: number;
  overdueTasks: number;
  notifications: Notification[];
  role?: "MEMBER" | "ADMIN";
  studentProjectId?: string | null;
  orgLogoUrl?: string | null;
  orgName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — always visible on md+, drawer on mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-40 md:static md:z-auto
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <Sidebar
          overdueTasks={overdueTasks}
          unreadPings={unreadPings}
          role={role}
          studentProjectId={studentProjectId}
          orgLogoUrl={orgLogoUrl}
          orgName={orgName}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          notifications={notifications}
          unreadPings={unreadPings}
          role={role}
          onMenuToggle={() => setMobileOpen((v) => !v)}
        />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

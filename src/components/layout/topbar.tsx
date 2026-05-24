"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search, Menu, Mail } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { NewPingDialog } from "@/components/pings/new-ping-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { NotificationsPanel, type Notification } from "@/components/layout/notifications-panel";

export function Topbar({
  notifications = [],
  unreadPings = 0,
  role = "ADMIN",
  onMenuToggle,
}: {
  notifications?: Notification[];
  unreadPings?: number;
  role?: "MEMBER" | "ADMIN";
  onMenuToggle?: () => void;
}) {
  const isAdmin = role === "ADMIN";
  const pathname = usePathname();
  const router = useRouter();
  const [projectOpen, setProjectOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [pingOpen, setPingOpen] = useState(false);

  const showNew = isAdmin && (
    pathname === "/dashboard" ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/tasks")
  );

  function openCommandBar() {
    const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    document.dispatchEvent(e);
  }

  return (
    <>
      <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          {/* Search */}
          <button
            onClick={openCommandBar}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm hover:bg-muted transition-colors w-44 sm:w-64"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Search...</span>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 relative">
          {showNew && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size="sm" className="gap-1.5 h-8" />}
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setProjectOpen(true)}>
                  New Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setTaskOpen(true)}>
                  New Task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPingOpen(true)}>
                  New Message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Inbox */}
          <button
            onClick={() => router.push("/inbox")}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Inbox"
            title="Inbox"
          >
            <Mail className="w-4 h-4" />
            {unreadPings > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary border-2 border-card" />
            )}
          </button>

          <NotificationsPanel notifications={notifications} />
          <UserMenu />
        </div>
      </header>

      <NewProjectDialog open={projectOpen} onOpenChange={setProjectOpen} />
      <NewTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
      <NewPingDialog open={pingOpen} onOpenChange={setPingOpen} />
    </>
  );
}

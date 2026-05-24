"use client";

import { useState } from "react";
import { Plus, MessageCircle, CheckSquare, FolderKanban } from "lucide-react";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { NewPingDialog } from "@/components/pings/new-ping-dialog";
import { cn } from "@/lib/utils";

const actions = [
  {
    key: "project",
    label: "New Project",
    icon: FolderKanban,
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  },
  {
    key: "task",
    label: "New Task",
    icon: CheckSquare,
    color: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
  },
  {
    key: "ping",
    label: "New Ping",
    icon: MessageCircle,
    color: "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200",
  },
] as const;

type ActionKey = typeof actions[number]["key"];

export function DashboardQuickActions() {
  const [open, setOpen] = useState<ActionKey | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setOpen(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
              color
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <NewProjectDialog open={open === "project"} onOpenChange={(o) => !o && setOpen(null)} />
      <NewPingDialog open={open === "ping"} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}

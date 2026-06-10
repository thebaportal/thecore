"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UserPlus, Megaphone, Upload, ArrowRight } from "lucide-react";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";

export function AdminQuickActions({ projectId }: { projectId: string }) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <>
      <div className="px-4 py-1 divide-y divide-border/40">
        <button
          onClick={() => setNewProjectOpen(true)}
          className="w-full flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-primary transition-colors group"
        >
          <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          New Project
          <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        </button>

        <Link
          href={`/projects/${projectId}/members`}
          className="flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-primary transition-colors group"
        >
          <UserPlus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          Invite Student
          <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        </Link>

        <Link
          href="/announcements"
          className="flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-primary transition-colors group"
        >
          <Megaphone className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          Create Announcement
          <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        </Link>

        <Link
          href="/library"
          className="flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-primary transition-colors group"
        >
          <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          Upload Resource
          <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        </Link>
      </div>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
      />
    </>
  );
}

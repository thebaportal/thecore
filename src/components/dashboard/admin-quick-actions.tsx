"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, Megaphone, Upload, ArrowRight, FolderKanban, X } from "lucide-react";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";

type Project = { id: string; name: string };

export function AdminQuickActions({ projectId, projects = [] }: {
  projectId: string;
  projects?: Project[];
}) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [invitePickerOpen, setInvitePickerOpen] = useState(false);
  const router = useRouter();

  function handleInviteSelect(id: string) {
    setInvitePickerOpen(false);
    router.push(`/projects/${id}/members`);
  }

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

        <button
          onClick={() => setInvitePickerOpen(true)}
          className="w-full flex items-center gap-3 py-2.5 text-sm text-foreground hover:text-primary transition-colors group"
        >
          <UserPlus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          Invite Student
          <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        </button>

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

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />

      {/* Project picker for Invite Student */}
      {invitePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setInvitePickerOpen(false)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-xl w-80 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Choose a project</p>
              <button
                onClick={() => setInvitePickerOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No active projects.</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleInviteSelect(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/40 transition-colors text-left"
                  >
                    <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

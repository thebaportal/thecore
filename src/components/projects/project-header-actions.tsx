"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, Pencil, Copy, Loader2, Archive, Trash2, Pin, AlertTriangle } from "lucide-react";
import { EditProjectDialog } from "./edit-project-dialog";
import { duplicateProject, archiveProject, deleteProject, toggleProjectPin } from "@/actions/projects";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  iconEmoji: string | null;
  targetDate: Date | null;
  status: string;
  pinnedAt: Date | null;
};

function DeleteConfirmDialog({
  project,
  onConfirm,
  onCancel,
  pending,
}: {
  project: Project;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        {/* Warning icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Delete project permanently?</h2>
            <p className="text-sm text-muted-foreground mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        {/* What gets deleted */}
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1.5">
          <p className="text-sm font-medium text-red-800">
            &ldquo;{project.name}&rdquo; and everything inside it will be permanently deleted:
          </p>
          <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
            <li>All tasks and subtasks</li>
            <li>All posts and replies</li>
            <li>All documents and files</li>
            <li>All phases and deliverables</li>
            <li>All project members and activity</li>
          </ul>
          <p className="text-xs font-semibold text-red-800 pt-1">There is no way to restore this data.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={pending}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {pending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
              : <><Trash2 className="w-4 h-4" /> Yes, delete permanently</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectHeaderActions({ project }: { project: Project }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pinned = !!project.pinnedAt;

  function handlePin() {
    setMenuOpen(false);
    startTransition(() => toggleProjectPin(project.id));
  }

  function handleDuplicate() {
    setMenuOpen(false);
    startTransition(async () => {
      const newProject = await duplicateProject(project.id);
      router.push(`/projects/${newProject.id}`);
    });
  }

  function handleArchive() {
    setMenuOpen(false);
    startTransition(async () => {
      await archiveProject(project.id);
      router.push("/projects");
    });
  }

  function handleDeleteConfirm() {
    startTransition(async () => {
      await deleteProject(project.id);
      router.push("/projects");
    });
  }

  return (
    <>
      <div className="relative ml-auto">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          disabled={isPending}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
            menuOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            isPending && "opacity-60"
          )}
          aria-label="Project options"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ellipsis className="w-4 h-4" />}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden">
              <button
                onClick={handlePin}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
              >
                <Pin className={cn("w-3.5 h-3.5 text-muted-foreground", pinned && "fill-muted-foreground")} />
                {pinned ? "Unpin project" : "Pin project"}
              </button>
              <button
                onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                Edit project
              </button>
              <button
                onClick={handleDuplicate}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                Duplicate project
              </button>
              {project.status !== "ARCHIVED" && (
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                  Archive project
                </button>
              )}
              <div className="mx-2 my-1 border-t border-border" />
              <button
                onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete project
              </button>
            </div>
          </>
        )}
      </div>

      <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />

      {deleteOpen && (
        <DeleteConfirmDialog
          project={project}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteOpen(false)}
          pending={isPending}
        />
      )}
    </>
  );
}

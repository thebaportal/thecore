"use client";

import { useState } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "./new-project-dialog";

export function ProjectsHeader({ count }: { count: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {count > 0
              ? `${count} active ${count === 1 ? "project" : "projects"}`
              : "No projects yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md bg-background shadow-sm">
              <LayoutGrid className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground">
              <List className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Project
          </Button>
        </div>
      </div>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

"use server";

import { getBasecampProjects } from "./basecamp";

export type ProjectAuditRow = {
  bcId: number;
  name: string;
  description: string | null;
  bcStatus: "active" | "archived";
  // Tools present in this BC project
  hasTasks: boolean;
  hasVault: boolean;
  hasCampfire: boolean;
  hasMessageBoard: boolean;
  // Our classification
  classification: "Project" | "Library" | "Template";
  // Where it lands in The Core
  destination: string;
  // Current import state
  importStatus: string;
  // Content counts (post-import)
  tasksImported: number;
  filesImported: number;
  foldersImported: number;
  messagesImported: number;
};

function classify(name: string): "Project" | "Library" | "Template" {
  const n = name.trim();
  if (/\bproject$/i.test(n)) return "Project";
  if (/\b(templates?|playbooks?|frameworks?)\b/i.test(n)) return "Template";
  if (
    /\b(materials?|learning|resources?|curriculum|knowledge)\b/i.test(n) ||
    /\(docs?\s*(only)?\)/i.test(n) ||
    /\bhq\b/i.test(n)
  ) return "Library";
  return "Project";
}

function destination(cls: "Project" | "Library" | "Template"): string {
  if (cls === "Library")   return "Library → Docs & Files";
  if (cls === "Template")  return "Templates → Docs & Files";
  return "Projects (active workspace)";
}

export async function getBasecampProjectAudit(): Promise<ProjectAuditRow[]> {
  const projects = await getBasecampProjects();

  return projects
    .map((p) => {
      const cls = classify(p.name);
      const hasTasks       = p.dock.some((d) => d.name === "todoset");
      const hasVault       = p.dock.some((d) => d.name === "vault");
      const hasCampfire    = p.dock.some((d) => d.name === "chat");
      const hasMessageBoard = p.dock.some((d) => d.name === "message_board");

      return {
        bcId: p.id,
        name: p.name,
        description: p.description,
        bcStatus: p.bcStatus,
        hasTasks,
        hasVault,
        hasCampfire,
        hasMessageBoard,
        classification: cls,
        destination: destination(cls),
        importStatus: p.importStatus,
        tasksImported:    p.importLog?.tasksCount    ?? 0,
        filesImported:    p.importLog?.filesCount    ?? 0,
        foldersImported:  p.importLog?.foldersCount  ?? 0,
        messagesImported: p.importLog?.messagesCount ?? 0,
      };
    })
    .sort((a, b) => {
      // Sort: active before archived, then alphabetical within each group
      if (a.bcStatus !== b.bcStatus) return a.bcStatus === "active" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

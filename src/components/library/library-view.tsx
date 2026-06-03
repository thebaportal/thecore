"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Plus, Trash2, Loader2, Folder, FolderOpen, FolderPlus, ChevronRight,
  X, CloudUpload,
  Pencil, Check, AlertTriangle, BookOpen, ExternalLink, LayoutGrid, List,
} from "lucide-react";
import { FileTypeIcon } from "@/components/files/file-type-icon";
import {
  createLibraryFolder, renameLibraryFolder, deleteLibraryFolder,
  createLibraryDoc, deleteLibraryDoc, deleteLibraryFile,
  importProjectToLibrary, revertLibraryImport, moveLibraryItemToFolder,
  bulkDeleteLibraryItems, type ImportResult,
} from "@/actions/library";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { WorkspaceBanner } from "@/components/shared/workspace-banner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type LibraryFolder = {
  id: string;
  name: string;
  _count: { docs: number; children: number; files: number };
  docs: { title: string; emoji: string | null }[];
  files: { name: string }[];
};

type LibraryDoc = {
  id: string;
  title: string;
  emoji: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

type LibraryFile = {
  id: string;
  name: string;
  url: string;
  utKey: string | null;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
};

type ImportProject = {
  id: string;
  name: string;
  color: string | null;
  iconEmoji: string | null;
  _count: { docs: number; files: number };
};

type Breadcrumb = { id: string; name: string }[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function coverColors(seed: string): { from: string; to: string } {
  const palettes = [
    { from: "#1e3a8a", to: "#1e1b4b" },
    { from: "#065f46", to: "#064e3b" },
    { from: "#78350f", to: "#431407" },
    { from: "#1e293b", to: "#0f172a" },
    { from: "#4c1d95", to: "#2e1065" },
    { from: "#7f1d1d", to: "#450a0a" },
    { from: "#134e4a", to: "#042f2e" },
    { from: "#1e3a5f", to: "#0c1a2e" },
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (seed.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  return palettes[Math.abs(hash) % palettes.length]!;
}

function extractText(content: string): string {
  if (!content) return "";
  try {
    const doc = JSON.parse(content) as Record<string, unknown>;
    const parts: string[] = [];
    function walk(node: Record<string, unknown>) {
      if (typeof node.text === "string") parts.push(node.text);
      if (Array.isArray(node.content)) (node.content as Record<string, unknown>[]).forEach(walk);
    }
    walk(doc);
    return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 320);
  } catch {
    return typeof content === "string" ? content.slice(0, 320) : "";
  }
}

function getFileExt(mimeType: string, name: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword") return "DOCX";
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel") return "XLSX";
  if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint") return "PPTX";
  if (mimeType.includes("visio")) return "VSD";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("text/")) return "TXT";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "ZIP";
  return name.split(".").pop()?.toUpperCase() ?? "";
}

function FileThumb({ file }: { file: LibraryFile }) {
  if (file.mimeType.startsWith("image/")) {
    return <img src={file.url} alt={file.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />;
  }
  return <FileTypeIcon mimeType={file.mimeType} filename={file.name} className="w-10 h-10 shrink-0" />;
}

// ─── Import / Revert dialog ───────────────────────────────────────────────────

function ImportDialog({ projects, onClose, targetFolderId, targetFolderName }: {
  projects: ImportProject[];
  onClose: () => void;
  targetFolderId: string | null;
  targetFolderName: string;
}) {
  const [mode, setMode] = useState<"import" | "revert">("import");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revertTarget, setRevertTarget] = useState<ImportProject | null>(null);
  const [pending, start] = useTransition();
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [reverted, setReverted] = useState(false);
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleImport() {
    if (selected.size === 0) return;
    start(async () => {
      const res = await Promise.all([...selected].map((id) => importProjectToLibrary(id, targetFolderId)));
      setImportResults(res);
      router.refresh();
    });
  }

  function handleRevert() {
    if (!revertTarget) return;
    start(async () => {
      await revertLibraryImport(revertTarget.id);
      setReverted(true);
      router.refresh();
    });
  }

  const selectedProjects = projects.filter((p) => selected.has(p.id));
  const totalItems = selectedProjects.reduce((sum, p) => sum + p._count.docs + p._count.files, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">

        {importResults ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Import complete</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {importResults.length} project{importResults.length !== 1 ? "s" : ""} moved to Library
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-1 text-sm">
              <p><span className="font-medium">{importResults.reduce((s, r) => s + r.folders, 0)}</span> folders</p>
              <p><span className="font-medium">{importResults.reduce((s, r) => s + r.docs, 0)}</span> documents</p>
              <p><span className="font-medium">{importResults.reduce((s, r) => s + r.files, 0)}</span> files</p>
            </div>
            <Button onClick={onClose} className="w-full">Done</Button>
          </>
        ) : reverted ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Reverted</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Content moved back to &ldquo;{revertTarget?.name}&rdquo;
                </p>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">Done</Button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Library</h2>
              <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
                <button
                  onClick={() => setMode("import")}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    mode === "import" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Import from project
                </button>
                <button
                  onClick={() => setMode("revert")}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                    mode === "revert" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Undo import
                </button>
              </div>
            </div>

            {mode === "import" ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Importing into:</span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    {targetFolderId ? <FolderOpen className="w-3.5 h-3.5 text-amber-500" /> : <BookOpen className="w-3.5 h-3.5 text-primary" />}
                    {targetFolderName}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No projects available</p>
                  ) : projects.map((p) => (
                    <button key={p.id} onClick={() => toggle(p.id)} className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      selected.has(p.id) ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground"
                    )}>
                      <div className={cn("w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors", selected.has(p.id) ? "bg-primary border-primary" : "border-border")}>
                        {selected.has(p.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ backgroundColor: `${p.color ?? "#1E3A8A"}18` }}>
                        {p.iconEmoji ?? <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? "#1E3A8A" }} />}
                      </div>
                      <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{p._count.docs + p._count.files} items</span>
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>Moving <strong>{totalItems} items</strong> from {selected.size} project{selected.size !== 1 ? "s" : ""} into the Library.</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                  <Button onClick={handleImport} disabled={selected.size === 0 || pending} className="flex-1 gap-2">
                    {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : `Import${selected.size > 0 ? ` (${selected.size})` : ""}`}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Move all current Library content back to a project. Useful if you imported by mistake.</p>
                <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                  {projects.map((p) => (
                    <button key={p.id} onClick={() => setRevertTarget(revertTarget?.id === p.id ? null : p)} className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      revertTarget?.id === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60 text-foreground"
                    )}>
                      <div className={cn("w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors", revertTarget?.id === p.id ? "bg-primary border-primary" : "border-border")}>
                        {revertTarget?.id === p.id && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ backgroundColor: `${p.color ?? "#1E3A8A"}18` }}>
                        {p.iconEmoji ?? <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color ?? "#1E3A8A" }} />}
                      </div>
                      <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
                {revertTarget && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>All Library docs and files will move back to <strong>{revertTarget.name}</strong>. Library folders will be deleted.</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                  <Button variant="destructive" onClick={handleRevert} disabled={!revertTarget || pending} className="flex-1 gap-2">
                    {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Reverting…</> : "Revert to Project"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function LibraryView({
  folders,
  docs,
  files,
  breadcrumb,
  currentFolderId,
  isAdmin,
  importProjects,
  note,
  onSaveNote,
  orgBranding = null,
}: {
  folders: LibraryFolder[];
  docs: LibraryDoc[];
  files: LibraryFile[];
  breadcrumb: Breadcrumb;
  currentFolderId: string | null;
  isAdmin: boolean;
  importProjects: ImportProject[];
  note: string | null;
  onSaveNote: (note: string) => Promise<void>;
  orgBranding?: { logoUrl: string | null; orgName: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Note editing
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteValue, setNoteValue] = useState(note ?? "");
  const [notePending, startNote] = useTransition();

  // Folder management
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);

  // File upload
  const dragCountRef = useRef(0);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const { startUpload, isUploading } = useUploadThing("libraryFileUploader", {
    onClientUploadComplete: () => { setDraggingFiles(false); router.refresh(); },
  });

  // Bulk selection — no "select mode" toggle; checkboxes appear on hover per card
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const totalSelected = selectedDocs.size + selectedFiles.size;

  function toggleDoc(id: string) {
    setSelectedDocs((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleFile(id: string) {
    setSelectedFiles((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() {
    setSelectedDocs(new Set(docs.map((d) => d.id)));
    setSelectedFiles(new Set(files.map((f) => f.id)));
  }
  function clearSelection() {
    setSelectedDocs(new Set());
    setSelectedFiles(new Set());
  }
  function handleBulkDelete() {
    start(async () => {
      await bulkDeleteLibraryItems([...selectedDocs], [...selectedFiles]);
      clearSelection();
      router.refresh();
    });
  }

  // Drag & drop
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, type: "doc" | "file", id: string) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleFolderDragOver(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  }

  function handleFolderDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  }

  function handleFolderDrop(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    setDragOverFolderId(null);
    try {
      const { type, id } = JSON.parse(e.dataTransfer.getData("text/plain"));
      start(async () => {
        await moveLibraryItemToFolder(type, id, folderId);
        router.refresh();
      });
    } catch {}
  }

  // Other handlers
  function handleCreateFolder() {
    if (!folderName.trim()) return;
    start(async () => {
      await createLibraryFolder(folderName.trim(), currentFolderId);
      setFolderName("");
      setCreatingFolder(false);
      router.refresh();
    });
  }

  function handleRenameFolder(folderId: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    start(async () => {
      await renameLibraryFolder(folderId, renameValue.trim());
      setRenamingId(null);
      router.refresh();
    });
  }

  function handleDeleteFolder(folderId: string) {
    start(async () => {
      await deleteLibraryFolder(folderId);
      router.refresh();
    });
  }

  function handleCreateDoc() {
    start(async () => {
      const doc = await createLibraryDoc("Untitled", currentFolderId);
      router.push(`/library/docs/${doc.id}`);
    });
  }

  function handleDeleteDoc(docId: string) {
    start(async () => {
      await deleteLibraryDoc(docId);
      router.refresh();
    });
  }

  function handleDeleteFile(fileId: string) {
    start(async () => {
      await deleteLibraryFile(fileId);
      router.refresh();
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const sel = Array.from(e.target.files ?? []);
    if (sel.length === 0) return;
    startUpload(sel, { folderId: currentFolderId ?? undefined });
    e.target.value = "";
  }

  function handleUploadDragEnter(e: React.DragEvent) {
    if (!isAdmin) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCountRef.current += 1;
    if (dragCountRef.current === 1) setDraggingFiles(true);
  }

  function handleUploadDragLeave() {
    if (!isAdmin) return;
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setDraggingFiles(false);
  }

  function handleUploadDrop(e: React.DragEvent) {
    if (!isAdmin) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCountRef.current = 0;
    setDraggingFiles(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) startUpload(files, { folderId: currentFolderId ?? undefined });
  }

  const [fileView, setFileView] = useState<"grid" | "list">("grid");
  const [confirmDelete, setConfirmDelete] = useState<{ type: "doc" | "file" | "folder"; id: string } | null>(null);

  const isEmpty = folders.length === 0 && docs.length === 0 && files.length === 0;
  const cardGrid = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

  return (
    <div
      className="relative"
      onDragEnter={handleUploadDragEnter}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDragLeave={handleUploadDragLeave}
      onDrop={handleUploadDrop}
    >
      {/* File drag-drop upload overlay */}
      {draggingFiles && (
        <div className="absolute inset-0 z-50 rounded-xl bg-primary/5 border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <CloudUpload className="w-10 h-10 text-primary/70" />
          <p className="text-sm font-medium text-primary">Drop files to upload</p>
        </div>
      )}

      {/* Workspace branding — root level only */}
      {breadcrumb.length === 0 && orgBranding?.orgName && (
        <WorkspaceBanner
          orgLogoUrl={orgBranding.logoUrl}
          orgName={orgBranding.orgName}
          className="mb-5"
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Link href="/library" className="hover:text-foreground transition-colors flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Library
              </Link>
              {breadcrumb.slice(0, -1).map((crumb) => (
                <span key={crumb.id} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3" />
                  <Link href={`/library?folder=${crumb.id}`} className="hover:text-foreground transition-colors">
                    {crumb.name}
                  </Link>
                </span>
              ))}
              <ChevronRight className="w-3 h-3" />
            </div>
          )}
          <h1 className="text-xl font-semibold text-foreground">
            {breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1]!.name : "Library"}
          </h1>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setCreatingFolder(true)}>
              <FolderPlus className="w-3.5 h-3.5" />
              New Folder
            </Button>
            <label className={cn(
              "flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
              isUploading && "opacity-50 pointer-events-none"
            )}>
              <input type="file" multiple className="hidden" onChange={handleFileSelect} disabled={isUploading} />
              {isUploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              }
              Upload
            </label>
            <Button size="sm" className="gap-1.5 h-8" onClick={handleCreateDoc} disabled={pending}>
              <Plus className="w-3.5 h-3.5" />
              New Doc
            </Button>
          </div>
        )}
      </div>

      {/* Page note — only shown at root level */}
      {!currentFolderId && (isAdmin || note) && (
        <div className="mb-5">
          {noteEditing ? (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-primary/40 bg-primary/5">
              <textarea
                autoFocus
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setNoteValue(note ?? ""); setNoteEditing(false); }
                }}
                placeholder="Write a brief introduction for this library…"
                rows={3}
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none leading-relaxed"
              />
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => {
                    startNote(async () => {
                      await onSaveNote(noteValue);
                      setNoteEditing(false);
                      router.refresh();
                    });
                  }}
                  disabled={notePending}
                  className="flex items-center justify-center w-6 h-6 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {notePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => { setNoteValue(note ?? ""); setNoteEditing(false); }}
                  className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : note ? (
            <div
              className={cn(
                "group relative px-4 py-3 rounded-xl border border-border/60 bg-muted/30 text-sm text-muted-foreground leading-relaxed",
                isAdmin && "cursor-pointer hover:border-primary/30 hover:bg-primary/5 hover:text-foreground transition-colors"
              )}
              onClick={isAdmin ? () => setNoteEditing(true) : undefined}
            >
              {note}
              {isAdmin && (
                <Pencil className="absolute top-2.5 right-2.5 w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              )}
            </div>
          ) : isAdmin ? (
            <button
              onClick={() => setNoteEditing(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
            >
              <Pencil className="w-3.5 h-3.5" />
              Add an introduction…
            </button>
          ) : null}
        </div>
      )}

      {/* New folder input */}
      {creatingFolder && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl border border-border bg-muted/30">
          <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setCreatingFolder(false); }}
            placeholder="Folder name…"
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={handleCreateFolder} disabled={!folderName.trim() || pending} className="text-primary hover:text-primary/80 disabled:opacity-40">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setCreatingFolder(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !creatingFolder && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            {currentFolderId ? "This folder is empty" : "Library is empty"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isAdmin
              ? "Create folders and docs, upload files, or import from an existing project."
              : "No resources have been added yet. Check back later."}
          </p>
        </div>
      )}

      {/* Folders — accept drops */}
      {folders.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Folders</h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{folders.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {folders.map((folder) => {
              const { from, to } = coverColors(folder.id);
              const itemCount = folder._count.docs + folder._count.files;
              const parts = [
                folder._count.docs > 0 && `${folder._count.docs} doc${folder._count.docs !== 1 ? "s" : ""}`,
                folder._count.files > 0 && `${folder._count.files} file${folder._count.files !== 1 ? "s" : ""}`,
                folder._count.children > 0 && `${folder._count.children} folder${folder._count.children !== 1 ? "s" : ""}`,
              ].filter(Boolean);
              const contentDesc = parts.length > 0 ? parts.join(" · ") : "Empty";
              return (
                <div
                  key={folder.id}
                  className="group relative"
                  onDragOver={isAdmin ? (e) => handleFolderDragOver(e, folder.id) : undefined}
                  onDragLeave={isAdmin ? handleFolderDragLeave : undefined}
                  onDrop={isAdmin ? (e) => handleFolderDrop(e, folder.id) : undefined}
                >
                  {renamingId === folder.id ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 mt-4 rounded-2xl border border-primary bg-card shadow-sm">
                      <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(folder.id); if (e.key === "Escape") setRenamingId(null); }}
                        className="flex-1 text-sm bg-transparent outline-none"
                      />
                      <button onClick={() => handleRenameFolder(folder.id)} className="text-primary">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/library?folder=${folder.id}`}
                      className={cn(
                        "block transition-all duration-200",
                        dragOverFolderId === folder.id ? "scale-[1.02]" : "hover:-translate-y-0.5"
                      )}
                    >
                      <div className={cn(
                        "relative bg-card rounded-xl border overflow-hidden transition-shadow",
                        dragOverFolderId === folder.id
                          ? "border-primary/50 shadow-lg"
                          : "border-border/60 hover:shadow-md"
                      )}>
                        {/* Colored top accent bar */}
                        <div className="h-1 w-full" style={{ backgroundColor: from }} />

                        <div className="p-4">
                          {/* Icon */}
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                            style={{ backgroundColor: `${from}18` }}
                          >
                            <Folder className="w-5 h-5" style={{ color: from }} />
                          </div>

                          {/* Name */}
                          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
                            {folder.name}
                          </p>

                          {/* Count */}
                          <p className="text-xs text-muted-foreground">{contentDesc}</p>
                        </div>

                        {dragOverFolderId === folder.id && (
                          <div className="absolute inset-0 bg-primary/10 border-2 border-primary/40 rounded-xl flex items-center justify-center">
                            <span className="text-primary text-sm font-semibold">Drop here</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )}
                  {isAdmin && renamingId !== folder.id && (
                    <div className={cn("absolute top-3 right-3 items-center gap-0.5 z-10", confirmDelete?.id === folder.id ? "flex" : "hidden group-hover:flex")}>
                      <button
                        onClick={(e) => { e.preventDefault(); setRenamingId(folder.id); setRenameValue(folder.name); setConfirmDelete(null); }}
                        className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {confirmDelete?.id === folder.id ? (
                        <>
                          <span className="text-[11px] text-destructive font-medium px-1">Delete?</span>
                          <button onClick={(e) => { e.preventDefault(); setConfirmDelete(null); handleDeleteFolder(folder.id); }} className="p-1.5 rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors shadow-sm">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.preventDefault(); setConfirmDelete(null); }} className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors shadow-sm">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); setConfirmDelete({ type: "folder", id: folder.id }); }}
                          className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors shadow-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {isAdmin && (docs.length > 0 || files.length > 0) && (
            <p className="text-xs text-muted-foreground/60 mt-2">Drag docs or files onto a folder to move them.</p>
          )}
        </section>
      )}

      {/* Docs — content-preview cards */}
      {docs.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Documents</h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{docs.length}</span>
          </div>
          <div className={cardGrid}>
            {docs.map((doc) => {
              const { from } = coverColors(doc.id);
              const isSelected = selectedDocs.has(doc.id);
              const preview = extractText(doc.content);
              return (
                <div
                  key={doc.id}
                  className="group relative"
                  draggable={isAdmin}
                  onDragStart={isAdmin ? (e) => handleDragStart(e, "doc", doc.id) : undefined}
                >
                  <Link href={`/library/docs/${doc.id}`}>
                    <div className={cn(
                      "rounded-xl overflow-hidden border bg-card transition-all duration-200 cursor-pointer",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/60 hover:border-border hover:shadow-md hover:-translate-y-0.5"
                    )}>
                      {/* Preview area — paper-like */}
                      <div className="h-40 px-4 py-3 bg-muted/30 border-b border-border/40 flex flex-col overflow-hidden relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ backgroundColor: from }} />
                        {doc.emoji && <span className="text-xl mb-1.5 shrink-0">{doc.emoji}</span>}
                        {preview ? (
                          <p className="text-[11px] leading-relaxed text-foreground/50 line-clamp-5">{preview}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/30 italic mt-auto">Empty document</p>
                        )}
                      </div>
                      {/* Info */}
                      <div className="px-3 pt-2 pb-2.5">
                        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{doc.title}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1 truncate">{doc.author.name} · {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.preventDefault(); toggleDoc(doc.id); }}
                      className={cn(
                        "absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        isSelected
                          ? "bg-primary border-primary opacity-100"
                          : "bg-white/80 border-border opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </button>
                  )}
                  {isAdmin && !isSelected && (
                    confirmDelete?.id === doc.id ? (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-card border border-red-200 rounded-lg px-2 py-1 shadow-sm">
                        <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                        <button onClick={() => { setConfirmDelete(null); handleDeleteDoc(doc.id); }} className="text-red-500 hover:text-red-600 p-0.5"><Check className="w-3 h-3" /></button>
                        <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete({ type: "doc", id: doc.id })}
                        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-card border border-border text-muted-foreground hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Files */}
      {files.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Files</h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{files.length}</span>
            <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded-lg bg-muted border border-border">
              <button onClick={() => setFileView("grid")} className={cn("p-1.5 rounded-md transition-colors", fileView === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setFileView("list")} className={cn("p-1.5 rounded-md transition-colors", fileView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {fileView === "grid" ? (
            <div className={cardGrid}>
              {files.map((file) => {
                const isSelected = selectedFiles.has(file.id);
                const ext = getFileExt(file.mimeType, file.name);
                return (
                  <div key={file.id} className="group relative" draggable={isAdmin} onDragStart={isAdmin ? (e) => handleDragStart(e, "file", file.id) : undefined}>
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      <div className={cn("rounded-xl overflow-hidden border bg-card transition-all duration-200", isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/60 hover:border-border hover:shadow-md hover:-translate-y-0.5")}>
                        <div className="h-32 flex items-center justify-center overflow-hidden bg-gray-50">
                          {file.mimeType.startsWith("image/") ? (
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                          ) : (
                            <FileTypeIcon mimeType={file.mimeType} filename={file.name} className="w-14 h-14" />
                          )}
                        </div>
                        <div className="px-3 pt-2 pb-2.5">
                          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                            {getFileExt(file.mimeType, file.name) && <span className="font-semibold">{getFileExt(file.mimeType, file.name)} · </span>}
                            {formatBytes(file.size)}
                          </p>
                        </div>
                      </div>
                    </a>
                    {isAdmin && (
                      <button onClick={(e) => { e.preventDefault(); toggleFile(file.id); }} className={cn("absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary opacity-100" : "bg-white/80 border-border opacity-0 group-hover:opacity-100")}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                    )}
                    {isAdmin && !isSelected && (
                      confirmDelete?.id === file.id ? (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-card border border-red-200 rounded-lg px-2 py-1 shadow-sm">
                          <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                          <button onClick={(e) => { e.preventDefault(); setConfirmDelete(null); handleDeleteFile(file.id); }} className="text-red-500 hover:text-red-600 p-0.5"><Check className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.preventDefault(); setConfirmDelete(null); }} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.preventDefault(); setConfirmDelete({ type: "file", id: file.id }); }} className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-card border border-border text-muted-foreground hover:text-red-500 hover:border-red-200 transition-all shadow-sm">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
              {files.map((file) => {
                const isSelected = selectedFiles.has(file.id);
                const ext = getFileExt(file.mimeType, file.name);
                return (
                  <div key={file.id} className={cn("group flex items-center gap-3 px-4 py-2.5 transition-colors", isSelected ? "bg-primary/5" : "hover:bg-muted/40")} draggable={isAdmin} onDragStart={isAdmin ? (e) => handleDragStart(e, "file", file.id) : undefined}>
                    {isAdmin && (
                      <button onClick={() => toggleFile(file.id)} className={cn("w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary" : "border-border opacity-0 group-hover:opacity-100")}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </button>
                    )}
                    <FileThumb file={file} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{formatBytes(file.size)} · {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}</p>
                    </div>
                    {getFileExt(file.mimeType, file.name) && <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 bg-muted text-muted-foreground">{getFileExt(file.mimeType, file.name)}</span>}
                    <a href={file.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {isAdmin && !isSelected && (
                      confirmDelete?.id === file.id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                          <button onClick={() => { setConfirmDelete(null); handleDeleteFile(file.id); }} className="text-red-500 hover:text-red-600 p-1"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete({ type: "file", id: file.id })} className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Floating bulk toolbar — appears as soon as anything is selected */}
      {totalSelected > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-card border border-border rounded-full shadow-2xl px-2 py-1.5">
          <span className="text-sm font-medium text-foreground px-2">{totalSelected} selected</span>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={selectAll} className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-full transition-colors">
            Select all
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={handleBulkDelete}
            disabled={pending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-full transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={clearSelection} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {importOpen && (
        <ImportDialog
          projects={importProjects}
          onClose={() => setImportOpen(false)}
          targetFolderId={currentFolderId}
          targetFolderName={breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1]!.name : "Library"}
        />
      )}
    </div>
  );
}

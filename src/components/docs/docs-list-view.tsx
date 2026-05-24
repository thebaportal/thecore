"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  FileText, Plus, Trash2, Loader2, Folder, FolderPlus, ChevronRight,
  Home, LayoutGrid, List, Check, X, Upload, File, FileImage,
  FileVideo, FileAudio, Download, Eye, Paperclip,
} from "lucide-react";
import { createDoc, createDocFolder, deleteDoc } from "@/actions/docs";
import { deleteProjectFile } from "@/actions/files";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocFolder = {
  id: string;
  name: string;
  _count: { docs: number; children: number; files: number };
};

type Doc = {
  id: string;
  title: string;
  emoji: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

type ProjectFile = {
  id: string;
  name: string;
  url: string;
  utKey: string | null;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
  importedAuthor: string | null;
};

type Breadcrumb = { id: string; name: string }[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cls = cn("shrink-0", className);
  if (mimeType.startsWith("image/"))  return <FileImage className={cls} />;
  if (mimeType.startsWith("video/"))  return <FileVideo className={cls} />;
  if (mimeType.startsWith("audio/"))  return <FileAudio className={cls} />;
  return <File className={cls} />;
}

function canPreview(file: ProjectFile) {
  return !!file.utKey && (
    file.mimeType.startsWith("image/") ||
    file.mimeType.startsWith("video/") ||
    file.mimeType.startsWith("text/")  ||
    file.mimeType === "application/pdf"
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DocsListView({
  projectId,
  folders,
  initialDocs,
  initialFiles = [],
  breadcrumb,
  currentFolderId,
}: {
  projectId: string;
  folders: DocFolder[];
  initialDocs: Doc[];
  initialFiles?: ProjectFile[];
  breadcrumb: Breadcrumb;
  currentFolderId: string | null;
}) {
  const router       = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs,          setDocs]          = useState<Doc[]>(initialDocs);
  const [files,         setFiles]         = useState<ProjectFile[]>(initialFiles);
  const [view,          setView]          = useState<"list" | "grid">("grid");
  const [addingFolder,  setAddingFolder]  = useState(false);
  const [folderName,    setFolderName]    = useState("");
  const [deletingDoc,   setDeletingDoc]   = useState<string | null>(null);
  const [deletingFile,  setDeletingFile]  = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "doc" | "file"; id: string } | null>(null);
  const [dragging,      setDragging]      = useState(false);
  const [uploadPct,     setUploadPct]     = useState<number | null>(null);

  const [creating,      startCreate]      = useTransition();
  const [creatingFolder, startFolderCreate] = useTransition();

  const { startUpload, isUploading } = useUploadThing("projectFileUploader", {
    onUploadProgress: (p) => setUploadPct(p),
    onClientUploadComplete: () => { setUploadPct(null); router.refresh(); },
    onUploadError: (err) => { alert(`Upload failed: ${err.message}`); setUploadPct(null); },
  });

  function handleCreateDoc() {
    startCreate(async () => {
      const doc = await createDoc({ projectId, title: "Untitled", folderId: currentFolderId ?? undefined });
      router.push(`/projects/${projectId}/docs/${doc.id}`);
    });
  }

  function handleFolderCreate() {
    if (!folderName.trim()) return;
    startFolderCreate(async () => {
      await createDocFolder({ projectId, name: folderName.trim(), parentId: currentFolderId });
      setFolderName(""); setAddingFolder(false); router.refresh();
    });
  }

  function handleDeleteDoc(docId: string) {
    setConfirmDelete(null);
    setDeletingDoc(docId);
    deleteDoc(docId)
      .then(() => setDocs((prev) => prev.filter((d) => d.id !== docId)))
      .finally(() => setDeletingDoc(null));
  }

  function handleDeleteFile(fileId: string) {
    setConfirmDelete(null);
    setDeletingFile(fileId);
    deleteProjectFile(fileId)
      .then(() => setFiles((prev) => prev.filter((f) => f.id !== fileId)))
      .finally(() => setDeletingFile(null));
  }

  function handleUpload(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    startUpload(arr, { projectId, folderId: currentFolderId ?? undefined });
  }

  const isEmpty = folders.length === 0 && docs.length === 0 && files.length === 0;

  return (
    <div
      className="space-y-5 pb-8"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleUpload(e.dataTransfer.files); }}
    >

      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-50 pointer-events-none border-2 border-dashed border-primary rounded-xl bg-primary/5 flex items-center justify-center">
          <p className="text-sm font-medium text-primary">Drop to upload</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <nav className="flex items-center gap-1 text-sm min-w-0">
          <Link
            href={`/projects/${projectId}/docs`}
            className={cn(
              "flex items-center gap-1 transition-colors shrink-0",
              currentFolderId ? "text-muted-foreground hover:text-foreground" : "text-foreground font-medium"
            )}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Docs & Files</span>
          </Link>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Link
                href={`/projects/${projectId}/docs?folder=${crumb.id}`}
                className={cn(
                  "truncate transition-colors",
                  i === breadcrumb.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={cn("flex items-center justify-center h-7 w-7 rounded-md transition-all",
                view === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label="List view"
              className={cn("flex items-center justify-center h-7 w-7 rounded-md transition-all",
                view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button size="sm" variant="outline" onClick={() => setAddingFolder(true)} disabled={addingFolder} className="gap-1.5">
            <FolderPlus className="w-3.5 h-3.5" />
            Folder
          </Button>

          <Button
            size="sm" variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1.5"
          >
            {isUploading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadPct ?? 0}%</>
              : <><Upload className="w-3.5 h-3.5" />Upload</>
            }
          </Button>

          <Button size="sm" onClick={handleCreateDoc} disabled={creating} className="gap-1.5">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            New Doc
          </Button>

          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files) handleUpload(e.target.files); }} />
        </div>
      </div>

      {/* Inline folder name input */}
      {addingFolder && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-2.5">
          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  handleFolderCreate();
              if (e.key === "Escape") { setAddingFolder(false); setFolderName(""); }
            }}
            placeholder="Folder name…"
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleFolderCreate}
            disabled={creatingFolder || !folderName.trim()}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
          >
            {creatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => { setAddingFolder(false); setFolderName(""); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center justify-center gap-3 text-center">
          <Paperclip className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {currentFolderId ? "This folder is empty" : "No docs or files yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a document, upload files, or drag and drop anything here.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload
            </Button>
            <Button size="sm" onClick={handleCreateDoc} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              New Document
            </Button>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ────────────────────────────────────────────────────── */}
      {!isEmpty && view === "list" && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">

          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`/projects/${projectId}/docs?folder=${folder.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[
                    folder._count.docs   > 0 && `${folder._count.docs} doc${folder._count.docs !== 1 ? "s" : ""}`,
                    folder._count.files  > 0 && `${folder._count.files} file${folder._count.files !== 1 ? "s" : ""}`,
                    folder._count.children > 0 && `${folder._count.children} folder${folder._count.children !== 1 ? "s" : ""}`,
                  ].filter(Boolean).join(" · ") || "Empty"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}

          {docs.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => router.push(`/projects/${projectId}/docs/${doc.id}`)}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-base">
                {doc.emoji ?? <FileText className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.author.name.split(" ")[0]} · edited {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                </p>
              </div>
              {confirmDelete?.id === doc.id ? (
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }} className="text-red-500 hover:text-red-600 p-1"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "doc", id: doc.id }); }}
                  disabled={deletingDoc === doc.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0"
                >
                  {deletingDoc === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}

          {files.map((file) => {
            const author    = file.importedAuthor ?? file.uploadedBy.name;
            const previable = canPreview(file);
            return (
              <div key={file.id} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileTypeIcon mimeType={file.mimeType} className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(file.size)} · {author.split(" ")[0]} · {format(new Date(file.createdAt), "MMM d, yyyy")}
                    {!file.utKey && <span className="ml-1.5 text-amber-600 font-medium">Basecamp</span>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {previable && (
                    <a href={file.url} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {file.utKey && (
                    <a href={file.url} download={file.name}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {file.utKey && (
                    confirmDelete?.id === file.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                        <button onClick={() => handleDeleteFile(file.id)} className="text-red-500 hover:text-red-600 p-1"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete({ type: "file", id: file.id })}
                        disabled={deletingFile === file.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {deletingFile === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GRID VIEW ────────────────────────────────────────────────────── */}
      {!isEmpty && view === "grid" && (
        <div className="space-y-4">

          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {folders.map((folder) => (
                <Link
                  key={folder.id}
                  href={`/projects/${projectId}/docs?folder=${folder.id}`}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:shadow-sm hover:border-border/80 transition-all text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                    <Folder className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug w-full group-hover:text-primary transition-colors">
                    {folder.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {folder._count.docs + folder._count.files} item{folder._count.docs + folder._count.files !== 1 ? "s" : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/projects/${projectId}/docs/${doc.id}`)}
                  className="group relative flex flex-col rounded-xl border border-border bg-card p-4 hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl mb-3">
                    {doc.emoji ?? <FileText className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                    {doc.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {doc.author.name.split(" ")[0]} · {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </p>
                  {confirmDelete?.id === doc.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-card border border-red-200 rounded-lg px-2 py-1 shadow-sm" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }} className="text-red-500 hover:text-red-600 p-0.5"><Check className="w-3 h-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "doc", id: doc.id }); }}
                      disabled={deletingDoc === doc.id}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50"
                    >
                      {deletingDoc === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {files.map((file) => {
                const isImage = !!file.utKey && file.mimeType.startsWith("image/");
                return (
                  <div
                    key={file.id}
                    className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:shadow-sm transition-all"
                  >
                    <div className="h-20 bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {isImage
                        ? <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        : <FileTypeIcon mimeType={file.mimeType} className="w-7 h-7 text-muted-foreground" />
                      }
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatBytes(file.size)}</p>
                    </div>
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {file.utKey && (
                        <a href={file.url} download={file.name} className="w-6 h-6 rounded-md bg-card/90 backdrop-blur-sm border border-border/60 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                          <Download className="w-3 h-3" />
                        </a>
                      )}
                      {file.utKey && (
                        confirmDelete?.id === file.id ? (
                          <div className="flex items-center gap-0.5 bg-card/90 backdrop-blur-sm border border-red-200 rounded-lg px-1.5 py-0.5 shadow-sm">
                            <span className="text-[10px] text-red-600 font-medium">Del?</span>
                            <button onClick={() => handleDeleteFile(file.id)} className="text-red-500 p-0.5"><Check className="w-2.5 h-2.5" /></button>
                            <button onClick={() => setConfirmDelete(null)} className="text-muted-foreground p-0.5"><X className="w-2.5 h-2.5" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete({ type: "file", id: file.id })}
                            disabled={deletingFile === file.id}
                            className="w-6 h-6 rounded-md bg-card/90 backdrop-blur-sm border border-border/60 shadow-sm flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            {deletingFile === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

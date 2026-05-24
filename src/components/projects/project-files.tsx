"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Upload, Trash2, FileText, FileImage, FileVideo, FileAudio,
  File, Download, Eye, Loader2, CloudUpload,
  Folder, FolderPlus, ChevronRight, Home, Check, X,
  Ellipsis, Pencil,
} from "lucide-react";
import { deleteProjectFile } from "@/actions/files";
import { createDocFolder, renameDocFolder, deleteDocFolder } from "@/actions/docs";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocFolder = {
  id: string;
  name: string;
  _count: { docs: number; children: number; files: number };
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("text/") ||
    mimeType === "application/pdf"
  );
}

type FileBadge = { label: string; className: string };

function getFileBadge(mimeType: string, filename: string): FileBadge {
  if (mimeType === "application/pdf")
    return { label: "PDF", className: "bg-red-100 text-red-700 border-red-200" };
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword")
    return { label: "DOCX", className: "bg-blue-100 text-blue-700 border-blue-200" };
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel")
    return { label: "XLSX", className: "bg-green-100 text-green-700 border-green-200" };
  if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint")
    return { label: "PPTX", className: "bg-orange-100 text-orange-700 border-orange-200" };
  if (mimeType.includes("visio") || filename.toLowerCase().endsWith(".vsdx"))
    return { label: "VSDX", className: "bg-purple-100 text-purple-700 border-purple-200" };
  if (mimeType.startsWith("image/")) {
    const sub = mimeType.split("/")[1]?.toUpperCase().replace("JPEG", "JPG") ?? "IMG";
    return { label: sub, className: "bg-sky-100 text-sky-700 border-sky-200" };
  }
  if (mimeType.startsWith("video/"))
    return { label: "VIDEO", className: "bg-violet-100 text-violet-700 border-violet-200" };
  if (mimeType.startsWith("audio/"))
    return { label: "AUDIO", className: "bg-pink-100 text-pink-700 border-pink-200" };
  if (mimeType.startsWith("text/"))
    return { label: "TXT", className: "bg-gray-100 text-gray-600 border-gray-200" };
  const ext = filename.split(".").pop()?.toUpperCase() ?? "FILE";
  return { label: ext, className: "bg-gray-100 text-gray-600 border-gray-200" };
}

type ThumbnailBg = { bg: string; iconColor: string };

function getThumbnailStyle(mimeType: string): ThumbnailBg {
  if (mimeType === "application/pdf")          return { bg: "bg-red-50",    iconColor: "text-red-400" };
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword")
                                               return { bg: "bg-blue-50",   iconColor: "text-blue-400" };
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel")
                                               return { bg: "bg-green-50",  iconColor: "text-green-400" };
  if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint")
                                               return { bg: "bg-orange-50", iconColor: "text-orange-400" };
  if (mimeType.includes("visio"))              return { bg: "bg-purple-50", iconColor: "text-purple-400" };
  if (mimeType.startsWith("video/"))           return { bg: "bg-violet-50", iconColor: "text-violet-400" };
  if (mimeType.startsWith("audio/"))           return { bg: "bg-pink-50",   iconColor: "text-pink-400" };
  return { bg: "bg-muted", iconColor: "text-muted-foreground" };
}

function ThumbnailIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cls = cn("w-8 h-8", className);
  if (mimeType.startsWith("image/"))  return <FileImage className={cls} />;
  if (mimeType.startsWith("video/"))  return <FileVideo className={cls} />;
  if (mimeType.startsWith("audio/"))  return <FileAudio className={cls} />;
  if (mimeType === "application/pdf") return <FileText className={cls} />;
  return <File className={cls} />;
}

// ─── Folder card ─────────────────────────────────────────────────────────────

function FolderCard({ folder, projectId }: { folder: DocFolder; projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [nameValue, setNameValue] = useState(folder.name);
  const [isPending, startTransition] = useTransition();

  const total = folder._count.files + folder._count.docs + folder._count.children;
  const parts = [
    folder._count.files > 0    && `${folder._count.files} file${folder._count.files !== 1 ? "s" : ""}`,
    folder._count.docs  > 0    && `${folder._count.docs} doc${folder._count.docs !== 1 ? "s" : ""}`,
    folder._count.children > 0 && `${folder._count.children} folder${folder._count.children !== 1 ? "s" : ""}`,
  ].filter(Boolean);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleNavigate() {
    if (renaming || confirming || isPending) return;
    router.push(`/projects/${projectId}/files?folder=${folder.id}`);
  }

  function saveRename() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === folder.name) { setRenaming(false); setNameValue(folder.name); return; }
    startTransition(async () => {
      await renameDocFolder(folder.id, trimmed);
      setRenaming(false);
      router.refresh();
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    setConfirming(true);
  }

  function confirmDelete() {
    setConfirming(false);
    startTransition(async () => {
      await deleteDocFolder(folder.id);
      router.refresh();
    });
  }

  return (
    <div
      onClick={handleNavigate}
      className={cn(
        "group relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all duration-150 select-none",
        renaming || isPending
          ? "border-primary/30 cursor-default"
          : total === 0
            ? "border-slate-100 cursor-pointer opacity-60 hover:opacity-100 hover:shadow-sm hover:border-amber-200"
            : "border-slate-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-amber-200"
      )}
    >
      {/* Amber thumbnail header */}
      <div className="h-24 bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center relative border-b border-amber-100/80">
        {isPending
          ? <Loader2 className="w-10 h-10 text-amber-300 animate-spin" />
          : <Folder className="w-10 h-10 text-amber-400" />
        }
        {total > 0 && (
          <span className="absolute bottom-2 right-2 text-[10px] font-semibold text-amber-700 bg-white/80 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
            {total}
          </span>
        )}

        {/* ··· menu */}
        {!renaming && (
          <div
            ref={menuRef}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm hover:bg-white transition-colors"
            >
              <Ellipsis className="w-3.5 h-3.5 text-slate-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 w-32 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => { setMenuOpen(false); setRenaming(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Rename
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="px-3 py-2.5">
        {renaming ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); saveRename(); }
              if (e.key === "Escape") { setRenaming(false); setNameValue(folder.name); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm font-medium bg-transparent border-b border-primary/40 outline-none text-slate-800 pb-0.5"
          />
        ) : (
          <p className="text-sm font-semibold text-slate-800 truncate leading-snug" title={folder.name}>
            {folder.name}
          </p>
        )}
        <p className={cn("text-xs mt-0.5", total === 0 ? "text-slate-300" : "text-slate-400")}>
          {total === 0 ? "Empty" : parts.join(" · ")}
        </p>
      </div>

      {/* Inline delete confirmation */}
      {confirming && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 rounded-xl bg-white/95 backdrop-blur-sm flex items-center justify-center gap-3 px-4 z-40"
        >
          <p className="text-xs font-medium text-slate-700 truncate flex-1">
            Delete &ldquo;{folder.name}&rdquo;?
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-2.5 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File card ───────────────────────────────────────────────────────────────

function FileCard({ file, onDelete }: { file: ProjectFile; onDelete: (id: string) => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isStoredInUT = !!file.utKey;
  const canPreview   = isStoredInUT && isPreviewable(file.mimeType);
  const isImage      = isStoredInUT && file.mimeType.startsWith("image/");
  const badge        = getFileBadge(file.mimeType, file.name);
  const { bg, iconColor } = getThumbnailStyle(file.mimeType);
  const authorName   = file.importedAuthor ?? file.uploadedBy.name;

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:shadow-sm hover:border-border/80 transition-all">

      {/* Delete — inline confirm */}
      {isStoredInUT && (
        <div className="absolute top-2 right-2 z-10">
          {confirmingDelete ? (
            <div className="flex items-center gap-1 bg-card border border-red-200 rounded-lg px-2 py-1 shadow-sm">
              <span className="text-[11px] text-red-600 font-medium">Delete?</span>
              <button onClick={() => { setConfirmingDelete(false); onDelete(file.id); }} className="text-red-500 hover:text-red-600 p-0.5"><Check className="w-3 h-3" /></button>
              <button onClick={() => setConfirmingDelete(false)} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
              title="Delete file"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Thumbnail */}
      <div className={cn("h-28 flex items-center justify-center overflow-hidden flex-shrink-0 relative", bg)}>
        {isImage ? (
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <ThumbnailIcon mimeType={file.mimeType} className={cn("w-14 h-14", iconColor)} />
            <span className={cn(
              "absolute bottom-2 right-2 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border leading-none",
              badge.className
            )}>
              {badge.label}
            </span>
          </>
        )}
      </div>

      {/* File info */}
      <div className="px-3 pt-2.5 pb-2 flex-1">
        {/* Name + type badge (badge only shown for images since doc types overlay the thumbnail) */}
        <div className="flex items-start gap-1.5 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug flex-1 min-w-0" title={file.name}>
            {file.name}
          </p>
          {isImage && (
            <span className={cn(
              "flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border leading-none mt-0.5",
              badge.className
            )}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{formatBytes(file.size)}</span>
            <span>·</span>
            <span>{format(new Date(file.createdAt), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="truncate">{authorName}</span>
            {!isStoredInUT && (
              <span className="flex-shrink-0 font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200 leading-none text-[9px]">
                Basecamp
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {isStoredInUT ? (
        <div className="flex items-center border-t border-border/60">
          {canPreview ? (
            <>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </a>
              <div className="w-px h-4 bg-border/60" />
              <a
                href={file.url}
                download={file.name}
                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </>
          ) : (
            <a
              href={file.url}
              download={file.name}
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}
        </div>
      ) : (
        <div className="border-t border-border/60 px-3 py-2">
          <p className="text-[10px] text-muted-foreground text-center">
            Not available — re-import with UploadThing configured.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectFiles({
  projectId,
  folders,
  initialFiles,
  breadcrumb,
  currentFolderId,
}: {
  projectId: string;
  folders: DocFolder[];
  initialFiles: ProjectFile[];
  breadcrumb: { id: string; name: string }[];
  currentFolderId: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [creatingFolder, startFolderCreate] = useTransition();

  const visibleFolders = folders;

  const { startUpload } = useUploadThing("projectFileUploader", {
    onUploadProgress: (progress) => setUploadProgress(progress),
    onClientUploadComplete: () => {
      setUploading(false);
      setUploadProgress(null);
      setUploadError(null);
      router.refresh();
    },
    onUploadError: (error) => {
      setUploading(false);
      setUploadProgress(null);
      setUploadError(error.message || "Upload failed. Please try again.");
    },
  });

  function handleFolderCreate() {
    if (!folderName.trim()) return;
    setFolderError(null);
    startFolderCreate(async () => {
      try {
        await createDocFolder({ projectId, name: folderName.trim(), parentId: currentFolderId });
        setFolderName("");
        setAddingFolder(false);
        router.refresh();
      } catch (e) {
        setFolderError(e instanceof Error ? e.message : "Failed to create folder");
      }
    });
  }

  function handleFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploadError(null);
    setUploading(true);
    void startUpload(arr, { projectId, folderId: currentFolderId ?? undefined })
      ?.catch((err: unknown) => {
        setUploading(false);
        setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      });
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCountRef.current += 1;
    if (dragCountRef.current === 1) setDragging(true);
  }

  function handleDragLeave() {
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCountRef.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDelete(fileId: string) {
    startDeleteTransition(async () => {
      await deleteProjectFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    });
  }

  const busy    = uploading || isDeletePending;
  const isEmpty = visibleFolders.length === 0 && files.length === 0;

  return (
    <div
      className="relative space-y-6 pb-8"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag-over overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 rounded-xl bg-primary/5 border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <CloudUpload className="w-10 h-10 text-primary/70" />
          <p className="text-sm font-medium text-primary">
            {currentFolderId ? "Drop to upload into this folder" : "Drop files to upload"}
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        disabled={busy}
        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }}
      />

      {/* ── Breadcrumb + toolbar ── */}
      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
          <Link
            href={`/projects/${projectId}/files`}
            className={cn(
              "flex items-center gap-1 transition-colors shrink-0",
              currentFolderId ? "text-muted-foreground hover:text-foreground" : "text-foreground font-medium"
            )}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Files</span>
          </Link>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Link
                href={`/projects/${projectId}/files?folder=${crumb.id}`}
                className={cn(
                  "transition-colors truncate",
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

        {/* Toolbar actions */}
        <div className="flex items-center gap-3 shrink-0">
          {uploading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {uploadProgress !== null ? `${uploadProgress}%` : "Uploading…"}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          )}
          {!addingFolder && (
            <button
              onClick={() => setAddingFolder(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Folder
            </button>
          )}
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-2.5">
          {uploadError}
        </p>
      )}

      {/* Inline folder creation */}
      {addingFolder && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-2.5">
            <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={folderName}
              onChange={(e) => { setFolderName(e.target.value); setFolderError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFolderCreate();
                if (e.key === "Escape") { setAddingFolder(false); setFolderName(""); setFolderError(null); }
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
              onClick={() => { setAddingFolder(false); setFolderName(""); setFolderError(null); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {folderError && (
            <p className="text-xs text-destructive px-1">{folderError}</p>
          )}
        </div>
      )}

      {/* ── Folders ── */}
      {visibleFolders.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2.5">
            Folders
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visibleFolders.map((folder) => (
              <FolderCard key={folder.id} folder={folder} projectId={projectId} />
            ))}
          </div>
        </section>
      )}

      {/* ── Files ── */}
      {files.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2.5">
            Files
            <span className="ml-1.5 font-normal normal-case tracking-normal">
              · {files.length}
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {files.map((file) => (
              <FileCard key={file.id} file={file} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {isEmpty && !uploading && (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-foreground">
            {currentFolderId ? "No files in this folder" : "No files yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            Click Upload or drag files here to get started.
          </p>
        </div>
      )}

    </div>
  );
}

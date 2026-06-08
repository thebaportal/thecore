"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { UTApi, UTFile } from "uploadthing/server";
import { db } from "@/lib/db";
import { syncCurrentIdentity } from "@/actions/projects";
import { htmlToMarkdown, htmlToText } from "@/lib/html-to-markdown";

const BC_UA = "TheCore/1.0 (migration-tool)";

// ── Credential resolution (DB-first, cookie fallback) ────────────────────────

async function getBasecampCredentials(): Promise<{ token: string; accountId: string }> {
  const { orgId } = await auth();
  if (orgId) {
    const org = await db.organization.findUnique({
      where: { clerkOrgId: orgId },
      select: { basecampAccessToken: true, basecampAccountId: true },
    });
    if (org?.basecampAccessToken && org.basecampAccountId) {
      return { token: org.basecampAccessToken, accountId: org.basecampAccountId };
    }
  }
  // Cookie fallback (valid for 8 hours after connect)
  const cookieStore = await cookies();
  const token     = cookieStore.get("bc_token")?.value;
  const accountId = cookieStore.get("bc_account_id")?.value;
  if (token && accountId) return { token, accountId };
  throw new Error("Not connected to Basecamp. Please reconnect on the settings page.");
}

// ── Basecamp fetch helpers ────────────────────────────────────────────────────

// Retries up to 3 times on 429, honouring Retry-After when present.
async function bcFetchRaw(url: string, token: string): Promise<Response> {
  const opts = { headers: { Authorization: `Bearer ${token}`, "User-Agent": BC_UA } };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, opts);
    if (res.status !== 429) return res;
    const after = parseInt(res.headers.get("Retry-After") ?? "10", 10);
    const delay = isNaN(after) ? Math.min(10_000 * (attempt + 1), 30_000) : after * 1_000;
    console.log(`[BC] 429 on ${url.slice(0, 80)} — retrying in ${delay}ms (attempt ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, delay));
  }
  return fetch(url, opts);
}

async function bcFetch<T>(path: string, token: string, accountId: string): Promise<T> {
  const url = `https://3.basecampapi.com/${accountId}${path}`;
  const res = await bcFetchRaw(url, token);
  if (!res.ok) throw new Error(`Basecamp API error: ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

async function bcFetchAll<T>(path: string, token: string, accountId: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = `https://3.basecampapi.com/${accountId}${path}`;
  while (nextUrl) {
    const res = await bcFetchRaw(nextUrl, token);
    if (!res.ok) throw new Error(`Basecamp API error: ${res.status} ${nextUrl}`);
    results.push(...(await res.json() as T[]));
    const link = res.headers.get("Link") ?? "";
    nextUrl = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return results;
}

async function bcFetchFullUrl<T>(fullUrl: string, token: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = fullUrl;
  while (nextUrl) {
    const res = await bcFetchRaw(nextUrl, token);
    if (!res.ok) throw new Error(`Basecamp API error: ${res.status} ${nextUrl}`);
    results.push(...(await res.json() as T[]));
    const link = res.headers.get("Link") ?? "";
    nextUrl = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return results;
}

// ── Basecamp types ────────────────────────────────────────────────────────────

type BCProject = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  dock: { name: string; url: string; id: number }[];
};

type BCTodo = {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  due_on: string | null;
  assignees: { id: number; name: string; email_address: string }[];
};

type BCTodolist = { id: number; title: string; todos_url: string };

type BCMessage = {
  id: number;
  subject: string;
  content: string;
  created_at: string;
  creator: { id: number; name: string; email_address: string };
};

type BCComment = {
  id: number;
  content: string;
  created_at: string;
  creator: { id: number; name: string; email_address: string };
};

type BCAttachmentTag = {
  filename: string;
  contentType: string;
  filesize: number;
  url: string;
};

type BCDocument = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  creator: { id: number; name: string; email_address: string };
};

type BCUpload = {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  download_url: string;
  created_at: string;
  creator: { id: number; name: string; email_address: string };
};

type BCVault = {
  id: number;
  title: string;
  documents_url: string;
  vaults_url: string;
  uploads_url: string;
};

type DocWithFolder  = BCDocument & { dbFolderId: string | null };
type UploadWithFolder = BCUpload  & { dbFolderId: string | null; bcProjectId: number };

// ── Vault traversal ───────────────────────────────────────────────────────────
//
// depth=0 is the root vault (the "Docs & Files" tool on the dock).
// We do NOT create a DB folder for it — its sub-vaults become top-level
// folders so "Project Mandate", "Meeting Notes" etc. appear at root.

async function fetchVaultContent(
  vaultId: number,
  bcProjectId: number,
  token: string,
  accountId: string,
  dbProjectId: string,
  orgId: string,
  parentFolderId: string | null,
  depth = 0
): Promise<{ docs: DocWithFolder[]; uploads: UploadWithFolder[]; foldersCreated: number; vaultErrors: string[] }> {
  const vaultErrors: string[] = [];
  const allDocs: DocWithFolder[] = [];
  const allUploads: UploadWithFolder[] = [];
  let foldersCreated = 0;

  // This top-level fetch is intentionally non-caught: if we can't get the vault
  // detail at all, there's nothing to traverse and the caller should know.
  const vault = await bcFetch<BCVault>(
    `/buckets/${bcProjectId}/vaults/${vaultId}.json`,
    token,
    accountId
  );

  const vaultLabel = depth === 0 ? `Root vault id=${vaultId}` : `"${vault.title}" id=${vaultId} depth=${depth}`;
  console.log(`[BC Vault] ${vaultLabel} | uploads_url=${vault.uploads_url ?? "MISSING"}`);

  // Root vault (depth=0) is the container tool — don't create a folder for it.
  let folderId: string | null = null;
  if (depth > 0) {
    folderId = `bc-vault-${vaultId}`;
    await db.docFolder.upsert({
      where: { id: folderId },
      create: { id: folderId, organizationId: orgId, projectId: dbProjectId, name: vault.title, parentId: parentFolderId },
      update: { projectId: dbProjectId, name: vault.title, parentId: parentFolderId },
    });
    foldersCreated++;
  }

  // Fetch text documents in this vault — isolated so a failure here doesn't
  // prevent uploads or sub-folders from being imported.
  try {
    const rootDocs = await bcFetchFullUrl<BCDocument>(vault.documents_url, token);
    console.log(`[BC Vault] ${vaultLabel} → ${rootDocs.length} docs`);
    allDocs.push(...rootDocs.map((d) => ({ ...d, dbFolderId: folderId })));
  } catch (e) {
    vaultErrors.push(`⚠ Could not list docs in "${vault.title || "root"}": ${String(e)}`);
  }

  // Fetch file uploads in this vault — isolated from document failures.
  if (vault.uploads_url) {
    try {
      const uploads = await bcFetchFullUrl<BCUpload>(vault.uploads_url, token);
      console.log(`[BC Vault] ${vaultLabel} → ${uploads.length} uploads`);
      allUploads.push(...uploads.map((u) => ({ ...u, dbFolderId: folderId, bcProjectId })));
    } catch (e) {
      vaultErrors.push(`⚠ Could not list files in "${vault.title || "root"}": ${String(e)}`);
    }
  } else {
    // uploads_url missing — construct it manually as a fallback
    const fallbackUrl = `https://3.basecampapi.com/${accountId}/buckets/${bcProjectId}/vaults/${vaultId}/uploads.json`;
    console.log(`[BC Vault] ${vaultLabel} → uploads_url MISSING, trying fallback: ${fallbackUrl}`);
    try {
      const uploads = await bcFetchFullUrl<BCUpload>(fallbackUrl, token);
      console.log(`[BC Vault] ${vaultLabel} → fallback got ${uploads.length} uploads`);
      allUploads.push(...uploads.map((u) => ({ ...u, dbFolderId: folderId, bcProjectId })));
    } catch (e) {
      vaultErrors.push(`⚠ Could not list files (fallback) in "${vault.title || "root"}": ${String(e)}`);
    }
  }

  // Recurse into sub-folders — each sub-vault is isolated so one bad folder
  // doesn't abort the rest. Depth limit raised to 6 to handle deep structures.
  if (depth < 6) {
    try {
      const nestedVaults = await bcFetchFullUrl<BCVault>(vault.vaults_url, token);
      console.log(`[BC Vault] ${vaultLabel} → ${nestedVaults.length} sub-folders`);
      for (const nested of nestedVaults) {
        try {
          const result = await fetchVaultContent(
            nested.id, bcProjectId, token, accountId, dbProjectId, orgId, folderId, depth + 1
          );
          allDocs.push(...result.docs);
          allUploads.push(...result.uploads);
          foldersCreated += result.foldersCreated;
          vaultErrors.push(...result.vaultErrors);
        } catch (e) {
          vaultErrors.push(`⚠ Could not import folder (vault ${nested.id}): ${String(e)}`);
        }
      }
    } catch (e) {
      vaultErrors.push(`⚠ Could not list sub-folders in "${vault.title || "root"}": ${String(e)}`);
    }
  }

  return { docs: allDocs, uploads: allUploads, foldersCreated, vaultErrors };
}

// ── UploadThing pre-flight ────────────────────────────────────────────────────
//
// Uploads a 1-byte blob before the real file loop. If this fails we know UT is
// broken and can fail-fast with a clear message instead of 27 silent errors.

async function utPreFlight(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const utapi = new UTApi();
    const tiny  = new UTFile([new Uint8Array([0])], "__bc_preflight__.bin", { type: "application/octet-stream" });
    const res   = await utapi.uploadFiles(tiny);
    if (res.error) return { ok: false, reason: res.error.message };
    if (!res.data)  return { ok: false, reason: "UploadThing returned no data for pre-flight" };
    try { await utapi.deleteFiles([res.data.key]); } catch {}
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// ── File download + UploadThing storage ───────────────────────────────────────
//
// Uses the download_url already present on the listing record — no extra detail
// fetch needed. The shared UTApi instance is created once per import run and
// passed in to avoid re-instantiating for every file.

async function downloadAndStore(
  upload: UploadWithFolder,
  bcToken: string,
  utapi: UTApi
): Promise<{ url: string; utKey: string; size: number }> {
  const tag = `[BC File ${upload.id} "${upload.filename}"]`;

  // The upload listing already contains download_url. Construct a fallback in
  // the unlikely case it's missing.
  const downloadUrl = upload.download_url ||
    `https://3.basecampapi.com/buckets/${upload.bcProjectId}/uploads/${upload.id}/download/${encodeURIComponent(upload.filename)}`;

  console.log(`${tag} Downloading from ${downloadUrl.slice(0, 100)}…`);

  const dlRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${bcToken}`, "User-Agent": BC_UA },
    redirect: "follow",
  });

  console.log(`${tag} HTTP ${dlRes.status}  content-type=${dlRes.headers.get("content-type")}  size-header=${dlRes.headers.get("content-length") ?? "?"}`);

  if (dlRes.status === 404) throw new Error("FILE_NOT_FOUND");
  if (!dlRes.ok) {
    const body = await dlRes.text().catch(() => "");
    console.error(`${tag} DOWNLOAD FAILED — body: ${body.slice(0, 300)}`);
    throw new Error(`Download failed HTTP ${dlRes.status}`);
  }

  const buffer = await dlRes.arrayBuffer();
  console.log(`${tag} Downloaded ${buffer.byteLength} bytes`);

  if (buffer.byteLength === 0) {
    console.error(`${tag} EMPTY BODY — Basecamp returned 0 bytes`);
    throw new Error("Basecamp returned an empty file body");
  }

  const mimeType = upload.content_type || dlRes.headers.get("content-type") || "application/octet-stream";
  const file     = new UTFile([buffer], upload.filename, { type: mimeType });
  const result   = await utapi.uploadFiles(file);

  if (result.error) {
    console.error(`${tag} UPLOADTHING ERROR — ${JSON.stringify(result.error)}`);
    throw new Error(`UploadThing: ${result.error.message}`);
  }
  if (!result.data?.ufsUrl) {
    console.error(`${tag} UPLOADTHING ERROR — no URL in response`);
    throw new Error("UploadThing returned no URL");
  }

  console.log(`${tag} Stored → key=${result.data.key}  url=${result.data.ufsUrl.slice(0, 60)}…`);

  return { url: result.data.ufsUrl, utKey: result.data.key, size: buffer.byteLength };
}

// Extracts <bc-attachment> tags from Basecamp HTML before markdown conversion.
function extractBcAttachments(html: string): { cleanHtml: string; bcAttachmentTags: BCAttachmentTag[] } {
  const bcAttachmentTags: BCAttachmentTag[] = [];
  const cleanHtml = html
    .replace(/<bc-attachment([^>]*)>([\s\S]*?)<\/bc-attachment>/gi, (_, attrs: string) => {
      const filename    = attrs.match(/filename="([^"]+)"/i)?.[1] ?? "";
      const contentType = attrs.match(/content-type="([^"]+)"/i)?.[1] ?? "application/octet-stream";
      const filesize    = parseInt(attrs.match(/filesize="(\d+)"/i)?.[1] ?? "0", 10);
      const url         = attrs.match(/\burl="([^"]+)"/i)?.[1] ?? attrs.match(/href="([^"]+)"/i)?.[1] ?? "";
      if (url && filename) bcAttachmentTags.push({ filename, contentType, filesize, url });
      return "";
    })
    .replace(/<bc-attachment[^>]*\/?>/gi, "");
  return { cleanHtml, bcAttachmentTags };
}

async function downloadAndStoreRaw(
  url: string,
  filename: string,
  contentType: string,
  bcToken: string,
): Promise<{ utUrl: string; utKey: string; size: number }> {
  if (!process.env["UPLOADTHING_TOKEN"]) {
    throw new Error("UPLOADTHING_TOKEN not set");
  }
  const dlRes = await fetch(url, {
    headers: { Authorization: `Bearer ${bcToken}`, "User-Agent": BC_UA },
  });
  if (!dlRes.ok) throw new Error(`Basecamp download failed: ${dlRes.status}`);
  const buffer = await dlRes.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error("Empty file");
  const utapi = new UTApi();
  const file  = new File([buffer], filename, { type: contentType });
  const result = await utapi.uploadFiles(file);
  if (result.error) throw new Error(`UploadThing: ${result.error.message}`);
  if (!result.data) throw new Error("UploadThing returned no data");
  return { utUrl: result.data.ufsUrl, utKey: result.data.key, size: buffer.byteLength };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ImportStatus =
  | "NOT_IMPORTED"
  | "IMPORTED"
  | "IMPORTED_WITH_WARNINGS"
  | "PARTIALLY_IMPORTED"
  | "IMPORT_FAILED"
  | "LEGACY_IMPORT";

// Files larger than this are skipped during import — the server can't buffer them reliably.
// Override via BASECAMP_MAX_FILE_MB env var (e.g. "512" for 512 MB).
const MAX_IMPORT_FILE_BYTES =
  parseInt(process.env["BASECAMP_MAX_FILE_MB"] ?? "200", 10) * 1024 * 1024;

// Stored in BasecampImportLog.failedFiles — enough info to retry without re-fetching the BC list.
export type FailedFile = {
  uploadId: number;
  bcProjectId: number;
  dbProjectId: string;
  dbFolderId: string | null;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
  reason: string;
  is404: boolean;
  isOversized?: boolean;
};

export type ProjectImportLog = {
  tasksCount: number;
  messagesCount: number;
  filesCount: number;
  foldersCount: number;
  failedFilesCount: number;
  failedFiles: FailedFile[];
  phaseErrors: { phase: string; error: string }[];
  lastImportedAt: Date;
};

export type BCProjectWithStatus = {
  id: number;
  name: string;
  description: string | null;
  dock: { name: string; url: string; id: number }[];
  bcStatus: "active" | "archived";
  importStatus: ImportStatus;
  importedAt: Date | null;
  counts: { tasks: number; discussions: number; files: number; folders: number } | null;
  importLog: ProjectImportLog | null;
};

// Deterministic: phases drive critical failures, retryable item errors drive warnings,
// ⚠-only soft errors (404s, oversized, vault notes) = fully imported.
function calculateImportStatus(phases: PhaseResult[], errors: string[]): ImportStatus {
  const projectPhase = phases.find((p) => p.phase === "Project" || p.phase === "Project fetch");
  if (projectPhase?.status === "error") return "IMPORT_FAILED";

  const phaseErrors = phases.filter((p) => p.status === "error");
  if (phaseErrors.length > 0) return "PARTIALLY_IMPORTED";

  // Only retryable errors (not ⚠-prefixed) elevate to IMPORTED_WITH_WARNINGS.
  const retryable = errors.filter((e) => !e.startsWith("⚠"));
  if (retryable.length > 0) return "IMPORTED_WITH_WARNINGS";

  return "IMPORTED";
}

export async function getBasecampProjects(): Promise<BCProjectWithStatus[]> {
  const { token, accountId } = await getBasecampCredentials();

  const [activeProjects, archivedProjects] = await Promise.all([
    bcFetchAll<BCProject>("/projects.json", token, accountId),
    bcFetchAll<BCProject>("/projects/archived.json", token, accountId).catch(() => [] as BCProject[]),
  ]);
  const allProjects = [...activeProjects, ...archivedProjects];

  const dbIds = allProjects.map((p) => `bc-${p.id}`);

  const [existingProjects, importLogs, taskCounts, pingCounts, postCounts, fileCounts, folderCounts] = await Promise.all([
    db.project.findMany({
      where: { id: { in: dbIds } },
      select: { id: true, createdAt: true },
    }),
    db.basecampImportLog.findMany({
      where: { projectId: { in: dbIds } },
      select: {
        projectId: true, status: true,
        tasksCount: true, messagesCount: true, filesCount: true, foldersCount: true,
        failedFilesCount: true, failedFiles: true, phaseErrors: true, lastImportedAt: true,
      },
    }),
    db.task.groupBy({ by: ["projectId"], where: { projectId: { in: dbIds } }, _count: { _all: true } }),
    db.ping.groupBy({ by: ["projectId"], where: { projectId: { in: dbIds } }, _count: { _all: true } }),
    db.projectPost.groupBy({ by: ["projectId"], where: { projectId: { in: dbIds } }, _count: { _all: true } }),
    db.projectFile.groupBy({ by: ["projectId"], where: { projectId: { in: dbIds } }, _count: { _all: true } }),
    db.docFolder.groupBy({ by: ["projectId"], where: { projectId: { in: dbIds } }, _count: { _all: true } }),
  ]);

  const importedMap = new Map(existingProjects.map((p) => [p.id, p.createdAt]));
  const logMap      = new Map(importLogs.map((l) => [l.projectId, l]));
  const taskMap     = new Map(taskCounts.map((r) => [r.projectId, r._count._all]));
  const pingMap     = new Map(pingCounts.map((r) => [r.projectId, r._count._all]));
  const postMap     = new Map(postCounts.map((r) => [r.projectId, r._count._all]));
  const fileMap     = new Map(fileCounts.map((r) => [r.projectId, r._count._all]));
  const folderMap   = new Map(folderCounts.map((r) => [r.projectId, r._count._all]));

  return allProjects.map((p) => {
    const dbId     = `bc-${p.id}`;
    const inDb     = importedMap.has(dbId);
    const log      = logMap.get(dbId) ?? null;

    let importStatus: ImportStatus;
    if (!inDb) {
      importStatus = "NOT_IMPORTED";
    } else if (!log) {
      // In DB but no import log: if the project has content it was imported by an older version
      // of the app that didn't write logs. If it has no content the import started but never
      // completed (e.g. timed out) — treat as NOT_IMPORTED so it appears in "Ready to Import".
      const hasContent =
        (taskMap.get(dbId)   ?? 0) +
        (fileMap.get(dbId)   ?? 0) +
        (pingMap.get(dbId)   ?? 0) +
        (postMap.get(dbId)   ?? 0) +
        (folderMap.get(dbId) ?? 0) > 0;
      importStatus = hasContent ? "LEGACY_IMPORT" : "NOT_IMPORTED";
    } else {
      importStatus = log.status as ImportStatus;
    }

    const importLog: ProjectImportLog | null = log
      ? {
          tasksCount:      log.tasksCount,
          messagesCount:   log.messagesCount,
          filesCount:      log.filesCount,
          foldersCount:    log.foldersCount,
          failedFilesCount: log.failedFilesCount,
          failedFiles:     log.failedFiles as FailedFile[],
          phaseErrors:     log.phaseErrors as { phase: string; error: string }[],
          lastImportedAt:  log.lastImportedAt,
        }
      : null;

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      dock: p.dock,
      bcStatus: (p.status === "archived" ? "archived" : "active") as "active" | "archived",
      importStatus,
      importedAt: inDb ? (importedMap.get(dbId) ?? null) : null,
      counts: inDb ? {
        tasks:       taskMap.get(dbId)   ?? 0,
        discussions: (pingMap.get(dbId) ?? 0) + (postMap.get(dbId) ?? 0),
        files:       fileMap.get(dbId)   ?? 0,
        folders:     folderMap.get(dbId) ?? 0,
      } : null,
      importLog,
    };
  });
}

export type PhaseResult = {
  phase: string;
  status: "ok" | "error" | "skipped";
  count?: number;
  error?: string;
};

export type ImportResult = {
  project: string;
  importStatus: ImportStatus;
  importLog: ProjectImportLog;
  phases: PhaseResult[];
  tasksImported: number;
  messagesImported: number;
  commentsImported: number;
  docsImported: number;
  filesStored: number;
  filesMetadataOnly: number;
  foldersCreated: number;
  errors: string[];
};

// Returns the DB user for a Basecamp person.
// Priority: BasecampPerson table → email match → create placeholder.
async function resolveBasecampUser(
  bcPerson: { id: number; name: string; email_address: string },
  orgId: string,
  fallbackUserId: string
): Promise<string> {
  try {
    const personId = String(bcPerson.id);

    // 1. Already mapped via BasecampPerson table (populated by importBasecampPeople)
    const mapping = await db.basecampPerson.findUnique({
      where: { organizationId_basecampPersonId: { organizationId: orgId, basecampPersonId: personId } },
      select: { coreUserId: true },
    });
    if (mapping?.coreUserId) return mapping.coreUserId;

    // 2. Match by email
    if (bcPerson.email_address) {
      const byEmail = await db.user.findUnique({
        where: { email: bcPerson.email_address },
        select: { id: true },
      });
      if (byEmail) {
        await db.basecampPerson.upsert({
          where: { organizationId_basecampPersonId: { organizationId: orgId, basecampPersonId: personId } },
          create: { organizationId: orgId, basecampPersonId: personId, basecampName: bcPerson.name, basecampEmail: bcPerson.email_address, coreUserId: byEmail.id },
          update: { coreUserId: byEmail.id },
        });
        return byEmail.id;
      }
    }

    // 3. Create a placeholder (no Clerk account needed)
    const email = bcPerson.email_address || `bc-${personId}@basecamp.import`;
    const newUser = await db.user.create({
      data: {
        email,
        name: bcPerson.name,
        isPlaceholder: true,
        memberships: { create: { organizationId: orgId, role: "MEMBER" } },
      },
    });
    await db.basecampPerson.upsert({
      where: { organizationId_basecampPersonId: { organizationId: orgId, basecampPersonId: personId } },
      create: { organizationId: orgId, basecampPersonId: personId, basecampName: bcPerson.name, basecampEmail: bcPerson.email_address || null, coreUserId: newUser.id, isPlaceholder: true },
      update: { coreUserId: newUser.id },
    });
    return newUser.id;
  } catch {
    return fallbackUserId;
  }
}

async function importLineReactions(
  messageId: string,
  reactionsUrl: string,
  token: string,
  orgId: string,
  fallbackUserId: string
): Promise<void> {
  try {
    const reactions = await bcFetchFullUrl<BCReaction>(reactionsUrl, token);
    for (const reaction of reactions) {
      try {
        const userId = await resolveBasecampUser(reaction.person, orgId, fallbackUserId);
        await db.reaction.createMany({ data: [{ messageId, userId, emoji: reaction.content }], skipDuplicates: true });
      } catch {
        // individual reaction failure is non-fatal
      }
    }
  } catch {
    // reactions fetch failure is non-fatal — don't block the rest of the import
  }
}

// ── Explicit project people import ───────────────────────────────────────────
// Calls the Basecamp people-on-project endpoint and upserts ProjectMember rows.
// Runs after the project row is created; non-fatal if it fails.

async function importProjectPeopleFromBC(
  bcProjectId: number,
  dbProjectId: string,
  token: string,
  accountId: string,
  orgId: string,
  fallbackUserId: string,
): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = [];
  let added = 0;
  try {
    const bcPeople = await bcFetchAll<{ id: number; name: string; email_address: string }>(
      `/projects/${bcProjectId}/people.json`,
      token,
      accountId,
    );
    for (const person of bcPeople) {
      try {
        const userId = await resolveBasecampUser(person, orgId, fallbackUserId);
        const exists = await db.projectMember.findUnique({
          where: { projectId_userId: { projectId: dbProjectId, userId } },
          select: { id: true },
        });
        if (!exists) {
          await db.projectMember.create({ data: { projectId: dbProjectId, userId } });
          added++;
        }
      } catch (e) {
        errors.push(`person ${person.id} (${person.name}): ${String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`Could not fetch project people from Basecamp: ${String(e)}`);
  }
  return { added, errors };
}

/**
 * Classify a Basecamp project as a real project, a library repository, or a
 * template repository.  Basecamp uses "projects" for everything because it has
 * no dedicated library or templates module.  The Core does, so we route
 * repository-style projects to Library / Templates instead of creating Project
 * records with member associations.
 *
 * Rules (applied in order):
 *  1. Name ends with "Project" (case-insensitive) → definite project.
 *  2. Name contains template keywords → template.
 *  3. Name contains library/repository keywords → library.
 *  4. Default → project (err on the side of treating as a real project).
 */
function classifyBasecampProject(name: string): "project" | "library" | "template" {
  const n = name.trim();
  if (/\bproject$/i.test(n)) return "project";
  if (/\b(templates?|playbooks?|frameworks?)\b/i.test(n)) return "template";
  if (
    /\b(materials?|learning|resources?|curriculum|knowledge)\b/i.test(n) ||
    /\(docs?\s*(only)?\)/i.test(n) ||
    /\bhq\b/i.test(n)
  ) return "library";
  return "project";
}

export async function importBasecampProject(bcProjectId: number): Promise<ImportResult> {
  const { token, accountId } = await getBasecampCredentials();

  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as {
    user: NonNullable<typeof ctx.user>;
    org:  NonNullable<typeof ctx.org>;
  };

  const errors:           string[] = [];
  const phases:           PhaseResult[] = [];
  const failedFilesList:  FailedFile[] = [];
  let tasksImported     = 0;
  let messagesImported  = 0;
  let commentsImported  = 0;
  let docsImported      = 0;
  let filesStored       = 0;
  let filesMetadataOnly = 0;
  let foldersCreated    = 0;

  const log = (msg: string) => console.log(`[BC Import][${bcProjectId}] ${msg}`);

  if (!process.env["UPLOADTHING_TOKEN"]) {
    errors.push("⚠ UPLOADTHING_TOKEN missing — files saved as metadata only.");
  }

  // ── Phase: fetch + upsert project ─────────────────────────────────────────
  log("Starting — fetching project metadata");
  let bcProject: BCProject;
  let project: { id: string };
  let kind: "project" | "library" | "template" = "project";

  const emptyLog = (): ProjectImportLog => ({
    tasksCount: 0, messagesCount: 0, filesCount: 0, foldersCount: 0,
    failedFilesCount: 0, failedFiles: [], phaseErrors: [], lastImportedAt: new Date(),
  });

  try {
    bcProject = await bcFetch<BCProject>(`/projects/${bcProjectId}.json`, token, accountId);
    log(`Fetched project: "${bcProject.name}"`);
  } catch (e) {
    const msg = `Failed to fetch project from Basecamp: ${String(e)}`;
    log(`ERROR: ${msg}`);
    phases.push({ phase: "Project fetch", status: "error", error: msg });
    phases.push({ phase: "Tasks",    status: "skipped" });
    phases.push({ phase: "Messages", status: "skipped" });
    phases.push({ phase: "Files & Docs", status: "skipped" });
    return { project: `BC Project ${bcProjectId}`, importStatus: "IMPORT_FAILED", importLog: emptyLog(), phases, tasksImported, messagesImported, commentsImported, docsImported, filesStored, filesMetadataOnly, foldersCreated, errors: [msg] };
  }

  try {
    project = await db.project.upsert({
      where: { id: `bc-${bcProjectId}` },
      create: {
        id: `bc-${bcProjectId}`,
        organizationId: org.id,
        creatorId: user.id,
        name: bcProject.name,
        description: bcProject.description ?? undefined,
        status: "ACTIVE",
      },
      update: {
        name: bcProject.name,
        description: bcProject.description ?? undefined,
        // status intentionally not updated — preserve manual changes after import
      },
    });
    log(`Upserted project in DB: ${project.id}`);

    // Classify before seeding mandate or importing members.
    // Repository-style projects (doc/learning archives) skip member creation and
    // have their content moved to Library/Templates at the end of the import.
    kind = classifyBasecampProject(bcProject.name);
    log(`Classification: ${kind}`);

    // Seed the Project Mandate from the BC description on first import.
    // We only create — never overwrite — so manual edits survive re-imports.
    const mandateExists = await db.projectMandate.findUnique({ where: { projectId: project.id } });
    if (!mandateExists) {
      await db.projectMandate.create({
        data: { projectId: project.id, projectDescription: bcProject.description ?? "" },
      });
      log(`Created project mandate from description`);
    }

    phases.push({ phase: "Project", status: "ok" });

    // Import explicit Basecamp project people — skip for repository projects.
    // Repository projects have no student membership; their content belongs in
    // Library / Templates, not attached to a project with members.
    if (kind === "project") {
      try {
        const { added: membersAdded, errors: memberErrors } =
          await importProjectPeopleFromBC(bcProjectId, project.id, token, accountId, org.id, user.id);
        log(`People: ${membersAdded} members added from Basecamp project people list`);
        for (const me of memberErrors) errors.push(`⚠ People: ${me}`);
      } catch (e) {
        log(`People fetch non-fatal error: ${String(e)}`);
      }
    } else {
      log(`People: skipped — ${kind} repository, no member associations created`);
    }
  } catch (e) {
    const msg = `Failed to create project in DB: ${String(e)}`;
    log(`ERROR: ${msg}`);
    phases.push({ phase: "Project", status: "error", error: msg });
    phases.push({ phase: "Tasks",    status: "skipped" });
    phases.push({ phase: "Messages", status: "skipped" });
    phases.push({ phase: "Files & Docs", status: "skipped" });
    return { project: bcProject.name, importStatus: "IMPORT_FAILED", importLog: emptyLog(), phases, tasksImported, messagesImported, commentsImported, docsImported, filesStored, filesMetadataOnly, foldersCreated, errors: [msg] };
  }

  // ── Phase: Tasks ─────────────────────────────────────────────────────────
  log("Starting tasks import");
  const todosetDock = bcProject.dock.find((d) => d.name === "todoset");
  if (!todosetDock) {
    log("No todoset dock — skipping tasks");
    phases.push({ phase: "Tasks", status: "skipped" });
  } else {
    try {
      const todoset = await bcFetch<{ todolists_url: string }>(
        `/buckets/${bcProjectId}/todosets/${todosetDock.id}.json`, token, accountId
      );
      const todolists = await bcFetchFullUrl<BCTodolist>(todoset.todolists_url, token);
      log(`Found ${todolists.length} todolists`);
      for (const list of todolists) {
        const [activeTodos, completedTodos] = await Promise.all([
          bcFetchAll<BCTodo>(`/buckets/${bcProjectId}/todolists/${list.id}/todos.json`, token, accountId),
          bcFetchAll<BCTodo>(`/buckets/${bcProjectId}/todolists/${list.id}/todos.json?completed=true`, token, accountId),
        ]);
        const todos = [...activeTodos, ...completedTodos];
        const listPrefix = list.title ? `[${list.title}] ` : "";
        for (const todo of todos) {
          try {
            const firstAssignee = todo.assignees[0];
            const assigneeId = firstAssignee
              ? await resolveBasecampUser(firstAssignee, org.id, user.id)
              : undefined;
            const taskTitle = `${listPrefix}${htmlToText(todo.title)}`;
            await db.task.upsert({
              where: { id: `bc-todo-${todo.id}` },
              create: {
                id: `bc-todo-${todo.id}`,
                organizationId: org.id,
                projectId: project.id,
                creatorId: user.id,
                assigneeId: assigneeId ?? undefined,
                title: taskTitle,
                description: todo.description ? htmlToMarkdown(todo.description) : undefined,
                status: todo.completed ? "DONE" : "TODO",
                completedAt: todo.completed ? new Date() : undefined,
                dueDate: todo.due_on ? new Date(todo.due_on) : undefined,
                priority: "MEDIUM",
              },
              update: {
                title: taskTitle,
                status: todo.completed ? "DONE" : "TODO",
                assigneeId: assigneeId ?? undefined,
              },
            });
            tasksImported++;
          } catch (e) {
            errors.push(`Todo ${todo.id}: ${String(e)}`);
          }
        }
      }
      log(`Tasks done: ${tasksImported} imported, ${errors.filter(e => e.startsWith("Todo")).length} errors`);
      phases.push({ phase: "Tasks", status: tasksImported > 0 || errors.filter(e => e.startsWith("Todo")).length === 0 ? "ok" : "error", count: tasksImported });
    } catch (e) {
      const msg = String(e);
      log(`ERROR in tasks: ${msg}`);
      errors.push(`Tasks: ${msg}`);
      phases.push({ phase: "Tasks", status: "error", error: msg });
    }
  }

  // ── Phase: Messages (imported as ProjectPost records) ────────────────────
  log("Starting messages import");
  const messageBoardDock = bcProject.dock.find((d) => d.name === "message_board");
  if (!messageBoardDock) {
    log("No message_board dock — skipping messages");
    phases.push({ phase: "Messages", status: "skipped" });
  } else {
    try {
      const messages = await bcFetchAll<BCMessage>(
        `/buckets/${bcProjectId}/message_boards/${messageBoardDock.id}/messages.json`, token, accountId
      );
      for (const msg of messages) {
        try {
          const postId  = `bc-msg-${msg.id}`;
          const authorId = await resolveBasecampUser(msg.creator, org.id, user.id);
          const { cleanHtml, bcAttachmentTags } = extractBcAttachments(msg.content);
          let bodyMd = htmlToMarkdown(cleanHtml);

          // Embed attachment references inline (BC URLs are session-scoped and may expire,
          // but preserving the reference keeps the data visible in the post body)
          if (bcAttachmentTags.length > 0) {
            bodyMd += "\n\n---\n\n**Attachments:**\n" +
              bcAttachmentTags.map((a) => `- [${a.filename}](${a.url})`).join("\n");
          }

          await db.projectPost.upsert({
            where:  { id: postId },
            create: {
              id: postId,
              projectId: project.id,
              authorId,
              title: htmlToText(msg.subject),
              body: bodyMd,
              createdAt: new Date(msg.created_at),
            },
            update: {
              title: htmlToText(msg.subject),
              body: bodyMd,
            },
          });
          messagesImported++;

          // Import comments as ProjectPostReply records
          try {
            const comments = await bcFetchAll<BCComment>(
              `/buckets/${bcProjectId}/recordings/${msg.id}/comments.json`, token, accountId
            );
            for (const comment of comments) {
              try {
                const replyId = `bc-reply-${comment.id}`;
                const replyAuthorId = await resolveBasecampUser(comment.creator, org.id, user.id);
                const { cleanHtml: commentClean } = extractBcAttachments(comment.content);
                await db.projectPostReply.upsert({
                  where:  { id: replyId },
                  create: { id: replyId, postId, authorId: replyAuthorId, body: htmlToMarkdown(commentClean), createdAt: new Date(comment.created_at) },
                  update: { body: htmlToMarkdown(commentClean) },
                });
                commentsImported++;
              } catch (e) {
                errors.push(`Comment ${comment.id}: ${String(e)}`);
              }
            }
          } catch (e) {
            errors.push(`Comments for message ${msg.id}: ${String(e)}`);
          }
        } catch (e) {
          errors.push(`Message ${msg.id}: ${String(e)}`);
        }
      }
      log(`Messages done: ${messagesImported} posts, ${commentsImported} replies appended`);
      phases.push({ phase: "Messages", status: "ok", count: messagesImported });
    } catch (e) {
      const msg = String(e);
      log(`ERROR in messages: ${msg}`);
      errors.push(`Messages: ${msg}`);
      phases.push({ phase: "Messages", status: "error", error: msg });
    }
  }

  // ── Phase: Campfire (project group chat) ─────────────────────────────────
  log("Starting campfire import");
  const chatDock = bcProject.dock.find((d) => d.name === "chat");
  if (!chatDock) {
    log("No chat dock — skipping campfire");
    phases.push({ phase: "Campfire", status: "skipped" });
  } else {
    try {
      const linesUrl = chatDock.url.replace(/\.json$/, "/lines.json");
      const campfireLines = await bcFetchFullUrl<BCLine>(linesUrl, token);
      log(`Fetched ${campfireLines.length} campfire lines`);

      // Use existing project chat ping if one was already auto-created by the UI
      const existingChat = await db.ping.findFirst({
        where: { organizationId: org.id, projectId: project.id, type: "GROUP" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      let campfirePingId: string;
      if (existingChat) {
        campfirePingId = existingChat.id;
      } else {
        const newPing = await db.ping.create({
          data: {
            id: `bc-campfire-${bcProjectId}`,
            organizationId: org.id,
            type: "GROUP",
            title: "Project Chat",
            projectId: project.id,
          },
        });
        campfirePingId = newPing.id;
      }

      const campfireParticipants = new Set<string>();
      let campfireMessages = 0;

      for (const line of campfireLines) {
        const content = line.content?.trim();
        if (!content) continue;
        try {
          const authorId = await resolveBasecampUser(line.creator, org.id, user.id);
          campfireParticipants.add(authorId);
          const messageId = `bc-campfire-line-${bcProjectId}-${line.id}`;
          await db.message.upsert({
            where: { id: messageId },
            create: {
              id: messageId,
              pingId: campfirePingId,
              authorId,
              body: htmlToMarkdown(content),
              createdAt: new Date(line.created_at),
              updatedAt: new Date(line.created_at),
            },
            update: { body: htmlToMarkdown(content) },
          });
          if (line.reactions_url) {
            await importLineReactions(messageId, line.reactions_url, token, org.id, user.id);
          }
          campfireMessages++;
        } catch (e) {
          errors.push(`⚠ Campfire line ${line.id}: ${String(e)}`);
        }
      }

      await db.pingParticipant.createMany({
        data: [...campfireParticipants].map((uid) => ({ pingId: campfirePingId, userId: uid })),
        skipDuplicates: true,
      });

      if (campfireLines.length > 0) {
        const lastLine = campfireLines[campfireLines.length - 1]!;
        await db.ping.update({
          where: { id: campfirePingId },
          data: { updatedAt: new Date(lastLine.created_at) },
        });
      }

      messagesImported += campfireMessages;
      log(`Campfire done: ${campfireMessages} messages imported`);
      phases.push({ phase: "Campfire", status: "ok", count: campfireMessages });
    } catch (e) {
      const msg = String(e);
      log(`ERROR in campfire: ${msg}`);
      errors.push(`⚠ Campfire: ${msg}`);
      phases.push({ phase: "Campfire", status: "skipped" });
    }
  }

  // ── Phase: Docs & Files (Vault) ───────────────────────────────────────────
  log("Starting vault (docs & files) import");
  const vaultDock = bcProject.dock.find((d) => d.name === "vault");
  if (!vaultDock) {
    log(`No vault dock — skipping Files & Docs`);
    phases.push({ phase: "Files & Docs", status: "skipped" });
  } else {
    try {
      const { docs: bcDocs, uploads: bcUploads, foldersCreated: vaultFolders, vaultErrors } =
        await fetchVaultContent(vaultDock.id, bcProjectId, token, accountId, project.id, org.id, null);

      foldersCreated = vaultFolders;
      // vaultErrors are ⚠-prefixed — they count as item-level warnings, not phase failures
      errors.push(...vaultErrors);

      // Remove stale Doc records that were previously imported as uploads
      const staleIds = bcUploads.map((u) => `bc-upload-${u.id}`);
      if (staleIds.length > 0) {
        await db.doc.deleteMany({
          where: { id: { in: staleIds }, projectId: project.id },
        });
      }

      // ── Text documents ───────────────────────────────────────────────────
      for (const doc of bcDocs) {
        try {
          const docId = `bc-doc-${doc.id}`;
          const author = await db.user.findUnique({
            where: { email: doc.creator.email_address },
            select: { id: true },
          });
          await db.doc.upsert({
            where: { id: docId },
            create: {
              id: docId,
              organizationId: org.id,
              projectId: project.id,
              authorId: author?.id ?? user.id,
              importedAuthor: author ? null : doc.creator.name,
              folderId: doc.dbFolderId,
              title: htmlToText(doc.title),
              content: htmlToMarkdown(doc.content),
              docType: "REFERENCE",
              createdAt: new Date(doc.created_at),
            },
            update: {
              // Restore projectId in case this doc was moved to the Library
              projectId: project.id,
              organizationId: org.id,
              folderId: doc.dbFolderId,
              title: htmlToText(doc.title),
              content: htmlToMarkdown(doc.content),
            },
          });
          docsImported++;
        } catch (e) {
          errors.push(`Doc ${doc.id}: ${String(e)}`);
        }
      }

      // If any vault doc is literally titled "Project Mandate", its full content
      // overrides the short description we seeded during the project phase.
      const mandateDoc = bcDocs.find(
        (d) => htmlToText(d.title).trim().toLowerCase() === "project mandate"
      );
      if (mandateDoc) {
        try {
          await db.projectMandate.upsert({
            where:  { projectId: project.id },
            create: { projectId: project.id, projectDescription: htmlToMarkdown(mandateDoc.content) },
            update: { projectDescription: htmlToMarkdown(mandateDoc.content) },
          });
          log(`Project mandate updated from vault doc "${htmlToText(mandateDoc.title)}"`);
        } catch (e) {
          errors.push(`Project Mandate (from doc): ${String(e)}`);
        }
      }

      // ── Uploaded files ───────────────────────────────────────────────────────
      if (bcUploads.length > 0) {
        // Pre-flight: verify UploadThing works before touching any real file.
        // If this fails we know immediately and can skip 27 silent individual errors.
        log(`Running UploadThing pre-flight check…`);
        const preflight = await utPreFlight();
        if (!preflight.ok) {
          console.error(`[BC Import][${bcProjectId}] UploadThing pre-flight FAILED: ${preflight.reason}`);
          log(`UploadThing pre-flight FAILED: ${preflight.reason}`);
          for (const upload of bcUploads) {
            errors.push(`"${upload.filename}": UploadThing unavailable — ${preflight.reason}`);
            failedFilesList.push({
              uploadId: upload.id, bcProjectId, dbProjectId: project.id,
              dbFolderId: upload.dbFolderId, filename: upload.filename,
              contentType: upload.content_type, byteSize: upload.byte_size,
              createdAt: upload.created_at, reason: `UploadThing pre-flight failed: ${preflight.reason}`, is404: false,
            });
          }
        } else {
          log(`UploadThing pre-flight OK — uploading ${bcUploads.length} files (4 at a time)…`);
          // Single UTApi instance shared across all uploads in this run.
          // JS is single-threaded so shared counters (filesStored, errors, etc.)
          // are safe across concurrent async tasks — no locking needed.
          const utapi = new UTApi();

          for (let _i = 0; _i < bcUploads.length; _i += 4) {
            await Promise.all(bcUploads.slice(_i, _i + 4).map(async (upload) => {
              const fileId = `bc-upload-${upload.id}`;
              try {
                const uploader = await db.user.findUnique({
                  where: { email: upload.creator.email_address },
                  select: { id: true },
                });
                const common = {
                  uploadedById:   uploader?.id ?? user.id,
                  importedAuthor: uploader ? null : upload.creator.name,
                  folderId:       upload.dbFolderId,
                  name:           upload.filename,
                  mimeType:       upload.content_type,
                };

                const existing = await db.projectFile.findUnique({
                  where: { id: fileId },
                  select: { id: true, utKey: true },
                });

                // Already stored with a real UT key — sync metadata and restore projectId
                // in case the file was moved to the Library and is being pulled back.
                if (existing?.utKey) {
                  await db.projectFile.update({
                    where: { id: fileId },
                    data: { projectId: project.id, organizationId: org.id, folderId: upload.dbFolderId, name: upload.filename },
                  });
                  filesStored++;
                  return;
                }

                // Skip files too large to buffer in a serverless function.
                if (upload.byte_size > MAX_IMPORT_FILE_BYTES) {
                  const mb = Math.round(upload.byte_size / 1024 / 1024);
                  const reason = `File is ${mb} MB — too large to import via server. Download it manually from Basecamp.`;
                  console.warn(`[BC Import] SKIPPING OVERSIZED: "${upload.filename}" (${mb} MB)`);
                  errors.push(`⚠ "${upload.filename}": ${reason}`);
                  failedFilesList.push({
                    uploadId: upload.id, bcProjectId, dbProjectId: project.id,
                    dbFolderId: upload.dbFolderId, filename: upload.filename,
                    contentType: upload.content_type, byteSize: upload.byte_size,
                    createdAt: upload.created_at, reason, is404: false, isOversized: true,
                  });
                  return;
                }

                try {
                  const stored = await downloadAndStore(upload, token, utapi);
                  if (existing) {
                    await db.projectFile.update({
                      where: { id: fileId },
                      data: { ...common, url: stored.url, utKey: stored.utKey, size: stored.size },
                    });
                  } else {
                    await db.projectFile.create({
                      data: {
                        id: fileId, organizationId: org.id, projectId: project.id,
                        ...common, url: stored.url, utKey: stored.utKey, size: stored.size,
                        createdAt: new Date(upload.created_at),
                      },
                    });
                  }
                  filesStored++;
                } catch (storageErr) {
                  const errMsg = String(storageErr);
                  console.error(`\n[BC Import] FILE FAILED: "${upload.filename}"\n  → ${errMsg}\n`);
                  const is404  = errMsg.includes("FILE_NOT_FOUND");
                  if (is404) {
                    errors.push(`⚠ "${upload.filename}": no longer available in Basecamp (skipped)`);
                    failedFilesList.push({
                      uploadId: upload.id, bcProjectId, dbProjectId: project.id,
                      dbFolderId: upload.dbFolderId, filename: upload.filename,
                      contentType: upload.content_type, byteSize: upload.byte_size,
                      createdAt: upload.created_at, reason: "File no longer available in Basecamp (404)", is404: true,
                    });
                  } else {
                    errors.push(`"${upload.filename}": ${errMsg}`);
                    failedFilesList.push({
                      uploadId: upload.id, bcProjectId, dbProjectId: project.id,
                      dbFolderId: upload.dbFolderId, filename: upload.filename,
                      contentType: upload.content_type, byteSize: upload.byte_size,
                      createdAt: upload.created_at, reason: errMsg, is404: false,
                    });
                  }
                }
              } catch (e) {
                const errMsg = String(e);
                console.error(`\n[BC Import] FILE OUTER ERROR: "${upload.filename}"\n  → ${errMsg}\n`);
                errors.push(`"${upload.filename}": ${errMsg}`);
                failedFilesList.push({
                  uploadId: upload.id, bcProjectId, dbProjectId: project.id,
                  dbFolderId: upload.dbFolderId, filename: upload.filename,
                  contentType: upload.content_type, byteSize: upload.byte_size,
                  createdAt: upload.created_at, reason: errMsg, is404: false,
                });
              }
            }));
          }
        }
      }

      log(`Vault done: ${docsImported} docs, ${filesStored} files stored, ${filesMetadataOnly} metadata-only, ${foldersCreated} folders`);
      if (failedFilesList.length > 0) {
        log(`Failed files (${failedFilesList.length}):`);
        failedFilesList.forEach((f) => log(`  ✗ "${f.filename}": ${f.reason}`));
      }
      phases.push({ phase: "Files & Docs", status: "ok", count: docsImported + filesStored + filesMetadataOnly });
    } catch (e) {
      const msg = String(e);
      log(`ERROR in vault: ${msg}`);
      errors.push(`Docs/Files: ${msg}`);
      phases.push({ phase: "Files & Docs", status: "error", error: msg });
    }
  }

  // ── Repository conversion ─────────────────────────────────────────────────
  // Move all content to Library or Templates in-place (no folder ID remapping —
  // just clear projectId so the Library/Templates queries pick them up).
  // Archive the project shell so it no longer appears in the Projects list.
  if (kind !== "project") {
    const isTemplate = kind === "template";
    log(`Converting to ${kind} — moving content, archiving project shell`);
    await Promise.all([
      db.docFolder.updateMany({
        where: { projectId: project.id },
        data: { projectId: null, isTemplate },
      }),
      db.doc.updateMany({
        where: { projectId: project.id },
        data: { projectId: null, isTemplate },
      }),
      db.projectFile.updateMany({
        where: { projectId: project.id },
        data: { projectId: null, isTemplate },
      }),
    ]);
    await db.project.update({
      where: { id: project.id },
      data: { status: "ARCHIVED" },
    });
    log(`Repository conversion complete`);
  }

  log(`Import complete — tasks:${tasksImported} messages:${messagesImported} docs:${docsImported} files:${filesStored} errors:${errors.length}`);

  // ── Persist import log ────────────────────────────────────────────────────
  const importStatus = calculateImportStatus(phases, errors);
  const phaseErrors  = phases.filter((p) => p.status === "error").map((p) => ({ phase: p.phase, error: p.error ?? "" }));

  const importLog: ProjectImportLog = {
    tasksCount:      tasksImported,
    messagesCount:   messagesImported,
    filesCount:      filesStored + filesMetadataOnly,
    foldersCount:    foldersCreated,
    failedFilesCount: failedFilesList.length,
    failedFiles:     failedFilesList,
    phaseErrors,
    lastImportedAt:  new Date(),
  };

  await db.basecampImportLog.upsert({
    where:  { projectId: project.id },
    create: {
      projectId:       project.id,
      status:          importStatus,
      tasksCount:      importLog.tasksCount,
      messagesCount:   importLog.messagesCount,
      filesCount:      importLog.filesCount,
      foldersCount:    importLog.foldersCount,
      failedFilesCount: importLog.failedFilesCount,
      failedFiles:     JSON.parse(JSON.stringify(importLog.failedFiles)),
      phaseErrors:     JSON.parse(JSON.stringify(phaseErrors)),
    },
    update: {
      status:          importStatus,
      tasksCount:      importLog.tasksCount,
      messagesCount:   importLog.messagesCount,
      filesCount:      importLog.filesCount,
      foldersCount:    importLog.foldersCount,
      failedFilesCount: importLog.failedFilesCount,
      failedFiles:     JSON.parse(JSON.stringify(importLog.failedFiles)),
      phaseErrors:     JSON.parse(JSON.stringify(phaseErrors)),
      lastImportedAt:  importLog.lastImportedAt,
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/projects/${project.id}/docs`);
  revalidatePath(`/projects/${project.id}/files`);

  return {
    project: bcProject.name,
    importStatus,
    importLog,
    phases,
    tasksImported,
    messagesImported,
    commentsImported,
    docsImported,
    filesStored,
    filesMetadataOnly,
    foldersCreated,
    errors,
  };
}

export type RetryResult = {
  succeeded: number;
  total: number;
  newStatus: ImportStatus;
  newImportLog: ProjectImportLog;
};

export async function retryFailedFiles(dbProjectId: string): Promise<RetryResult> {
  const { token, accountId } = await getBasecampCredentials();

  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as {
    user: NonNullable<typeof ctx.user>;
    org:  NonNullable<typeof ctx.org>;
  };

  const logRow = await db.basecampImportLog.findUnique({
    where: { projectId: dbProjectId },
  });
  if (!logRow) throw new Error("No import log found for this project. Run a full import first.");

  const toRetry = logRow.failedFiles as FailedFile[];
  const stillFailed: FailedFile[] = [];
  let succeeded = 0;

  // Pre-flight before touching any file
  const preflight = await utPreFlight();
  if (!preflight.ok) {
    throw new Error(`UploadThing pre-flight failed: ${preflight.reason}`);
  }
  const utapi = new UTApi();

  for (const failed of toRetry) {
    // Oversized files can't be imported via server — keep them in the failed list as-is.
    if (failed.isOversized) {
      stillFailed.push(failed);
      continue;
    }

    const fileId = `bc-upload-${failed.uploadId}`;
    try {
      // Reconstruct a minimal UploadWithFolder. Rebuild the standard Basecamp
      // download URL from stored fields — same format as the original listing.
      const uploadProxy: UploadWithFolder = {
        id:           failed.uploadId,
        bcProjectId:  failed.bcProjectId,
        filename:     failed.filename,
        content_type: failed.contentType,
        byte_size:    failed.byteSize,
        download_url: `https://3.basecampapi.com/${accountId}/buckets/${failed.bcProjectId}/uploads/${failed.uploadId}/download/${encodeURIComponent(failed.filename)}`,
        created_at:   failed.createdAt,
        creator:      { id: 0, name: "", email_address: "" },
        dbFolderId:   failed.dbFolderId,
      };

      const stored = await downloadAndStore(uploadProxy, token, utapi);

      await db.projectFile.upsert({
        where: { id: fileId },
        create: {
          id: fileId,
          organizationId: org.id,
          projectId: dbProjectId,
          uploadedById: user.id,
          folderId: failed.dbFolderId,
          name: failed.filename,
          mimeType: failed.contentType,
          url: stored.url,
          utKey: stored.utKey,
          size: stored.size,
          createdAt: new Date(failed.createdAt),
        },
        update: {
          url: stored.url,
          utKey: stored.utKey,
          size: stored.size,
        },
      });
      succeeded++;
    } catch (e) {
      const errMsg = String(e);
      const is404  = errMsg.includes("FILE_NOT_FOUND");
      stillFailed.push({
        ...failed,
        reason: is404 ? "File no longer available in Basecamp (404)" : errMsg,
        is404,
      });
    }
  }

  // Recalculate status: phaseErrors still apply, only file failures change
  const phaseErrors = logRow.phaseErrors as { phase: string; error: string }[];
  const hasPhaseErrors = phaseErrors.length > 0;
  let newStatus: ImportStatus;
  const unfixable = (f: FailedFile) => f.is404 || !!f.isOversized;
  if (stillFailed.length === 0 && !hasPhaseErrors)               newStatus = "IMPORTED";
  else if (stillFailed.length === 0 && hasPhaseErrors)           newStatus = "PARTIALLY_IMPORTED";
  else if (stillFailed.every(unfixable) && !hasPhaseErrors)      newStatus = "IMPORTED_WITH_WARNINGS";
  else                                                            newStatus = "PARTIALLY_IMPORTED";

  const newFilesCount = (logRow.filesCount as number) + succeeded;

  const newImportLog: ProjectImportLog = {
    tasksCount:       logRow.tasksCount,
    messagesCount:    logRow.messagesCount,
    filesCount:       newFilesCount,
    foldersCount:     logRow.foldersCount,
    failedFilesCount: stillFailed.length,
    failedFiles:      stillFailed,
    phaseErrors,
    lastImportedAt:   new Date(),
  };

  await db.basecampImportLog.update({
    where: { projectId: dbProjectId },
    data: {
      status:           newStatus,
      filesCount:       newFilesCount,
      failedFilesCount: stillFailed.length,
      failedFiles:      JSON.parse(JSON.stringify(stillFailed)),
      lastImportedAt:   newImportLog.lastImportedAt,
    },
  });

  revalidatePath("/settings/import/basecamp");

  return { succeeded, total: toRetry.length, newStatus, newImportLog };
}

export async function disconnectBasecamp() {
  const { orgId } = await auth();
  const cookieStore = await cookies();
  cookieStore.delete("bc_token");
  cookieStore.delete("bc_account_id");

  if (orgId) {
    await db.organization.updateMany({
      where: { clerkOrgId: orgId },
      data: {
        basecampAccessToken: null,
        basecampRefreshToken: null,
        basecampAccountId: null,
        basecampAccountName: null,
        basecampConnectedAt: null,
      },
    });
  }

  revalidatePath("/settings/import/basecamp");
}

// ── People mapping ────────────────────────────────────────────────────────────

export type BCPersonRow = {
  basecampPersonId: string;
  basecampName: string;
  basecampEmail: string | null;
  coreUserId: string | null;
  isPlaceholder: boolean;
};

export type CoreUserOption = {
  id: string;
  name: string;
  email: string;
};

export async function getBasecampPeople(): Promise<{
  bcPeople: BCPersonRow[];
  coreUsers: CoreUserOption[];
}> {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: {
      id: true,
      basecampAccessToken: true,
      basecampAccountId: true,
      basecampPeople: {
        select: {
          basecampPersonId: true,
          basecampName: true,
          basecampEmail: true,
          coreUserId: true,
          isPlaceholder: true,
        },
      },
      memberships: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!org) throw new Error("Organization not found");

  // Fetch people from Basecamp API (the people on this account)
  let bcApiPeople: { id: number; name: string; email_address: string }[] = [];
  if (org.basecampAccessToken && org.basecampAccountId) {
    try {
      bcApiPeople = await bcFetchAll<{ id: number; name: string; email_address: string }>(
        "/people.json",
        org.basecampAccessToken,
        org.basecampAccountId,
      );
    } catch {
      // Non-fatal: use what's in DB
    }
  }

  // Build existing mapping from DB
  const existingMap = new Map(
    org.basecampPeople.map((p) => [p.basecampPersonId, p]),
  );

  // Auto-match by email, upsert all BC people into DB
  const coreUsers = org.memberships.map((m) => m.user);
  const emailToUserId = new Map(coreUsers.map((u) => [u.email.toLowerCase(), u.id]));

  for (const bcp of bcApiPeople) {
    const personId = String(bcp.id);
    const existing = existingMap.get(personId);
    const autoMatch = bcp.email_address
      ? (emailToUserId.get(bcp.email_address.toLowerCase()) ?? null)
      : null;

    await db.basecampPerson.upsert({
      where: { organizationId_basecampPersonId: { organizationId: org.id, basecampPersonId: personId } },
      create: {
        organizationId: org.id,
        basecampPersonId: personId,
        basecampName: bcp.name,
        basecampEmail: bcp.email_address || null,
        coreUserId: existing?.coreUserId ?? autoMatch,
        isPlaceholder: false,
      },
      update: {
        basecampName: bcp.name,
        basecampEmail: bcp.email_address || null,
        // Only update coreUserId if not already manually set
        ...(existing?.coreUserId == null && autoMatch ? { coreUserId: autoMatch } : {}),
      },
    });
  }

  // Re-read after upserts
  const fresh = await db.basecampPerson.findMany({
    where: { organizationId: org.id },
    select: {
      basecampPersonId: true,
      basecampName: true,
      basecampEmail: true,
      coreUserId: true,
      isPlaceholder: true,
    },
    orderBy: { basecampName: "asc" },
  });

  return {
    bcPeople: fresh,
    coreUsers: coreUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}

export async function saveUserMapping(
  basecampPersonId: string,
  coreUserId: string | null,
): Promise<void> {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: { id: true },
  });
  if (!org) throw new Error("Organization not found");

  await db.basecampPerson.update({
    where: { organizationId_basecampPersonId: { organizationId: org.id, basecampPersonId } },
    data: { coreUserId },
  });
}

// ── People import ─────────────────────────────────────────────────────────────

export type PeopleImportResult = {
  matched: number;   // email matched an existing User → just linked
  created: number;   // new placeholder User created
  skipped: number;   // already imported (BasecampPerson already had coreUserId)
  people: { name: string; email: string | null; status: "matched" | "created" | "skipped" }[];
};

export async function importBasecampPeople(): Promise<PeopleImportResult> {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const org = await db.organization.findUnique({
    where: { clerkOrgId: orgId },
    select: {
      id: true,
      basecampAccessToken: true,
      basecampAccountId: true,
      memberships: {
        select: { user: { select: { id: true, email: true } } },
      },
    },
  });
  if (!org) throw new Error("Organization not found");
  if (!org.basecampAccessToken || !org.basecampAccountId) {
    throw new Error("Basecamp is not connected");
  }

  // Fetch all people from Basecamp
  type BCPerson = {
    id: number;
    name: string;
    email_address: string;
    avatar_url: string | null;
    title: string | null;
  };
  const bcPeople = await bcFetchAll<BCPerson>("/people.json", org.basecampAccessToken, org.basecampAccountId);

  // Build lookup maps
  const emailToUserId = new Map(
    org.memberships.map((m) => [m.user.email.toLowerCase(), m.user.id]),
  );

  // Existing BasecampPerson records for this org
  const existing = await db.basecampPerson.findMany({
    where: { organizationId: org.id },
    select: { basecampPersonId: true, coreUserId: true },
  });
  const existingMap = new Map(existing.map((p) => [p.basecampPersonId, p.coreUserId]));

  const result: PeopleImportResult = { matched: 0, created: 0, skipped: 0, people: [] };

  for (const bcp of bcPeople) {
    const personId = String(bcp.id);
    const email = bcp.email_address || null;
    const existingCoreUserId = existingMap.get(personId);

    const bcTitle = bcp.title?.trim() || null;

    // Already fully linked — sync avatarUrl from Basecamp (always), jobTitle if not set
    if (existingCoreUserId) {
      if (bcp.avatar_url) {
        await db.user.update({
          where: { id: existingCoreUserId },
          data: { avatarUrl: bcp.avatar_url },
        });
      }
      if (bcTitle) {
        await db.user.updateMany({
          where: { id: existingCoreUserId, jobTitle: null },
          data: { jobTitle: bcTitle },
        });
      }
      result.skipped++;
      result.people.push({ name: bcp.name, email, status: "skipped" });
      continue;
    }

    // Check if email matches an existing org member
    const matchedUserId = email ? emailToUserId.get(email.toLowerCase()) : undefined;

    if (matchedUserId) {
      // Link the existing user and backfill jobTitle and avatarUrl if not set
      await db.basecampPerson.upsert({
        where: { organizationId_basecampPersonId: { organizationId: org.id, basecampPersonId: personId } },
        create: {
          organizationId: org.id,
          basecampPersonId: personId,
          basecampName: bcp.name,
          basecampEmail: email,
          coreUserId: matchedUserId,
          isPlaceholder: false,
        },
        update: { coreUserId: matchedUserId, basecampName: bcp.name, basecampEmail: email },
      });
      if (bcp.avatar_url) {
        await db.user.update({
          where: { id: matchedUserId },
          data: { avatarUrl: bcp.avatar_url },
        });
      }
      if (bcTitle) {
        await db.user.updateMany({
          where: { id: matchedUserId, jobTitle: null },
          data: { jobTitle: bcTitle },
        });
      }
      result.matched++;
      result.people.push({ name: bcp.name, email, status: "matched" });
      continue;
    }

    // Create a placeholder User + OrgMembership
    const newUser = await db.user.create({
      data: {
        email: email ?? `bc-${personId}@basecamp.import`,
        name: bcp.name,
        avatarUrl: bcp.avatar_url,
        jobTitle: bcTitle,
        isPlaceholder: true,
        memberships: {
          create: { organizationId: org.id, role: "MEMBER" },
        },
      },
    });

    await db.basecampPerson.upsert({
      where: { organizationId_basecampPersonId: { organizationId: org.id, basecampPersonId: personId } },
      create: {
        organizationId: org.id,
        basecampPersonId: personId,
        basecampName: bcp.name,
        basecampEmail: email,
        coreUserId: newUser.id,
        isPlaceholder: true,
      },
      update: { coreUserId: newUser.id, basecampName: bcp.name, basecampEmail: email },
    });

    result.created++;
    result.people.push({ name: bcp.name, email, status: "created" });
  }

  revalidatePath("/settings/import/basecamp");
  revalidatePath("/team");
  return result;
}

// ── Unarchive imported projects ───────────────────────────────────────────────
// Basecamp's "archived" status is not the same as The Core's ARCHIVED status.
// Projects imported before this fix came in as ARCHIVED and are invisible in the
// default "Active" filter. This resets them all to ACTIVE.

export type UnarchiveResult = { fixed: number };

export async function unarchiveImportedProjects(): Promise<UnarchiveResult> {
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const { count } = await db.project.updateMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id, status: "ARCHIVED" },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/projects");
  revalidatePath("/settings/import/basecamp");
  return { fixed: count };
}

// ── Project Mandate backfill ───────────────────────────────────────────────────
//
// Populates ProjectMandate for all already-imported projects using data already
// in the DB — no Basecamp API calls needed. Safe to run multiple times.

export type MandateBackfillResult = {
  filled: number;
  skipped: number;
  total: number;
};

export async function backfillProjectMandates(): Promise<MandateBackfillResult> {
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id },
    select: { id: true, description: true },
  });

  let filled = 0;
  let skipped = 0;

  for (const project of projects) {
    const existing = await db.projectMandate.findUnique({ where: { projectId: project.id } });
    if (existing) { skipped++; continue; }

    // Prefer a vault doc explicitly titled "Project Mandate" over the short description.
    const mandateDoc = await db.doc.findFirst({
      where: { projectId: project.id, title: { equals: "Project Mandate", mode: "insensitive" } },
      select: { content: true },
    });

    await db.projectMandate.create({
      data: {
        projectId: project.id,
        projectDescription: mandateDoc?.content ?? project.description ?? "",
      },
    });
    filled++;
  }

  revalidatePath("/projects");
  return { filled, skipped, total: projects.length };
}

// ── Message board backfill ────────────────────────────────────────────────────
// Imports Basecamp message board posts as ProjectPost records for all already-
// imported projects. Safe to re-run — uses upsert on bc-msg-{id}.

export type MessageBoardBackfillResult = {
  postsCreated: number;
  postsUpdated: number;
  projectsProcessed: number;
  projectsSkipped: number;
  errors: string[];
};

export async function backfillMessageBoardPosts(): Promise<MessageBoardBackfillResult> {
  const { token, accountId } = await getBasecampCredentials();
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id },
    select: { id: true },
  });

  let postsCreated = 0;
  let postsUpdated = 0;
  let projectsSkipped = 0;
  const errors: string[] = [];

  for (const project of projects) {
    const bcProjectId = parseInt(project.id.replace("bc-", ""), 10);
    try {
      const bcProject = await bcFetch<BCProject>(`/projects/${bcProjectId}.json`, token, accountId);
      const messageBoardDock = bcProject.dock.find((d) => d.name === "message_board");
      if (!messageBoardDock) { projectsSkipped++; continue; }

      const messages = await bcFetchAll<BCMessage>(
        `/buckets/${bcProjectId}/message_boards/${messageBoardDock.id}/messages.json`, token, accountId
      );

      for (const msg of messages) {
        try {
          const postId  = `bc-msg-${msg.id}`;
          const authorId = await resolveBasecampUser(msg.creator, org.id, user.id);
          const { cleanHtml, bcAttachmentTags } = extractBcAttachments(msg.content);
          let bodyMd = htmlToMarkdown(cleanHtml);

          if (bcAttachmentTags.length > 0) {
            bodyMd += "\n\n---\n\n**Attachments:**\n" +
              bcAttachmentTags.map((a) => `- [${a.filename}](${a.url})`).join("\n");
          }

          const existing = await db.projectPost.findUnique({ where: { id: postId }, select: { id: true } });
          await db.projectPost.upsert({
            where:  { id: postId },
            create: { id: postId, projectId: project.id, authorId, title: htmlToText(msg.subject), body: bodyMd, createdAt: new Date(msg.created_at) },
            update: { title: htmlToText(msg.subject), body: bodyMd },
          });
          existing ? postsUpdated++ : postsCreated++;

          try {
            const comments = await bcFetchAll<BCComment>(
              `/buckets/${bcProjectId}/recordings/${msg.id}/comments.json`, token, accountId
            );
            for (const comment of comments) {
              const replyId = `bc-reply-${comment.id}`;
              const replyAuthorId = await resolveBasecampUser(comment.creator, org.id, user.id);
              const { cleanHtml: cc } = extractBcAttachments(comment.content);
              await db.projectPostReply.upsert({
                where:  { id: replyId },
                create: { id: replyId, postId, authorId: replyAuthorId, body: htmlToMarkdown(cc), createdAt: new Date(comment.created_at) },
                update: { body: htmlToMarkdown(cc) },
              });
            }
          } catch { /* non-fatal */ }
        } catch (e) {
          errors.push(`msg ${msg.id} in ${project.id}: ${String(e)}`);
        }
      }
    } catch (e) {
      errors.push(`project ${project.id}: ${String(e)}`);
    }
  }

  revalidatePath("/projects");
  return { postsCreated, postsUpdated, projectsProcessed: projects.length - projectsSkipped, projectsSkipped, errors };
}

// ── To-dos backfill ───────────────────────────────────────────────────────────
// Imports Basecamp to-do lists + todos as Tasks for all already-imported
// projects. Adds list-name prefix to titles and resolves assignees.
// Safe to re-run — upserts on bc-todo-{id}.

export type TodosBackfillResult = {
  tasksCreated: number;
  tasksUpdated: number;
  projectsProcessed: number;
  projectsSkipped: number;
  errors: string[];
};

export async function backfillTodos(): Promise<TodosBackfillResult> {
  const { token, accountId } = await getBasecampCredentials();
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id },
    select: { id: true },
  });

  let tasksCreated = 0;
  let tasksUpdated = 0;
  let projectsSkipped = 0;
  const errors: string[] = [];

  for (const project of projects) {
    const bcProjectId = parseInt(project.id.replace("bc-", ""), 10);
    try {
      const bcProject = await bcFetch<BCProject>(`/projects/${bcProjectId}.json`, token, accountId);
      const todosetDock = bcProject.dock.find((d) => d.name === "todoset");
      if (!todosetDock) { projectsSkipped++; continue; }

      const todoset = await bcFetch<{ todolists_url: string }>(
        `/buckets/${bcProjectId}/todosets/${todosetDock.id}.json`, token, accountId
      );
      const todolists = await bcFetchFullUrl<BCTodolist>(todoset.todolists_url, token);

      for (const list of todolists) {
        const [activeTodos, completedTodos] = await Promise.all([
          bcFetchAll<BCTodo>(`/buckets/${bcProjectId}/todolists/${list.id}/todos.json`, token, accountId),
          bcFetchAll<BCTodo>(`/buckets/${bcProjectId}/todolists/${list.id}/todos.json?completed=true`, token, accountId),
        ]);
        const todos = [...activeTodos, ...completedTodos];
        const listPrefix = list.title ? `[${list.title}] ` : "";
        for (const todo of todos) {
          try {
            const firstAssignee = todo.assignees[0];
            const assigneeId = firstAssignee
              ? await resolveBasecampUser(firstAssignee, org.id, user.id)
              : undefined;
            const taskTitle = `${listPrefix}${htmlToText(todo.title)}`;
            const existing = await db.task.findUnique({ where: { id: `bc-todo-${todo.id}` }, select: { id: true } });
            await db.task.upsert({
              where: { id: `bc-todo-${todo.id}` },
              create: {
                id: `bc-todo-${todo.id}`,
                organizationId: org.id,
                projectId: project.id,
                creatorId: user.id,
                assigneeId: assigneeId ?? undefined,
                title: taskTitle,
                description: todo.description ? htmlToMarkdown(todo.description) : undefined,
                status: todo.completed ? "DONE" : "TODO",
                completedAt: todo.completed ? new Date() : undefined,
                dueDate: todo.due_on ? new Date(todo.due_on) : undefined,
                priority: "MEDIUM",
              },
              update: { title: taskTitle, status: todo.completed ? "DONE" : "TODO", assigneeId: assigneeId ?? undefined },
            });
            existing ? tasksUpdated++ : tasksCreated++;
          } catch (e) {
            errors.push(`todo ${todo.id} in ${project.id}: ${String(e)}`);
          }
        }
      }
    } catch (e) {
      errors.push(`project ${project.id}: ${String(e)}`);
    }
  }

  revalidatePath("/projects");
  return { tasksCreated, tasksUpdated, projectsProcessed: projects.length - projectsSkipped, projectsSkipped, errors };
}

// ── Project member backfill ───────────────────────────────────────────────────
// Infers project membership from already-imported data (task assignees/creators,
// message authors, doc authors, file uploaders). No Basecamp API calls needed.
// Safe to re-run — uses upsert on (projectId, userId).

export type ProjectMemberBackfillResult = {
  membershipsCreated: number;
  projectsProcessed: number;
  errors: string[];
};

export async function backfillProjectMembers(): Promise<ProjectMemberBackfillResult> {
  const { token, accountId } = await getBasecampCredentials();
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id },
    select: { id: true },
  });

  let membershipsCreated = 0;
  const errors: string[] = [];

  for (const project of projects) {
    const bcProjectId = parseInt(project.id.replace("bc-", ""), 10);
    try {
      // 1. Explicit people list from Basecamp API (catches members with no activity)
      const { added: bcAdded, errors: bcErrors } = await importProjectPeopleFromBC(
        bcProjectId, project.id, token, accountId, org.id, user.id
      );
      membershipsCreated += bcAdded;
      errors.push(...bcErrors);

      // 2. Also infer from imported content (catches anyone who posted but isn't on the list)
      const [taskRows, messageRows, docRows, fileRows] = await Promise.all([
        db.task.findMany({ where: { projectId: project.id }, select: { creatorId: true, assigneeId: true } }),
        db.projectPost.findMany({ where: { projectId: project.id }, select: { authorId: true } }),
        db.doc.findMany({ where: { projectId: project.id }, select: { authorId: true } }),
        db.projectFile.findMany({ where: { projectId: project.id }, select: { uploadedById: true } }),
      ]);

      const userIds = new Set<string>();
      for (const t of taskRows) {
        if (t.creatorId) userIds.add(t.creatorId);
        if (t.assigneeId) userIds.add(t.assigneeId);
      }
      for (const m of messageRows) userIds.add(m.authorId);
      for (const d of docRows) userIds.add(d.authorId);
      for (const f of fileRows) userIds.add(f.uploadedById);

      for (const userId of userIds) {
        try {
          const existing = await db.projectMember.findUnique({
            where: { projectId_userId: { projectId: project.id, userId } },
            select: { id: true },
          });
          if (!existing) {
            await db.projectMember.create({ data: { projectId: project.id, userId } });
            membershipsCreated++;
          }
        } catch (e) {
          errors.push(`member ${userId} on ${project.id}: ${String(e)}`);
        }
      }
    } catch (e) {
      errors.push(`project ${project.id}: ${String(e)}`);
    }
  }

  revalidatePath("/team");
  revalidatePath("/projects");
  return { membershipsCreated, projectsProcessed: projects.length, errors };
}

// ── Campfire backfill ────────────────────────────────────────────────────────
// Imports Basecamp Campfire (project group chat) for all already-imported
// projects. Safe to re-run — upserts on bc-campfire-line-{projectId}-{lineId}.

export type CampfireBackfillResult = {
  messagesImported: number;
  chatsCreated: number;
  projectsProcessed: number;
  projectsSkipped: number;
  errors: string[];
};

export async function backfillCampfire(): Promise<CampfireBackfillResult> {
  const { token, accountId } = await getBasecampCredentials();
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as { user: NonNullable<typeof ctx.user>; org: NonNullable<typeof ctx.org> };

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id },
    select: { id: true },
  });

  let messagesImported = 0;
  let chatsCreated = 0;
  let projectsSkipped = 0;
  const errors: string[] = [];

  for (const project of projects) {
    const bcProjectId = parseInt(project.id.replace("bc-", ""), 10);
    try {
      const bcProject = await bcFetch<BCProject>(`/projects/${bcProjectId}.json`, token, accountId);
      const chatDock = bcProject.dock.find((d) => d.name === "chat");
      if (!chatDock) { projectsSkipped++; continue; }

      const linesUrl = chatDock.url.replace(/\.json$/, "/lines.json");
      const lines = await bcFetchFullUrl<BCLine>(linesUrl, token);

      // Reuse existing project chat ping if one already exists (may have been
      // auto-created when a user visited the Messages tab before the import ran).
      const existingChat = await db.ping.findFirst({
        where: { organizationId: org.id, projectId: project.id, type: "GROUP" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      let pingId: string;
      if (existingChat) {
        pingId = existingChat.id;
      } else {
        const newPing = await db.ping.create({
          data: {
            id: `bc-campfire-${bcProjectId}`,
            organizationId: org.id,
            type: "GROUP",
            title: "Project Chat",
            projectId: project.id,
          },
        });
        pingId = newPing.id;
        chatsCreated++;
      }

      const participants = new Set<string>();

      for (const line of lines) {
        const content = line.content?.trim();
        if (!content) continue;
        try {
          const authorId = await resolveBasecampUser(line.creator, org.id, user.id);
          participants.add(authorId);
          const messageId = `bc-campfire-line-${bcProjectId}-${line.id}`;
          await db.message.upsert({
            where: { id: messageId },
            create: {
              id: messageId,
              pingId,
              authorId,
              body: htmlToMarkdown(line.content),
              createdAt: new Date(line.created_at),
              updatedAt: new Date(line.created_at),
            },
            update: { body: htmlToMarkdown(line.content) },
          });
          if (line.reactions_url) {
            await importLineReactions(messageId, line.reactions_url, token, org.id, user.id);
          }
          messagesImported++;
        } catch (e) {
          if ((e as { code?: string })?.code === "P2002") continue;
          errors.push(`line ${line.id} in ${project.id}: ${String(e)}`);
        }
      }

      await db.pingParticipant.createMany({
        data: [...participants].map((uid) => ({ pingId, userId: uid })),
        skipDuplicates: true,
      });

      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1]!;
        await db.ping.update({
          where: { id: pingId },
          data: { updatedAt: new Date(lastLine.created_at) },
        });
      }
    } catch (e) {
      errors.push(`project ${project.id}: ${String(e)}`);
    }
  }

  revalidatePath("/projects");
  revalidatePath("/inbox");
  return { messagesImported, chatsCreated, projectsProcessed: projects.length - projectsSkipped, projectsSkipped, errors };
}

// ── Diagnostic: find campfire lines with @mentions ───────────────────────────
export async function debugCampfireContent(): Promise<{ projectId: string; lines: { id: number; rawContent: string; converted: string }[] }> {
  const { token, accountId } = await getBasecampCredentials();
  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { org } = ctx as { org: NonNullable<typeof ctx.org> };

  const projects = await db.project.findMany({
    where: { id: { startsWith: "bc-" }, organizationId: org.id },
    select: { id: true },
    take: 20,
  });

  const results: { id: number; rawContent: string; converted: string }[] = [];
  let foundProjectId = "";

  for (const project of projects) {
    if (results.length >= 6) break;
    const bcProjectId = parseInt(project.id.replace("bc-", ""), 10);
    try {
      const bcProject = await bcFetch<BCProject>(`/projects/${bcProjectId}.json`, token, accountId);
      const chatDock = bcProject.dock.find((d) => d.name === "chat");
      if (!chatDock) continue;
      const linesUrl = chatDock.url.replace(/\.json$/, "/lines.json");
      const lines = await bcFetchFullUrl<BCLine>(linesUrl, token);
      // Prefer lines that look like they have @mentions or HTML
      const mentionLines = lines.filter((l) => l.content && (l.content.includes("@") || l.content.includes("<")));
      if (mentionLines.length > 0) {
        foundProjectId = project.id;
        for (const l of mentionLines.slice(0, 6)) {
          results.push({ id: l.id, rawContent: l.content ?? "", converted: htmlToMarkdown(l.content ?? "") });
        }
        break;
      }
    } catch {
      continue;
    }
  }

  // Fallback: if no mention lines found, show plain samples from first project with any lines
  if (results.length === 0) {
    for (const project of projects.slice(0, 5)) {
      const bcProjectId = parseInt(project.id.replace("bc-", ""), 10);
      try {
        const bcProject = await bcFetch<BCProject>(`/projects/${bcProjectId}.json`, token, accountId);
        const chatDock = bcProject.dock.find((d) => d.name === "chat");
        if (!chatDock) continue;
        const linesUrl = chatDock.url.replace(/\.json$/, "/lines.json");
        const lines = await bcFetchFullUrl<BCLine>(linesUrl, token);
        if (lines.length > 0) {
          foundProjectId = project.id + " (no @mentions found)";
          for (const l of lines.slice(0, 6)) {
            results.push({ id: l.id, rawContent: l.content ?? "", converted: htmlToMarkdown(l.content ?? "") });
          }
          break;
        }
      } catch { continue; }
    }
  }

  return { projectId: foundProjectId, lines: results };
}

// ── Basecamp private ping (DM) importer ──────────────────────────────────────
//
// In Basecamp 3, private messages are called "Pings". They are buckets (like
// projects) accessible at /pings.json. Each ping bucket has a dock containing
// a "chat" (Campfire) tool — exactly like project Campfires but person-to-person.

type BCPing = {
  id: number;
  status: string;
  participants: { id: number; name: string; email_address: string }[];
  dock: { name: string; id: number; url: string }[];
};

type BCLine = {
  id: number;
  content: string;
  created_at: string;
  creator: { id: number; name: string; email_address: string };
  reactions_url?: string;
};

type BCReaction = {
  id: number;
  content: string;
  person: { id: number; name: string; email_address: string };
};

export type ImportPingsResult = {
  chatsImported: number;
  messagesImported: number;
  skipped: number;
  errors: string[];
};

export async function importBasecampPrivatePings(): Promise<ImportPingsResult> {
  const { token, accountId } = await getBasecampCredentials();

  const ctx = await syncCurrentIdentity();
  if (!ctx?.org) throw new Error("No active organization");
  const { user, org } = ctx as {
    user: NonNullable<typeof ctx.user>;
    org:  NonNullable<typeof ctx.org>;
  };

  let chatsImported = 0;
  let messagesImported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // /pings.json returns the private DM buckets for the authenticated user.
  // This endpoint returns 404 if the Basecamp account doesn't have Pings enabled
  // (older accounts or certain plan tiers).
  let bcPings: BCPing[];
  try {
    bcPings = await bcFetchAll<BCPing>("/pings.json", token, accountId);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("404")) {
      return {
        chatsImported: 0,
        messagesImported: 0,
        skipped: 0,
        errors: ["Your Basecamp account doesn't have the Pings (private messages) feature enabled, or it may not be accessible via the API. Private messages may need to be enabled in your Basecamp account settings."],
      };
    }
    throw e;
  }

  for (const bcPing of bcPings) {
    try {
      const pingId = `bc-ping-${bcPing.id}`;

      // Each Ping bucket has a "chat" dock item (Campfire) for its messages
      const chatDock = bcPing.dock.find((d) => d.name === "chat");
      if (!chatDock) {
        errors.push(`ping ${bcPing.id}: no chat dock found`);
        continue;
      }
      // Lines endpoint: replace .json with /lines.json on the chat URL
      const linesUrl = chatDock.url.replace(/\.json$/, "/lines.json");

      // Check if already imported
      const existingPing = await db.ping.findUnique({ where: { id: pingId }, select: { id: true } });

      let ping: { id: string };
      if (existingPing) {
        ping = existingPing;
        skipped++;
        // Fall through to backfill any messages that failed on previous runs
      } else {
        const participantIds = await Promise.all(
          (bcPing.participants ?? []).map((p) => resolveBasecampUser(p, org.id, user.id))
        );
        const uniqueParticipantIds = [...new Set([user.id, ...participantIds])];
        const pingType = uniqueParticipantIds.length <= 2 ? "DIRECT" : "GROUP";

        ping = await db.ping.create({
          data: {
            id: pingId,
            organizationId: org.id,
            type: pingType,
            title: pingType === "GROUP" ? `Group (${uniqueParticipantIds.length} people)` : null,
            participants: {
              create: uniqueParticipantIds.map((uid) => ({ userId: uid })),
            },
          },
        });
        chatsImported++;
      }

      // Import lines as messages (idempotent — P2002 means already imported)
      const lines = await bcFetchFullUrl<BCLine>(linesUrl, token);
      for (const line of lines) {
        try {
          const content = line.content?.trim();
          if (!content) continue;

          const authorId = await resolveBasecampUser(line.creator, org.id, user.id);
          await db.message.create({
            data: {
              id: `bc-ping-line-${bcPing.id}-${line.id}`,
              pingId: ping.id,
              authorId,
              body: htmlToMarkdown(content),
              createdAt: new Date(line.created_at),
              updatedAt: new Date(line.created_at),
            },
          });
          messagesImported++;
        } catch (e: unknown) {
          if ((e as { code?: string })?.code === "P2002") continue;
          errors.push(`line ${line.id} in ping ${bcPing.id}: ${String(e)}`);
        }
      }

      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1]!;
        await db.ping.update({
          where: { id: ping.id },
          data: { updatedAt: new Date(lastLine.created_at) },
        });
      }
    } catch (e) {
      errors.push(`ping ${bcPing.id}: ${String(e)}`);
    }
  }

  revalidatePath("/inbox");
  return { chatsImported, messagesImported, skipped, errors };
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  getLibraryFolders, getLibraryDocs, getLibraryFiles,
  getLibraryFolderBreadcrumb, getProjectsForImport, getLibraryNote, updateLibraryNote,
} from "@/actions/library";
import { getOrgBrandingSettings } from "@/actions/org-branding";
import { LibraryView } from "@/components/library/library-view";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder: folderId = null } = await searchParams;
  const { orgRole } = await auth();

  const isAdmin = orgRole === "org:admin" || orgRole === "org:owner";

  // If a folder ID is in the URL but the folder no longer exists, go back to root
  if (folderId) {
    const breadcrumb = await getLibraryFolderBreadcrumb(folderId);
    if (breadcrumb.length === 0) redirect("/library");
  }

  const [folders, docs, files, breadcrumb, importProjects, note, branding] = await Promise.all([
    getLibraryFolders(folderId),
    getLibraryDocs(folderId),
    getLibraryFiles(folderId),
    folderId ? getLibraryFolderBreadcrumb(folderId) : Promise.resolve([]),
    isAdmin ? getProjectsForImport() : Promise.resolve([]),
    getLibraryNote(),
    getOrgBrandingSettings(),
  ]);

  return (
    <LibraryView
      folders={folders}
      docs={docs}
      files={files}
      breadcrumb={breadcrumb}
      currentFolderId={folderId}
      isAdmin={isAdmin}
      importProjects={importProjects}
      note={note}
      onSaveNote={updateLibraryNote}
      orgBranding={branding ? { logoUrl: branding.logoUrl, orgName: branding.displayName ?? branding.name } : null}
    />
  );
}

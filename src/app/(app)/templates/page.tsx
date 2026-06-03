import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  getTemplateFolders, getTemplateDocs, getTemplateFiles,
  getTemplateFolderBreadcrumb, getProjectsForTemplateImport, getTemplatesNote, updateTemplatesNote,
} from "@/actions/templates";
import { getOrgBrandingSettings } from "@/actions/org-branding";
import { TemplatesView } from "@/components/library/templates-view";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder: folderId = null } = await searchParams;
  const { orgRole } = await auth();

  if (orgRole !== "org:admin" && orgRole !== "org:owner") {
    redirect("/dashboard");
  }

  if (folderId) {
    const breadcrumb = await getTemplateFolderBreadcrumb(folderId);
    if (breadcrumb.length === 0) redirect("/templates");
  }

  const [folders, docs, files, breadcrumb, importProjects, note, branding] = await Promise.all([
    getTemplateFolders(folderId),
    getTemplateDocs(folderId),
    getTemplateFiles(folderId),
    folderId ? getTemplateFolderBreadcrumb(folderId) : Promise.resolve([]),
    getProjectsForTemplateImport(),
    getTemplatesNote(),
    getOrgBrandingSettings(),
  ]);

  return (
    <TemplatesView
      folders={folders}
      docs={docs}
      files={files}
      breadcrumb={breadcrumb}
      currentFolderId={folderId}
      importProjects={importProjects}
      note={note}
      onSaveNote={updateTemplatesNote}
      orgBranding={branding ? { logoUrl: branding.logoUrl, orgName: branding.name } : null}
    />
  );
}

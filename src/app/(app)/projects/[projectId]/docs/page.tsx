import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/actions/projects";
import { getProjectDocs, getProjectFolders, getFolderBreadcrumb } from "@/actions/docs";
import { getProjectFiles } from "@/actions/files";
import { DocsListView } from "@/components/docs/docs-list-view";

export const metadata: Metadata = { title: "Docs & Files" };

export default async function ProjectDocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { projectId } = await params;
  const { folder: folderId = null } = await searchParams;

  const [project, folders, docs, files, breadcrumb] = await Promise.all([
    getProject(projectId),
    getProjectFolders(projectId, folderId ?? null),
    getProjectDocs(projectId, folderId ?? null),
    getProjectFiles(projectId, folderId ?? null),
    folderId ? getFolderBreadcrumb(folderId) : Promise.resolve([]),
  ]);

  if (!project) notFound();

  return (
    <DocsListView
      projectId={projectId}
      folders={folders}
      initialDocs={docs}
      initialFiles={files}
      breadcrumb={breadcrumb}
      currentFolderId={folderId ?? null}
    />
  );
}

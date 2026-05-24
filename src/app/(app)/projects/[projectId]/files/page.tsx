import { getProjectFiles } from "@/actions/files";
import { getProjectFolders, getFolderBreadcrumb } from "@/actions/docs";
import { ProjectFiles } from "@/components/projects/project-files";

export default async function ProjectFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { projectId } = await params;
  const { folder: folderId = null } = await searchParams;

  const [folders, files, breadcrumb] = await Promise.all([
    getProjectFolders(projectId, folderId ?? null),
    getProjectFiles(projectId, folderId ?? null),
    folderId ? getFolderBreadcrumb(folderId) : Promise.resolve([]),
  ]);

  return (
    <ProjectFiles
      projectId={projectId}
      folders={folders}
      initialFiles={files}
      breadcrumb={breadcrumb}
      currentFolderId={folderId ?? null}
    />
  );
}

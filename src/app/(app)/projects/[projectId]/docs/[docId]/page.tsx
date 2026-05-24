import { notFound } from "next/navigation";
import { getDoc } from "@/actions/docs";
import { DocEditor } from "@/components/docs/doc-editor";

export default async function DocPage({
  params,
}: {
  params: Promise<{ projectId: string; docId: string }>;
}) {
  const { projectId, docId } = await params;

  const doc = await getDoc(docId);
  if (!doc || doc.projectId !== projectId) notFound();

  return <DocEditor doc={doc} backHref={`/projects/${projectId}/docs`} />;
}

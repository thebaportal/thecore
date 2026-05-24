import { notFound } from "next/navigation";
import { getLibraryDoc } from "@/actions/library";
import { DocEditor } from "@/components/docs/doc-editor";

export default async function LibraryDocPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const doc = await getLibraryDoc(docId);
  if (!doc) notFound();

  const backHref = doc.folderId ? `/library?folder=${doc.folderId}` : "/library";
  return <DocEditor doc={doc} backHref={backHref} />;
}

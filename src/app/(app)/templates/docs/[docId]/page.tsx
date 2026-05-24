import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTemplateDoc } from "@/actions/templates";
import { DocEditor } from "@/components/docs/doc-editor";

export default async function TemplateDocPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  const { orgRole } = await auth();

  if (orgRole !== "org:admin" && orgRole !== "org:owner") {
    redirect("/dashboard");
  }

  const doc = await getTemplateDoc(docId);
  if (!doc) notFound();

  const backHref = doc.folderId ? `/templates?folder=${doc.folderId}` : "/templates";
  return <DocEditor doc={doc} backHref={backHref} />;
}

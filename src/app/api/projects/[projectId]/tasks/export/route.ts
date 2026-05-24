import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { format } from "date-fns";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return new Response("Unauthorized", { status: 401 });

  const { projectId } = await params;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return new Response("Not found", { status: 404 });

  const project = await db.project.findUnique({
    where: { id: projectId, organizationId: org.id },
    select: { name: true },
  });
  if (!project) return new Response("Not found", { status: 404 });

  const tasks = await db.task.findMany({
    where: { projectId, organizationId: org.id },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
    include: {
      assignee: { select: { name: true } },
      creator: { select: { name: true } },
    },
  });

  const rows = [
    ["ID", "Title", "Status", "Priority", "Assignee", "Created By", "Due Date", "Completed At", "Created At"],
    ...tasks.map((t) => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.assignee?.name ?? "",
      t.creator.name,
      t.dueDate ? format(new Date(t.dueDate), "yyyy-MM-dd") : "",
      t.completedAt ? format(new Date(t.completedAt), "yyyy-MM-dd") : "",
      format(new Date(t.createdAt), "yyyy-MM-dd"),
    ]),
  ];

  const csv = rows.map((r) => r.join(",")).join("\n");
  const filename = `${project.name.replace(/[^a-z0-9]/gi, "_")}_tasks_${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

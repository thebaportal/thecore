import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { NextResponse } from "next/server";

// Temporary debug route — shows raw DB body + what Basecamp is currently returning
export async function GET(req: Request) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId"); // e.g. bc-47410403

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // Find the ping for this project
  const ping = await db.ping.findFirst({
    where: { projectId, organizationId: org.id, type: "GROUP" },
    select: { id: true },
  });
  if (!ping) return NextResponse.json({ error: "No chat found for project" }, { status: 404 });

  // Get short messages (likely the ones with issues)
  const messages = await db.message.findMany({
    where: { pingId: ping.id },
    select: { id: true, body: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Find messages with newlines (the broken ones)
  const broken = messages.filter(m => m.body.includes("\n"));
  const sample = messages.slice(0, 5);

  // Also test what htmlToMarkdown does with common inputs
  const testCases = [
    "yes",
    "y\ne\ns",
    "<div>y</div><div>e</div><div>s</div>",
    "y<br>e<br>s",
    "<p>y</p><p>e</p><p>s</p>",
  ];

  return NextResponse.json({
    totalMessages: messages.length,
    brokenMessages: broken.length,
    brokenSample: broken.slice(0, 5).map(m => ({
      id: m.id,
      body: m.body,
      bodyEscaped: JSON.stringify(m.body),
      lines: m.body.split("\n"),
    })),
    firstFewBodies: sample.map(m => ({ id: m.id, bodyEscaped: JSON.stringify(m.body) })),
    htmlToMarkdownTests: testCases.map(input => ({
      input: JSON.stringify(input),
      output: JSON.stringify(htmlToMarkdown(input)),
    })),
  });
}

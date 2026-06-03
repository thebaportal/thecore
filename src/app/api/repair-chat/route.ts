import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET  ?projectId=bc-47410403  — inspect messages for a specific project
// GET  (no params)              — find all genuinely broken messages org-wide
// POST                          — repair only the genuinely broken ones

// "Genuinely broken" = EVERY line in the body is 0–1 chars (per-char <div> artifact).
// Messages with intentional single-\n line breaks, numbered lists, or signatures
// are NOT touched.

function isPerCharBroken(body: string): boolean {
  const lines = body.split("\n");
  return lines.length > 1 && lines.every((l) => l.trim().length <= 1);
}

function repairPerChar(body: string): string {
  if (!isPerCharBroken(body)) return body;
  // Join the single chars, removing newlines and blank separator lines
  return body.split("\n").map((l) => l.trim()).join("").trim();
}

export async function GET(req: Request) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (projectId) {
    // Targeted lookup: show ALL messages for this project's chat (broken or not)
    const ping = await db.ping.findFirst({
      where: { projectId, organizationId: org.id, type: "GROUP" },
      select: { id: true },
    });
    if (!ping) return NextResponse.json({ error: "No GROUP ping for that project" }, { status: 404 });

    const messages = await db.message.findMany({
      where: { pingId: ping.id },
      select: { id: true, body: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      pingId: ping.id,
      totalMessages: messages.length,
      messagesWithNewline: messages.filter((m) => m.body.includes("\n")).length,
      perCharBroken: messages.filter((m) => isPerCharBroken(m.body)).length,
      allMessages: messages.map((m) => ({
        id: m.id,
        bodyEscaped: JSON.stringify(m.body),
        isPerCharBroken: isPerCharBroken(m.body),
        hasNewline: m.body.includes("\n"),
      })),
    });
  }

  // Org-wide scan — only the per-char broken pattern
  const candidates = await db.message.findMany({
    where: { ping: { organizationId: org.id }, body: { contains: "\n" } },
    select: { id: true, body: true },
  });

  const broken = candidates.filter((m) => isPerCharBroken(m.body));

  return NextResponse.json({
    scanned: candidates.length,
    genuinelyBroken: broken.length,
    broken: broken.map((m) => ({
      id: m.id,
      before: JSON.stringify(m.body),
      after: JSON.stringify(repairPerChar(m.body)),
    })),
  });
}

export async function POST() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const candidates = await db.message.findMany({
    where: { ping: { organizationId: org.id }, body: { contains: "\n" } },
    select: { id: true, body: true },
  });

  const broken = candidates.filter((m) => isPerCharBroken(m.body));
  const results: { id: string; before: string; after: string }[] = [];

  for (const msg of broken) {
    const fixed = repairPerChar(msg.body);
    await db.message.update({ where: { id: msg.id }, data: { body: fixed } });
    results.push({ id: msg.id, before: JSON.stringify(msg.body), after: JSON.stringify(fixed) });
  }

  return NextResponse.json({ repaired: results.length, results });
}

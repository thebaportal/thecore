import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/debug-message?id=bc-campfire-line-47410403-9951839625
// Returns the exact body as stored in DB plus what the server would
// pass to the frontend — confirms whether the issue is DB, server, or render.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

  const message = await db.message.findUnique({
    where: { id },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      ping: { select: { id: true, projectId: true, organizationId: true } },
    },
  });

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  return NextResponse.json({
    id: message.id,
    // Raw string value — what is literally stored
    bodyRaw: message.body,
    // JSON-escaped — shows invisible chars like \n, \r, \t
    bodyEscaped: JSON.stringify(message.body),
    // Per-char breakdown — reveals hidden characters
    chars: [...message.body].map((c) => ({
      char: c,
      code: c.codePointAt(0),
      hex: c.codePointAt(0)?.toString(16),
    })),
    lineCount: message.body.split("\n").length,
    lines: message.body.split("\n"),
    author: message.author.name,
    ping: message.ping,
    timestamp: message.createdAt,
  }, {
    headers: {
      // Prevent any edge/CDN caching of this response
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}

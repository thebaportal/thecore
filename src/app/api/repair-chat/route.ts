"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET  — show broken message bodies (before repair)
// POST — fix them directly in the DB, return before/after
//
// Does NOT call Basecamp API. Reads the stored body and re-normalises it.

function repairBody(body: string): string {
  let md = body;

  // 1. Collapse runs of single-char lines: "y\ne\ns" → "yes"
  md = md.replace(/(^.$\n)+^.$/mg, (match) => match.replace(/\n/g, ""));

  // 2. Collapse remaining single \n between non-newline chars: "Hello every\none" → "Hello every one"
  //    Skips \n\n paragraph breaks (both look-arounds fail on the adjacent \n).
  md = md.replace(/(?<=[^\n])\n(?=[^\n])/g, " ");

  return md.trim();
}

function isBroken(body: string): boolean {
  const lines = body.split("\n");
  // Broken = every line is 0–1 chars (per-char div artifact)
  if (lines.length > 1 && lines.every((l) => l.length <= 1)) return true;
  // Also catch word-splits where any line is a single character surrounded by real words
  if (lines.some((l) => l.length === 1 && /\w/.test(l))) return true;
  return false;
}

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // Find messages in this org's pings that have \n in the body
  const candidates = await db.message.findMany({
    where: {
      ping: { organizationId: org.id },
      body: { contains: "\n" },
    },
    select: { id: true, body: true },
  });

  const broken = candidates.filter((m) => isBroken(m.body));

  return NextResponse.json({
    totalWithNewlines: candidates.length,
    brokenCount: broken.length,
    broken: broken.map((m) => ({
      id: m.id,
      currentBody: JSON.stringify(m.body),
      wouldBecome: JSON.stringify(repairBody(m.body)),
    })),
  });
}

export async function POST() {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const candidates = await db.message.findMany({
    where: {
      ping: { organizationId: org.id },
      body: { contains: "\n" },
    },
    select: { id: true, body: true },
  });

  const broken = candidates.filter((m) => isBroken(m.body));
  const results: { id: string; before: string; after: string }[] = [];

  for (const msg of broken) {
    const fixed = repairBody(msg.body);
    await db.message.update({ where: { id: msg.id }, data: { body: fixed } });
    results.push({
      id: msg.id,
      before: JSON.stringify(msg.body),
      after: JSON.stringify(fixed),
    });
  }

  return NextResponse.json({ fixed: results.length, results });
}

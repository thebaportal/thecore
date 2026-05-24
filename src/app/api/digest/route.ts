import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email";
import type { NotificationKind } from "@/generated/prisma/enums";

const SECTION_LABELS: Record<NotificationKind, string> = {
  DELIVERABLE_SUBMITTED:  "Deliverables",
  DELIVERABLE_APPROVED:   "Deliverables",
  DELIVERABLE_REVISION:   "Deliverables",
  DELIVERABLE_ASSIGNED:   "Deliverables",
  PHASE_UNLOCKED:         "Deliverables",
  TASK_ASSIGNED:          "Tasks",
  CHAT_MENTION:           "Messages",
  LIBRARY_UPLOAD:         "Library",
  MANDATE_UPDATED:        "Project mandates",
};

function formatSinceLabel(since: Date): string {
  const now = new Date();
  const dateStr = since.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = since.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const isToday = since.toDateString() === now.toDateString();
  return isToday ? `Since ${timeStr}` : `Since ${timeStr} on ${dateStr}`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const defaultSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fetch users who want digest emails, with their org memberships
  const users = await db.user.findMany({
    where: {
      emailNotifEnabled: true,
      emailDigest: true,
      isPlaceholder: false,
      email: { not: "" },
    },
    select: {
      id: true,
      email: true,
      name: true,
      lastDigestSentAt: true,
      memberships: {
        select: {
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });

  let sent = 0;

  for (const user of users) {
    const since = user.lastDigestSentAt ?? defaultSince;

    for (const membership of user.memberships) {
      const org = membership.organization;

      // Fetch notifications for this user in this org since last digest
      const notifications = await db.notification.findMany({
        where: {
          userId: user.id,
          organizationId: org.id,
          createdAt: { gt: since },
        },
        orderBy: { createdAt: "asc" },
        select: { kind: true, title: true, body: true, href: true },
      });

      if (notifications.length === 0) continue;

      // Group by section heading
      const sectionMap = new Map<string, { title: string; body?: string | null; href: string }[]>();
      for (const n of notifications) {
        const heading = SECTION_LABELS[n.kind] ?? "Updates";
        if (!sectionMap.has(heading)) sectionMap.set(heading, []);
        sectionMap.get(heading)!.push({ title: n.title, body: n.body, href: n.href });
      }

      const sections = Array.from(sectionMap.entries()).map(([heading, items]) => ({
        heading,
        items,
      }));

      await sendDigestEmail({
        to: user.email,
        toName: user.name,
        orgName: org.name,
        sections,
        sinceLabel: formatSinceLabel(since),
      });

      sent++;
    }

    // Update lastDigestSentAt after processing all orgs for this user
    await db.user.update({
      where: { id: user.id },
      data: { lastDigestSentAt: now },
    });
  }

  return NextResponse.json({ ok: true, digestsSent: sent });
}

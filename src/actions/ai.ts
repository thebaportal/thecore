"use server";

import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const client = new Anthropic();

// ─── Daily briefing ───────────────────────────────────────────────────────────

export type BriefingInput = {
  userName: string;
  orgName?: string;
  overdueTasks:    { title: string; project: string; daysLate: number }[];
  dueTodayTasks:   { title: string; project: string }[];
  atRiskProjects:  { name: string; completionPct: number; daysLeft: number }[];
  unreadPings:     number;
  // Admin/org-health extras
  isAdminView?: boolean;
  activeProjects?: number;
  activeProjectNames?: string[];
  memberCount?: number;
  completedToday?: number;
  pendingReviews?: number;
};

export async function getDailyBriefing(input: BriefingInput): Promise<string> {
  if (!process.env["ANTHROPIC_API_KEY"]) return "";

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  let context: string;
  let prompt: string;

  if (input.isAdminView) {
    const lines: string[] = [];
    const org = input.orgName ?? "your organisation";
    if (input.activeProjectNames && input.activeProjectNames.length > 0) {
      lines.push(`Active projects: ${input.activeProjectNames.join(", ")}`);
    } else if (input.activeProjects) {
      lines.push(`Active projects: ${input.activeProjects}`);
    }
    if (input.memberCount) lines.push(`Team members: ${input.memberCount}`);
    if (input.completedToday) lines.push(`Tasks completed today: ${input.completedToday}`);
    if (input.pendingReviews) lines.push(`Deliverables awaiting review: ${input.pendingReviews}`);
    if (input.atRiskProjects.length > 0) {
      lines.push(`At-risk or behind: ${
        input.atRiskProjects.map((p) => `${p.name} — ${p.completionPct}% complete${p.daysLeft < 0 ? `, ${Math.abs(p.daysLeft)}d overdue` : `, ${p.daysLeft}d left`}`).join("; ")
      }`);
    }
    if (input.unreadPings > 0) lines.push(`Unread conversations: ${input.unreadPings}`);
    context = lines.length > 0 ? lines.join("\n") : "No active projects yet.";
    prompt = `You are a sharp, direct assistant for ${input.userName}, who manages ${org}.

Current workspace snapshot:
${context}

Write 2–3 plain sentences as a morning briefing. Rules:
- Use plain prose only — no markdown, no bullet points, no headers, no hashtags
- Name specific projects and numbers from the data above
- Be action-oriented: tell ${input.userName} what needs attention right now
- If there are pending reviews, lead with that
- If at-risk projects exist, name them and suggest a next step
- If everything looks fine, say so briefly and suggest one proactive thing
- Do not use placeholders like [project name] — only reference real data provided above
- Do not start with "Good morning" or similar pleasantries`;
  } else {
    const lines: string[] = [];
    if (input.overdueTasks.length > 0) {
      lines.push(`Overdue tasks (${input.overdueTasks.length}): ${
        input.overdueTasks.map((t) => `"${t.title}" in ${t.project}, ${t.daysLate}d late`).join("; ")
      }`);
    }
    if (input.dueTodayTasks.length > 0) {
      lines.push(`Due today: ${
        input.dueTodayTasks.map((t) => `"${t.title}" (${t.project})`).join("; ")
      }`);
    }
    if (input.atRiskProjects.length > 0) {
      lines.push(`At-risk projects: ${
        input.atRiskProjects.map((p) => `${p.name} — ${p.completionPct}% complete, ${p.daysLeft}d to deadline`).join("; ")
      }`);
    }
    if (input.unreadPings > 0) lines.push(`Unread conversations: ${input.unreadPings}`);
    context = lines.length > 0 ? lines.join("\n") : "No urgent items.";
    prompt = `You are a sharp, direct assistant for ${input.userName}.

Workspace snapshot:
${context}

Write 2–3 plain sentences as a morning briefing. Rules:
- Use plain prose only — no markdown, no bullet points, no headers, no hashtags
- Name specific tasks and projects from the data above
- Be action-oriented: tell ${input.userName} what to tackle first
- If nothing is urgent, say so in one sentence and suggest one proactive thing
- Do not use placeholders — only reference real data provided above
- Do not start with "Good morning" or similar pleasantries`;
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 180,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block?.type !== "text") throw new Error("Unexpected AI response");
  return block.text;
}

export async function summarizePingThread(pingId: string): Promise<string> {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return "AI features require an ANTHROPIC_API_KEY in your .env file. Get one at console.anthropic.com, then restart the server.";
  }

  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthenticated");

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) throw new Error("Organization not found");

  const ping = await db.ping.findUnique({
    where: { id: pingId, organizationId: org.id },
    include: {
      messages: {
        where: { deletedAt: null, threadParentId: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
        take: 50,
      },
    },
  });

  if (!ping) throw new Error("Conversation not found");
  if (ping.messages.length === 0) return "No messages to summarize.";

  const transcript = ping.messages
    .map((m) => `${m.author.name}: ${m.body}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Summarize this conversation thread in 2-3 concise sentences. Focus on the key decisions, action items, or conclusions. Be direct — no filler phrases like "The conversation discusses...":\n\n${transcript}`,
      },
    ],
  });

  const block = message.content[0];
  if (block?.type !== "text") throw new Error("Unexpected response from AI");
  return block.text;
}

export async function suggestTasksFromPing(pingId: string): Promise<string[]> {
  if (!process.env["ANTHROPIC_API_KEY"]) return [];

  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthenticated");

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) throw new Error("Organization not found");

  const ping = await db.ping.findUnique({
    where: { id: pingId, organizationId: org.id },
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
        take: 30,
      },
    },
  });

  if (!ping || ping.messages.length === 0) return [];

  const transcript = ping.messages
    .map((m) => `${m.author.name}: ${m.body}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `From this conversation, extract 1-5 clear action items or tasks that need to be done. Return ONLY a JSON array of short task title strings (no descriptions, no numbers, no bullet points). Example: ["Review the design mockups", "Update the API endpoint"]\n\nConversation:\n${transcript}`,
      },
    ],
  });

  const block = message.content[0];
  if (block?.type !== "text") return [];

  try {
    const match = block.text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as string[];
  } catch {
    return [];
  }
}

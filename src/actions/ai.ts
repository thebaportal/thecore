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
  overdueTaskCount?: number;
  activePhaseSummary?: {
    projectName: string;
    phaseName: string;
    submitted: number;
    revisionNeeded: number;
    notSubmitted: number;
  }[];
};

export async function getDailyBriefing(input: BriefingInput): Promise<string> {
  if (!process.env["ANTHROPIC_API_KEY"]) return "";

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  let context: string;
  let prompt: string;

  if (input.isAdminView) {
    const lines: string[] = [];
    const org = input.orgName ?? "your class";
    if (input.activeProjectNames && input.activeProjectNames.length > 0) {
      lines.push(`Active student projects: ${input.activeProjectNames.join(", ")}`);
    } else if (input.activeProjects) {
      lines.push(`Active student projects: ${input.activeProjects}`);
    }
    if (input.memberCount) lines.push(`Students/participants: ${input.memberCount}`);
    if (input.pendingReviews) lines.push(`Deliverables awaiting instructor review: ${input.pendingReviews}`);
    if (input.overdueTaskCount) lines.push(`Overdue tasks (across all groups): ${input.overdueTaskCount}`);
    if (input.activePhaseSummary && input.activePhaseSummary.length > 0) {
      const phaseLines = input.activePhaseSummary.map((p) =>
        `${p.projectName} — Phase: ${p.phaseName} (${p.submitted} submitted, ${p.revisionNeeded} need revision, ${p.notSubmitted} not yet submitted)`
      );
      lines.push(`Current phase progress:\n${phaseLines.join("\n")}`);
    }
    if (input.atRiskProjects.length > 0) {
      lines.push(`Groups behind or at risk: ${
        input.atRiskProjects.map((p) => `${p.name} — ${p.completionPct}% complete${p.daysLeft < 0 ? `, ${Math.abs(p.daysLeft)}d overdue` : `, ${p.daysLeft}d left`}`).join("; ")
      }`);
    }
    if (input.unreadPings > 0) lines.push(`Unread student messages: ${input.unreadPings}`);
    context = lines.length > 0 ? lines.join("\n") : "No active projects yet.";
    prompt = `You are a briefing assistant for ${input.userName}, an instructor running a project-based learning program at ${org}.

IMPORTANT CONTEXT — read before responding:
- This is a classroom training simulation. Students are learning Business Analysis and Project Management skills.
- They work on SIMULATED projects (e.g., designing an e-commerce app, an insurance portal). These are NOT real products being built for real customers.
- There are NO real suppliers, customers, delivery dates, Q2 targets, marketing budgets, or commercial operations. Those concepts DO NOT EXIST here.
- Everything is group work with defined phases and deliverables that the instructor reviews and approves.
- Your role is to help the instructor understand student group progress and what to focus on today.

Current classroom snapshot:
${context}

Respond in EXACTLY this format — 4 lines, each starting with the label shown, nothing else:
PROJECT STATUS: [one sentence about overall group progress across active phases]
KEY RISK: [one sentence about the most important risk — late submissions, revision-needed deliverables, or groups falling behind]
RECOMMENDED ACTION: [one specific action the instructor should take today — e.g., review a specific submission, unlock the next phase, follow up with a group]
IMPORTANT UPDATE: [one encouraging or informational note about student progress]

Rules:
- Use ONLY the data provided in the classroom snapshot above
- Reference actual project names and numbers from the data
- Use educational language: students, groups, phases, deliverables, submissions
- Never mention suppliers, customers, Q2, marketing, delivery schedules, or any commercial concept
- Each response must be exactly one sentence per label
- No markdown, no bullet points, no extra text or commentary outside the 4 labeled lines`;
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
    max_tokens: 300,
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

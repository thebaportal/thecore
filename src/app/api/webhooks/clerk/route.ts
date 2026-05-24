import { headers } from "next/headers";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });

  const headerStore = await headers();
  const svixId = headerStore.get("svix-id");
  const svixTimestamp = headerStore.get("svix-timestamp");
  const svixSignature = headerStore.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = evt;

  // ── User events ──────────────────────────────────────────────────
  if (type === "user.created" || type === "user.updated") {
    await db.user.upsert({
      where: { clerkUserId: data.id },
      create: {
        clerkUserId: data.id,
        email: data.email_addresses[0]?.email_address ?? "",
        name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unknown",
        avatarUrl: data.image_url ?? null,
      },
      update: {
        email: data.email_addresses[0]?.email_address ?? "",
        name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unknown",
        avatarUrl: data.image_url ?? null,
      },
    });
  }

  if (type === "user.deleted" && data.id) {
    await db.user.deleteMany({ where: { clerkUserId: data.id } });
  }

  // ── Organization events ──────────────────────────────────────────
  if (type === "organization.created" || type === "organization.updated") {
    await db.organization.upsert({
      where: { clerkOrgId: data.id },
      create: {
        clerkOrgId: data.id,
        name: data.name,
        slug: data.slug ?? data.id,
        logoUrl: data.image_url ?? null,
      },
      update: {
        name: data.name,
        slug: data.slug ?? data.id,
        logoUrl: data.image_url ?? null,
      },
    });
  }

  if (type === "organization.deleted" && data.id) {
    await db.organization.deleteMany({ where: { clerkOrgId: data.id } });
  }

  // ── Membership events ────────────────────────────────────────────
  if (type === "organizationMembership.created" || type === "organizationMembership.updated") {
    const clerkOrgId = data.organization.id;
    const clerkUserId = data.public_user_data.user_id;
    const identifier: string = (data.public_user_data as { identifier?: string }).identifier ?? "";

    const [org, user] = await Promise.all([
      db.organization.findUnique({ where: { clerkOrgId } }),
      db.user.findUnique({ where: { clerkUserId } }),
    ]);

    if (org && user) {
      const role = data.role === "org:admin" ? "ADMIN" : "MEMBER";
      await db.orgMembership.upsert({
        where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
        create: { organizationId: org.id, userId: user.id, role },
        update: { role },
      });

      // On new membership, fulfil any pending project invitations for this email
      if (type === "organizationMembership.created" && identifier) {
        const email = identifier.toLowerCase();
        const pendingInvitations = await db.projectInvitation.findMany({
          where: { email, project: { organizationId: org.id } },
          select: { id: true, projectId: true },
        });

        if (pendingInvitations.length > 0) {
          await Promise.all(
            pendingInvitations.map((inv) =>
              db.projectMember.upsert({
                where: { projectId_userId: { projectId: inv.projectId, userId: user.id } },
                create: { projectId: inv.projectId, userId: user.id },
                update: {},
              })
            )
          );
          await db.projectInvitation.deleteMany({
            where: { id: { in: pendingInvitations.map((i) => i.id) } },
          });
        }
      }
    }
  }

  if (type === "organizationMembership.deleted") {
    const clerkOrgId = data.organization.id;
    const clerkUserId = data.public_user_data.user_id;

    const [org, user] = await Promise.all([
      db.organization.findUnique({ where: { clerkOrgId } }),
      db.user.findUnique({ where: { clerkUserId } }),
    ]);

    if (org && user) {
      await db.orgMembership.deleteMany({
        where: { organizationId: org.id, userId: user.id },
      });
    }
  }

  return new Response("OK", { status: 200 });
}

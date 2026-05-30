import { db } from "@/lib/db";
import type { NotificationKind } from "@/generated/prisma/enums";
import { sendNotificationEmail } from "@/lib/email";

// Map each kind to the preference field that gates its email
const KIND_TO_PREF: Record<NotificationKind, keyof EmailPrefs> = {
  TASK_ASSIGNED:         "emailNotifTasks",
  DELIVERABLE_SUBMITTED: "emailNotifDeliverables",
  DELIVERABLE_APPROVED:  "emailNotifDeliverables",
  DELIVERABLE_REVISION:  "emailNotifDeliverables",
  DELIVERABLE_ASSIGNED:  "emailNotifDeliverables",
  PHASE_UNLOCKED:        "emailNotifDeliverables",
  CHAT_MENTION:          "emailNotifMentions",
  LIBRARY_UPLOAD:        "emailNotifLibrary",
  MANDATE_UPDATED:       "emailNotifDeliverables",
  ANNOUNCEMENT:          "emailNotifEnabled",
};

type EmailPrefs = {
  emailNotifEnabled: boolean;
  emailNotifTasks: boolean;
  emailNotifDeliverables: boolean;
  emailNotifMentions: boolean;
  emailNotifLibrary: boolean;
};

export async function createNotificationsForUsers(
  organizationId: string,
  userIds: string[],
  kind: NotificationKind,
  data: { title: string; body?: string; href: string },
  orgName?: string,
) {
  if (userIds.length === 0) return;

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      organizationId,
      userId,
      kind,
      title: data.title,
      body: data.body ?? null,
      href: data.href,
    })),
    skipDuplicates: true,
  });

  // Fire emails for users who have that preference enabled
  const prefField = KIND_TO_PREF[kind];
  const users = await db.user.findMany({
    where: {
      id: { in: userIds },
      emailNotifEnabled: true,
      [prefField]: true,
    },
    select: { email: true, name: true },
  });

  void Promise.allSettled(
    users.map((u) =>
      sendNotificationEmail({
        to: u.email,
        toName: u.name,
        kind,
        title: data.title,
        body: data.body,
        href: data.href,
        orgName,
      })
    )
  );
}

export async function getOrgUserIdsByRole(
  organizationId: string,
  roles: ("OWNER" | "ADMIN" | "MEMBER" | "GUEST")[],
): Promise<string[]> {
  const members = await db.orgMembership.findMany({
    where: { organizationId, role: { in: roles } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

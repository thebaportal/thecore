import { Resend } from "resend";
import type { NotificationKind } from "@/generated/prisma/enums";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function getFrom(orgName?: string): string {
  const base  = process.env.RESEND_FROM_NAME  ?? "The Core";
  const email = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const name  = orgName ? `${base} (${orgName})` : base;
  return `${name} <${email}>`;
}

const KIND_SUBJECT_PREFIX: Record<NotificationKind, string> = {
  TASK_ASSIGNED:          "Task assigned",
  DELIVERABLE_SUBMITTED:  "New submission",
  DELIVERABLE_APPROVED:   "Submission approved",
  DELIVERABLE_REVISION:   "Revision requested",
  DELIVERABLE_ASSIGNED:   "Review assigned",
  PHASE_UNLOCKED:         "Phase unlocked",
  CHAT_MENTION:           "You were mentioned",
  LIBRARY_UPLOAD:         "New library resource",
  MANDATE_UPDATED:        "Project mandate updated",
  ANNOUNCEMENT:           "Announcement",
};

function buildHtml({
  toName,
  title,
  body,
  actionUrl,
  orgName,
}: {
  toName: string;
  title: string;
  body?: string;
  actionUrl: string;
  orgName?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <!-- Preheader: controls Gmail/Outlook inbox preview text -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${body ?? title}</span>
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:52px 16px 64px">

        <!-- Brand above card -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;margin-bottom:20px">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="width:30px;height:30px;background:#1d4ed8;border-radius:8px;text-align:center;vertical-align:middle">
                    <span style="color:#ffffff;font-size:12px;font-weight:700;line-height:1;display:block;padding-top:9px">TC</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle">
                    <div style="font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;line-height:1.2">The Core</div>
                    ${orgName ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px;letter-spacing:0.01em">${orgName}</div>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">

          <!-- Body -->
          <tr>
            <td style="padding:44px 48px 40px">
              <p style="margin:0 0 28px;font-size:13px;font-weight:500;color:#94a3b8;letter-spacing:0.01em">Hi ${toName},</p>
              <p style="margin:0 0 14px;font-size:21px;font-weight:700;color:#0f172a;line-height:1.35;letter-spacing:-0.02em">${title}</p>
              ${body ? `<p style="margin:0 0 36px;font-size:14px;color:#64748b;line-height:1.8">${body}</p>` : `<div style="margin-bottom:36px"></div>`}
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#1d4ed8;border-radius:10px">
                    <a href="${actionUrl}" style="display:block;padding:14px 30px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;white-space:nowrap">Open in The Core &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 48px 22px;border-top:1px solid #f1f5f9">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
                You received this because email notifications are enabled for your account &middot; <a href="${APP_URL}/settings/notifications" style="color:#94a3b8;text-decoration:underline">Manage preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendNotificationEmail({
  to,
  toName,
  kind,
  title,
  body,
  href,
  orgName,
}: {
  to: string;
  toName: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href: string;
  orgName?: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return; // no key configured — silent no-op

  const actionUrl = `${APP_URL}${href}`;
  const subject = `${KIND_SUBJECT_PREFIX[kind]}: ${title}`;

  try {
    await client.emails.send({
      from: getFrom(orgName),
      to: [to],
      subject,
      html: buildHtml({ toName, title, body, actionUrl, orgName }),
    });
  } catch (err) {
    console.error("[email] Failed to send notification email:", err);
  }
}

// ─── Daily digest ────────────────────────────────────────────────────────────

type DigestItem = { title: string; body?: string | null; href: string };
type DigestSection = { heading: string; items: DigestItem[] };

function buildDigestHtml({
  toName,
  orgName,
  sections,
  sinceLabel,
}: {
  toName: string;
  orgName: string;
  sections: DigestSection[];
  sinceLabel: string;
}): string {
  const APP_URL_LOCAL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const sectionsHtml = sections
    .map(
      (s) => `
      <tr><td style="padding-bottom:24px">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8">${s.heading}</p>
        ${s.items
          .map(
            (item) => `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:10px">
            <tr>
              <td style="background:#f8fafc;border-radius:8px;padding:12px 14px">
                <a href="${APP_URL_LOCAL}${item.href}" style="text-decoration:none">
                  <p style="margin:0 0 ${item.body ? "3px" : "0"};font-size:13px;font-weight:600;color:#0f172a;line-height:1.4">${item.title}</p>
                  ${item.body ? `<p style="margin:0;font-size:12px;color:#64748b;line-height:1.5">${item.body}</p>` : ""}
                </a>
              </td>
            </tr>
          </table>`
          )
          .join("")}
      </td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your daily digest from The Core</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">Here's everything that happened ${sinceLabel} in ${orgName}.</span>
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:52px 16px 64px">

        <!-- Brand -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;margin-bottom:20px">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="width:30px;height:30px;background:#1d4ed8;border-radius:8px;text-align:center;vertical-align:middle">
                    <span style="color:#ffffff;font-size:12px;font-weight:700;line-height:1;display:block;padding-top:9px">TC</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle">
                    <div style="font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;line-height:1.2">The Core</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:1px;letter-spacing:0.01em">${orgName}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">

          <!-- Header -->
          <tr>
            <td style="padding:36px 48px 28px;border-bottom:1px solid #f1f5f9">
              <p style="margin:0 0 4px;font-size:13px;font-weight:500;color:#94a3b8">Hi ${toName},</p>
              <p style="margin:0 0 4px;font-size:21px;font-weight:700;color:#0f172a;line-height:1.3;letter-spacing:-0.02em">Here's the latest activity</p>
              <p style="margin:0;font-size:13px;color:#94a3b8">${sinceLabel}</p>
            </td>
          </tr>

          <!-- Sections -->
          <tr>
            <td style="padding:28px 48px 8px">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${sectionsHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:4px 48px 36px">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#1d4ed8;border-radius:10px">
                    <a href="${APP_URL_LOCAL}" style="display:block;padding:14px 30px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;white-space:nowrap">Open The Core &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 48px 22px;border-top:1px solid #f1f5f9">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
                You received this daily digest because email notifications are enabled &middot; <a href="${APP_URL_LOCAL}/settings/notifications" style="color:#94a3b8;text-decoration:underline">Manage preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDigestEmail({
  to,
  toName,
  orgName,
  sections,
  sinceLabel,
}: {
  to: string;
  toName: string;
  orgName: string;
  sections: DigestSection[];
  sinceLabel: string;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const subject = `The Core (${orgName}): Here's the latest activity`;

  try {
    await client.emails.send({
      from: getFrom(orgName),
      to: [to],
      subject,
      html: buildDigestHtml({ toName, orgName, sections, sinceLabel }),
    });
  } catch (err) {
    console.error("[email] Failed to send digest email:", err);
  }
}

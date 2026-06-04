import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { BasecampImporter } from "@/components/settings/basecamp-importer";
import { BasecampAuditReport } from "@/components/settings/basecamp-audit-report";
import { getBasecampProjectAudit } from "@/actions/basecamp-audit";
import { deleteImportedPings } from "@/actions/pings";

export const metadata: Metadata = { title: "Import from Basecamp" };

export default async function BasecampImportPage() {
  const { orgId } = await auth();

  // Prefer DB-stored token (persistent), fall back to cookie (session)
  let token: string | null = null;
  let accountId: string | null = null;
  let accountName: string | null = null;

  if (orgId) {
    const org = await db.organization.findUnique({
      where: { clerkOrgId: orgId },
      select: {
        basecampAccessToken: true,
        basecampAccountId: true,
        basecampAccountName: true,
      },
    });
    token = org?.basecampAccessToken ?? null;
    accountId = org?.basecampAccountId ?? null;
    accountName = org?.basecampAccountName ?? null;
  }

  // Cookie fallback for first connection before DB write
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("bc_token")?.value ?? null;
    accountId = cookieStore.get("bc_account_id")?.value ?? null;
  }

  const clientId = process.env["BASECAMP_CLIENT_ID"] ?? "";
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const redirectUri = encodeURIComponent(`${appUrl}/api/basecamp/callback`);

  // Pass orgId as state so callback knows which org to update
  const connectHref = clientId && orgId
    ? `https://launchpad.37signals.com/authorization/new?type=web_server&client_id=${clientId}&redirect_uri=${redirectUri}&state=${orgId}`
    : null;

  const auditRows = token && accountId ? await getBasecampProjectAudit().catch(() => null) : null;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <a href="/settings" className="hover:text-foreground transition-colors">Settings</a>
          <span>/</span>
          <span className="text-foreground">Basecamp</span>
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Basecamp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect Basecamp to bring your projects, tasks, and conversations into The Core.
        </p>
      </div>

      <Suspense>
        <BasecampImporter
          connected={!!token && !!accountId}
          token={token}
          accountId={accountId}
          accountName={accountName}
          connectHref={connectHref}
          storageConfigured={!!process.env["UPLOADTHING_TOKEN"]}
          onClearPings={deleteImportedPings}
        />
      </Suspense>

      {auditRows && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Project audit &amp; data mapping</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All projects found in your Basecamp account — active and archived. Review the classification
              and destination before importing. Download as CSV to plan your cleanup in Basecamp first.
            </p>
          </div>
          <BasecampAuditReport rows={auditRows} />
        </div>
      )}
    </div>
  );
}

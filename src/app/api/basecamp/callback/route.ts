import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const clerkOrgId = searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings/import/basecamp?error=auth_failed", request.url));
  }

  const clientId = process.env["BASECAMP_CLIENT_ID"];
  const clientSecret = process.env["BASECAMP_CLIENT_SECRET"];
  const redirectUri = `${process.env["NEXT_PUBLIC_APP_URL"]}/api/basecamp/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/import/basecamp?error=not_configured", request.url));
  }

  try {
    const tokenRes = await fetch("https://launchpad.37signals.com/authorization/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        type: "web_server",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/settings/import/basecamp?error=token_failed", request.url));
    }

    const data = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Fetch identity to get BC account info
    const identityRes = await fetch("https://launchpad.37signals.com/authorization.json", {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "User-Agent": "TheCore/1.0 (migration-tool)",
      },
    });

    const identity = await identityRes.json() as {
      accounts: { id: number; product: string; name: string }[];
    };
    const basecampAccount = identity.accounts?.find((a) => a.product === "bc3");

    if (!basecampAccount) {
      return NextResponse.redirect(new URL("/settings/import/basecamp?error=no_account", request.url));
    }

    // Persist to DB so the token survives beyond 2 hours
    if (clerkOrgId) {
      await db.organization.updateMany({
        where: { clerkOrgId },
        data: {
          basecampAccessToken: data.access_token,
          basecampRefreshToken: data.refresh_token,
          basecampAccountId: String(basecampAccount.id),
          basecampAccountName: basecampAccount.name,
          basecampConnectedAt: new Date(),
        },
      });
    }

    const response = NextResponse.redirect(new URL("/settings/import/basecamp?connected=1", request.url));

    // Also keep short-lived cookies for the existing importer
    const maxAge = 60 * 60 * 8;
    response.cookies.set("bc_token", data.access_token, { httpOnly: true, maxAge, path: "/" });
    response.cookies.set("bc_account_id", String(basecampAccount.id), { httpOnly: true, maxAge, path: "/" });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/settings/import/basecamp?error=unknown", request.url));
  }
}

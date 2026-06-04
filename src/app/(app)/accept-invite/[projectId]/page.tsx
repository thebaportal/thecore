import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { syncCurrentIdentity } from "@/actions/projects";
import { db } from "@/lib/db";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organization: {
        select: { name: true, displayName: true, logoUrl: true, brandColor: true },
      },
    },
  });

  if (!project) redirect("/dashboard");

  // Process any pending ProjectInvitation for this user's email → creates ProjectMember
  await syncCurrentIdentity();

  const org = project.organization;
  const displayName = org.displayName ?? org.name;
  const logoUrl = org.logoUrl && !org.logoUrl.includes("clerk") ? org.logoUrl : null;
  const brandColor = org.brandColor ?? "#1E3A8A";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Org identity */}
        <div className="flex flex-col items-center mb-8">
          {logoUrl ? (
            <div className="h-16 flex items-center justify-center mb-4">
              <img src={logoUrl} alt={displayName} className="max-h-full max-w-[180px] object-contain" />
            </div>
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold mb-4 shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              {initials}
            </div>
          )}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{displayName}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Brand color accent strip */}
          <div className="h-1 w-full" style={{ backgroundColor: brandColor }} />

          <div className="px-8 py-8 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${brandColor}18` }}
            >
              <CheckCircle2 className="w-6 h-6" style={{ color: brandColor }} />
            </div>

            <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1">
              You&apos;re in!
            </h1>
            <p className="text-sm text-muted-foreground mb-1">
              You&apos;ve been added to
            </p>
            <p className="text-sm font-semibold text-foreground mb-6">
              {project.name}
            </p>

            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              Open project →
            </Link>

            <Link
              href="/dashboard"
              className="block mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

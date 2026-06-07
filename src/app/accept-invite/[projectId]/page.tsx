import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { syncCurrentIdentity } from "@/actions/projects";
import { db } from "@/lib/db";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { userId, orgId } = await auth();

  // Not signed in — redirect to sign-up so new users land with their invitation
  // context intact (the __clerk_ticket query param is already in the URL when
  // Clerk sends the email; if it's not here, a plain redirect still works).
  if (!userId) {
    redirect(`/sign-up?redirect_url=${encodeURIComponent(`/accept-invite/${projectId}`)}`);
  }

  // Signed in but no active org in session yet — org-selection will activate it
  // and redirect back here.
  if (!orgId) {
    redirect(`/organization-selection?redirect_url=${encodeURIComponent(`/accept-invite/${projectId}`)}`);
  }

  // Signed in with an active org — fulfil any pending project invitation and go
  // straight to the project (no intermediate "You're in!" page).
  await syncCurrentIdentity();

  const project = await db.project.findFirst({
    where: { id: projectId },
    select: { id: true },
  });

  redirect("/dashboard");
}

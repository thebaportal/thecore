import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function ProfileSettingsPage() {
  const { userId } = await auth();
  const dbUser = userId
    ? await db.user.findUnique({ where: { clerkUserId: userId }, select: { jobTitle: true } })
    : null;

  return <ProfileForm initialJobTitle={dbUser?.jobTitle ?? ""} />;
}

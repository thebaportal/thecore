import type { Metadata } from "next";
import { getAnnouncements } from "@/actions/announcements";
import { AnnouncementsView } from "@/components/announcements/announcements-view";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const { announcements, isAdmin } = await getAnnouncements();
  return <AnnouncementsView announcements={announcements} isAdmin={isAdmin} />;
}

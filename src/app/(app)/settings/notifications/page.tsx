import type { Metadata } from "next";
import { getNotifPrefs } from "@/actions/notification-prefs";
import { NotifPrefsForm } from "./notif-prefs-form";

export const metadata: Metadata = { title: "Notification Preferences" };

export default async function NotificationsSettingsPage() {
  const prefs = await getNotifPrefs();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which events send you an email. In-app notifications (the bell) are always on.
        </p>
      </div>

      <NotifPrefsForm prefs={prefs} />
    </div>
  );
}

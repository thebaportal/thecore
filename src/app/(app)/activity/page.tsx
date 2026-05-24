import type { Metadata } from "next";
import { getActivityFeed } from "@/actions/activity";
import { ActivityFeed } from "@/components/activity/activity-feed";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const items = await getActivityFeed(60);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything happening across your organization in the last 30 days.</p>
      </div>
      <ActivityFeed items={items} />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateNotifPrefs, type NotifPrefs } from "@/actions/notification-prefs";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

type Row = {
  key: keyof NotifPrefs;
  label: string;
  description: string;
};

const ROWS: Row[] = [
  {
    key: "emailNotifTasks",
    label: "Task assignments",
    description: "When a task is assigned to you.",
  },
  {
    key: "emailNotifDeliverables",
    label: "Deliverable updates",
    description: "Submissions, approvals, revision requests, and phase unlocks.",
  },
  {
    key: "emailNotifMentions",
    label: "@Mentions",
    description: "When someone mentions you in a chat message.",
  },
  {
    key: "emailNotifLibrary",
    label: "Library uploads",
    description: "When a new resource is added to the Library.",
  },
];

const DEFAULT_PREFS: NotifPrefs = {
  emailNotifEnabled: true,
  emailNotifTasks: true,
  emailNotifDeliverables: true,
  emailNotifMentions: true,
  emailNotifLibrary: false,
  emailDigest: true,
};

export function NotifPrefsForm({ prefs }: { prefs: NotifPrefs | null }) {
  const [local, setLocal] = useState<NotifPrefs>(prefs ?? DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set(key: keyof NotifPrefs, value: boolean) {
    const next = { ...local, [key]: value };
    setLocal(next);
    setSaved(false);
    startTransition(async () => {
      await updateNotifPrefs({ [key]: value });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Email notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Master switch — turn off to stop all notification emails.
            </p>
          </div>
          <Toggle
            checked={local.emailNotifEnabled}
            onChange={(v) => set("emailNotifEnabled", v)}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Per-kind toggles */}
      <div className={cn(
        "rounded-xl border border-border bg-card overflow-hidden divide-y divide-border transition-opacity",
        !local.emailNotifEnabled && "opacity-40 pointer-events-none"
      )}>
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
            </div>
            <Toggle
              checked={local[row.key]}
              onChange={(v) => set(row.key, v)}
              disabled={isPending}
            />
          </div>
        ))}
      </div>

      {/* Daily digest */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Daily digest</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              One summary email per day covering everything that happened — instead of individual alerts.
            </p>
          </div>
          <Toggle
            checked={local.emailDigest}
            onChange={(v) => set("emailDigest", v)}
            disabled={isPending || !local.emailNotifEnabled}
          />
        </div>
      </div>

      {saved && (
        <p className="text-xs text-emerald-600 font-medium">Preferences saved.</p>
      )}

      <p className="text-xs text-muted-foreground">
        In-app notifications (the bell icon) are always delivered regardless of these settings.
      </p>
    </div>
  );
}

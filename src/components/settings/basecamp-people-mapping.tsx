"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, CheckCircle2, UserCircle2 } from "lucide-react";
import { getBasecampPeople, saveUserMapping, type BCPersonRow, type CoreUserOption } from "@/actions/basecamp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function UserSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | null;
  options: CoreUserOption[];
  onChange: (userId: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={cn(
        "text-sm rounded-lg border border-border bg-background px-2.5 py-1.5 outline-none",
        "focus:border-primary transition-colors w-full max-w-[220px]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      <option value="">— No match —</option>
      {options.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} ({u.email})
        </option>
      ))}
    </select>
  );
}

export function BasecampPeopleMapping() {
  const [bcPeople, setBcPeople] = useState<BCPersonRow[] | null>(null);
  const [coreUsers, setCoreUsers] = useState<CoreUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // basecampPersonId being saved
  const [isPending, startTransition] = useTransition();

  function handleLoad() {
    setLoading(true);
    setLoadError(null);
    startTransition(async () => {
      try {
        const data = await getBasecampPeople();
        setBcPeople(data.bcPeople);
        setCoreUsers(data.coreUsers);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load people");
      } finally {
        setLoading(false);
      }
    });
  }

  function handleMappingChange(basecampPersonId: string, coreUserId: string | null) {
    setSaving(basecampPersonId);
    startTransition(async () => {
      try {
        await saveUserMapping(basecampPersonId, coreUserId);
        setBcPeople((prev) =>
          prev
            ? prev.map((p) =>
                p.basecampPersonId === basecampPersonId ? { ...p, coreUserId } : p
              )
            : prev,
        );
      } finally {
        setSaving(null);
      }
    });
  }

  const matchedCount = bcPeople?.filter((p) => p.coreUserId).length ?? 0;
  const totalCount = bcPeople?.length ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">People Mapping</h2>
          {bcPeople && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {matchedCount} of {totalCount} matched
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleLoad}
          disabled={loading || isPending}
          className="gap-1.5"
        >
          {loading || isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {bcPeople ? "Refresh" : "Load People"}
        </Button>
      </div>

      {!bcPeople && !loadError && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Match Basecamp people to The Core accounts so imported tasks and messages show the right authors.
        </div>
      )}

      {loadError && (
        <div className="px-5 py-4 text-sm text-destructive">{loadError}</div>
      )}

      {bcPeople && bcPeople.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No people found in your Basecamp account.
        </div>
      )}

      {bcPeople && bcPeople.length > 0 && (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-2 border-b border-border bg-muted/10">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Basecamp person</span>
            <span />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">The Core account</span>
          </div>

          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {bcPeople.map((p) => {
              const isSaving = saving === p.basecampPersonId && isPending;
              const isMatched = !!p.coreUserId;
              return (
                <div
                  key={p.basecampPersonId}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3"
                >
                  {/* BC person */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.basecampName}</p>
                    {p.basecampEmail && (
                      <p className="text-xs text-muted-foreground truncate">{p.basecampEmail}</p>
                    )}
                  </div>

                  {/* Match indicator */}
                  <div className="flex items-center justify-center w-6">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : isMatched ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <UserCircle2 className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Core user dropdown */}
                  <UserSelect
                    value={p.coreUserId}
                    options={coreUsers}
                    onChange={(userId) => handleMappingChange(p.basecampPersonId, userId)}
                    disabled={isSaving}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

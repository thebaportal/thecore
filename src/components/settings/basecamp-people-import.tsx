"use client";

import { useState, useTransition } from "react";
import { Users, Loader2, CheckCircle2, Link2, SkipForward, AlertCircle } from "lucide-react";
import { importBasecampPeople, type PeopleImportResult } from "@/actions/basecamp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  created: { label: "Created",  icon: <Users    className="w-3.5 h-3.5 text-emerald-500" />, cls: "text-emerald-700" },
  matched: { label: "Matched",  icon: <Link2    className="w-3.5 h-3.5 text-blue-500"    />, cls: "text-blue-700"    },
  skipped: { label: "Already imported", icon: <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />, cls: "text-muted-foreground" },
};

export function BasecampPeopleImport() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PeopleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  function handleImport() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await importBasecampPeople();
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  const displayPeople = showAll ? result?.people : result?.people.slice(0, 8);
  const hasMore = (result?.people.length ?? 0) > 8;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import Members from Basecamp</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Creates historical member records for attribution — no login required.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={isPending}
          className="gap-1.5 shrink-0"
        >
          {isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</>
          ) : (
            <><Users className="w-3.5 h-3.5" /> {result ? "Re-import" : "Import Members"}</>
          )}
        </Button>
      </div>

      {error && (
        <div className="px-5 py-4 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Fetches all people from your Basecamp account, matches existing members by email,
          and creates placeholder records for historical attribution.
        </div>
      )}

      {result && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
            <div className="px-5 py-3 text-center">
              <p className="text-xl font-semibold text-emerald-600">{result.created}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Created</p>
            </div>
            <div className="px-5 py-3 text-center">
              <p className="text-xl font-semibold text-blue-600">{result.matched}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Matched</p>
            </div>
            <div className="px-5 py-3 text-center">
              <p className="text-xl font-semibold text-foreground">{result.skipped}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Already imported</p>
            </div>
          </div>

          {/* People list */}
          <div className="divide-y divide-border">
            {displayPeople?.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  {cfg.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                  </div>
                  <span className={cn("text-xs shrink-0", cfg.cls)}>{cfg.label}</span>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="px-5 py-3 border-t border-border">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-primary hover:opacity-70 transition-opacity"
              >
                {showAll ? "Show less" : `Show all ${result.people.length} people`}
              </button>
            </div>
          )}

          {result.created + result.matched > 0 && (
            <div className="px-5 py-3 border-t border-border bg-emerald-50/50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">
                {result.created + result.matched} members ready — you can now import projects and content will be attributed correctly.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

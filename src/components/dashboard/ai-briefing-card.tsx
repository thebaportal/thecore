"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { getDailyBriefing, type BriefingInput } from "@/actions/ai";
import { cn } from "@/lib/utils";

type BriefingSections = {
  projectStatus: string;
  keyRisk: string;
  action: string;
  update: string;
};

function parseSections(raw: string): BriefingSections {
  const result: BriefingSections = { projectStatus: "", keyRisk: "", action: "", update: "" };
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (l.startsWith("PROJECT STATUS:"))       result.projectStatus = l.slice("PROJECT STATUS:".length).trim();
    else if (l.startsWith("KEY RISK:"))        result.keyRisk       = l.slice("KEY RISK:".length).trim();
    else if (l.startsWith("RECOMMENDED ACTION:")) result.action     = l.slice("RECOMMENDED ACTION:".length).trim();
    else if (l.startsWith("IMPORTANT UPDATE:")) result.update       = l.slice("IMPORTANT UPDATE:".length).trim();
  }
  return result;
}

const SECTIONS = [
  { key: "projectStatus" as const, label: "Project Status",     dotCls: "bg-blue-500",    labelCls: "text-blue-600"    },
  { key: "keyRisk"       as const, label: "Key Risk",           dotCls: "bg-amber-500",   labelCls: "text-amber-600"   },
  { key: "action"        as const, label: "Recommended Action", dotCls: "bg-primary",     labelCls: "text-primary"     },
  { key: "update"        as const, label: "Important Update",   dotCls: "bg-emerald-500", labelCls: "text-emerald-600" },
];

export function AIBriefingCard({ input }: { input: BriefingInput }) {
  const [sections, setSections] = useState<BriefingSections | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const raw = await getDailyBriefing(input);
      setSections(parseSections(raw));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground/40" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            AI Briefing
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2 bg-muted animate-pulse rounded-full w-28" />
                <div className="h-3.5 bg-muted animate-pulse rounded-full w-full" />
                <div className="h-3.5 bg-muted animate-pulse rounded-full w-[75%]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load briefing.{" "}
            <button onClick={load} className="text-foreground underline hover:no-underline">
              Try again
            </button>
          </p>
        ) : sections ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {SECTIONS.map(({ key, label, dotCls, labelCls }) => (
              <div key={key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotCls)} />
                  <p className={cn("text-[10px] font-semibold uppercase tracking-widest", labelCls)}>
                    {label}
                  </p>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {sections[key] || (
                    <span className="text-muted-foreground italic">Not available</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { getDailyBriefing, type BriefingInput } from "@/actions/ai";
import { cn } from "@/lib/utils";

export function AIBriefingCard({ input }: { input: BriefingInput }) {
  const [text, setText]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const raw = await getDailyBriefing(input);
      // Strip any markdown the model sneaks in
      const clean = raw
        .replace(/^#+\s*/gm, "")        // headings
        .replace(/\*\*(.*?)\*\*/g, "$1") // bold
        .replace(/\*(.*?)\*/g, "$1")     // italic
        .trim();
      setText(clean);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []); // input is stable (serialised from server render)

  useEffect(() => { load(); }, [load]);

  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden">
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary/60 via-primary to-primary/60" />

      <div className="pl-5 pr-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Your briefing
            </span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Regenerate briefing"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="space-y-2 py-0.5">
            <div className="h-3.5 bg-muted rounded-full animate-pulse w-full" />
            <div className="h-3.5 bg-muted rounded-full animate-pulse w-[90%]" />
            <div className="h-3.5 bg-muted rounded-full animate-pulse w-[70%]" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load briefing.{" "}
            <button onClick={load} className="text-primary hover:underline">Try again</button>
          </p>
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}

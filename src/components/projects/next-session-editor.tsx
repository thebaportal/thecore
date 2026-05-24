"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateProject } from "@/actions/projects";
import { cn } from "@/lib/utils";

export function NextSessionEditor({
  projectId,
  initialValue,
  isInstructor,
}: {
  projectId: string;
  initialValue: string;
  isInstructor: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleSave() {
    const trimmed = value.trim();
    if (trimmed === saved) { setEditing(false); return; }
    startTransition(async () => {
      await updateProject(projectId, { nextSession: trimmed || null });
      setSaved(trimmed);
      setValue(trimmed);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setValue(saved); setEditing(false); }
  }

  if (!isInstructor) {
    return saved ? (
      <span className="text-sm font-semibold text-foreground">{saved}</span>
    ) : (
      <span className="text-sm text-muted-foreground/50 italic">TBD</span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="e.g. Mon Jun 9 · 7 PM"
          className="text-sm font-semibold bg-transparent border-b border-primary/40 outline-none text-foreground placeholder:text-muted-foreground/30 w-48 pb-0.5"
        />
        {isPending && <span className="text-[11px] text-muted-foreground/50">Saving…</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group text-left",
        saved
          ? "text-sm font-semibold text-foreground hover:text-primary transition-colors"
          : "text-sm italic text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
      )}
    >
      {saved || "Set next session…"}
      {saved && (
        <span className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/40 not-italic font-normal">
          edit
        </span>
      )}
    </button>
  );
}

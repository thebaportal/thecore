"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updatePhase } from "@/actions/phases";

export function PhaseTitleEditor({
  phaseId,
  initialName,
}: {
  phaseId: string;
  initialName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) { setValue(saved); setEditing(false); return; }
    if (trimmed === saved) { setEditing(false); return; }
    startTransition(async () => {
      await updatePhase(phaseId, { name: trimmed });
      setSaved(trimmed);
      setValue(trimmed);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setValue(saved); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        className="text-base font-semibold text-foreground leading-snug bg-muted/40 border border-primary/20 rounded-md px-2 py-0.5 outline-none focus:border-primary/40 transition-colors w-full"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left group flex items-center gap-1.5"
    >
      <h2 className="text-base font-semibold text-foreground leading-snug group-hover:text-foreground/80 transition-colors">
        {saved}
      </h2>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/50">
        edit
      </span>
    </button>
  );
}

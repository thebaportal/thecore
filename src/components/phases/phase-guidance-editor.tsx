"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updatePhase } from "@/actions/phases";

export function PhaseGuidanceEditor({
  phaseId,
  initialGuidance,
}: {
  phaseId: string;
  initialGuidance: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialGuidance);
  const [saved, setSaved] = useState(initialGuidance);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
      autoResize(ref.current);
    }
  }, [editing]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleSave() {
    const trimmed = value.trim();
    if (trimmed === saved) { setEditing(false); return; }
    startTransition(async () => {
      await updatePhase(phaseId, { guidance: trimmed });
      setSaved(trimmed);
      setValue(trimmed);
      setEditing(false);
    });
  }

  function handleCancel() {
    setValue(saved);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => { setValue(e.target.value); autoResize(e.target); }}
          rows={3}
          placeholder="Add phase guidance for the team…"
          className="w-full text-sm text-foreground/80 leading-relaxed bg-muted/40 border border-primary/20 rounded-lg px-3 py-2.5 outline-none resize-none placeholder:text-muted-foreground/40 focus:border-primary/40 transition-colors"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-left w-full group">
      {saved ? (
        <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors whitespace-pre-wrap">
          {saved}
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/50">
            edit
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic hover:text-muted-foreground/60 transition-colors">
          Add phase guidance…
        </p>
      )}
    </button>
  );
}

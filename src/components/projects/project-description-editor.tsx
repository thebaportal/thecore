"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateProject } from "@/actions/projects";
import { cn } from "@/lib/utils";

export function ProjectDescriptionEditor({
  projectId,
  initialDescription,
}: {
  projectId: string;
  initialDescription: string;
}) {
  const [editing,     setEditing]     = useState(false);
  const [value,       setValue]       = useState(initialDescription);
  const [savedValue,  setSavedValue]  = useState(initialDescription);
  const [isPending,   startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize(textareaRef.current);
    }
  }, [editing]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleSave() {
    const trimmed = value.trim();
    if (trimmed === savedValue) { setEditing(false); return; }
    startTransition(async () => {
      await updateProject(projectId, { description: trimmed });
      setSavedValue(trimmed);
      setValue(trimmed);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setValue(savedValue); setEditing(false); }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); autoResize(e.target); }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          rows={2}
          placeholder="Add a project description…"
          className="w-full text-sm text-foreground/80 leading-relaxed bg-muted/40 border border-primary/20 rounded-lg px-3 py-2.5 outline-none resize-none placeholder:text-muted-foreground/40 focus:border-primary/40 transition-colors"
        />
        <p className="text-[11px] text-muted-foreground/50">
          {isPending ? "Saving…" : "⌘↵ to save · Esc to cancel"}
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "text-left w-full group",
        savedValue
          ? "text-sm text-foreground/70 leading-relaxed hover:text-foreground/90 transition-colors"
          : "text-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors italic"
      )}
    >
      {savedValue || "Add a description…"}
      <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/50 not-italic">
        edit
      </span>
    </button>
  );
}

"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createTask } from "@/actions/tasks";
import { cn } from "@/lib/utils";

type Status = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export function InlineTaskInput({ projectId, status }: { projectId: string; status: Status }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function activate() {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function reset() {
    setActive(false);
    setValue("");
  }

  function submit() {
    const title = value.trim();
    if (!title) return reset();

    startTransition(async () => {
      await createTask({ projectId, title, status, priority: "MEDIUM" });
      setValue("");
      // stay active for rapid entry
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape") reset();
  }

  if (!active) {
    return (
      <button
        onClick={activate}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5 bg-accent/40 border-b border-border/50")}>
      <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (!isPending) reset(); }}
        placeholder="Task name"
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
      <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0">↵ to save · Esc to cancel</span>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateOrgPostCategories } from "@/actions/posts";
import type { PostCategory } from "@/lib/post-categories";
import { cn } from "@/lib/utils";

export function PostCategoriesEditor({ initial }: { initial: PostCategory[] }) {
  const [categories, setCategories] = useState<PostCategory[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addCategory() {
    setCategories((prev) => [...prev, { emoji: "", name: "" }]);
  }

  function removeCategory(i: number) {
    setCategories((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCategory(i: number, field: "emoji" | "name", value: string) {
    setCategories((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    );
  }

  function handleSave() {
    const valid = categories.filter((c) => c.name.trim());
    setError(null);
    startTransition(async () => {
      try {
        await updateOrgPostCategories(valid.map((c) => ({ emoji: c.emoji.trim(), name: c.name.trim() })));
        setCategories(valid.map((c) => ({ emoji: c.emoji.trim(), name: c.name.trim() })));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground/60 py-2">No categories yet. Add one below.</p>
        )}
        {categories.map((cat, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 cursor-grab" />
            <Input
              value={cat.emoji}
              onChange={(e) => updateCategory(i, "emoji", e.target.value)}
              placeholder="📢"
              className="w-[56px] text-center shrink-0 text-base px-2"
              maxLength={2}
            />
            <Input
              value={cat.name}
              onChange={(e) => updateCategory(i, "name", e.target.value)}
              placeholder="Category name"
              className="flex-1 text-sm"
            />
            <button
              onClick={() => removeCategory(i)}
              className="text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={addCategory}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add category
        </button>
        <div className="ml-auto flex items-center gap-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {saved ? "Saved!" : "Save categories"}
          </Button>
        </div>
      </div>
    </div>
  );
}

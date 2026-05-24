"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Eye, Edit3, Save, Loader2, Smile } from "lucide-react";
import Link from "next/link";
import { updateDoc } from "@/actions/docs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Doc = {
  id: string;
  projectId: string | null;
  title: string;
  content: string;
  emoji: string | null;
  updatedAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

const QUICK_EMOJIS = ["📝", "📌", "💡", "⚙️", "🎯", "📋", "🗒️", "📖", "🔍", "✅", "🚀", "⚠️"];

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-1.5 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2 text-foreground">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted text-foreground text-[0.85em] px-1 py-0.5 rounded font-mono">$1</code>')
    .replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^\s*\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-border pl-3 text-muted-foreground italic my-2">$1</blockquote>')
    .replace(/---/g, '<hr class="my-4 border-border" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n/g, '</p><p class="text-sm text-foreground leading-relaxed mt-3">')
    .replace(/\n/g, '<br />');
}

export function DocEditor({ doc, backHref }: { doc: Doc; backHref: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [emoji, setEmoji] = useState(doc.emoji ?? "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date>(new Date(doc.updatedAt));
  const [isDirty, setIsDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (newTitle: string, newContent: string, newEmoji: string) => {
      startTransition(async () => {
        await updateDoc(doc.id, {
          title: newTitle || "Untitled",
          content: newContent,
          emoji: newEmoji || null,
        });
        setLastSaved(new Date());
        setIsDirty(false);
      });
    },
    [doc.id]
  );

  function scheduleSave(newTitle: string, newContent: string, newEmoji: string) {
    setIsDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(newTitle, newContent, newEmoji), 1500);
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    scheduleSave(val, content, emoji);
  }

  function handleContentChange(val: string) {
    setContent(val);
    scheduleSave(title, val, emoji);
  }

  function handleEmojiPick(e: string) {
    setEmoji(e);
    setEmojiOpen(false);
    scheduleSave(title, content, e);
  }

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  return (
    <div className="flex flex-col pb-8 max-w-3xl">
      {/* Back + toolbar */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isPending ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
            ) : isDirty ? (
              "Unsaved changes"
            ) : (
              `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`
            )}
          </span>

          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setMode("edit")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                mode === "edit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                mode === "preview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => save(title, content, emoji)}
            disabled={isPending || !isDirty}
            className="gap-1.5 h-8"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Title area */}
      <div className="flex items-start gap-3 mb-6">
        {/* Emoji picker */}
        <div className="relative mt-1">
          <button
            onClick={() => setEmojiOpen((v) => !v)}
            className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-xl transition-colors shrink-0"
            title="Set emoji"
          >
            {emoji || <Smile className="w-5 h-5 text-muted-foreground" />}
          </button>

          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg p-2 grid grid-cols-6 gap-1 w-52">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleEmojiPick(e)}
                    className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-base transition-colors"
                  >
                    {e}
                  </button>
                ))}
                {emoji && (
                  <button
                    onClick={() => handleEmojiPick("")}
                    className="col-span-6 text-xs text-muted-foreground hover:text-foreground px-2 py-1 hover:bg-muted rounded-lg transition-colors mt-1"
                  >
                    Remove emoji
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="flex-1 text-2xl font-semibold text-foreground bg-transparent border-0 outline-none placeholder:text-muted-foreground/50 min-w-0"
        />
      </div>

      {/* Editor / Preview */}
      {mode === "edit" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-1 py-1.5 border-b border-border bg-muted/40 flex items-center gap-1 flex-wrap">
            {[
              ["**B**", "**", "Bold"],
              ["*I*", "*", "Italic"],
              ["`</>` Code", "`", "Inline code"],
              ["# H1", "# ", "Heading 1"],
              ["## H2", "## ", "Heading 2"],
              ["- List", "- ", "Bullet list"],
              ["> Quote", "> ", "Blockquote"],
            ].map(([label, syntax, title]) => (
              <button
                key={label}
                title={title}
                onClick={() => {
                  const next = content + (content ? "\n" : "") + syntax;
                  handleContentChange(next);
                }}
                className="px-2 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing… (Markdown supported)"
            className="w-full min-h-[400px] p-4 text-sm font-mono text-foreground bg-transparent outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 min-h-[400px]">
          {content ? (
            <div
              className="prose-custom text-sm text-foreground leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: `<p class="text-sm text-foreground leading-relaxed">${renderMarkdown(content)}</p>`,
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">No content yet</p>
              <p className="text-xs text-muted-foreground/70 max-w-xs">
                Switch to Edit mode and start writing, or this doc may have been imported as a file — check the Files tab.
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Created by {doc.author.name} · Supports Markdown
      </p>
    </div>
  );
}

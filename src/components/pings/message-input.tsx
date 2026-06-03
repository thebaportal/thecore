"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Send, Loader2, X, Smile, Paperclip, FileText, ImageIcon } from "lucide-react";
import { sendMessage } from "@/actions/pings";
import { getOrgMembers } from "@/actions/tasks";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["😊", "👍", "❤️", "😂", "🎉", "🙏", "🔥", "👀", "✅", "💡", "🤔", "😅"];

type Member = { id: string; name: string; avatarUrl: string | null };

function getMentionQuery(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/@(\w*)$/);
  if (!match) return null;
  return { query: match[1] ?? "", start: before.length - match[0].length };
}

export function MessageInput({
  pingId,
  members = [],
  replyingTo,
  defaultThreadParentId,
  onCancelReply,
}: {
  pingId: string;
  members?: Member[];
  replyingTo?: { id: string; authorName: string; body: string } | null;
  defaultThreadParentId?: string;
  onCancelReply?: () => void;
}) {
  type PendingAttachment = { url: string; name: string; mimeType: string; size: number };

  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [allOrgMembers, setAllOrgMembers] = useState<Member[]>([]);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getOrgMembers().then(setAllOrgMembers);
  }, []);

  const { startUpload, isUploading } = useUploadThing("messageAttachmentUploader", {
    onClientUploadComplete: (res) => {
      if (!res) return;
      const newAtts: PendingAttachment[] = res.map((f) => ({
        url: f.url,
        name: f.name,
        mimeType: f.type ?? "application/octet-stream",
        size: f.size,
      }));
      setPendingAttachments((prev) => [...prev, ...newAtts]);
    },
  });

  function submit() {
    const body = value.trim();
    if ((!body && pendingAttachments.length === 0) || isPending || isUploading) return;

    startTransition(async () => {
      await sendMessage({
        pingId,
        body: body || "📎",
        threadParentId: replyingTo?.id ?? defaultThreadParentId,
        attachments: pendingAttachments,
      });
      setValue("");
      setPendingAttachments([]);
      onCancelReply?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    });
  }

  const mentionSource = allOrgMembers.length > 0 ? allOrgMembers : members;
  const filteredMembers = mentionQuery
    ? mentionSource.filter((m) => m.name.toLowerCase().includes(mentionQuery.query.toLowerCase())).slice(0, 6)
    : [];

  function onKeyDown(e: React.KeyboardEvent) {
    if (mentionQuery && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % filteredMembers.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const m = filteredMembers[mentionIndex];
        if (m) insertMention(m);
        return;
      }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    // Check for @mention trigger
    const cursor = el.selectionStart ?? next.length;
    const mq = getMentionQuery(next, cursor);
    setMentionQuery(mq);
    setMentionIndex(0);
  }

  function insertMention(member: Member) {
    const el = textareaRef.current;
    if (!el || !mentionQuery) return;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, mentionQuery.start);
    const after = value.slice(cursor);
    const next = `${before}@${member.name} ${after}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + member.name.length + 2;
      el.setSelectionRange(pos, pos);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    });
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setValue((v) => v + emoji);
      setEmojiOpen(false);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    setValue(next);
    setEmojiOpen(false);
    // Restore focus + cursor after emoji insert
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    });
  }

  return (
    <div className="relative px-4 py-3.5 border-t border-border/50 bg-background/95 backdrop-blur-sm shrink-0">
      {/* Reply context */}
      {replyingTo && (
        <div className="flex items-start gap-2 mb-2.5 px-3 py-2 rounded-xl bg-muted/60 border-l-2 border-primary/50">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-primary text-xs">{replyingTo.authorName}</span>
            <p className="text-muted-foreground text-xs truncate mt-0.5">{replyingTo.body}</p>
          </div>
          <button onClick={onCancelReply} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) startUpload(files, { pingId });
          e.target.value = "";
        }}
      />

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingAttachments.map((att, i) => {
            const isImage = att.mimeType.startsWith("image/");
            return (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground max-w-[200px]">
                {isImage ? <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" /> : <FileText className="w-3 h-3 text-muted-foreground shrink-0" />}
                <span className="truncate">{att.name}</span>
                <button onClick={() => setPendingAttachments((p) => p.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-foreground ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* @mention dropdown */}
      {mentionQuery && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-border/60">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Mention someone</span>
          </div>
          {filteredMembers.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                i === mentionIndex ? "bg-primary/8 text-primary" : "hover:bg-muted text-foreground"
              )}
            >
              {m.avatarUrl
                ? <img src={m.avatarUrl} alt={m.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">{m.name[0]?.toUpperCase()}</div>
              }
              <span className="text-sm truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className={cn(
        "flex items-end gap-1 rounded-2xl border bg-muted/30 transition-colors pl-2 pr-1.5 py-1.5",
        "border-border/60 focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm"
      )}>
        {/* Attach file */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-0.5 disabled:opacity-50"
          tabIndex={-1}
          title="Attach file"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>

        {/* Emoji picker */}
        <div className="relative shrink-0 mb-0.5">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-xl transition-colors",
              emojiOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            tabIndex={-1}
          >
            <Smile className="w-4 h-4" />
          </button>

          {emojiOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
              <div className="absolute left-0 bottom-full mb-2 z-50 p-2 rounded-2xl border border-border bg-card shadow-xl">
                <div className="grid grid-cols-6 gap-0.5">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-lg hover:bg-muted transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={autoResize}
          onKeyDown={onKeyDown}
          placeholder={
            replyingTo
              ? `Replying to ${replyingTo.authorName}…`
              : defaultThreadParentId
              ? "Add a reply…"
              : "Message…"
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none min-h-[36px] max-h-40 py-1.5 leading-relaxed px-1"
          disabled={isPending}
        />

        <button
          onClick={submit}
          disabled={(!value.trim() && pendingAttachments.length === 0) || isPending || isUploading}
          className={cn(
            "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center transition-all mb-0.5",
            (value.trim() || pendingAttachments.length > 0) && !isPending && !isUploading
              ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Send className="w-3.5 h-3.5" />
          }
        </button>
      </div>
    </div>
  );
}

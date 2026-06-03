"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isThisYear, isYesterday } from "date-fns";
import { SmilePlus, Paperclip, ChevronDown, ChevronUp, Trash2, Pencil, Check, X } from "lucide-react";
import { addReaction, deleteMessage, editMessage } from "@/actions/pings";
import { UserCard } from "@/components/users/user-card";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["👍", "❤️", "😄", "🎉", "🤔", "👀"];

export type Attachment = { id: string; name: string; url: string; mimeType: string };

export type ChatMessageData = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt?: Date | null;
  author: { id: string; name: string; avatarUrl: string | null };
  reactions: { emoji: string; user: { id: string; name: string } }[];
  attachments: Attachment[];
};

export function formatMsgTime(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  if (isThisYear(d)) return format(d, "MMM d, h:mm a");
  return format(d, "MMM d yyyy, h:mm a");
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted transition-colors text-xs text-foreground max-w-[220px]"
        >
          <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="truncate">{att.name}</span>
        </a>
      ))}
    </div>
  );
}

function renderMention(name: string, display: string, membersByName: Record<string, string>, key: number): React.ReactNode {
  const userId = membersByName[name];
  const chip = <span className="text-primary font-semibold cursor-pointer hover:underline">@{name}</span>;
  if (userId) return <UserCard key={key} userId={userId} side="top" align="center">{chip}</UserCard>;
  return <span key={key} className="text-primary font-semibold">{display}</span>;
}

function renderInline(text: string, membersByName?: Record<string, string>): React.ReactNode[] {
  // Split on markdown bold/italic AND plain @mentions
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|@\S+(?:\s+\S+){0,3})/g);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;

    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      if (inner.startsWith("@") && membersByName) {
        nodes.push(renderMention(inner.slice(1), inner, membersByName, i));
      } else {
        nodes.push(<strong key={i}>{inner}</strong>);
      }
      continue;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
      continue;
    }

    if (part.startsWith("@") && membersByName) {
      // Try progressively shorter suffixes until we find a member name match
      // e.g. "@Omojo Amanyi extra" → try "Omojo Amanyi extra", "Omojo Amanyi", "Omojo"
      const words = part.slice(1).split(" ");
      let matched = false;
      for (let len = words.length; len >= 1; len--) {
        const candidate = words.slice(0, len).join(" ");
        if (membersByName[candidate]) {
          const remainder = words.slice(len).join(" ");
          nodes.push(renderMention(candidate, `@${candidate}`, membersByName, i));
          if (remainder) nodes.push(` ${remainder}`);
          matched = true;
          break;
        }
      }
      if (!matched) nodes.push(part);
      continue;
    }

    nodes.push(part);
  }

  return nodes;
}

function MarkdownBody({ text, className, membersByName }: { text: string; className?: string; membersByName?: Record<string, string> }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={i} className="border-l-2 border-muted-foreground/40 pl-2 my-1 text-muted-foreground italic text-[0.9em]">
          {quoteLines.map((ql, qi) => <span key={qi}>{renderInline(ql, membersByName)}{qi < quoteLines.length - 1 && <br />}</span>)}
        </blockquote>
      );
    } else {
      nodes.push(<span key={i}>{renderInline(line, membersByName)}</span>);
      i++;
      if (i < lines.length) nodes.push(<br key={`br-${i}`} />);
    }
  }
  return <div className={className}>{nodes}</div>;
}

function MessageBody({ body, attachments, isOwn, membersByName }: { body: string; attachments: Attachment[]; isOwn: boolean; membersByName?: Record<string, string> }) {
  const isLong = body.length > 500;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
      isOwn
        ? "bg-primary/10 text-foreground rounded-tl-sm"
        : "bg-muted/70 text-foreground rounded-tl-sm",
    )}>
      <div className="relative">
        <MarkdownBody text={body} membersByName={membersByName} className={cn(
          "break-words whitespace-pre-wrap",
          isLong && !expanded && "line-clamp-6"
        )} />
        {isLong && !expanded && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t to-transparent pointer-events-none",
            isOwn ? "from-primary/10" : "from-muted/70"
          )} />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 mt-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors"
        >
          {expanded
            ? <><ChevronUp className="w-3 h-3" /> Show less</>
            : <><ChevronDown className="w-3 h-3" /> Show more</>}
        </button>
      )}
      <AttachmentList attachments={attachments} />
    </div>
  );
}

function InlineEdit({ messageId, initialBody, onDone }: { messageId: string; initialBody: string; onDone: () => void }) {
  const [value, setValue] = useState(initialBody);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(value.length, value.length);
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, []);

  function save() {
    if (!value.trim() || isPending) return;
    startTransition(async () => {
      await editMessage(messageId, value);
      onDone();
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === "Escape") onDone();
  }

  return (
    <div className="flex flex-col gap-1.5 max-w-[85%]">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={onKeyDown}
        rows={1}
        className="w-full resize-none rounded-xl border border-primary/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 focus:shadow-sm leading-relaxed"
        disabled={isPending}
      />
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>Enter to save · Esc to cancel</span>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={onDone} className="flex items-center gap-0.5 px-2 py-0.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={save}
            disabled={!value.trim() || isPending}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  prevMessage,
  currentUserId,
  membersByName,
  onReply,
}: {
  message: ChatMessageData;
  prevMessage?: ChatMessageData;
  currentUserId: string;
  membersByName?: Record<string, string>;
  onReply?: (id: string) => void;
}) {
  const router = useRouter();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isOwn = message.author.id === currentUserId;

  const sameAuthor = prevMessage?.author.id === message.author.id;
  const closeInTime =
    prevMessage &&
    new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000;
  const grouped = sameAuthor && closeInTime;

  const reactionGroups = message.reactions.reduce<
    Record<string, { emoji: string; count: number; names: string[]; mine: boolean }>
  >((acc, r) => {
    if (acc[r.emoji]) {
      acc[r.emoji]!.count++;
      acc[r.emoji]!.names.push(r.user.name);
      if (r.user.id === currentUserId) acc[r.emoji]!.mine = true;
    } else {
      acc[r.emoji] = { emoji: r.emoji, count: 1, names: [r.user.name], mine: r.user.id === currentUserId };
    }
    return acc;
  }, {});

  function handleReact(emoji: string) {
    setEmojiOpen(false);
    startTransition(async () => { await addReaction(message.id, emoji); });
  }

  function handleDelete() {
    if (!confirm("Delete this message?")) return;
    startTransition(async () => {
      await deleteMessage(message.id);
      router.refresh();
    });
  }

  return (
    <div className={cn(
      "group flex gap-3 px-4 transition-colors",
      grouped ? "pt-0.5 pb-0.5" : "pt-5 pb-0.5",
      isOwn ? "hover:bg-primary/[0.04]" : "hover:bg-muted/25",
    )}>
      {/* Avatar / timestamp spacer */}
      <div className="w-10 shrink-0 flex flex-col items-center">
        {!grouped ? (
          <UserCard userId={message.author.id} side="right" align="start">
            {message.author.avatarUrl
              ? <img src={message.author.avatarUrl} alt={message.author.name} className="w-10 h-10 rounded-full object-cover cursor-pointer shrink-0 ring-1 ring-border/50" />
              : <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold cursor-pointer shrink-0",
                  isOwn
                    ? "bg-primary/15 text-primary ring-2 ring-primary/20"
                    : "bg-muted text-foreground ring-1 ring-border"
                )}>
                  {message.author.name[0]?.toUpperCase()}
                </div>
            }
          </UserCard>
        ) : (
          <span className="hidden group-hover:flex items-start justify-end w-full text-[9px] text-muted-foreground/60 pt-1.5 pr-0.5 leading-none">
            {format(new Date(message.createdAt), "h:mm")}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-0.5">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-2">
            <span className={cn(
              "text-[13px] font-semibold leading-none",
              isOwn ? "text-primary" : "text-foreground"
            )}>
              {message.author.name}
            </span>
            <span className="text-[10px] text-muted-foreground/60 font-normal">{formatMsgTime(message.createdAt)}</span>
          </div>
        )}

        {editing ? (
          <InlineEdit messageId={message.id} initialBody={message.body} onDone={() => setEditing(false)} />
        ) : (
          <>
            {/* Bubble + hover actions sit inline so actions are right next to the text */}
            <div className="flex items-center gap-2">
              <div className="min-w-0 max-w-[85%]">
                <MessageBody body={message.body} attachments={message.attachments} isOwn={isOwn} membersByName={membersByName} />
                {message.editedAt && (
                  <span className="text-[9px] text-muted-foreground/50 mt-0.5 ml-1 select-none">(edited)</span>
                )}
              </div>

              {/* Hover actions */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-xl shadow-md px-1.5 py-0.5 shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setEmojiOpen((v) => !v)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <SmilePlus className="w-3.5 h-3.5" />
                  </button>
                  {emojiOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
                      <div className="absolute left-0 top-full mt-1.5 z-50 flex gap-1 p-2 rounded-2xl border border-border bg-card shadow-xl">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button key={emoji} onClick={() => handleReact(emoji)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-base hover:bg-muted transition-colors">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {onReply && (
                  <button
                    onClick={() => onReply(message.id)}
                    className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Reply
                  </button>
                )}
                {isOwn && (
                  <button
                    onClick={() => setEditing(true)}
                    title="Edit message"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {isOwn && (
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    title="Delete message"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Reactions */}
            {Object.keys(reactionGroups).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.values(reactionGroups).map((r) => (
                  <button
                    key={r.emoji}
                    onClick={() => handleReact(r.emoji)}
                    disabled={isPending}
                    title={r.names.join(", ")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-colors",
                      r.mine
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border bg-muted/60 text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {r.emoji} <span className="text-[11px]">{r.count}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

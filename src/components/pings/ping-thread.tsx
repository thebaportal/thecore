"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { format, isToday, isThisYear, isYesterday } from "date-fns";
import { Sparkles, X, Loader2, CheckSquare, MessageSquare, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { summarizePingThread, suggestTasksFromPing } from "@/actions/ai";
import { createTask } from "@/actions/tasks";
import { MessageBubble, type ChatMessageData, type Attachment, formatMsgTime } from "./message-bubble";
import { MessageInput } from "./message-input";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = ChatMessageData & {
  threadReplies: (ChatMessageData)[];
};

type AIPanel =
  | { type: "summary"; content: string }
  | { type: "tasks"; items: string[]; projectId: string | null }
  | null;

// ── Date separator ────────────────────────────────────────────────────────────

function formatDateLabel(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisYear(d)) return format(d, "MMMM d");
  return format(d, "MMMM d, yyyy");
}

function isSameDay(a: Date, b: Date): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 select-none">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Context Card (original post for discussion threads) ───────────────────────

function ContextCard({ message }: { message: Message }) {
  const isLong = message.body.length > 500;
  const [expanded, setExpanded] = useState(!isLong);

  return (
    <div className="mx-4 mt-4 mb-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{message.author.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">posted</span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{formatMsgTime(message.createdAt)}</span>
      </div>

      {/* Body */}
      <div className="relative">
        <div className={cn("px-4 py-3 overflow-hidden", !expanded && "max-h-40")}>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {message.body}
          </p>
        </div>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand / collapse */}
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-center gap-1 w-full px-4 py-2 text-[11px] text-primary hover:bg-muted/40 transition-colors border-t border-border/60"
        >
          {expanded
            ? <><ChevronUp className="w-3 h-3" /> Show less</>
            : <><ChevronDown className="w-3 h-3" /> Read full post</>}
        </button>
      )}

      {/* Attachments */}
      {message.attachments.length > 0 && (
        <div className="px-4 py-2.5 border-t border-border/60 flex flex-wrap gap-1.5">
          {message.attachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/60 hover:bg-muted text-xs text-foreground transition-colors max-w-[220px]"
            >
              <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">{att.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Panel ──────────────────────────────────────────────────────────────────

function AIResultPanel({
  panel,
  projectId,
  onClose,
  onCreateTask,
  creatingTask,
  createdTasks,
}: {
  panel: AIPanel;
  projectId?: string | null;
  onClose: () => void;
  onCreateTask: (title: string) => void;
  creatingTask: string | null;
  createdTasks: Set<string>;
}) {
  if (!panel) return null;
  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl overflow-hidden border border-primary/25 shadow-sm shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-primary/8 border-b border-primary/15">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary tracking-wide">
            AI · {panel.type === "summary" ? "Summary" : "Suggested Tasks"}
          </span>
        </div>
        <button onClick={onClose} className="text-primary/50 hover:text-primary transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 bg-card">
        {panel.type === "summary" && (
          <p className="text-sm text-foreground leading-relaxed">{panel.content}</p>
        )}

        {panel.type === "tasks" && (
          <div className="space-y-2">
            {panel.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clear action items found.</p>
            ) : (
              panel.items.map((item) => {
                const done = createdTasks.has(item);
                return (
                  <div key={item} className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", done ? "bg-emerald-400" : "bg-primary/40")} />
                    <span className={cn("text-sm flex-1", done && "text-muted-foreground line-through")}>{item}</span>
                    {projectId && !done && (
                      <button
                        onClick={() => onCreateTask(item)}
                        disabled={creatingTask === item}
                        className="flex items-center gap-1 text-[10px] text-primary px-1.5 py-0.5 rounded border border-primary/20 hover:bg-primary/5 transition-colors shrink-0"
                      >
                        {creatingTask === item
                          ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          : <CheckSquare className="w-2.5 h-2.5" />}
                        Add
                      </button>
                    )}
                    {done && <span className="text-[10px] text-emerald-600 shrink-0">Created</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main PingThread component ─────────────────────────────────────────────────

type Member = { id: string; name: string; avatarUrl: string | null };

export function PingThread({
  pingId,
  pingType,
  projectId,
  projectName,
  members = [],
  messages,
  currentUserId,
}: {
  pingId: string;
  pingType?: "DIRECT" | "GROUP" | "CONTEXTUAL";
  projectId?: string | null;
  projectName?: string;
  members?: Member[];
  messages: Message[];
  currentUserId: string;
}) {
  const isDiscussion = pingType === "CONTEXTUAL" || (pingType === undefined && Boolean(projectId));

  // For discussions: first message is the context card, replies are the chat stream.
  // For DMs: all messages are the chat stream.
  const contextMsg = isDiscussion && messages.length > 0 ? messages[0] : null;

  const chatStream: ChatMessageData[] = (() => {
    if (isDiscussion && contextMsg) {
      // Flatten: replies to the original post + any subsequent top-level messages
      const replies = (contextMsg.threadReplies ?? []) as ChatMessageData[];
      const topLevel = messages.slice(1) as ChatMessageData[];
      return [...replies, ...topLevel].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    return messages as ChatMessageData[];
  })();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll to bottom instantly on first mount
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Smooth-scroll on new messages, only when already near the bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatStream.length, isAtBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; body: string } | null>(null);
  const [aiPanel, setAiPanel] = useState<AIPanel>(null);
  const [isAiPending, startAiTransition] = useTransition();
  const [creatingTask, setCreatingTask] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Set<string>>(new Set());

  function handleReply(messageId: string) {
    const msg = chatStream.find((m) => m.id === messageId) ?? (contextMsg?.id === messageId ? contextMsg : null);
    if (!msg) return;
    setReplyingTo({ id: msg.id, authorName: msg.author.name, body: msg.body });
  }

  function handleSummarize() {
    startAiTransition(async () => {
      try {
        const summary = await summarizePingThread(pingId);
        setAiPanel({ type: "summary", content: summary });
      } catch {
        setAiPanel({ type: "summary", content: "Failed to generate summary. Please try again." });
      }
    });
  }

  function handleSuggestTasks() {
    startAiTransition(async () => {
      try {
        const items = await suggestTasksFromPing(pingId);
        setAiPanel({ type: "tasks", items, projectId: projectId ?? null });
      } catch {
        setAiPanel({ type: "tasks", items: [], projectId: projectId ?? null });
      }
    });
  }

  async function handleCreateTask(title: string) {
    if (!projectId) return;
    setCreatingTask(title);
    try {
      await createTask({ title, projectId, priority: "MEDIUM", status: "TODO" });
      setCreatedTasks((prev) => new Set([...prev, title]));
    } finally {
      setCreatingTask(null);
    }
  }

  const hasContent = messages.length > 0;

  const participants = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; avatarUrl: string | null }> = [];
    for (const msg of [...(contextMsg ? [contextMsg as ChatMessageData] : []), ...chatStream]) {
      if (!seen.has(msg.author.id)) {
        seen.add(msg.author.id);
        result.push(msg.author);
      }
    }
    return result;
  }, [chatStream, contextMsg]);

  // Always prefer the full project member list; fall back to message authors if not provided
  const headerPeople: Member[] = useMemo(() => {
    if (members.length > 0) return members;
    return participants;
  }, [participants, members]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header: participants + AI actions ── */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border bg-background shrink-0 min-h-[34px]">
        {headerPeople.length > 0 ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex -space-x-1.5">
              {headerPeople.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="w-5 h-5 rounded-full ring-1 ring-background overflow-hidden bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground shrink-0"
                  title={p.name}
                >
                  {p.avatarUrl
                    ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                    : p.name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {headerPeople.length} {headerPeople.length === 1 ? "person" : "people"}
            </span>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {hasContent && (
          <div className="flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-primary/40 shrink-0 mr-0.5" />
            <button
              onClick={handleSummarize}
              disabled={isAiPending}
              className="text-xs text-muted-foreground hover:text-primary px-2 py-0.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            >
              Summarize
            </button>
            {projectId && (
              <button
                onClick={handleSuggestTasks}
                disabled={isAiPending}
                className="text-xs text-muted-foreground hover:text-primary px-2 py-0.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              >
                Suggest tasks
              </button>
            )}
            {isAiPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
          </div>
        )}
      </div>

      {/* ── Scrollable area ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 flex flex-col"
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-8 py-16">
            {/* Member avatars */}
            {headerPeople.length > 0 && (
              <div className="flex -space-x-2 mb-5">
                {headerPeople.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="w-9 h-9 rounded-full ring-2 ring-background overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0"
                    title={p.name}
                  >
                    {p.avatarUrl
                      ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                      : p.name[0]?.toUpperCase()}
                  </div>
                ))}
                {headerPeople.length > 5 && (
                  <div className="w-9 h-9 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                    +{headerPeople.length - 5}
                  </div>
                )}
              </div>
            )}
            <p className="text-sm font-semibold text-foreground mb-1.5">
              {pingType === "DIRECT" && headerPeople.length > 0
                ? `Message ${headerPeople.find((p) => p.id !== currentUserId)?.name ?? headerPeople[0]?.name ?? ""}`
                : projectName
                ? `Welcome to ${projectName} chat`
                : "No messages yet"}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {pingType === "DIRECT"
                ? "This is just the two of you. Ask a question, share an update, or just say hi."
                : headerPeople.length > 0
                ? `${headerPeople.length} ${headerPeople.length === 1 ? "person" : "people"} in this conversation. Send a message to get started.`
                : "Start the conversation below."}
            </p>
          </div>
        ) : (
          <>
            {/* Spacer: pushes messages to the bottom when the chat is short */}
            <div className="flex-1" />

            {/* Context card (original post) */}
            {contextMsg && <ContextCard message={contextMsg} />}

            {/* AI result panel — single render, no duplicate */}
            {aiPanel && (
              <AIResultPanel
                panel={aiPanel}
                projectId={projectId}
                onClose={() => setAiPanel(null)}
                onCreateTask={handleCreateTask}
                creatingTask={creatingTask}
                createdTasks={createdTasks}
              />
            )}

            {/* Replies divider */}
            {contextMsg && chatStream.length > 0 && (
              <div className="flex items-center gap-3 px-4 pt-4 pb-1 select-none">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {chatStream.length} {chatStream.length === 1 ? "reply" : "replies"}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
            )}

            <div className="pb-4">
              {chatStream.length === 0 && contextMsg ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No replies yet — add one below.
                </p>
              ) : (
                chatStream.map((msg, i) => {
                  const prev = chatStream[i - 1];
                  const showDateSep = !prev || !isSameDay(new Date(prev.createdAt), new Date(msg.createdAt));
                  return (
                    <div key={msg.id}>
                      {showDateSep && <DateSeparator date={new Date(msg.createdAt)} />}
                      <MessageBubble
                        message={msg}
                        prevMessage={showDateSep ? undefined : prev}
                        currentUserId={currentUserId}
                        onReply={handleReply}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div ref={bottomRef} className="h-1" />
          </>
        )}
      </div>

      {/* ── Input ── */}
      <MessageInput
        pingId={pingId}
        members={members}
        replyingTo={replyingTo}
        defaultThreadParentId={isDiscussion && contextMsg ? contextMsg.id : undefined}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
}

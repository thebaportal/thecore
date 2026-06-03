"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Megaphone, Plus, Trash2, Loader2, X, AlertTriangle, ChevronDown } from "lucide-react";
import { createAnnouncement, deleteAnnouncement } from "@/actions/announcements";
import { RichText } from "@/components/shared/rich-text";

type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null };
};

function NewAnnouncementDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function handleSubmit() {
    if (!title.trim() || !body.trim()) { setError("Title and message are required."); return; }
    setError(null);
    start(async () => {
      try {
        await createAnnouncement({ title, body });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">New Announcement</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Nova Kitchen Appliance — Project Launch"
              disabled={isPending}
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement here…"
              rows={6}
              disabled={isPending}
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Megaphone className="w-3.5 h-3.5 shrink-0" />
          Everyone in the organisation will receive this in their notifications.
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !title.trim() || !body.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Megaphone className="w-4 h-4" /> Send to everyone</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ onConfirm, onCancel, pending }: { onConfirm: () => void; onCancel: () => void; pending: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Delete announcement?</p>
            <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={pending} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={pending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}


export function AnnouncementsView({ announcements, isAdmin }: { announcements: Announcement[]; isAdmin: boolean }) {
  const [showNew, setShowNew]           = useState(false);
  const [confirmId, setConfirmId]       = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [isPending, start]              = useTransition();

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDelete(id: string) {
    start(async () => {
      await deleteAnnouncement(id);
      setConfirmId(null);
    });
  }

  return (
    <div className="max-w-2xl space-y-6 pb-16">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Company-wide updates sent to everyone.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Announcement
          </button>
        )}
      </div>

      {/* List */}
      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No announcements yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin ? "Post your first announcement — everyone in the org will be notified." : "Check back later for company-wide updates."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => {
            const isOpen = expanded.has(a.id);
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header — always visible, click to expand */}
                <button
                  onClick={() => toggle(a.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  {a.author.avatarUrl ? (
                    <img src={a.author.avatarUrl} alt={a.author.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {a.author.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate leading-snug">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.author.name}
                      <span className="ml-1.5" title={format(new Date(a.createdAt), "PPPp")}>
                        · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmId(a.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Body — shown when expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/50">
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap pl-11">
                      <RichText text={a.body} />
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewAnnouncementDialog onClose={() => setShowNew(false)} />}

      {confirmId && (
        <DeleteConfirm
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          pending={isPending}
        />
      )}
    </div>
  );
}

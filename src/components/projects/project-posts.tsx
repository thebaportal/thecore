"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pin, Trash2, Plus, Loader2, Pencil, Copy, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createProjectPost, updateProjectPost, togglePinPost, deleteProjectPost } from "@/actions/posts";
import type { PostCategory } from "@/lib/post-categories";
import { UserAvatar } from "@/components/users/user-avatar";
import { cn } from "@/lib/utils";

type Reply = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
};

type Post = {
  id: string;
  title: string;
  body: string;
  pinnedAt: Date | null;
  category: string | null;
  instructorOnly: boolean;
  createdAt: Date;
  author: { id: string; name: string; avatarUrl: string | null };
  replies: Reply[];
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline break-all hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CategoryBadge({ category, emoji }: { category: string; emoji?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground shrink-0">
      {emoji && <span>{emoji}</span>}
      {category}
    </span>
  );
}

export function ProjectPosts({
  projectId,
  initialPosts,
  isInstructor,
  currentUserId,
  currentUserAvatarUrl,
  categories,
}: {
  projectId: string;
  initialPosts: Post[];
  isInstructor: boolean;
  currentUserId: string;
  currentUserAvatarUrl: string | null;
  categories: PostCategory[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", category: "", instructorOnly: false });
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", category: "", instructorOnly: false });
  const [editError, setEditError] = useState<string | null>(null);

  const [isPinPending, startPinTransition] = useTransition();
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => { setPosts(initialPosts); }, [initialPosts]);

  const categoryMap = new Map(categories.map((c) => [c.name, c.emoji]));

  const usedCategories = [...new Set(posts.map((p) => p.category).filter(Boolean) as string[])];

  const filtered = activeFilter ? posts.filter((p) => p.category === activeFilter) : posts;
  const pinned   = filtered.filter((p) => p.pinnedAt);
  const unpinned = filtered.filter((p) => !p.pinnedAt);

  function handleCreate() {
    if (!form.title.trim()) return;
    setCreateError(null);
    startTransition(async () => {
      try {
        await createProjectPost(projectId, {
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category || null,
          instructorOnly: form.instructorOnly,
        });
        setForm({ title: "", body: "", category: "", instructorOnly: false });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : "Failed to post. Please try again.");
      }
    });
  }

  function handleEditOpen(post: Post) {
    setEditingPost(post);
    setEditForm({ title: post.title, body: post.body, category: post.category ?? "", instructorOnly: post.instructorOnly });
    setEditError(null);
  }

  function handleEditSave() {
    if (!editingPost || !editForm.title.trim()) return;
    setEditError(null);
    startTransition(async () => {
      try {
        await updateProjectPost(editingPost.id, {
          title: editForm.title.trim(),
          body: editForm.body.trim(),
          category: editForm.category || null,
          instructorOnly: editForm.instructorOnly,
        });
        setEditingPost(null);
        router.refresh();
      } catch (e) {
        setEditError(e instanceof Error ? e.message : "Failed to update post.");
      }
    });
  }

  function handlePin(postId: string) {
    setPinError(null);
    startPinTransition(async () => {
      try {
        await togglePinPost(projectId, postId);
        router.refresh();
      } catch (e) {
        setPinError(e instanceof Error ? e.message : "Failed to pin post.");
      }
    });
  }

  function handleDelete(postId: string) {
    startTransition(async () => {
      await deleteProjectPost(projectId, postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    });
  }

  return (
    <div className="max-w-2xl pb-16 space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        {/* Category filter strip */}
        {usedCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                !activeFilter
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              All
            </button>
            {usedCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  activeFilter === cat
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {categoryMap.get(cat) && <span className="mr-1">{categoryMap.get(cat)}</span>}
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto shrink-0">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Post
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground/40">
            {activeFilter ? `No posts in "${activeFilter}".` : "No posts yet."}
          </p>
        </div>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
            <Pin className="h-2.5 w-2.5" /> Pinned
          </p>
          {pinned.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryEmoji={post.category ? categoryMap.get(post.category) : undefined}
              expanded={expanded === post.id}
              onToggle={() => setExpanded(expanded === post.id ? null : post.id)}
              isInstructor={isInstructor}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              onEdit={() => handleEditOpen(post)}
              onPin={() => handlePin(post.id)}
              onDelete={() => handleDelete(post.id)}
              pinError={pinError}
              pinned
            />
          ))}
        </div>
      )}

      {/* Unpinned */}
      {unpinned.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Recent</p>
          )}
          {unpinned.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              categoryEmoji={post.category ? categoryMap.get(post.category) : undefined}
              expanded={expanded === post.id}
              onToggle={() => setExpanded(expanded === post.id ? null : post.id)}
              isInstructor={isInstructor}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              onEdit={() => handleEditOpen(post)}
              onPin={() => handlePin(post.id)}
              onDelete={() => handleDelete(post.id)}
              pinError={pinError}
              pinned={false}
            />
          ))}
        </div>
      )}

      {/* New post dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
              <Input
                placeholder="e.g. Kick-off meeting recap"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
              <Textarea
                rows={6}
                placeholder="Write your post…"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="text-sm resize-none"
              />
            </div>
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: "" }))}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                      !form.category
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20",
                    )}
                  >
                    None
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: c.name }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        form.category === c.name
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20",
                      )}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isInstructor && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.instructorOnly}
                  onChange={(e) => setForm((f) => ({ ...f, instructorOnly: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">Instructor only</span>
                <span className="text-xs text-muted-foreground">— hidden from students</span>
              </label>
            )}
          </div>
          <DialogFooter>
            {createError && <p className="text-xs text-destructive mr-auto self-center">{createError}</p>}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending || !form.title.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit post dialog */}
      <Dialog open={!!editingPost} onOpenChange={(o) => { if (!o) setEditingPost(null); }}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
              <Textarea
                rows={6}
                value={editForm.body}
                onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                className="text-sm resize-none"
              />
            </div>
            {categories.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, category: "" }))}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                      !editForm.category
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20",
                    )}
                  >
                    None
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, category: c.name }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        editForm.category === c.name
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20",
                      )}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isInstructor && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editForm.instructorOnly}
                  onChange={(e) => setEditForm((f) => ({ ...f, instructorOnly: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">Instructor only</span>
                <span className="text-xs text-muted-foreground">— hidden from students</span>
              </label>
            )}
          </div>
          <DialogFooter>
            {editError && <p className="text-xs text-destructive mr-auto self-center">{editError}</p>}
            <Button variant="outline" onClick={() => setEditingPost(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={isPending || !editForm.title.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({
  post,
  categoryEmoji,
  expanded,
  onToggle,
  isInstructor,
  currentUserId,
  currentUserAvatarUrl,
  onEdit,
  onPin,
  onDelete,
  pinned,
  pinError,
}: {
  post: Post;
  categoryEmoji: string | undefined;
  expanded: boolean;
  onToggle: () => void;
  isInstructor: boolean;
  currentUserId: string;
  currentUserAvatarUrl: string | null;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
  pinned: boolean;
  pinError: string | null;
}) {
  const isAuthor = post.author.id === currentUserId;
  const canManage = isInstructor || isAuthor;
  const avatarUrl = isAuthor ? (currentUserAvatarUrl ?? post.author.avatarUrl) : post.author.avatarUrl;
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleCopy() {
    const text = [post.title, post.body].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-colors",
      pinned ? "border-primary/20" : "border-border",
    )}>
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
      >
        <span className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <UserAvatar
            userId={post.author.id}
            name={post.author.name}
            avatarUrl={avatarUrl}
            size="lg"
            side="right"
            align="start"
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground leading-snug">{post.title}</p>
            {post.category && (
              <CategoryBadge category={post.category} emoji={categoryEmoji} />
            )}
            {post.instructorOnly && isInstructor && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                <Lock className="w-2.5 h-2.5" />
                Instructor only
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {post.author.name} · {fmt(post.createdAt)}
            {post.replies.length > 0 && (
              <span className="ml-2 text-muted-foreground/50">
                · {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
              </span>
            )}
          </p>
          {!expanded && post.body && (
            <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{post.body}</p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground/40 shrink-0 mt-0.5 font-medium">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/40">
          <div className="px-5 pt-4 pb-3">
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {post.body
                ? renderWithLinks(post.body)
                : <span className="italic text-muted-foreground/50">No body.</span>}
            </p>
          </div>

          {post.replies.length > 0 && (
            <div className="border-t border-border/40 bg-muted/20 divide-y divide-border/40">
              {post.replies.map((reply) => (
                <div key={reply.id} className="px-5 py-3 flex items-start gap-3">
                  <UserAvatar
                    userId={reply.author.id}
                    name={reply.author.name}
                    avatarUrl={reply.author.avatarUrl}
                    size="sm"
                    side="right"
                    align="start"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {reply.author.name}
                      <span className="ml-2 font-normal text-muted-foreground/60">{fmt(reply.createdAt)}</span>
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mt-0.5">
                      {renderWithLinks(reply.body)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-border/40">
            {pinError && <p className="text-xs text-destructive mb-2">{pinError}</p>}
            <div className="flex items-center gap-2">
              {isInstructor && (
                <button
                  onClick={onPin}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    pinned ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Pin className="h-3 w-3" />
                  {pinned ? "Unpin" : "Pin"}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              {canManage && (
                <>
                  <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  {confirmingDelete ? (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Delete this post?</span>
                      <button onClick={() => setConfirmingDelete(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                      <button onClick={onDelete} className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors">Yes, delete</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors ml-auto">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

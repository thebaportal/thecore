"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search, FolderKanban, CheckSquare, MessageCircle,
  Home, Activity, Plus, ArrowRight, FileText, Loader2,
  FileImage, File, MessageSquare, MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Project  = { id: string; name: string; color: string | null; iconEmoji: string | null; status?: string };
type Task     = { id: string; title: string; status?: string; projectId: string; assigneeId?: string | null; project: { name: string } };
type Doc      = { id: string; title: string; emoji: string | null; projectId: string | null; project: { name: string } | null };
type Post       = { id: string; title: string; projectId: string; project: { name: string } };
type FileResult = { id: string; name: string; mimeType: string | null; projectId: string; project: { name: string } };
type ChatFile   = { id: string; name: string; mimeType: string; message: { pingId: string; ping: { title: string | null } } };
type PingResult = { id: string; title: string | null; type: string };

interface CommandBarProps {
  projects: Project[];
  tasks: Task[];
  docs?: Doc[];
  role?: "MEMBER" | "ADMIN";
  currentDbUserId?: string;
  onNewProject: () => void;
  onNewTask: () => void;
  onNewPing: () => void;
}

const GROUP_HEADING = "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground mt-1";

function fileIcon(mime: string | null) {
  if (!mime) return <File className="w-3.5 h-3.5" />;
  if (mime.startsWith("image/")) return <FileImage className="w-3.5 h-3.5" />;
  return <File className="w-3.5 h-3.5" />;
}

export function CommandBar({ projects, tasks, docs = [], role = "ADMIN", currentDbUserId, onNewProject, onNewTask, onNewPing }: CommandBarProps) {
  const isAdmin = role === "ADMIN";
  const [open, setOpen]               = useState(false);
  const [query, setQuery]             = useState("");
  const [searching, setSearching]     = useState(false);
  const [results, setResults]         = useState<{
    projects: Project[];
    tasks: Task[];
    docs: Doc[];
    posts: Post[];
    files: FileResult[];
    chatFiles: ChatFile[];
    pings: PingResult[];
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const runSearch = useCallback((q: string) => {
    if (q.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setResults(data))
      .finally(() => setSearching(false));
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(() => runSearch(q), 250);
  }

  useEffect(() => {
    if (!open) { setQuery(""); setResults(null); }
  }, [open]);

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasQuery = query.length >= 2;

  // With a query: use live DB results; without: fall back to preloaded list
  const shownProjects = results ? results.projects
    : projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const shownTasks = results ? results.tasks
    : tasks.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));
  const shownDocs  = results ? results.docs
    : docs.filter((d) => d.title.toLowerCase().includes(query.toLowerCase()));
  const shownPosts      = results?.posts     ?? [];
  const shownFiles      = results?.files     ?? [];
  const shownChatFiles  = results?.chatFiles ?? [];
  const shownPings      = results?.pings     ?? [];

  const hasResults = shownProjects.length + shownTasks.length + shownDocs.length +
    shownPosts.length + shownFiles.length + shownChatFiles.length + shownPings.length > 0;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {open && (
        <div className="fixed left-1/2 top-[18vh] z-50 w-full max-w-lg -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <Command className="[&_[cmdk-input-wrapper]]:border-0" shouldFilter={false}>
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                {searching
                  ? <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
                  : <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                }
                <Command.Input
                  value={query}
                  onValueChange={handleQueryChange}
                  placeholder="Search projects, tasks, docs, posts, files…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setResults(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border"
                  >
                    Clear
                  </button>
                )}
              </div>

              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                  {hasQuery && !searching ? `No results for "${query}"` : null}
                </Command.Empty>

                {/* Students: show a hint when no query instead of preloaded data */}
                {!hasQuery && !isAdmin && (
                  <div className="py-10 flex flex-col items-center gap-1.5 text-center px-4">
                    <p className="text-sm text-muted-foreground">Search your project</p>
                    <p className="text-xs text-muted-foreground/60">Tasks, docs, files, chat messages…</p>
                  </div>
                )}

                {/* Quick Actions — shown when no query, admin only */}
                {!hasQuery && isAdmin && (
                  <Command.Group heading="Quick Actions" className={GROUP_HEADING}>
                    <CmdItem icon={<Plus className="w-3.5 h-3.5 text-blue-600" />}   label="New Project" onSelect={onNewProject} setOpen={setOpen} />
                    <CmdItem icon={<Plus className="w-3.5 h-3.5 text-amber-600" />}  label="New Task"    onSelect={onNewTask}    setOpen={setOpen} />
                    <CmdItem icon={<Plus className="w-3.5 h-3.5 text-violet-600" />} label="New Message" onSelect={onNewPing} setOpen={setOpen} />
                  </Command.Group>
                )}

                {/* Navigation — shown when no query, admin only */}
                {!hasQuery && isAdmin && (
                  <Command.Group heading="Navigate" className={GROUP_HEADING}>
                    <CmdItem icon={<Home className="w-3.5 h-3.5" />}          label="Dashboard" onSelect={() => go("/dashboard")} setOpen={setOpen} />
                    <CmdItem icon={<FolderKanban className="w-3.5 h-3.5" />}  label="Projects"  onSelect={() => go("/projects")} setOpen={setOpen} />
                    <CmdItem icon={<CheckSquare className="w-3.5 h-3.5" />}   label="My Tasks"  onSelect={() => go("/tasks")}     setOpen={setOpen} />
                    <CmdItem icon={<MessageCircle className="w-3.5 h-3.5" />} label="Inbox"     onSelect={() => go("/inbox")}     setOpen={setOpen} />
                    <CmdItem icon={<Activity className="w-3.5 h-3.5" />}      label="Activity"  onSelect={() => go("/activity")}  setOpen={setOpen} />
                  </Command.Group>
                )}

                {/* Projects — only shown when typing */}
                {hasQuery && shownProjects.length > 0 && (
                  <Command.Group heading="Projects" className={GROUP_HEADING}>
                    {shownProjects.map((p) => (
                      <CmdItem
                        key={p.id}
                        icon={p.iconEmoji
                          ? <span className="text-sm">{p.iconEmoji}</span>
                          : <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#1E3A8A" }} />
                        }
                        label={p.name}
                        sub={p.status === "ARCHIVED" ? "Archived" : undefined}
                        onSelect={() => go(`/projects/${p.id}`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Tasks */}
                {(hasQuery || isAdmin) && shownTasks.length > 0 && (
                  <Command.Group heading="Tasks" className={GROUP_HEADING}>
                    {shownTasks.map((t) => (
                      <CmdItem
                        key={t.id}
                        icon={<CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />}
                        label={t.title}
                        sub={t.project.name}
                        onSelect={() => go(`/projects/${t.projectId}/tasks`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Posts */}
                {shownPosts.length > 0 && (
                  <Command.Group heading="Posts" className={GROUP_HEADING}>
                    {shownPosts.map((p) => (
                      <CmdItem
                        key={p.id}
                        icon={<MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />}
                        label={p.title}
                        sub={p.project.name}
                        onSelect={() => go(`/projects/${p.projectId}/posts`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Docs */}
                {shownDocs.length > 0 && (
                  <Command.Group heading="Docs" className={GROUP_HEADING}>
                    {shownDocs.map((d) => (
                      <CmdItem
                        key={d.id}
                        icon={d.emoji
                          ? <span className="text-sm">{d.emoji}</span>
                          : <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                        label={d.title}
                        sub={d.project?.name ?? "Library"}
                        onSelect={() => go(d.projectId ? `/projects/${d.projectId}/docs/${d.id}` : `/library/docs/${d.id}`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Files */}
                {shownFiles.length > 0 && (
                  <Command.Group heading="Files" className={GROUP_HEADING}>
                    {shownFiles.map((f) => (
                      <CmdItem
                        key={f.id}
                        icon={<span className="text-muted-foreground">{fileIcon(f.mimeType)}</span>}
                        label={f.name}
                        sub={f.project.name}
                        onSelect={() => go(`/projects/${f.projectId}/files`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Files shared in chat */}
                {shownChatFiles.length > 0 && (
                  <Command.Group heading="Files in Chat" className={GROUP_HEADING}>
                    {shownChatFiles.map((f) => (
                      <CmdItem
                        key={f.id}
                        icon={<span className="text-muted-foreground">{fileIcon(f.mimeType)}</span>}
                        label={f.name}
                        sub={f.message.ping.title ?? "Direct message"}
                        onSelect={() => go(`/inbox/${f.message.pingId}`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

                {/* Chats / Pings */}
                {shownPings.length > 0 && (
                  <Command.Group heading="Chats" className={GROUP_HEADING}>
                    {shownPings.map((p) => (
                      <CmdItem
                        key={p.id}
                        icon={<MessagesSquare className="w-3.5 h-3.5 text-muted-foreground" />}
                        label={p.title ?? "Direct message"}
                        onSelect={() => go(`/inbox/${p.id}`)}
                        setOpen={setOpen}
                      />
                    ))}
                  </Command.Group>
                )}

              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}

function CmdItem({
  icon, label, sub, onSelect, setOpen,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onSelect: () => void;
  setOpen: (v: boolean) => void;
}) {
  return (
    <Command.Item
      onSelect={() => { onSelect(); setOpen(false); }}
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer text-sm text-foreground",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        "transition-colors"
      )}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {sub && <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[120px]">{sub}</span>}
      <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100 shrink-0" />
    </Command.Item>
  );
}

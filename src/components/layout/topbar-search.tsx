"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, FolderKanban, CheckSquare, FileText, File, MessageSquare } from "lucide-react";

type Result = {
  projects: { id: string; name: string; color: string | null; iconEmoji: string | null }[];
  tasks:    { id: string; title: string; projectId: string; project: { name: string } }[];
  docs:     { id: string; title: string; emoji: string | null; projectId: string | null; project: { name: string } | null }[];
  files:    { id: string; name: string; mimeType: string | null; projectId: string | null; project: { name: string } | null }[];
  pings:    { id: string; title: string | null }[];
};

export function TopbarSearch() {
  const router = useRouter();
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Result | null>(null);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);
  const debounce                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);
  const containerRef            = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setResults)
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(q), 250);
  }

  function handleFocus() { setOpen(true); }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const hasResults = results && (
    results.projects.length + results.tasks.length +
    results.docs.length + results.files.length + results.pings.length > 0
  );
  const showDropdown = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-44 sm:w-72">
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm focus-within:bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        {loading
          ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          : <Search className="w-3.5 h-3.5 shrink-0" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Search…"
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm min-w-0"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults(null); inputRef.current?.focus(); }}
            className="text-muted-foreground hover:text-foreground text-xs leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
          {!hasResults && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">No results for &ldquo;{query}&rdquo;</p>
          )}

          {results && results.projects.length > 0 && (
            <Section label="Projects">
              {results.projects.map((p) => (
                <Row
                  key={p.id}
                  icon={p.iconEmoji
                    ? <span className="text-base">{p.iconEmoji}</span>
                    : <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                  }
                  label={p.name}
                  onClick={() => go(`/projects/${p.id}`)}
                />
              ))}
            </Section>
          )}

          {results && results.tasks.length > 0 && (
            <Section label="Tasks">
              {results.tasks.map((t) => (
                <Row
                  key={t.id}
                  icon={<CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />}
                  label={t.title}
                  sub={t.project?.name}
                  onClick={() => go(`/projects/${t.projectId}/tasks`)}
                />
              ))}
            </Section>
          )}

          {results && results.docs.length > 0 && (
            <Section label="Docs">
              {results.docs.map((d) => (
                <Row
                  key={d.id}
                  icon={d.emoji ? <span className="text-base">{d.emoji}</span> : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                  label={d.title}
                  sub={d.project?.name ?? "Library"}
                  onClick={() => go(d.projectId ? `/projects/${d.projectId}/docs/${d.id}` : `/library/docs/${d.id}`)}
                />
              ))}
            </Section>
          )}

          {results && results.files.length > 0 && (
            <Section label="Files">
              {results.files.map((f) => (
                <Row
                  key={f.id}
                  icon={<File className="w-3.5 h-3.5 text-muted-foreground" />}
                  label={f.name}
                  sub={f.project?.name}
                  onClick={() => go(`/projects/${f.projectId}/files`)}
                />
              ))}
            </Section>
          )}

          {results && results.pings.length > 0 && (
            <Section label="Messages">
              {results.pings.map((p) => (
                <Row
                  key={p.id}
                  icon={<MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />}
                  label={p.title ?? "Direct message"}
                  onClick={() => go(`/inbox/${p.id}`)}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ icon, label, sub, onClick }: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
    >
      <span className="shrink-0 flex items-center">{icon}</span>
      <span className="flex-1 truncate text-foreground">{label}</span>
      {sub && <span className="text-xs text-muted-foreground truncate max-w-[100px] shrink-0">{sub}</span>}
    </button>
  );
}

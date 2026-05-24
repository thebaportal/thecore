"use client";

import { useState } from "react";
import { Search, Users, ChevronDown, ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/users/user-avatar";
import { MessageButton } from "@/components/pings/message-button";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  orgRole: string;
  joinedAt: Date;
};

type Project = {
  id: string;
  name: string;
  color: string | null;
  iconEmoji: string | null;
  status: string;
  members: Member[];
};

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  ACTIVE:    { label: "Active",     dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  ON_HOLD:   { label: "On Hold",   dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200"   },
  COMPLETED: { label: "Completed", dot: "bg-blue-400",    text: "text-blue-700",    bg: "bg-blue-50 border-blue-200"     },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Avatar stack ──────────────────────────────────────────────────────────────

function AvatarStack({ members }: { members: Member[] }) {
  const visible = members.slice(0, 5);
  const overflow = members.length - visible.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((m) => (
          <div
            key={m.userId}
            title={m.name}
            className="w-6 h-6 rounded-full ring-2 ring-white overflow-hidden bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-500 shrink-0"
          >
            {m.avatarUrl
              ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
              : m.name[0]?.toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {members.length} {members.length === 1 ? "member" : "members"}
      </span>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  currentDbUserId,
  forceOpen,
}: {
  project: Project;
  currentDbUserId: string | null;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const color = project.color ?? "#6366f1";
  const isOpen = forceOpen || open;

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-150 overflow-hidden
        ${isOpen
          ? "border-slate-200 shadow-lg"
          : "border-slate-200 shadow hover:shadow-lg hover:-translate-y-px"
        }`}
    >
      {/* Card header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3.5 px-5 py-4 text-left group"
      >
        {/* Color bar */}
        <div
          className="w-1 self-stretch rounded-full shrink-0 opacity-80"
          style={{ backgroundColor: color }}
        />

        {/* Project icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 border"
          style={{ backgroundColor: `${color}12`, borderColor: `${color}30` }}
        >
          {project.iconEmoji ?? (
            <span className="text-sm font-bold" style={{ color }}>
              {project.name[0]?.toUpperCase()}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{project.name}</p>
          <div className="mt-1 hidden sm:block">
            {project.members.length > 0
              ? <AvatarStack members={project.members} />
              : <p className="text-xs text-slate-400">No members yet</p>}
          </div>
        </div>

        {/* Status + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={project.status} />
          {isOpen
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />}
        </div>
      </button>

      {/* Members */}
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50/60">
          {project.members.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400 text-center">
              No members yet — invite from within the project.
            </p>
          ) : (
            project.members.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 pl-8 pr-5 py-2.5 hover:bg-white transition-colors
                  ${i < project.members.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <UserAvatar
                  userId={m.userId}
                  name={m.name}
                  avatarUrl={m.avatarUrl}
                  size="sm"
                  side="right"
                  align="start"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate leading-tight">{m.name}</p>
                  {m.jobTitle && (
                    <p className="text-xs text-slate-400 truncate leading-tight">{m.jobTitle}</p>
                  )}
                </div>
                {currentDbUserId && m.userId !== currentDbUserId && (
                  <MessageButton targetUserId={m.userId} targetName={m.name} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export function TeamShell({
  orgName,
  projects,
  currentDbUserId,
}: {
  orgName: string;
  projects: Project[];
  currentDbUserId: string | null;
}) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const uniquePeople = new Set(projects.flatMap((p) => p.members.map((m) => m.userId))).size;
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;

  const filtered = projects
    .map((p) => ({
      ...p,
      members: q
        ? p.members.filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              (m.jobTitle ?? "").toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q)
          )
        : p.members,
    }))
    .filter((p) => q ? p.members.length > 0 || p.name.toLowerCase().includes(q) : true);

  return (
    // Soft page background
    <div className="-mt-6 sm:-mt-8 -mx-4 sm:-mx-6 min-h-screen bg-slate-100 px-4 sm:px-6 pt-6 sm:pt-8 pb-16">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Workspace</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {orgName} · {uniquePeople} people · {activeCount} active {activeCount === 1 ? "project" : "projects"}
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people, roles or projects…"
          className="w-full max-w-md pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white shadow text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
        />
      </div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No projects yet</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            Create a project and invite members — they'll appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">No results for "{search}"</p>
      ) : (
        <>
          {/* Section label */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            {filtered.length} {filtered.length === 1 ? "Project" : "Projects"}
          </p>
          <div className="space-y-2.5">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                currentDbUserId={currentDbUserId}
                forceOpen={q.length > 0}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

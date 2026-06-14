"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Clock, X, ChevronDown, Mail } from "lucide-react";
import { UserAvatar } from "@/components/users/user-avatar";
import { MessageButton } from "@/components/pings/message-button";
import { InviteButton } from "@/components/team/invite-button";
import { revokeOrgInvitation, type PendingOrgInvitation } from "@/actions/invitations";
import type { TeamMember, TeamProject } from "@/actions/team";

// ── Person card ───────────────────────────────────────────────────────────────

function PersonCard({
  person,
  currentDbUserId,
}: {
  person: TeamMember;
  currentDbUserId: string | null;
}) {
  const [emailVisible, setEmailVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = person.orgRole === "OWNER" || person.orgRole === "ADMIN";
  const primaryProject = person.projects[0] ?? null;

  // Close email on outside click
  useEffect(() => {
    if (!emailVisible) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setEmailVisible(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emailVisible]);

  return (
    <div ref={ref} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-4 flex items-start gap-3.5 hover:shadow-md transition-shadow">
      {/* Avatar — click to reveal email */}
      <button
        onClick={() => setEmailVisible((v) => !v)}
        className="shrink-0 relative group focus:outline-none"
        title="Click to see email"
      >
        <UserAvatar userId={person.userId} name={person.name} avatarUrl={person.avatarUrl} size="md" side="right" align="start" />
        <span className="absolute inset-0 rounded-full ring-2 ring-transparent group-hover:ring-primary/30 transition-all" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{person.name}</p>
          {isAdmin && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full shrink-0">
              Admin
            </span>
          )}
        </div>

        {person.jobTitle && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{person.jobTitle}</p>
        )}

        {/* Email — revealed on avatar click */}
        {emailVisible && (
          <div className="flex items-center gap-1 mt-1">
            <Mail className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs text-primary truncate">{person.email}</p>
          </div>
        )}

        {/* Project badge */}
        {primaryProject && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: primaryProject.color ?? "#6366f1" }}
            />
            <span className="text-xs text-slate-500 truncate">{primaryProject.name}</span>
          </div>
        )}
      </div>

      {currentDbUserId && person.userId !== currentDbUserId && (
        <MessageButton targetUserId={person.userId} targetName={person.name} />
      )}
    </div>
  );
}

// ── Pending invitations section ───────────────────────────────────────────────

function PendingInvitationsSection({ invitations }: { invitations: PendingOrgInvitation[] }) {
  const [list, setList] = useState(invitations);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRevoke(id: string) {
    setRevoking(id);
    startTransition(async () => {
      try {
        await revokeOrgInvitation(id);
        setList((prev) => prev.filter((inv) => inv.id !== id));
      } finally {
        setRevoking(null);
      }
    });
  }

  if (list.length === 0) return null;

  return (
    <section className="mb-8">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        {list.length} Pending {list.length === 1 ? "Invitation" : "Invitations"}
      </p>
      <div className="space-y-2">
        {list.map((inv) => {
          const name = [inv.firstName, inv.lastName].filter(Boolean).join(" ") || null;
          const sentDate = new Date(inv.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <div key={inv.id} className="bg-white rounded-xl border border-amber-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                {name && <p className="text-sm font-medium text-slate-700 truncate leading-tight">{name}</p>}
                <p className="text-sm text-slate-500 truncate">{inv.email}</p>
                <p className="text-xs text-slate-400 mt-0.5">Invited {sentDate} · {inv.role === "org:admin" ? "Instructor / Admin" : "Member"}</p>
              </div>
              <button
                onClick={() => handleRevoke(inv.id)}
                disabled={revoking === inv.id}
                title="Revoke invitation"
                className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "archived";

export function TeamShell({
  orgName,
  people,
  projects,
  currentDbUserId,
  pendingInvitations = [],
}: {
  orgName: string;
  orgLogoUrl?: string | null;
  people: TeamMember[];
  projects: TeamProject[];
  currentDbUserId: string | null;
  pendingInvitations?: PendingOrgInvitation[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const q = search.toLowerCase().trim();

  // Split projects into active/archived for the dropdown grouping
  const activeProjects = projects.filter((p) => p.status !== "ARCHIVED");
  const archivedProjects = projects.filter((p) => p.status === "ARCHIVED");

  // Filter people
  const filteredPeople = people.filter((person) => {
    // Search
    if (q) {
      const matchesSearch =
        person.name.toLowerCase().includes(q) ||
        person.email.toLowerCase().includes(q) ||
        (person.jobTitle ?? "").toLowerCase().includes(q) ||
        person.projects.some((p) => p.name.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    // Project filter
    if (selectedProjectId) {
      if (!person.projects.some((p) => p.id === selectedProjectId)) return false;
    }

    // Status filter
    if (statusFilter === "active") {
      const inActiveProject = person.projects.some((p) => p.status !== "ARCHIVED");
      const isAdmin = person.orgRole === "OWNER" || person.orgRole === "ADMIN";
      if (!inActiveProject && !isAdmin) return false;
    } else if (statusFilter === "archived") {
      const onlyArchived =
        person.projects.length > 0 && person.projects.every((p) => p.status === "ARCHIVED");
      if (!onlyArchived) return false;
    }

    return true;
  });

  return (
    <div className="-mt-6 sm:-mt-8 -mx-4 sm:-mx-6 min-h-screen bg-slate-100 px-4 sm:px-6 pt-6 sm:pt-8 pb-16">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{orgName || "Team"}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {people.length} {people.length === 1 ? "person" : "people"} · {projects.filter(p => p.status !== "ARCHIVED").length} active {projects.filter(p => p.status !== "ARCHIVED").length === 1 ? "project" : "projects"}
          </p>
        </div>
        <InviteButton adminOnly onDone={() => router.refresh()} />
      </div>

      {/* Pending invitations */}
      <PendingInvitationsSection invitations={pendingInvitations} />

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, title, project…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white shadow-sm text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
        </div>

        {/* Project filter */}
        <div className="relative">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white shadow-sm text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all cursor-pointer"
          >
            <option value="">All Projects</option>
            {activeProjects.length > 0 && (
              <optgroup label="Active">
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            )}
            {archivedProjects.length > 0 && (
              <optgroup label="Archived">
                {archivedProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden text-sm">
          {(["all", "active", "archived"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 capitalize transition-colors ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        {filteredPeople.length} {filteredPeople.length === 1 ? "Person" : "People"}
        {(q || selectedProjectId || statusFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setSelectedProjectId(null); setStatusFilter("all"); }}
            className="ml-1 text-primary hover:opacity-70 normal-case font-medium tracking-normal"
          >
            Clear filters
          </button>
        )}
      </p>

      {/* People grid */}
      {filteredPeople.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredPeople.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              currentDbUserId={currentDbUserId}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">No people match your filters.</p>
        </div>
      )}
    </div>
  );
}

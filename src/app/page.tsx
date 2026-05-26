import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, FolderKanban, MessageSquare,
  Sparkles, FileText, Users, Activity, CheckSquare,
} from "lucide-react";

const features = [
  {
    Icon: FolderKanban,
    title: "Phase-driven project delivery",
    description: "Structure every project into phases with their own deliverables and timelines. Teams always know where they are and what comes next.",
    color: "#3b82f6",
  },
  {
    Icon: CheckSquare,
    title: "Deliverables with built-in review",
    description: "Teams submit work directly in the platform. Review, approve, or request revisions — the feedback loop is part of every project.",
    color: "#10b981",
  },
  {
    Icon: MessageSquare,
    title: "Every conversation in context",
    description: "Messages belong to projects, tasks, and deliverables — not scattered across email. Discussion lives exactly where the work happens.",
    color: "#8b5cf6",
  },
  {
    Icon: Activity,
    title: "Full project visibility",
    description: "See every project's phase, health, and progress without asking for a status update. Problems surface before they become blockers.",
    color: "#f59e0b",
  },
  {
    Icon: FileText,
    title: "Project-attached file library",
    description: "Docs, designs, and deliverables organized by project and phase. Everything findable, always attached to the work it belongs to.",
    color: "#06b6d4",
  },
  {
    Icon: Users,
    title: "Built for any team structure",
    description: "From solo contributors to multi-team organizations — role-based access, shared workspaces, and visibility that scales with you.",
    color: "#e879f9",
  },
];

const BG = "oklch(0.168 0.022 264)";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Nav ── */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-6 md:px-16 border-b border-white/8"
        style={{ background: BG }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black" style={{ color: BG }}>TC</span>
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">The Core</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/sign-in" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg">
            Sign in
          </Link>
          <Link href="/sign-up" className="px-4 py-2.5 text-sm font-semibold bg-white rounded-lg hover:bg-white/90 transition-colors" style={{ color: BG }}>
            Get started
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative flex flex-col items-center text-center px-6 pt-36 pb-0 overflow-hidden"
        style={{ background: BG }}
      >
        {/* Glow layers */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[640px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% -5%, rgba(99,102,241,0.42) 0%, rgba(99,102,241,0.1) 45%, transparent 70%)" }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[260px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(192,132,252,0.28) 0%, transparent 60%)" }}
        />
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "64px 64px" }}
        />

        <div className="relative z-10 w-full max-w-5xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-white/50 font-medium tracking-wide">Built for teams that deliver</span>
          </div>

          {/* Headline */}
          <h1 className="text-[3.25rem] sm:text-[5rem] md:text-[6.75rem] font-extrabold text-white leading-[0.9] tracking-[-0.035em] mb-7">
            One platform.<br />
            <span style={{
              background: "linear-gradient(125deg, #93c5fd 0%, #a78bfa 40%, #e879f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Every project.
            </span>
          </h1>

          <p className="text-base md:text-lg text-white/40 max-w-md mx-auto mb-9 leading-relaxed">
            Projects, tasks, files, and conversations — structured around delivery,
            not scattered across tools.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link href="/sign-up"
              className="flex items-center gap-2 px-7 py-3.5 bg-white font-semibold text-sm rounded-xl hover:bg-white/90 transition-colors"
              style={{ color: BG }}
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-in"
              className="px-7 py-3.5 border border-white/10 text-white/45 text-sm rounded-xl hover:border-white/20 hover:text-white/65 transition-colors"
            >
              Sign in
            </Link>
          </div>

          {/* ── Product mockup ── */}
          <div className="relative">
            {/* Bottom fade into next section */}
            <div className="absolute inset-x-0 bottom-0 h-48 z-10 pointer-events-none"
              style={{ background: `linear-gradient(to bottom, transparent 0%, ${BG} 100%)` }}
            />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-28 blur-3xl pointer-events-none opacity-60"
              style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.5), rgba(139,92,246,0.5))" }}
            />
            <div
              className="relative rounded-2xl border border-white/10 overflow-hidden text-left"
              style={{ background: "oklch(0.13 0.018 264)", boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(99,102,241,0.12)" }}
            >
              {/* Browser bar */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/8">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white/5 rounded-md px-14 py-1 text-[11px] text-white/20 select-none">
                    thecore.app/dashboard
                  </div>
                </div>
              </div>

              {/* App interior */}
              <div className="flex" style={{ minHeight: "280px" }}>
                {/* Sidebar */}
                <div className="w-44 border-r border-white/8 p-3 flex flex-col gap-0.5 shrink-0">
                  <div className="flex items-center gap-2 px-2 py-2 mb-2">
                    <div className="w-5 h-5 rounded-md bg-white/15 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white/60">TC</span>
                    </div>
                    <span className="text-[11px] text-white/40 font-semibold">Apex Studio</span>
                  </div>
                  <div className="px-2 py-1">
                    <span className="text-[8px] font-semibold uppercase tracking-widest text-white/20">Work</span>
                  </div>
                  {[
                    { label: "Dashboard", active: true },
                    { label: "Projects",  active: false },
                    { label: "My Tasks",  active: false },
                    { label: "Inbox",     active: false },
                  ].map(item => (
                    <div key={item.label}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                      style={{ background: item.active ? "rgba(255,255,255,0.08)" : "transparent" }}
                    >
                      <div className="w-3 h-3 rounded-sm bg-white/15" />
                      <span className={`text-[11px] font-medium ${item.active ? "text-white/90" : "text-white/30"}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                  <div className="px-2 py-1 mt-2">
                    <span className="text-[8px] font-semibold uppercase tracking-widest text-white/20">Knowledge</span>
                  </div>
                  {["Library", "Templates"].map(label => (
                    <div key={label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                      <div className="w-3 h-3 rounded-sm bg-white/15" />
                      <span className="text-[11px] font-medium text-white/30">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Main */}
                <div className="flex-1 p-4 overflow-hidden">
                  <div className="mb-4">
                    <p className="text-[9px] text-white/25">Monday, May 25 · Apex Studio</p>
                    <p className="text-sm font-semibold text-white/70 mt-0.5">Good morning, Jordan</p>
                  </div>

                  {/* KPI cards */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: "Pending Reviews", value: "4",  accent: "#d97706" },
                      { label: "Overdue Tasks",   value: "2",  accent: "#dc2626" },
                      { label: "Unread",          value: "11", accent: "#7c3aed" },
                      { label: "Active Projects", value: "6",  accent: "#2563eb" },
                    ].map(k => (
                      <div key={k.label}
                        className="rounded-lg border border-white/8 p-2.5 relative overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: k.accent }} />
                        <p className="text-base font-bold text-white/80 tabular-nums">{k.value}</p>
                        <p className="text-[8px] text-white/30 mt-0.5 leading-tight">{k.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Projects */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { name: "Nova Platform", color: "#3b82f6", pct: 72, phase: "Phase 3 of 5" },
                      { name: "Atlas Launch",  color: "#8b5cf6", pct: 44, phase: "Phase 2 of 4" },
                      { name: "Orbit CRM",     color: "#10b981", pct: 89, phase: "Phase 4 of 4" },
                    ].map(p => (
                      <div key={p.name}
                        className="rounded-lg border border-white/8 p-2.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-3.5 h-3.5 rounded" style={{ background: p.color + "35" }} />
                          <span className="text-[10px] font-semibold text-white/65 truncate">{p.name}</span>
                        </div>
                        <p className="text-[8px] text-white/25 mb-1.5">{p.phase}</p>
                        <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ background: p.color, width: `${p.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Briefing strip */}
                  <div
                    className="rounded-lg border border-white/8 px-3 py-2.5 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <Sparkles className="w-3 h-3 shrink-0 text-indigo-400/60" />
                    <div className="min-w-0">
                      <span className="text-[8px] font-semibold uppercase tracking-widest text-white/20 mr-2">
                        Daily Briefing
                      </span>
                      <span className="text-[10px] text-white/30">
                        Nova Platform has 4 deliverables pending review · Atlas group is 2 days behind on Phase 2
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="border-y border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6 grid grid-cols-3 divide-x divide-border">
          {[
            { value: "All-in-one",            sub: "projects, tasks, files, and conversations" },
            { value: "Built Around Delivery",  sub: "phases, deliverables, and reviews built in" },
            { value: "Phases to Done",         sub: "structured execution for every project" },
          ].map(s => (
            <div key={s.value} className="px-6 text-center">
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── "Work that stays in context" — dark, prominent ── */}
      <section className="py-16 px-6 md:px-16" style={{ background: BG }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Work that stays in context.
          </h2>
          <p className="text-white/40 max-w-xl mb-10 text-sm md:text-base leading-relaxed">
            Most tools scatter your work across tabs and threads. The Core keeps
            everything connected — so your team stops hunting for context and starts executing.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Messages",  sub: "live inside projects" },
              { label: "Files",     sub: "attached to phases" },
              { label: "Tasks",     sub: "linked to deliverables" },
              { label: "Decisions", sub: "tied to context" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white/80">{item.label}</p>
                <p className="text-xs text-white/35 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3">
              Built around delivery
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
              From kickoff to final review — The Core gives every project a structure that moves work forward.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ Icon, title, description, color }) => (
              <div key={title} className="rounded-xl border border-border p-5 hover:border-foreground/20 transition-colors">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3.5"
                  style={{ background: color + "15" }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5 text-sm">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 px-6 text-center overflow-hidden" style={{ background: BG }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.2) 0%, transparent 70%)" }}
        />
        <div className="relative z-10 max-w-xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
            Stop chasing work across email,<br />chats, and spreadsheets.
          </h2>
          <p className="text-white/40 mb-8 text-sm">
            Give your team one place to manage projects, communication, and delivery.
            Set up in minutes.
          </p>
          <Link href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white font-semibold text-sm rounded-xl hover:bg-white/90 transition-colors shadow-lg"
            style={{ color: BG }}
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6 px-6 md:px-16 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <span className="text-[9px] font-black text-primary-foreground">TC</span>
          </div>
          <span className="text-sm font-semibold text-foreground">The Core</span>
        </div>
        <span className="text-xs text-muted-foreground">© 2025 The Core. All rights reserved.</span>
      </footer>

    </div>
  );
}

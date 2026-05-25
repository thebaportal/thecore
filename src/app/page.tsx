import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Layers, MessageCircle, Sparkles } from "lucide-react";

const features = [
  {
    icon: <Layers className="w-5 h-5" />,
    title: "Structured delivery",
    description:
      "Phases, tasks, and deliverables give every project a clear shape — so teams know exactly what's due and when.",
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: "Focused communication",
    description:
      "Direct messages, group chats, and context-linked conversations keep discussion tied to the work, not buried in email.",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "Intelligent oversight",
    description:
      "An AI briefing surfaces what needs attention each day. No dashboards to check — just a calm morning read.",
  },
];

const pillars = [
  "Multi-project oversight from one place",
  "Daily digests so nothing slips through",
  "File library attached to each project",
  "Role-based access for every team member",
];

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-6 md:px-12 bg-background/95 backdrop-blur-sm border-b border-border">
        <span className="font-semibold text-base tracking-tight text-foreground">
          The Core
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main
        className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-28"
        style={{ background: "oklch(0.168 0.022 264)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-8">
          Project management for education
        </p>
        <h1 className="text-4xl md:text-[3.75rem] font-bold text-white leading-[1.1] tracking-tight max-w-2xl mb-6">
          Where great work
          <br />
          comes together.
        </h1>
        <p className="text-base md:text-lg text-white/60 max-w-lg mb-10 leading-relaxed">
          The Core gives your team one calm, structured workspace — for projects,
          communication, and everything in between.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/sign-up"
            className="w-full sm:w-auto px-8 py-3 bg-white text-[oklch(0.168_0.022_264)] font-semibold text-sm rounded-md hover:bg-white/90 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="w-full sm:w-auto px-8 py-3 border border-white/20 text-white/80 text-sm rounded-md hover:border-white/40 hover:text-white transition-colors"
          >
            Sign in to your workspace
          </Link>
        </div>

        {/* Pillars */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-3xl w-full">
          {pillars.map((p) => (
            <div key={p} className="flex items-start gap-2 text-left">
              <CheckCircle className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
              <span className="text-xs text-white/50 leading-relaxed">{p}</span>
            </div>
          ))}
        </div>
      </main>

      {/* Features */}
      <section className="bg-card border-t border-border py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground text-center mb-4">
            Built for how project teams actually work
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-16 max-w-md mx-auto">
            Simple enough that everyone uses it. Structured enough that nothing
            falls through.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {features.map((f) => (
              <div key={f.title} className="space-y-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-2">
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border py-20 px-6 text-center bg-background">
        <h2 className="text-2xl font-bold text-foreground mb-4 tracking-tight">
          Ready to bring your projects together?
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Set up in minutes. No credit card required.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex px-8 py-3 bg-primary text-primary-foreground font-medium text-sm rounded-md hover:bg-primary/90 transition-colors"
        >
          Create your workspace
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 md:px-12 flex items-center justify-between bg-card">
        <span className="text-sm font-semibold text-foreground">The Core</span>
        <span className="text-xs text-muted-foreground">
          © 2025 The Core. All rights reserved.
        </span>
      </footer>
    </div>
  );
}

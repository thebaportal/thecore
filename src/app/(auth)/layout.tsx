import Link from "next/link";
import { CheckCircle } from "lucide-react";

const bullets = [
  "Phases, tasks & deliverables in one place",
  "Direct messages linked to your work",
  "Daily digest so nothing slips",
  "AI briefing every morning",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 px-12 py-12"
        style={{ background: "oklch(0.168 0.022 264)" }}
      >
        <Link
          href="/"
          className="text-white font-semibold text-lg tracking-tight"
        >
          The Core
        </Link>

        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
              Project management for education
            </p>
            <h2 className="text-2xl font-bold text-white leading-snug">
              Where great work
              <br />
              comes together.
            </h2>
            <p className="text-sm text-white/50 leading-relaxed">
              One calm workspace for your projects,
              <br />
              your team, and everything in between.
            </p>
          </div>

          <div className="space-y-3">
            {bullets.map((b) => (
              <div key={b} className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-white/30 shrink-0" />
                <span className="text-sm text-white/60">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/25">
          © 2025 The Core. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <Link
          href="/"
          className="lg:hidden mb-10 text-foreground font-semibold text-lg tracking-tight"
        >
          The Core
        </Link>
        {children}
      </div>
    </div>
  );
}

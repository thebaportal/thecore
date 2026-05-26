import Link from "next/link";
import { Check } from "lucide-react";

const BG = "oklch(0.168 0.022 264)";

const bullets = [
  "Structured project phases",
  "Deliverables and reviews",
  "Team conversations linked to work",
  "Unified file library",
  "Clear daily project visibility",
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
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 px-12 py-12 relative overflow-hidden"
        style={{ background: BG }}
      >
        {/* Glow */}
        <div
          className="absolute top-0 left-0 right-0 h-96 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% -10%, rgba(99,102,241,0.32) 0%, transparent 60%)" }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center shrink-0"
          >
            <span className="text-[11px] font-black" style={{ color: BG }}>TC</span>
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">The Core</span>
        </Link>

        {/* Content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-[2rem] font-extrabold text-white leading-[0.95] tracking-[-0.025em]">
              One platform.<br />
              <span style={{
                background: "linear-gradient(125deg, #93c5fd 0%, #a78bfa 40%, #e879f9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                Every project.
              </span>
            </h2>
            <p className="text-sm text-white/45 leading-relaxed max-w-[280px]">
              Plan work, manage delivery, keep communication in context, and track
              progress from kickoff to completion.
            </p>
          </div>

          <div className="space-y-3">
            {bullets.map((b) => (
              <div key={b} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                </div>
                <span className="text-sm text-white/60">{b}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/20">
          © 2025 The Core. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="lg:hidden mb-10 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-primary-foreground">TC</span>
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">The Core</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

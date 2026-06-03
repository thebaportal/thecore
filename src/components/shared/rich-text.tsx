"use client";

import { UserCard } from "@/components/users/user-card";

const TOKEN_RE = /(@\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s]+)/g;

export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN_RE);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;

        const mentionMatch = /^@\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (mentionMatch) {
          const chip = (
            <span className="inline-flex items-center text-primary font-semibold cursor-pointer bg-primary/8 hover:bg-primary/15 rounded px-1 py-0.5 transition-colors text-[0.9em] leading-none">
              @{mentionMatch[1]}
            </span>
          );
          return (
            <UserCard key={i} userId={mentionMatch[2]!} side="top" align="center">
              {chip}
            </UserCard>
          );
        }

        if (/^https?:\/\//.test(part)) {
          return (
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
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

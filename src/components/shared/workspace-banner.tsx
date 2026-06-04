import { cn } from "@/lib/utils";

/**
 * Lightweight workspace identity label for content page headers.
 * Shows org name only — no logo. Brand color does the visual work.
 * Logo lives exclusively in the sidebar header and org switcher.
 */
export function WorkspaceLabel({
  orgName,
  className,
}: {
  orgLogoUrl?: string | null; // accepted but intentionally unused on content pages
  orgName: string;
  className?: string;
}) {
  if (!orgName) return null;

  return (
    <div className={cn("flex items-center gap-2 border-l-2 border-primary/40 pl-2.5", className)}>
      <span className="text-xs font-medium text-muted-foreground/75 tracking-tight leading-none">
        {orgName}
      </span>
    </div>
  );
}

/** @deprecated Use WorkspaceLabel */
export const WorkspaceBanner = WorkspaceLabel;

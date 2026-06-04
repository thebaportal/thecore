import { cn } from "@/lib/utils";

export function WorkspaceLabel({
  orgLogoUrl,
  orgName,
  className,
}: {
  orgLogoUrl: string | null;
  orgName: string;
  className?: string;
}) {
  if (!orgName) return null;

  const initials = orgName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Thin brand-color accent line */}
      <div className="w-px h-3.5 rounded-full bg-primary/50 shrink-0" />
      {orgLogoUrl ? (
        <img
          src={orgLogoUrl}
          alt={orgName}
          className="h-4 w-auto max-w-[80px] object-contain opacity-75"
        />
      ) : (
        <div className="w-4 h-4 rounded bg-primary/15 flex items-center justify-center text-primary text-[7px] font-bold shrink-0">
          {initials}
        </div>
      )}
      <span className="text-[11px] font-medium text-muted-foreground/60 truncate">{orgName}</span>
    </div>
  );
}

/** @deprecated Use WorkspaceLabel */
export const WorkspaceBanner = WorkspaceLabel;

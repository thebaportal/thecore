import { cn } from "@/lib/utils";

export function WorkspaceBanner({
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
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 w-fit",
        className
      )}
    >
      {orgLogoUrl ? (
        <img
          src={orgLogoUrl}
          alt={orgName}
          className="h-5 w-auto max-w-[100px] object-contain"
        />
      ) : (
        <>
          <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-[8px] font-bold shrink-0">
            {initials}
          </div>
          <span className="text-xs font-medium text-primary/80">{orgName}</span>
        </>
      )}
    </div>
  );
}

import { UserCard } from "./user-card";
import { cn } from "@/lib/utils";

export function UserAvatar({
  userId,
  name,
  avatarUrl,
  size = "sm",
  className,
  side,
  align,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const sizeClasses = {
    xs: "w-5 h-5 text-[8px]",
    sm: "w-7 h-7 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      className={cn("rounded-full object-cover cursor-pointer shrink-0", sizeClasses[size], className)}
    />
  ) : (
    <div className={cn(
      "rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold cursor-pointer shrink-0",
      sizeClasses[size],
      className
    )}>
      {name[0]?.toUpperCase()}
    </div>
  );

  return (
    <UserCard userId={userId} side={side} align={align}>
      {inner}
    </UserCard>
  );
}

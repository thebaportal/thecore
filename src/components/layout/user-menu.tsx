"use client";

import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut, UserCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded || !user) return null;

  const name = user.fullName ?? user.firstName ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0" />
        }
      >
        <img
          src={user.imageUrl}
          alt={name}
          className="w-10 h-10 rounded-full object-cover"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Identity header */}
        <div className="px-3 py-2.5 border-b border-border mb-1">
          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user.primaryEmailAddress?.emailAddress}</p>
        </div>

        <DropdownMenuItem>
          <Link href="/settings/profile" className="flex items-center gap-2 w-full">
            <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
            Manage profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

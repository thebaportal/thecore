"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function ChooseOrganizationInner() {
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: true,
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  // Clerk passes the intended destination in these params
  const afterUrl =
    searchParams.get("redirect_url") ??
    searchParams.get("sign_in_redirect_url") ??
    searchParams.get("sign_in_fallback_redirect_url") ??
    "/dashboard";

  // Normalise to a relative path — Clerk sometimes passes absolute URLs
  const dest = (() => {
    try {
      const u = new URL(afterUrl);
      return u.pathname + u.search;
    } catch {
      return afterUrl.startsWith("/") ? afterUrl : "/dashboard";
    }
  })();

  const memberships = userMemberships?.data ?? [];

  useEffect(() => {
    if (!isLoaded || !setActive) return;
    // memberships.length is in the dep array so this re-runs if Clerk
    // delivers the list after isLoaded fires (two-phase load edge case).
    if (memberships.length > 0) {
      setActive({ organization: memberships[0]!.organization.id })
        .then(() => router.replace(dest))
        .catch(() => router.replace("/organization-selection"));
    } else {
      router.replace("/organization-selection");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, memberships.length]);

  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ChooseOrganizationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ChooseOrganizationInner />
    </Suspense>
  );
}

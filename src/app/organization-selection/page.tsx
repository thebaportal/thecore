import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OrgSelectionClient } from "./org-selection-client";

export default function OrganizationSelectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OrgSelectionClient />
    </Suspense>
  );
}

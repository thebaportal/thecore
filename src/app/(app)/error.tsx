"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </Button>
    </div>
  );
}

"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>{error.message}</p>
          <button onClick={reset} style={{ padding: "6px 16px", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

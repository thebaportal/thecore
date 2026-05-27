"use client";

export default function BasecampError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 max-w-2xl p-6 rounded-xl border border-red-200 bg-red-50">
      <h2 className="text-sm font-semibold text-red-900">Page failed to load</h2>
      <p className="text-xs text-red-700 font-mono break-all">{error.message}</p>
      {error.digest && (
        <p className="text-xs text-red-500">Digest: <span className="font-mono">{error.digest}</span></p>
      )}
    </div>
  );
}

"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/**
 * Route-level safety net. `fetchMeals` returns known Notion problems as values
 * (see app/page.tsx), so this boundary catches the *unexpected* — an
 * unrecognized API failure or a render error in the charts. `unstable_retry`
 * (Next.js 16.2+) re-fetches and re-renders the segment, which is exactly what a
 * transient Notion hiccup needs.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">🍽️ Macro Tracker</h1>
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-500">
          Something went wrong
        </div>
        <h2 className="mt-1 text-lg font-semibold">Couldn’t render the dashboard</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          An unexpected error occurred while loading your macros. This is usually
          temporary.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-[var(--muted)]">Reference: {error.digest}</p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

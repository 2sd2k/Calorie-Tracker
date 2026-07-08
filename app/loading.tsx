// Shown via Suspense while the server component awaits Notion. Mirrors the
// dashboard layout in app/page.tsx so the shell doesn't jump on load.

function Box({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-black/5 dark:bg-white/5 ${className}`} />
  );
}

export default function Loading() {
  return (
    <main className="w-full px-6 py-10 sm:px-8 lg:px-12">
      <header className="mb-8">
        <Box className="h-7 w-56" />
        <Box className="mt-2 h-4 w-72" />
      </header>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <Box className="h-3 w-16" />
            <Box className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-6">
        {[0, 1].map((i) => (
          <section
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <Box className="mb-4 h-4 w-32" />
            <Box className="h-[280px] w-full" />
          </section>
        ))}
      </div>
    </main>
  );
}

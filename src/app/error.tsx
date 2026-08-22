"use client";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        {error.message || "Unexpected error"}
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <button
        type="button"
        onClick={reset}
        className="tap mt-4 rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink"
      >
        Try again
      </button>
    </main>
  );
}

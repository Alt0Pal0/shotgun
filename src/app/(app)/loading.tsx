/** Instant feedback on navigation while the server renders the page. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 pt-2" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-24 rounded bg-surface-2" />
      <div className="h-7 w-2/3 rounded bg-surface-2" />
      <div className="h-28 rounded-2xl bg-surface-2" />
      <div className="h-40 rounded-2xl bg-surface-2" />
    </div>
  );
}

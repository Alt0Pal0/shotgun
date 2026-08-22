export function ProgressBar({
  value,
  label,
  color = "bg-accent",
}: {
  value: number | null;
  label: string;
  color?: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m} min`;
}
export function fmtElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}
export function fmtDistance(meters: number | null | undefined, unit: "imperial" | "metric" = "imperial"): string {
  if (meters == null) return "Distance unavailable";
  return unit === "imperial" ? `${(meters / 1609.344).toFixed(1)} mi` : `${(meters / 1000).toFixed(1)} km`;
}
export function fmtDate(iso: string | null | undefined, tz?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: tz }).format(new Date(iso));
}
export function fmtDateTime(iso: string | null | undefined, tz?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(
    new Date(iso),
  );
}
export function fmtAgo(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} seconds ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}
export function hours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

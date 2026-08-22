import { MAX_ACCEPTED_ACCURACY_M, MAX_PLAUSIBLE_SPEED_MPS, MIN_USABLE_POINTS, type GpsQuality, type LocationSample } from "./types";

const EARTH_RADIUS_M = 6371008.8;

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface FilterResult {
  accepted: LocationSample[];
  rejected: { sample: LocationSample; reason: RejectReason }[];
  /** Segments flagged for implausible speed or timestamp order are retained diagnostically but excluded from distance. */
  flagged: { from: LocationSample; to: LocationSample; reason: "IMPLAUSIBLE_SPEED" | "TIMESTAMP_ORDER"; implied_speed_mps?: number }[];
}
export type RejectReason = "INACCURATE" | "INVALID" | "DUPLICATE_SEQUENCE";

/**
 * Documented acceptance rules (PRD FR-023):
 *  - ignore points with reported accuracy worse than 100 m
 *  - flag (but retain) segments implying > 50 m/s or out-of-order timestamps; they do not add distance
 *  - duplicates by sequence number are dropped
 */
export function filterSamples(samples: LocationSample[]): FilterResult {
  const sorted = [...samples].sort((a, b) => a.sequence_no - b.sequence_no);
  const accepted: LocationSample[] = [];
  const rejected: FilterResult["rejected"] = [];
  const flagged: FilterResult["flagged"] = [];
  const seen = new Set<number>();
  for (const s of sorted) {
    if (seen.has(s.sequence_no)) { rejected.push({ sample: s, reason: "DUPLICATE_SEQUENCE" }); continue; }
    seen.add(s.sequence_no);
    if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude) || Math.abs(s.latitude) > 90 || Math.abs(s.longitude) > 180 || Number.isNaN(Date.parse(s.recorded_at))) {
      rejected.push({ sample: s, reason: "INVALID" }); continue;
    }
    if (s.accuracy_m != null && s.accuracy_m > MAX_ACCEPTED_ACCURACY_M) { rejected.push({ sample: s, reason: "INACCURATE" }); continue; }
    accepted.push(s);
  }
  for (let i = 1; i < accepted.length; i++) {
    const a = accepted[i - 1], b = accepted[i];
    const dt = (Date.parse(b.recorded_at) - Date.parse(a.recorded_at)) / 1000;
    if (dt <= 0) { flagged.push({ from: a, to: b, reason: "TIMESTAMP_ORDER" }); continue; }
    const d = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    const v = d / dt;
    if (v > MAX_PLAUSIBLE_SPEED_MPS) flagged.push({ from: a, to: b, reason: "IMPLAUSIBLE_SPEED", implied_speed_mps: v });
  }
  return { accepted, rejected, flagged };
}

/** Sum of Haversine distances between consecutive accepted points, excluding flagged segments. */
export function computeDistanceMeters(result: FilterResult): number | null {
  if (result.accepted.length < MIN_USABLE_POINTS) return null;
  const bad = new Set(result.flagged.map((f) => f.to.sequence_no));
  let total = 0;
  for (let i = 1; i < result.accepted.length; i++) {
    const a = result.accepted[i - 1], b = result.accepted[i];
    if (bad.has(b.sequence_no)) continue;
    total += haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
  }
  return Math.round(total);
}

/** GPS quality classification (FR-022): GOOD / LIMITED / NONE based on recent valid samples. */
export function classifyQuality(samples: LocationSample[], windowMs = 60_000, now = Date.now()): GpsQuality {
  const recent = samples.filter((s) => now - Date.parse(s.recorded_at) <= windowMs && (s.accuracy_m == null || s.accuracy_m <= MAX_ACCEPTED_ACCURACY_M));
  if (recent.length === 0) return "NONE";
  const median = [...recent].map((s) => s.accuracy_m ?? 0).sort((a, b) => a - b)[Math.floor(recent.length / 2)];
  return median <= 30 ? "GOOD" : "LIMITED";
}

/** Whole-drive quality: share of active minutes covered by accepted samples. */
export function classifyDriveQuality(accepted: LocationSample[], startedAt: Date, endedAt: Date): { quality: GpsQuality; coverage: number; longest_gap_s: number } {
  const durationS = Math.max(1, (endedAt.getTime() - startedAt.getTime()) / 1000);
  if (accepted.length === 0) return { quality: "NONE", coverage: 0, longest_gap_s: durationS };
  const times = accepted.map((s) => Date.parse(s.recorded_at)).sort((a, b) => a - b);
  let covered = 0, longest = 0;
  let prev = startedAt.getTime();
  for (const t of times) {
    const gap = (t - prev) / 1000;
    covered += Math.min(gap, 15);
    longest = Math.max(longest, gap);
    prev = t;
  }
  longest = Math.max(longest, (endedAt.getTime() - prev) / 1000);
  const coverage = Math.min(1, covered / durationS);
  const medianAcc = [...accepted].map((s) => s.accuracy_m ?? 0).sort((a, b) => a - b)[Math.floor(accepted.length / 2)];
  const quality: GpsQuality = accepted.length < MIN_USABLE_POINTS ? "NONE" : coverage >= 0.9 && medianAcc <= 30 && longest <= 120 ? "GOOD" : "LIMITED";
  return { quality, coverage, longest_gap_s: Math.round(longest) };
}

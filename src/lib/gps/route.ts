import { classifyDriveQuality, computeDistanceMeters, filterSamples } from "./distance";
import { computeNightMinutes, type NightRule } from "./night";
import { NIGHT_ALGORITHM_VERSION, PROCESSING_VERSION, type LocationSample } from "./types";

export interface LineString { type: "LineString"; coordinates: [number, number][] }

/** Douglas–Peucker simplification in degrees (≈ 1e-5 deg ≈ 1 m). */
export function simplify(coords: [number, number][], tolerance = 2e-5): [number, number][] {
  if (coords.length <= 2) return coords;
  const sqTol = tolerance * tolerance;
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = keep[coords.length - 1] = true;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop() as [number, number];
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = sqSegDist(coords[i], coords[s], coords[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqTol && idx > 0) { keep[idx] = true; stack.push([s, idx], [idx, e]); }
  }
  return coords.filter((_, i) => keep[i]);
}
function sqSegDist(p: [number, number], a: [number, number], b: [number, number]): number {
  let [x, y] = a; let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}

export interface RouteProcessingResult {
  distance_meters: number | null;
  gps_quality: "GOOD" | "LIMITED" | "NONE";
  gps_incomplete: boolean;
  proposed_night_minutes: number;
  night_gap_minutes: number;
  processing_version: string;
  night_algorithm_version: string;
  route_geojson: LineString | null;
  simplified_geojson: LineString | null;
  point_count: number;
  accepted_point_count: number;
  rejection_counts: Record<string, number>;
  coverage: number;
  longest_gap_s: number;
}

/** Deterministic post-drive processing from first-party samples only (never from a Google route). */
export function processRoute(samples: LocationSample[], startedAt: Date, endedAt: Date, nightRule?: NightRule): RouteProcessingResult {
  const filtered = filterSamples(samples);
  const distance = computeDistanceMeters(filtered);
  const { quality, coverage, longest_gap_s } = classifyDriveQuality(filtered.accepted, startedAt, endedAt);
  const night = computeNightMinutes(filtered.accepted, startedAt, endedAt, nightRule);
  const coords = filtered.accepted.map((s) => [Number(s.longitude.toFixed(6)), Number(s.latitude.toFixed(6))] as [number, number]);
  const rejection_counts: Record<string, number> = {};
  for (const r of filtered.rejected) rejection_counts[r.reason] = (rejection_counts[r.reason] ?? 0) + 1;
  for (const f of filtered.flagged) rejection_counts[f.reason] = (rejection_counts[f.reason] ?? 0) + 1;
  const hasRoute = distance != null;
  return {
    distance_meters: distance,
    gps_quality: quality,
    gps_incomplete: quality !== "GOOD",
    proposed_night_minutes: night.night_minutes,
    night_gap_minutes: night.gap_minutes,
    processing_version: PROCESSING_VERSION,
    night_algorithm_version: NIGHT_ALGORITHM_VERSION,
    route_geojson: hasRoute ? { type: "LineString", coordinates: coords } : null,
    simplified_geojson: hasRoute ? { type: "LineString", coordinates: simplify(coords) } : null,
    point_count: samples.length,
    accepted_point_count: filtered.accepted.length,
    rejection_counts,
    coverage,
    longest_gap_s,
  };
}

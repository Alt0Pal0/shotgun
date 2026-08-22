import * as SunCalc from "suncalc";
import type { LocationSample } from "./types";

export interface NightRule { after_sunset_minutes: number; before_sunrise_minutes: number }
export const DEFAULT_NIGHT_RULE: NightRule = { after_sunset_minutes: 30, before_sunrise_minutes: 30 };

/** Is the instant `t` inside candidate darkness at the given location per the rule (sunset+X → sunrise−Y)? */
export function isDark(t: Date, lat: number, lng: number, rule: NightRule = DEFAULT_NIGHT_RULE): boolean {
  // Check the solar day containing t and its neighbours to handle night spanning midnight and UTC offsets.
  for (const offsetDays of [-1, 0, 1]) {
    const day = new Date(t.getTime() + offsetDays * 86_400_000);
    const times = SunCalc.getTimes(day, lat, lng);
    const sunset = times.sunset?.getTime();
    const nextSunrise = SunCalc.getTimes(new Date(day.getTime() + 86_400_000), lat, lng).sunrise?.getTime();
    if (sunset == null || nextSunrise == null || Number.isNaN(sunset) || Number.isNaN(nextSunrise)) continue;
    const darkStart = sunset + rule.after_sunset_minutes * 60_000;
    // Dark ends at the *next* sunrise minus Y.
    const darkEnd = nextSunrise - rule.before_sunrise_minutes * 60_000;
    if (t.getTime() >= darkStart && t.getTime() < darkEnd) return true;
  }
  return false;
}

export interface NightResult {
  night_minutes: number;
  /** Minutes inside gaps longer than `maxGapMs` that were NOT classified and need adult confirmation. */
  gap_minutes: number;
  segments: { start: string; end: string; dark: boolean }[];
}

/**
 * Split the drive into intervals between consecutive accepted samples and classify each by the solar times at the
 * sample location and date (PRD §7.2). Gaps > maxGapMs are not auto-classified and are surfaced for the adult.
 * When no samples exist, the whole drive is a gap.
 */
export function computeNightMinutes(samples: LocationSample[], startedAt: Date, endedAt: Date, rule: NightRule = DEFAULT_NIGHT_RULE, maxGapMs = 5 * 60_000): NightResult {
  const pts = [...samples].sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  if (pts.length === 0) {
    return { night_minutes: 0, gap_minutes: Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000), segments: [] };
  }
  let darkMs = 0, gapMs = 0;
  const segments: NightResult["segments"] = [];
  // Pre-roll from session start to first sample uses the first sample's location.
  const anchors = [{ t: startedAt.getTime(), lat: pts[0].latitude, lng: pts[0].longitude }, ...pts.map((p) => ({ t: Date.parse(p.recorded_at), lat: p.latitude, lng: p.longitude })), { t: endedAt.getTime(), lat: pts[pts.length - 1].latitude, lng: pts[pts.length - 1].longitude }];
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    const span = b.t - a.t;
    if (span <= 0) continue;
    if (span > maxGapMs) { gapMs += span; continue; }
    // Classify by sub-steps of at most 60 s so a boundary crossing is split, not rounded.
    const steps = Math.max(1, Math.ceil(span / 60_000));
    let dark = 0;
    for (let k = 0; k < steps; k++) {
      const t0 = a.t + (span * k) / steps, t1 = a.t + (span * (k + 1)) / steps;
      const mid = new Date((t0 + t1) / 2);
      if (isDark(mid, a.lat, a.lng, rule)) dark += t1 - t0;
    }
    darkMs += dark;
    segments.push({ start: new Date(a.t).toISOString(), end: new Date(b.t).toISOString(), dark: dark > span / 2 });
  }
  return { night_minutes: Math.round(darkMs / 60_000), gap_minutes: Math.round(gapMs / 60_000), segments };
}

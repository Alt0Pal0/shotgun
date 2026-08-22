import type { LocationSample } from "./types";

export interface SimulatedDriveOptions {
  start: { lat: number; lng: number };
  /** Total duration in seconds. */
  durationS: number;
  /** Sample interval in seconds. */
  intervalS?: number;
  /** Cruise speed in m/s. */
  speedMps?: number;
  /** Seconds of stationary time at the end (to trigger the parked end flow). */
  parkedTailS?: number;
  /** Include a brief mid-drive stop (traffic light) of this many seconds. */
  trafficLightS?: number;
  startTime?: Date;
  accuracyM?: number;
  /** Inject one implausible jump and one inaccurate point for filter coverage. */
  injectNoise?: boolean;
}

/** Deterministic simulated drive along a gentle curve. Used by dev mode and automated tests; never in production builds. */
export function simulateDrive(opts: SimulatedDriveOptions): LocationSample[] {
  const interval = opts.intervalS ?? 5;
  const speed = opts.speedMps ?? 12;
  const tail = opts.parkedTailS ?? 45;
  const lightAt = Math.floor(opts.durationS / 2);
  const lightLen = opts.trafficLightS ?? 0;
  const t0 = (opts.startTime ?? new Date()).getTime();
  const out: LocationSample[] = [];
  let lat = opts.start.lat, lng = opts.start.lng, seq = 0;
  const mPerDegLat = 111_320, mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  for (let t = 0; t <= opts.durationS; t += interval) {
    const moving = t < opts.durationS - tail && !(t >= lightAt && t < lightAt + lightLen);
    const heading = (t / opts.durationS) * 180; // gentle arc
    const v = moving ? speed : 0;
    if (moving) {
      lat += ((v * interval) * Math.cos((heading * Math.PI) / 180)) / mPerDegLat;
      lng += ((v * interval) * Math.sin((heading * Math.PI) / 180)) / mPerDegLng;
    }
    let accuracy = opts.accuracyM ?? 8, plat = lat, plng = lng;
    if (opts.injectNoise && t === interval * 7) accuracy = 250; // inaccurate point
    if (opts.injectNoise && t === interval * 11) { plat = lat + 0.05; plng = lng + 0.05; } // ~7 km jump
    out.push({ sequence_no: seq++, recorded_at: new Date(t0 + t * 1000).toISOString(), latitude: plat, longitude: plng, accuracy_m: accuracy, speed_mps: v, heading_deg: heading });
  }
  return out;
}

export interface LocationSample {
  sequence_no: number;
  recorded_at: string; // ISO UTC
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
}

export type GpsQuality = "GOOD" | "LIMITED" | "NONE";

export const PROCESSING_VERSION = "route-v1";
export const NIGHT_ALGORITHM_VERSION = "night-v1-suncalc";

export const MAX_ACCEPTED_ACCURACY_M = 100;
export const MAX_PLAUSIBLE_SPEED_MPS = 50;
export const MIN_USABLE_POINTS = 5;

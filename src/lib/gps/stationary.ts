import { haversineMeters } from "./distance";

export const STATIONARY_SPEED_MPS = 1.34; // ≈ 3 mph
export const STATIONARY_RADIUS_M = 15;
export const STATIONARY_HOLD_MS = 30_000;

export interface StationaryState {
  since: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
}

export function initialStationaryState(): StationaryState {
  return { since: null, anchorLat: null, anchorLng: null };
}

/** Client-side mirror of the server's stationary detector used to enable the End control optimistically. */
export function updateStationary(
  state: StationaryState,
  lat: number,
  lng: number,
  speedMps: number | null,
  t: number,
): StationaryState {
  if (state.anchorLat == null || state.anchorLng == null) return { since: t, anchorLat: lat, anchorLng: lng };
  const slow = (speedMps ?? 0) < STATIONARY_SPEED_MPS;
  const close = haversineMeters(state.anchorLat, state.anchorLng, lat, lng) < STATIONARY_RADIUS_M;
  if (slow && close) return { ...state, since: state.since ?? t };
  return { since: null, anchorLat: lat, anchorLng: lng };
}

export function stationarySeconds(state: StationaryState, now: number): number {
  return state.since == null ? 0 : Math.max(0, Math.floor((now - state.since) / 1000));
}

export function isParked(state: StationaryState, now: number): boolean {
  return stationarySeconds(state, now) * 1000 >= STATIONARY_HOLD_MS;
}

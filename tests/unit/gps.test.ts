import { describe, it, expect } from "vitest";
import { classifyQuality, computeDistanceMeters, computeNightMinutes, filterSamples, haversineMeters, initialStationaryState, isDark, isParked, processRoute, simplify, simulateDrive, stationarySeconds, updateStationary, type LocationSample } from "@/lib/gps";

const s = (seq: number, t: number, lat: number, lng: number, acc = 8, spd = 10): LocationSample => ({ sequence_no: seq, recorded_at: new Date(t).toISOString(), latitude: lat, longitude: lng, accuracy_m: acc, speed_mps: spd, heading_deg: 0 });
const T0 = Date.parse("2026-08-22T20:00:00Z");

describe("GPS filtering and distance", () => {
  it("haversine matches a known distance (SF → LA ≈ 559 km)", () => {
    expect(haversineMeters(37.7749, -122.4194, 34.0522, -118.2437) / 1000).toBeCloseTo(559, 0);
  });
  it("rejects inaccurate points, drops duplicate sequences, flags implausible speed and timestamp order", () => {
    const samples = [s(0, T0, 37.77, -122.41), s(1, T0 + 5000, 37.7705, -122.41, 150), s(2, T0 + 10000, 37.771, -122.41), s(2, T0 + 10000, 37.771, -122.41), s(3, T0 + 15000, 37.85, -122.41), s(4, T0 + 14000, 37.851, -122.41)];
    const r = filterSamples(samples);
    expect(r.accepted.map((x) => x.sequence_no)).toEqual([0, 2, 3, 4]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["INACCURATE", "DUPLICATE_SEQUENCE"]);
    expect(r.flagged.map((x) => x.reason)).toEqual(["IMPLAUSIBLE_SPEED", "TIMESTAMP_ORDER"]);
  });
  it("returns null distance with fewer than five usable points but retains duration elsewhere", () => {
    const r = filterSamples([s(0, T0, 37.77, -122.41), s(1, T0 + 5000, 37.771, -122.41), s(2, T0 + 10000, 37.772, -122.41)]);
    expect(computeDistanceMeters(r)).toBeNull();
  });
  it("excludes flagged segments from the distance total", () => {
    const good = Array.from({ length: 6 }, (_, i) => s(i, T0 + i * 5000, 37.77 + i * 0.001, -122.41));
    const withJump = [...good, s(6, T0 + 30000, 38.5, -122.41), s(7, T0 + 35000, 38.501, -122.41)];
    const dGood = computeDistanceMeters(filterSamples(good)) as number;
    const dJump = computeDistanceMeters(filterSamples(withJump)) as number;
    expect(dGood).toBeCloseTo(556, -1);
    expect(dJump - dGood).toBeLessThan(200); // the 80 km jump is excluded, only the last 111 m segment adds
  });
  it("classifies live quality from recent samples", () => {
    const now = T0 + 60_000;
    expect(classifyQuality([], 60_000, now)).toBe("NONE");
    expect(classifyQuality([s(0, now - 5000, 1, 1, 10)], 60_000, now)).toBe("GOOD");
    expect(classifyQuality([s(0, now - 5000, 1, 1, 60)], 60_000, now)).toBe("LIMITED");
    expect(classifyQuality([s(0, now - 5000, 1, 1, 500)], 60_000, now)).toBe("NONE");
    expect(classifyQuality([s(0, now - 120_000, 1, 1, 5)], 60_000, now)).toBe("NONE");
  });
});

describe("stationary detection", () => {
  it("requires ~30 s of slow, low-displacement samples; a brief stop does not count; moving resets", () => {
    let st = initialStationaryState();
    let t = T0;
    st = updateStationary(st, 37.77, -122.41, 0, t);
    for (let i = 1; i <= 4; i++) { t += 5000; st = updateStationary(st, 37.77, -122.41, 0, t); }
    expect(stationarySeconds(st, t)).toBe(20);
    expect(isParked(st, t)).toBe(false);
    t += 5000; st = updateStationary(st, 37.7705, -122.41, 12, t); // moved 55 m
    expect(stationarySeconds(st, t)).toBe(0);
    for (let i = 1; i <= 7; i++) { t += 5000; st = updateStationary(st, 37.7705, -122.41, 0.3, t); }
    expect(isParked(st, t)).toBe(true);
  });
});

describe("night-minute segmentation", () => {
  const sf = { lat: 37.7749, lng: -122.4194 };
  it("uses sunset+30 / sunrise−30 boundaries at the sample location", () => {
    // 22 Aug 2026 San Francisco: sunset ≈ 19:50 PDT (02:50Z), sunrise ≈ 06:33 PDT (13:33Z)
    expect(isDark(new Date("2026-08-23T02:00:00Z"), sf.lat, sf.lng)).toBe(false);
    expect(isDark(new Date("2026-08-23T04:00:00Z"), sf.lat, sf.lng)).toBe(true);
    expect(isDark(new Date("2026-08-23T09:00:00Z"), sf.lat, sf.lng)).toBe(true);
    expect(isDark(new Date("2026-08-23T13:40:00Z"), sf.lat, sf.lng)).toBe(false);
    expect(isDark(new Date("2026-08-23T20:00:00Z"), sf.lat, sf.lng)).toBe(false);
  });
  it("splits a drive crossing the darkness threshold instead of labelling all of it night", () => {
    const start = Date.parse("2026-08-23T02:30:00Z"); // 19:30 PDT, 50 min before dark starts (sunset ~19:50 + 30)
    const samples = Array.from({ length: 61 }, (_, i) => s(i, start + i * 60_000, sf.lat, sf.lng, 8, 10)); // 60-minute drive
    const r = computeNightMinutes(samples, new Date(start), new Date(start + 60 * 60_000));
    expect(r.night_minutes).toBeGreaterThan(5);
    expect(r.night_minutes).toBeLessThan(20);
    expect(r.gap_minutes).toBe(0);
  });
  it("does not auto-classify long GPS gaps; surfaces them for the adult", () => {
    const start = Date.parse("2026-08-23T05:00:00Z");
    const samples = [s(0, start, sf.lat, sf.lng), s(1, start + 2 * 60_000, sf.lat, sf.lng), s(2, start + 30 * 60_000, sf.lat, sf.lng), s(3, start + 32 * 60_000, sf.lat, sf.lng)];
    const r = computeNightMinutes(samples, new Date(start), new Date(start + 32 * 60_000));
    expect(r.gap_minutes).toBe(28);
    expect(r.night_minutes).toBe(4);
  });
  it("a drive with no samples is entirely a gap", () => {
    const r = computeNightMinutes([], new Date(T0), new Date(T0 + 10 * 60_000));
    expect(r).toMatchObject({ night_minutes: 0, gap_minutes: 10 });
  });
});

describe("route processing and simulator", () => {
  it("processes a simulated drive: distance, quality, simplified geometry, rejection counts", () => {
    const start = new Date("2026-08-22T18:00:00Z");
    const samples = simulateDrive({ start: { lat: 37.77, lng: -122.41 }, durationS: 600, parkedTailS: 45, trafficLightS: 15, startTime: start, injectNoise: true });
    const r = processRoute(samples, start, new Date(start.getTime() + 600_000));
    expect(r.point_count).toBe(121);
    expect(r.accepted_point_count).toBe(120);
    expect(r.rejection_counts).toMatchObject({ INACCURATE: 1, IMPLAUSIBLE_SPEED: 2 });
    expect(r.distance_meters).toBeGreaterThan(6000);
    expect(r.distance_meters).toBeLessThan(6600);
    expect(r.gps_quality).toBe("GOOD");
    expect(r.route_geojson?.coordinates.length).toBe(120);
    expect((r.simplified_geojson?.coordinates.length ?? 0)).toBeLessThan(120);
    expect(r.processing_version).toBe("route-v1");
  });
  it("preserves duration semantics when GPS is poor: null distance, NONE quality, gps_incomplete", () => {
    const start = new Date(T0);
    const r = processRoute([s(0, T0, 37.77, -122.41)], start, new Date(T0 + 30 * 60_000));
    expect(r.distance_meters).toBeNull();
    expect(r.gps_quality).toBe("NONE");
    expect(r.gps_incomplete).toBe(true);
    expect(r.route_geojson).toBeNull();
  });
  it("simplify keeps endpoints and removes collinear points", () => {
    const line: [number, number][] = Array.from({ length: 50 }, (_, i) => [i * 0.0001, i * 0.0001]);
    expect(simplify(line)).toEqual([line[0], line[49]]);
  });
});

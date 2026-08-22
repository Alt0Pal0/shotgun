"use client";
import {
  classifyQuality,
  initialStationaryState,
  isParked,
  simulateDrive,
  stationarySeconds,
  updateStationary,
  type GpsQuality,
  type LocationSample,
  type StationaryState,
} from "@/lib/gps";
import { api } from "@/lib/client/api";
import { appendSample, cleanupAcked, nextSequence, unackedCount } from "./buffer";
import { syncSamples } from "./sync";

export interface RecorderState {
  permission: "granted" | "denied" | "prompt" | "unknown";
  quality: GpsQuality;
  online: boolean;
  recording: boolean;
  sampleCount: number;
  pendingUpload: number;
  lastSampleAt: number | null;
  wakeLock: "active" | "released" | "unsupported";
  visibilityGaps: number;
  stationarySeconds: number;
  localParked: boolean;
  serverCanEnd: boolean;
  serverStatus: string | null;
  error: string | null;
  simulated: boolean;
}

export const INITIAL_RECORDER_STATE: RecorderState = {
  permission: "unknown",
  quality: "NONE",
  online: true,
  recording: false,
  sampleCount: 0,
  pendingUpload: 0,
  lastSampleAt: null,
  wakeLock: "unsupported",
  visibilityGaps: 0,
  stationarySeconds: 0,
  localParked: false,
  serverCanEnd: false,
  serverStatus: null,
  error: null,
  simulated: false,
};

const SIM_ENABLED = process.env.NEXT_PUBLIC_GPS_SIMULATOR === "1";

/**
 * Foreground GPS recorder for the designated device (external store, framework-agnostic).
 * Samples → IndexedDB → idempotent batches every 15 s (or when 50 accumulate). Continues locally when offline.
 * Requests a screen wake lock where supported and logs visibility gaps.
 */
export class RecorderController {
  private state: RecorderState = {
    ...INITIAL_RECORDER_STATE,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
  };
  private listeners = new Set<() => void>();
  private seq = 0;
  private recent: LocationSample[] = [];
  private stationary: StationaryState = initialStationaryState();
  private watchId: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private timers: number[] = [];
  private simTimer: number | null = null;
  private simQueue: LocationSample[] = [];
  private hiddenAt: number | null = null;
  private unsynced = 0;
  private running = false;
  private cleanup: (() => void)[] = [];

  constructor(
    private sessionId: string,
    private deviceId: string,
  ) {}

  getState = () => this.state;
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };
  private set(p: Partial<RecorderState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.seq = await nextSequence(this.sessionId);
    this.set({ sampleCount: this.seq, pendingUpload: await unackedCount(this.sessionId) });
    await cleanupAcked();
    const params = new URLSearchParams(window.location.search);
    const simulate = SIM_ENABLED && (params.get("sim") === "1" || localStorage.getItem("ldp_sim") === "1");
    if (simulate) this.startSimulator(params);
    else this.startGeolocation();
    this.timers.push(window.setInterval(() => void this.flush(), 15_000));
    // While parked locally, sync every 5 s so the server can confirm the stop candidate promptly.
    this.timers.push(
      window.setInterval(() => {
        if (this.state.localParked && this.unsynced > 0 && !this.state.serverCanEnd) void this.flush();
      }, 5_000),
    );
    this.timers.push(
      window.setInterval(
        () =>
          this.set({
            stationarySeconds: Math.max(
              this.state.serverCanEnd ? 30 : 0,
              stationarySeconds(this.stationary, Date.now()),
            ),
            localParked: isParked(this.stationary, Date.now()),
          }),
        1000,
      ),
    );
    const online = () => {
      this.set({ online: true });
      void this.flush();
    };
    const offline = () => {
      this.set({ online: false });
      void api
        .post(`/api/drives/${this.sessionId}/status`, {
          device_id: this.deviceId,
          recorder_state: "RECORDING",
          connectivity: "OFFLINE",
        })
        .catch(() => undefined);
    };
    const vis = () => this.onVisibility();
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", vis);
    this.cleanup.push(() => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", vis);
    });
    void this.requestWakeLock();
    void this.flush();
  }

  stop() {
    this.running = false;
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    if (this.simTimer) clearTimeout(this.simTimer);
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    this.cleanup.forEach((c) => c());
    this.cleanup = [];
    this.wakeLock?.release().catch(() => undefined);
  }

  async flush() {
    const r = await syncSamples(this.sessionId, this.deviceId);
    this.unsynced = 0;
    this.set({
      pendingUpload: await unackedCount(this.sessionId),
      online: !r.offline,
      serverCanEnd: r.can_end ?? this.state.serverCanEnd,
      serverStatus: r.status ?? this.state.serverStatus,
      stationarySeconds: r.stationary_seconds ?? stationarySeconds(this.stationary, Date.now()),
    });
    if (!r.offline)
      void api
        .post(`/api/drives/${this.sessionId}/status`, {
          device_id: this.deviceId,
          recorder_state: "RECORDING",
          connectivity: "ONLINE",
          location_permission: this.state.permission,
        })
        .catch(() => undefined);
  }

  private async record(sample: Omit<LocationSample, "sequence_no">) {
    const s: LocationSample = { ...sample, sequence_no: this.seq++ };
    await appendSample(this.sessionId, s);
    this.recent = [...this.recent.slice(-40), s];
    this.stationary = updateStationary(
      this.stationary,
      s.latitude,
      s.longitude,
      s.speed_mps,
      Date.parse(s.recorded_at),
    );
    this.unsynced += 1;
    this.set({
      recording: true,
      sampleCount: this.seq,
      lastSampleAt: Date.parse(s.recorded_at),
      quality: classifyQuality(this.recent),
      stationarySeconds: stationarySeconds(this.stationary, Date.parse(s.recorded_at)),
      localParked: isParked(this.stationary, Date.parse(s.recorded_at)),
    });
    if (this.unsynced >= 50) void this.flush();
  }

  private startGeolocation() {
    if (!("geolocation" in navigator)) {
      this.set({ permission: "denied", error: "Geolocation is not available in this browser" });
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => this.set({ permission: p.state as RecorderState["permission"] }))
      .catch(() => undefined);
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.set({ permission: "granted", error: null });
        void this.record({
          recorded_at: new Date(pos.timestamp).toISOString(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy ?? null,
          speed_mps: pos.coords.speed ?? null,
          heading_deg: pos.coords.heading ?? null,
        });
      },
      (err) =>
        this.set({
          permission: err.code === err.PERMISSION_DENIED ? "denied" : this.state.permission,
          error: err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Location signal limited",
          quality: "NONE",
        }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }

  private startSimulator(params: URLSearchParams) {
    this.set({ simulated: true, permission: "granted" });
    const durationS = Number(params.get("simDuration") ?? localStorage.getItem("ldp_sim_duration") ?? 120);
    const speedMs = Number(params.get("simSpeedMs") ?? localStorage.getItem("ldp_sim_speed_ms") ?? 500);
    this.simQueue = simulateDrive({
      start: { lat: 37.7749, lng: -122.4194 },
      durationS,
      intervalS: 2,
      parkedTailS: 40,
      trafficLightS: 10,
      injectNoise: true,
    });
    let last: LocationSample | null = null;
    const tick = () => {
      if (!this.running) return;
      const next = this.simQueue.shift();
      if (next) {
        last = next;
        void this.record({ ...next, recorded_at: new Date().toISOString() });
        this.simTimer = window.setTimeout(tick, speedMs);
        return;
      }
      // Like a real receiver, keep reporting the parked position once the scripted drive is over.
      if (last) void this.record({ ...last, speed_mps: 0, recorded_at: new Date().toISOString() });
      this.simTimer = window.setTimeout(tick, 2000);
    };
    tick();
  }

  private async requestWakeLock() {
    if (!("wakeLock" in navigator)) {
      this.set({ wakeLock: "unsupported" });
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.set({ wakeLock: "active" });
      this.wakeLock.addEventListener("release", () => this.set({ wakeLock: "released" }));
    } catch {
      this.set({ wakeLock: "released" });
    }
  }

  private onVisibility() {
    if (document.visibilityState === "hidden") {
      this.hiddenAt = Date.now();
      return;
    }
    if (this.hiddenAt) {
      this.set({ visibilityGaps: this.state.visibilityGaps + 1 });
      void api
        .post("/api/analytics", {
          event: "visibility_gap",
          properties: { seconds: Math.round((Date.now() - this.hiddenAt) / 1000) },
        })
        .catch(() => undefined);
      this.hiddenAt = null;
    }
    void this.requestWakeLock();
    void this.flush();
  }
}

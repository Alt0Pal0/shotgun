"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { useLiveSession } from "@/lib/live/useLiveSession";
import type { LiveView, Observation, Skill } from "@/lib/types";
import { RouteMap } from "@/components/drive/RouteMap";
import { HoldButton } from "@/components/ui/HoldButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { fmtAgo, fmtDistance, fmtElapsed } from "@/lib/util/format";
import { OBS_LABEL } from "@/components/drive/ObservationTimeline";

type ObsType = Observation["observation_type"];
const PRIMARY: { type: ObsType; label: string; cls: string }[] = [
  { type: "DID_WELL", label: "Did well", cls: "bg-success text-[#04301d]" },
  { type: "NEEDS_PRACTICE", label: "Needs practice", cls: "bg-rose text-white" },
  { type: "DISCUSS_LATER", label: "Discuss later", cls: "bg-violet text-white" },
  { type: "INTERVENED", label: "I intervened", cls: "bg-amber text-[#332600]" },
];
const QUEUE_KEY = (id: string) => `ldp_obs_queue_${id}`;

export function LiveClient({
  initial,
  skills,
  unit,
}: {
  initial: LiveView;
  skills: Skill[];
  unit: "imperial" | "metric";
}) {
  const router = useRouter();
  const { view: liveView, conn, refresh, serverNow, trail } = useLiveSession(initial.session.id);
  const view = liveView ?? initial;
  const [pendingType, setPendingType] = useState<ObsType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const endKey = useRef(newIdempotencyKey());
  const isLive = view.session.status === "ACTIVE" || view.session.status === "STOP_CANDIDATE";
  const live = view.live;
  const elapsed = view.session.started_at
    ? Math.max(0, (serverNow - Date.parse(view.session.started_at)) / 1000)
    : live.elapsed_seconds;
  const locAge = live.latest_sample_at ? Math.round((serverNow - Date.parse(live.latest_sample_at)) / 1000) : null;
  const stale =
    locAge == null || locAge > 30 || live.recorder_state === "OFFLINE" || live.connectivity_state === "OFFLINE";

  useEffect(() => {
    if (!isLive)
      router.replace(
        view.viewer.is_in_car_supervisor ? `/drive/${view.session.id}/review` : `/drives/${view.session.id}`,
      );
  }, [isLive, router, view.session.id, view.viewer.is_in_car_supervisor]);

  // Flush queued observations when back online
  useEffect(() => {
    const flushQueue = async () => {
      const q: Record<string, unknown>[] = JSON.parse(localStorage.getItem(QUEUE_KEY(view.session.id)) ?? "[]");
      if (!q.length) return;
      const rest: Record<string, unknown>[] = [];
      for (const item of q) {
        try {
          await api.post(`/api/drives/${view.session.id}/observations`, item);
        } catch (e) {
          if ((e as { status?: number }).status === 409 || (e as { status?: number }).status === 403) continue;
          rest.push(item);
        }
      }
      localStorage.setItem(QUEUE_KEY(view.session.id), JSON.stringify(rest));
      if (rest.length < q.length) void refresh();
    };
    void flushQueue();
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [view.session.id, refresh]);

  async function observe(type: ObsType, skillId: string | null) {
    const body = {
      observation_type: type,
      skill_id: skillId,
      client_event_id: newIdempotencyKey(),
      occurred_at: new Date(serverNow).toISOString(),
    };
    setPendingType(null);
    try {
      await api.post(`/api/drives/${view.session.id}/observations`, body);
      setToast(
        `${OBS_LABEL[type]}${skillId ? ` · ${skills.find((s) => s.id === skillId)?.label}` : ""} saved at ${fmtElapsed(elapsed)}`,
      );
      void refresh();
    } catch (e) {
      if ((e as { status?: number }).status && (e as { status: number }).status < 500) {
        setErr((e as Error).message);
        return;
      }
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY(view.session.id)) ?? "[]");
      q.push(body);
      localStorage.setItem(QUEUE_KEY(view.session.id), JSON.stringify(q));
      setToast("Saved on this phone — will upload when back online");
    }
    setTimeout(() => setToast(null), 2500);
  }
  async function endDrive(override?: string) {
    setEnding(true);
    setErr(null);
    try {
      await api.post(`/api/drives/${view.session.id}/end`, {
        idempotency_key: endKey.current,
        confirmed_parked: true,
        override_reason: override ?? null,
      });
      router.replace(`/drive/${view.session.id}/review`);
    } catch (e) {
      setErr((e as Error).message);
      setEnding(false);
    }
  }
  const canEnd = view.session.status === "STOP_CANDIDATE";
  const stationaryS = live.stationary_since ? Math.round((serverNow - Date.parse(live.stationary_since)) / 1000) : 0;

  return (
    <div className="space-y-3" data-testid="live-view">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Live · {view.session.learner?.display_name}
          </p>
          <h1 className="text-xl font-bold">
            {view.viewer.is_in_car_supervisor ? "You are the in-car supervisor" : "Remote view (notes only)"}
          </h1>
          <p className="text-xs text-muted">
            {view.session.vehicle?.label ?? "No vehicle"} ·{" "}
            {view.session.status === "STOP_CANDIDATE" ? "Parked?" : "Driving"}
          </p>
        </div>
        <span
          className={`chip ${conn.connected ? (conn.mode === "realtime" ? "bg-success/20 text-success" : "bg-accent/20 text-accent") : "bg-rose/20 text-rose"}`}
          aria-live="polite"
        >
          {conn.connected ? (conn.mode === "realtime" ? "Realtime" : "Polling") : "Disconnected"}
        </span>
      </header>
      <RouteMap
        coordinates={trail}
        current={
          live.latest_latitude != null && live.latest_longitude != null
            ? { lat: live.latest_latitude, lng: live.latest_longitude }
            : null
        }
        stale={stale}
        markers={view.observations
          .filter((o) => o.latitude != null)
          .map((o) => ({
            lat: o.latitude as number,
            lng: o.longitude as number,
            label: OBS_LABEL[o.observation_type],
            tone: o.assessment === "POSITIVE" ? "positive" : o.assessment === "IMPROVEMENT" ? "improvement" : "neutral",
          }))}
        ariaLabel="Live route (recent positions)"
      />
      <p className="text-xs text-muted" aria-live="polite">
        {locAge == null ? "No location yet" : `Updated ${fmtAgo(live.latest_sample_at, serverNow)}`}
        {live.gps_quality === "LIMITED" && " · Location signal limited"}
        {live.gps_quality === "NONE" && " · No GPS signal"}
        {live.recorder_state === "OFFLINE" || live.connectivity_state === "OFFLINE"
          ? " · Recorder temporarily offline"
          : ""}
        {stale && " · Route may be incomplete"}
        {live.battery_warning ? ` · ${live.battery_warning}` : ""}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="card p-2">
          <dt className="text-[10px] uppercase text-muted">Elapsed</dt>
          <dd className="numeral text-lg font-bold">{fmtElapsed(elapsed)}</dd>
        </div>
        <div className="card p-2">
          <dt className="text-[10px] uppercase text-muted">Distance (est.)</dt>
          <dd className="numeral text-lg font-bold">{fmtDistance(live.estimated_distance_m, unit)}</dd>
        </div>
        <div className="card p-2">
          <dt className="text-[10px] uppercase text-muted">GPS</dt>
          <dd className="text-lg font-bold">
            {live.gps_quality === "GOOD" ? "Good" : live.gps_quality === "LIMITED" ? "Limited" : "None"}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted">
        Recorder: {live.recorder_state.toLowerCase()} · {view.recorder?.connectivity_state.toLowerCase() ?? "unknown"} ·
        permission {view.recorder?.location_permission ?? "unknown"} · {live.sample_count} samples
      </p>
      {view.planned_skills.length > 0 && (
        <p className="text-xs text-muted">Practicing: {view.planned_skills.map((s) => s.label).join(", ")}</p>
      )}
      {view.viewer.can_observe && (
        <section aria-label="Quick observations" className="card p-3">
          {!pendingType ? (
            <div className="grid grid-cols-2 gap-2">
              {PRIMARY.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => setPendingType(p.type)}
                  className={`tap rounded-2xl py-5 text-base font-bold ${p.cls}`}
                >
                  {p.label}
                </button>
              ))}
              {!view.viewer.is_in_car_supervisor && (
                <button
                  type="button"
                  onClick={() => observe("NOTE", null)}
                  className="tap col-span-2 rounded-2xl bg-surface-2 py-4 font-semibold"
                >
                  Add a note for later
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm font-semibold">{OBS_LABEL[pendingType]} — which skill?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => observe(pendingType, null)}
                  className="tap col-span-2 rounded-xl bg-accent py-3 font-bold text-accent-ink"
                >
                  Save without a skill
                </button>
                {skills.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => observe(pendingType, k.id)}
                    className="tap rounded-xl bg-surface-2 py-3 text-sm font-semibold"
                  >
                    {k.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPendingType(null)}
                  className="tap col-span-2 rounded-xl py-2 text-sm text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!view.viewer.is_in_car_supervisor && (
            <p className="mt-2 text-xs text-muted">
              You are not in the car: your notes are saved as unverified for later review.
            </p>
          )}
          {toast && (
            <p className="mt-2 text-center text-sm text-accent" role="status">
              {toast}
            </p>
          )}
        </section>
      )}
      {view.observations.length > 0 && (
        <p className="text-xs text-muted">
          {view.observations.length} observation{view.observations.length === 1 ? "" : "s"} this drive · last:{" "}
          {OBS_LABEL[view.observations.at(-1)!.observation_type]} at{" "}
          {fmtElapsed(view.observations.at(-1)!.elapsed_seconds ?? 0)}
        </p>
      )}
      {err && <Alert tone="error">{err}</Alert>}
      {view.viewer.is_in_car_supervisor && (
        <div className="space-y-2 pt-2">
          <p className="text-center text-xs text-muted">
            {canEnd
              ? `Parked for ${stationaryS}s — you can end the drive`
              : "End unlocks once the car has been still for 30 s"}
          </p>
          <HoldButton
            label={canEnd ? "Hold to end drive" : "End drive (waiting for parked)"}
            disabled={!canEnd || ending}
            onComplete={() => {
              if (confirm("Is the vehicle safely parked?")) void endDrive();
            }}
          />
          {!overrideOpen ? (
            <button
              type="button"
              className="tap w-full text-center text-xs text-muted underline"
              onClick={() => setOverrideOpen(true)}
            >
              Recorder problem? End with an override
            </button>
          ) : (
            <div className="card space-y-2 p-3">
              <input
                aria-label="Override reason"
                className="tap w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (recorded)"
              />
              <Button
                variant="secondary"
                block
                disabled={reason.trim().length < 5 || ending}
                loading={ending}
                onClick={() => endDrive(reason.trim())}
              >
                End with override
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

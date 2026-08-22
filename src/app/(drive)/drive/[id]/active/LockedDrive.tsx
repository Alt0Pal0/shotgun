"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { ensureDeviceId } from "@/lib/client/device";
import { useRecorder } from "@/lib/recorder/useRecorder";
import { queueEnd, pendingEnd, clearPendingEnd } from "@/lib/recorder/buffer";
import type { LockState } from "@/lib/types";
import { HoldButton } from "@/components/ui/HoldButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SAFETY_LOCK_COPY } from "@/lib/copy";
import { fmtElapsed } from "@/lib/util/format";

export function LockedDrive({ initial }: { initial: LockState }) {
  const router = useRouter();
  const [lock, setLock] = useState(initial);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endKey = useRef(newIdempotencyKey());
  const live = lock.status === "ACTIVE" || lock.status === "STOP_CANDIDATE";
  const isRecorder = deviceId != null && deviceId === lock.recorder_device_id;
  const { state, flush } = useRecorder(lock.id, isRecorder ? deviceId : null, live && isRecorder);

  useEffect(() => { ensureDeviceId().then(setDeviceId).catch(() => setDeviceId("")); }, []);

  // Elapsed time from the server start (survives refresh).
  useEffect(() => {
    const started = lock.server_started_at ? Date.parse(lock.server_started_at) : Date.now();
    const skew = Date.parse(lock.server_time) - Date.now();
    const t = setInterval(() => setElapsed((Date.now() + skew - started) / 1000), 1000);
    return () => clearInterval(t);
  }, [lock.server_started_at, lock.server_time]);

  // Lock is a server fact: poll status; leave only when the server says the session is no longer live.
  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const l = await api.get<LockState>(`/api/drives/${lock.id}/lock`);
        if (!on) return;
        setLock(l);
        if (l.status !== "ACTIVE" && l.status !== "STOP_CANDIDATE") router.replace(`/drive/${l.id}/summary`);
      } catch { /* offline: keep the lock */ }
    };
    const t = setInterval(tick, 10_000);
    // Retry a queued end action (PRD §12: end response timed out)
    pendingEnd(lock.id).then((p) => { if (p) void submitEnd(p.payload as { override_reason?: string }, true); });
    return () => { on = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.id]);

  const canEndNormally = state.serverCanEnd || lock.status === "STOP_CANDIDATE";
  const stationaryPct = Math.min(100, Math.round((state.stationarySeconds / 30) * 100));

  async function submitEnd(payload: { override_reason?: string }, retry = false) {
    setBusy(true); setErr(null);
    try {
      await flush();
      await queueEnd(lock.id, payload);
      await api.post(`/api/drives/${lock.id}/end`, { idempotency_key: endKey.current, confirmed_parked: true, override_reason: payload.override_reason ?? null });
      await clearPendingEnd(lock.id);
      router.replace(`/drive/${lock.id}/summary`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "NOT_STATIONARY") { await clearPendingEnd(lock.id); setErr("The car doesn't look parked yet. Wait a moment, or use the override."); setConfirming(false); }
      else if (retry) setErr("Still trying to end the drive…");
      else setErr(e instanceof Error ? e.message : "Could not end the drive — it will retry when you're back online.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col" data-testid="locked-drive">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Learner</p>
      <h1 className="text-2xl font-bold">{SAFETY_LOCK_COPY.title}</h1>
      <p className="text-sm text-muted">The rest of the app is locked until you park.</p>
      <div className="my-8 flex flex-col items-center" aria-live="off">
        <div className={`flex h-56 w-56 items-center justify-center rounded-full border-8 ${canEndNormally ? "border-accent" : "border-surface-2"}`}>
          <p className="numeral text-5xl font-bold" data-testid="elapsed">{fmtElapsed(elapsed)}</p>
        </div>
        <p className="mt-3 text-xs text-muted">elapsed time</p>
      </div>
      <div className="card mb-4 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wider text-amber">Stay focused</p><p className="text-sm">{SAFETY_LOCK_COPY.body}</p></div>
      <ul className="mb-4 grid grid-cols-2 gap-2 text-xs" aria-label="Recording status">
        <li className="card p-2">GPS: <strong>{!isRecorder ? "other device" : state.permission === "denied" ? "blocked" : state.quality === "GOOD" ? "good" : state.quality === "LIMITED" ? "limited" : "no signal"}</strong></li>
        <li className="card p-2">Network: <strong>{state.online ? "online" : "offline — recording locally"}</strong></li>
        <li className="card p-2">Samples: <strong className="numeral">{state.sampleCount}</strong>{state.pendingUpload > 0 && <span className="text-muted"> ({state.pendingUpload} to upload)</span>}</li>
        <li className="card p-2">Screen: <strong>{state.wakeLock === "active" ? "kept awake" : state.wakeLock === "released" ? "may sleep" : "no wake lock"}</strong></li>
      </ul>
      {state.simulated && <p className="mb-2 text-center text-xs text-amber">GPS simulator active</p>}
      {state.error && <div className="mb-3"><Alert tone="warn">{state.error}. Time is still being recorded.</Alert></div>}
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      <div className="mt-auto space-y-3">
        {!confirming ? (
          <>
            <p className="text-center text-xs text-muted" aria-live="polite">{canEndNormally ? "Parked — you can end the drive" : `End unlocks after 30 s parked (${stationaryPct}%)`}</p>
            <HoldButton label={canEndNormally ? "Hold to end drive" : "We're parked (keep still)"} disabled={!canEndNormally || busy} onComplete={() => setConfirming(true)} />
          </>
        ) : (
          <div className="card space-y-3 p-4">
            <p className="text-sm font-semibold">Is the vehicle safely parked?</p>
            <Button size="lg" block loading={busy} onClick={() => submitEnd({})} data-testid="confirm-end">Yes, we&apos;re parked — end drive</Button>
            <Button variant="ghost" block onClick={() => setConfirming(false)}>Not yet</Button>
          </div>
        )}
        {!overrideOpen ? (
          <button type="button" className="tap w-full text-center text-xs text-muted underline" onClick={() => setOverrideOpen(true)}>GPS or phone problem? End with an override</button>
        ) : (
          <div className="card space-y-2 p-3">
            <label className="block text-xs font-medium" htmlFor="override">Why are you ending without parked detection? (recorded for the adult review)</label>
            <input id="override" className="tap w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., GPS lost in parking garage" />
            <Button variant="secondary" block disabled={reason.trim().length < 5 || busy} loading={busy} onClick={() => { setConfirming(false); void submitEnd({ override_reason: reason.trim() }); }}>End with override</Button>
          </div>
        )}
        <a href="tel:911" className="tap block w-full rounded-xl border border-rose/60 py-3 text-center text-sm font-semibold text-rose">Emergency: call 911</a>
      </div>
    </div>
  );
}

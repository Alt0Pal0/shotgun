"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { ensureDeviceId } from "@/lib/client/device";
import type { LockState } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Card } from "@/components/ui/Page";

/** Learner waits for the designated adult to confirm. When READY, this (recorder) device starts the session. */
export function WaitingClient({ initial }: { initial: LockState }) {
  const router = useRouter();
  const [lock, setLock] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startKey = useRef(newIdempotencyKey());

  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const l = await api.get<LockState>(`/api/drives/${initial.id}/lock`);
        if (!on) return;
        setLock(l);
        if (l.status === "ACTIVE" || l.status === "STOP_CANDIDATE") { router.replace(`/drive/${l.id}/active`); return; }
        if (l.status === "VOIDED") { router.replace("/home"); return; }
        if (l.status === "READY" && !busy) { await startNow(); }
      } catch { /* keep polling */ }
    };
    const t = setInterval(tick, 3000);
    return () => { on = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  async function startNow(onePhone = false) {
    setBusy(true); setErr(null);
    try {
      const device = await ensureDeviceId();
      await api.post(`/api/drives/${initial.id}/start`, { device_id: device, idempotency_key: startKey.current, one_phone: onePhone });
      router.replace(`/drive/${initial.id}/active`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not start"); setBusy(false); }
  }
  async function cancel() { await api.post(`/api/drives/${initial.id}/cancel`, { reason: "learner cancelled" }); router.replace("/home"); router.refresh(); }

  return (
    <>
      <PageHeader eyebrow="Drive request sent" title={lock.status === "READY" ? "Starting…" : `Waiting for ${lock.supervisor?.display_name ?? "your adult"}`} subtitle={lock.status === "READY" ? "Your adult confirmed. Starting GPS recording on this phone." : "Ask them to open the app and confirm they're in the car with you."} />
      <Card className="mb-4"><div className="flex items-center gap-3"><span className="h-3 w-3 animate-pulse rounded-full bg-amber" aria-hidden /><p className="text-sm text-muted" aria-live="polite">{lock.status === "READY" ? "Confirmed — starting now" : "Checking every few seconds…"}</p></div></Card>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      <div className="space-y-2">
        <Button variant="secondary" block loading={busy} onClick={() => startNow(true)}>My adult is here but can&apos;t confirm on their phone — start on this phone</Button>
        <Button variant="ghost" block onClick={cancel}>Cancel request</Button>
      </div>
    </>
  );
}

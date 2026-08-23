"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { ensureDeviceId } from "@/lib/client/device";
import type { LockState } from "@/lib/types";
import { rideRequestShareText } from "@/lib/brand";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Card } from "@/components/ui/Page";

/** Learner waits for the designated adult to confirm. When READY, this (recorder) device starts the session. */
export function WaitingClient({ initial, learnerName }: { initial: LockState; learnerName: string }) {
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
        if (l.status === "ACTIVE" || l.status === "STOP_CANDIDATE") {
          router.replace(`/drive/${l.id}/active`);
          return;
        }
        if (l.status === "VOIDED") {
          router.replace("/home");
          return;
        }
        if (l.status === "READY" && !busy) {
          await startNow();
        }
      } catch {
        /* keep polling */
      }
    };
    const t = setInterval(tick, 3000);
    return () => {
      on = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  async function startNow(onePhone = false) {
    setBusy(true);
    setErr(null);
    try {
      const device = await ensureDeviceId();
      await api.post(`/api/drives/${initial.id}/start`, {
        device_id: device,
        idempotency_key: startKey.current,
        one_phone: onePhone,
      });
      router.replace(`/drive/${initial.id}/active`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start");
      setBusy(false);
    }
  }
  async function nudge() {
    const url = `${window.location.origin}/drive/${initial.id}/accept`;
    const text = rideRequestShareText(learnerName, url);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Come ride shotgun with me? 🤘", text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(text);
    setErr(null);
    alert("Message copied — paste it into a text.");
  }
  async function cancel() {
    await api.post(`/api/drives/${initial.id}/cancel`, { reason: "learner cancelled" });
    router.replace("/home");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Drive request sent"
        title={
          lock.status === "READY"
            ? "Starting…"
            : `Waiting for ${lock.supervisor?.display_name ?? "your shotgun"} to call it`
        }
        subtitle={
          lock.status === "READY"
            ? "Your shotgun confirmed. Starting GPS recording on this phone."
            : "They confirm from their own phone that they're in the passenger seat and the car is parked."
        }
      />
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-amber" aria-hidden />
          <p className="text-sm text-muted" aria-live="polite">
            {lock.status === "READY" ? "Confirmed — starting now" : "Checking every few seconds…"}
          </p>
        </div>
      </Card>
      {err && (
        <div className="mb-4">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
      <div className="space-y-2">
        <Button block onClick={nudge}>
          Text them: &ldquo;Come ride shotgun with me?&rdquo;
        </Button>
        <Button variant="secondary" block loading={busy} onClick={() => startNow(true)}>
          My adult is here but can&apos;t confirm on their phone — start on this phone
        </Button>
        <Button variant="ghost" block onClick={cancel}>
          Cancel request
        </Button>
      </div>
    </>
  );
}

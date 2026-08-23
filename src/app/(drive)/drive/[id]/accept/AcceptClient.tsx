"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import type { SessionDetail } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Card } from "@/components/ui/Page";

export function AcceptClient({ session, isDesignated }: { session: SessionDetail; isDesignated: boolean }) {
  const router = useRouter();
  const [key] = useState(newIdempotencyKey);
  const [c, setC] = useState({
    designated_supervisor: false,
    physically_present: false,
    vehicle_parked: false,
    ready: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState(session.status);
  const all = Object.values(c).every(Boolean);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const d = await api.get<SessionDetail>(`/api/drives/${session.id}`);
        setStatus(d.status);
        if (d.status === "ACTIVE" || d.status === "STOP_CANDIDATE") router.replace(`/drive/${session.id}/live`);
        if (d.status === "VOIDED") router.replace("/reviews");
      } catch {
        /* retry */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [session.id, router]);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/drives/${session.id}/accept`, { ...c, idempotency_key: key });
      setStatus("READY");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  }
  async function decline() {
    await api.post(`/api/drives/${session.id}/cancel`, { reason: "adult declined" });
    router.replace("/reviews");
    router.refresh();
  }

  if (status === "READY")
    return (
      <>
        <PageHeader
          eyebrow="Confirmed"
          title="Waiting for the recorder"
          subtitle={`${session.learner?.display_name}'s phone is starting GPS recording. The live view opens automatically.`}
        />
        <Card>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-accent" aria-hidden />
            <p className="text-sm text-muted">Listening for the session to start…</p>
          </div>
        </Card>
      </>
    );
  if (!isDesignated)
    return (
      <>
        <PageHeader
          eyebrow="Drive request"
          title={`${session.learner?.display_name} requested a drive`}
          subtitle={`${session.supervisor?.display_name ?? "Another adult"} is the designated supervisor for this drive.`}
        />
        <Alert tone="info">
          Only the designated in-car supervisor can confirm. If you are in the car instead, ask the learner to restart
          the request selecting you.
        </Alert>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Drive request"
        title={`${session.learner?.display_name} called shotgun — for you`}
        subtitle="Confirm each item from the passenger seat. The learner's phone locks the moment the drive starts."
      />
      {session.vehicle && <p className="mb-3 text-sm text-muted">Vehicle: {session.vehicle.label}</p>}
      <div className="space-y-2">
        <Checkbox
          checked={c.designated_supervisor}
          onChange={(e) => setC({ ...c, designated_supervisor: e.target.checked })}
          label="I'm riding shotgun on this drive as the designated supervising adult"
          hint="A California-licensed adult age 25 or older, per my attestation."
        />
        <Checkbox
          checked={c.physically_present}
          onChange={(e) => setC({ ...c, physically_present: e.target.checked })}
          label="I'm physically in the passenger seat"
        />
        <Checkbox
          checked={c.vehicle_parked}
          onChange={(e) => setC({ ...c, vehicle_parked: e.target.checked })}
          label="The vehicle is parked"
        />
        <Checkbox
          checked={c.ready}
          onChange={(e) => setC({ ...c, ready: e.target.checked })}
          label="We're ready to begin"
        />
      </div>
      {err && (
        <div className="mt-3">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
      <div className="mt-4 space-y-2">
        <Button size="xl" block disabled={!all} loading={busy} onClick={accept}>
          Shotgun! Let&rsquo;s go
        </Button>
        <Button variant="ghost" block onClick={decline}>
          Decline
        </Button>
      </div>
    </>
  );
}

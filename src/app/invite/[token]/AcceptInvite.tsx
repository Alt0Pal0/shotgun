"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { ATTESTATION_TEXT } from "@/lib/copy";
import { GUARDIAN_CONSENT } from "@/lib/legal/documents";

export function AcceptInvite({ token, learnerName }: { token: string; learnerName: string }) {
  const router = useRouter();
  const [attest, setAttest] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      await api.post("/api/invitations/accept", { token, attestation: true, guardian_consent: true });
      router.push("/reviews");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Accepting links your account to {learnerName}. You will see their drives, routes, reflections, and progress, and
        you can review and approve practice time.
      </p>
      <Checkbox
        label="Supervisor attestation"
        hint={ATTESTATION_TEXT}
        checked={attest}
        onChange={(e) => setAttest(e.target.checked)}
      />
      <Checkbox
        label={GUARDIAN_CONSENT.title}
        hint={GUARDIAN_CONSENT.summary}
        checked={guardian}
        onChange={(e) => setGuardian(e.target.checked)}
      />
      <p className="text-xs text-muted">
        Both acceptances are recorded with the date, time, IP address, and device. The app does not verify your driver
        license.
      </p>
      {err && <Alert tone="error">{err}</Alert>}
      <Button size="lg" block disabled={!attest || !guardian} loading={busy} onClick={accept}>
        Accept — I&rsquo;ll ride shotgun
      </Button>
    </div>
  );
}

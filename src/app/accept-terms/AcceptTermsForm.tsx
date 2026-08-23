"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { LegalCheckboxes } from "@/components/legal/LegalCheckboxes";

export function AcceptTermsForm() {
  const router = useRouter();
  const [terms, setTerms] = useState(false);
  const [risk, setRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await api.post("/api/legal/accept", { acceptTerms: true, acceptRisk: true });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-4">
      <LegalCheckboxes terms={terms} risk={risk} onTerms={setTerms} onRisk={setRisk} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button size="lg" block disabled={!terms || !risk} loading={busy} onClick={submit}>
        I agree — continue
      </Button>
    </div>
  );
}

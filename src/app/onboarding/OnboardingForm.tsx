"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { GPS_LIMITS_COPY } from "@/lib/copy";

export function OnboardingForm({ displayName, isAdult }: { displayName: string; isAdult: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.patch("/api/profile", { display_name: name, timezone: tz, onboarding_completed: true });
      await api.post("/api/track", { jurisdiction: "US-CA", permitIssueDate: date });
      router.push("/home"); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {isAdult && <Alert tone="info">You are linked as a supervising adult. Only create a permit profile if you are also a learner. <a className="underline" href="/reviews">Go to reviews</a></Alert>}
      <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      <Select label="State" value="US-CA" onChange={() => undefined}><option value="US-CA">California</option></Select>
      <Input label="Permit issue date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required max={new Date().toISOString().slice(0, 10)} hint="Found on your instruction permit. No permit number is collected." />
      <p className="text-xs text-muted">Timezone detected: {tz}</p>
      <Alert tone="warn" title="Before your first drive">{GPS_LIMITS_COPY} Enable your phone&apos;s Driving Focus; this app can only lock its own screen.</Alert>
      {err && <Alert tone="error">{err}</Alert>}
      <Button type="submit" size="lg" block loading={busy}>Continue to Home</Button>
    </form>
  );
}

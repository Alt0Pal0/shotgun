"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Page";

const ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export function ProfileForm({
  displayName,
  timezone,
  unit,
}: {
  displayName: string;
  timezone: string;
  unit: "imperial" | "metric";
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [tz, setTz] = useState(timezone);
  const [units, setUnits] = useState(unit);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES];
  const dirty = name !== displayName || tz !== timezone || units !== unit;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.patch("/api/profile", { display_name: name, timezone: tz, unit_preference: units });
      setMsg({ tone: "success", text: "Saved" });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Account">
      <form onSubmit={save} className="space-y-3">
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        <Select
          label="Timezone"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          hint="Used for drive dates and night-time calculations."
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace("_", " ")}
            </option>
          ))}
        </Select>
        <Select label="Units" value={units} onChange={(e) => setUnits(e.target.value as "imperial" | "metric")}>
          <option value="imperial">Miles</option>
          <option value="metric">Kilometers</option>
        </Select>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" block disabled={!dirty} loading={busy}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

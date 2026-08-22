"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { ensureDeviceId, isStandalonePwa } from "@/lib/client/device";
import type { Skill, Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Page";
import { SAFETY_LOCK_COPY } from "@/lib/copy";

type Perm = "granted" | "denied" | "prompt" | "unknown";

export function PreDriveForm({ adults, vehicles, skills }: { adults: { id: string; name: string }[]; vehicles: Vehicle[]; skills: Skill[] }) {
  const router = useRouter();
  const [key] = useState(newIdempotencyKey);
  const [supervisor, setSupervisor] = useState(adults[0]?.id ?? "");
  const [vehicle, setVehicle] = useState(vehicles[0]?.id ?? "");
  const [newVehicle, setNewVehicle] = useState("");
  const [vehicleList, setVehicleList] = useState(vehicles);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [present, setPresent] = useState(false);
  const [parked, setParked] = useState(false);
  const [onePhone, setOnePhone] = useState(false);
  const [perm, setPerm] = useState<Perm>("unknown");
  const [battery, setBattery] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sim = process.env.NEXT_PUBLIC_GPS_SIMULATOR === "1";
  const wakeSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  useEffect(() => {
    ensureDeviceId().then(setDeviceId).catch(() => setErr("Could not register this phone as the recorder"));
    navigator.permissions?.query({ name: "geolocation" }).then((p) => { setPerm(p.state as Perm); p.onchange = () => setPerm(p.state as Perm); }).catch(() => undefined);
    (navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery?.().then((b) => setBattery(`${Math.round(b.level * 100)}%${b.charging ? " (charging)" : ""}`)).catch(() => undefined);
  }, []);

  function requestLocation() {
    if (sim && localStorage.getItem("ldp_sim") === "1") { setPerm("granted"); return; }
    navigator.geolocation.getCurrentPosition(() => setPerm("granted"), (e) => setPerm(e.code === e.PERMISSION_DENIED ? "denied" : "prompt"), { enableHighAccuracy: true, timeout: 15_000 });
  }
  async function addVehicle() {
    if (!newVehicle.trim()) return;
    const r = await api.post<{ id: string }>("/api/vehicles", { label: newVehicle.trim() });
    setVehicleList((v) => [...v, { id: r.id, label: newVehicle.trim() }]); setVehicle(r.id); setNewVehicle("");
  }
  async function start() {
    if (!deviceId) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ id: string }>("/api/drives/request", { supervisor_id: supervisor, vehicle_id: vehicle || null, recorder_device_id: deviceId, supervisor_present: true, planned_skill_ids: skillIds, location_permission: perm, idempotency_key: key });
      if (onePhone) await api.post(`/api/drives/${r.id}/start`, { device_id: deviceId, idempotency_key: `${key}-start`, one_phone: true });
      router.replace(onePhone ? `/drive/${r.id}/active` : `/drive/${r.id}/waiting`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not start"); setBusy(false); }
  }
  const ready = Boolean(deviceId) && present && parked && perm === "granted" && Boolean(supervisor);
  return (
    <div className="space-y-4">
      <Card>
        <Select label="Supervising adult (in the car)" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}>{adults.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <div className="mt-3"><Select label="Vehicle (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)}><option value="">No vehicle</option>{vehicleList.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</Select></div>
        <div className="mt-2 flex gap-2"><Input label="Add a vehicle" value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} maxLength={60} placeholder="e.g., Blue Civic" /><Button type="button" variant="secondary" className="self-end" onClick={addVehicle}>Add</Button></div>
      </Card>
      <Card title="Practice goals (optional, up to 5)">
        <div className="flex flex-wrap gap-2">{skills.map((k) => { const on = skillIds.includes(k.id); return <button key={k.id} type="button" aria-pressed={on} onClick={() => setSkillIds((s) => on ? s.filter((x) => x !== k.id) : s.length < 5 ? [...s, k.id] : s)} className={`tap rounded-full px-3 py-2 text-sm font-semibold ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink"}`}>{k.label}</button>; })}</div>
      </Card>
      <Card title="This phone is the GPS recorder">
        <ul className="space-y-1 text-sm">
          <li>Location permission: <strong>{perm}</strong> {perm !== "granted" && <Button type="button" variant="secondary" className="ml-2" onClick={requestLocation}>Allow location</Button>}</li>
          {perm === "denied" && <li className="text-rose">Location is blocked. Open your browser&apos;s site settings to allow location, or <a className="underline" href="/records/new">add this drive manually</a> afterwards.</li>}
          <li>Screen wake lock: {wakeSupported ? "supported" : "not supported — keep the screen on manually"}</li>
          <li>Battery: {battery ?? "unknown"}</li>
          <li>Installed as app: {typeof window !== "undefined" && isStandalonePwa() ? "yes" : "no (works in the browser too)"}</li>
        </ul>
        {sim && <label className="mt-2 flex items-center gap-2 text-xs text-amber"><input type="checkbox" defaultChecked={typeof window !== "undefined" && localStorage.getItem("ldp_sim") === "1"} onChange={(e) => { localStorage.setItem("ldp_sim", e.target.checked ? "1" : "0"); if (e.target.checked) setPerm("granted"); }} /> Use GPS simulator (development)</label>}
      </Card>
      <Checkbox checked={present} onChange={(e) => setPresent(e.target.checked)} label="My supervising adult is physically in the car with me" />
      <Checkbox checked={parked} onChange={(e) => setParked(e.target.checked)} label="The vehicle is parked and I will stow this phone before driving" hint={SAFETY_LOCK_COPY.limits} />
      <Checkbox checked={onePhone} onChange={(e) => setOnePhone(e.target.checked)} label="One-phone fallback: my adult can't confirm on their own phone right now" hint="The drive starts immediately on this phone. Your adult can still open the live view later from their account." />
      {err && <Alert tone="error">{err}</Alert>}
      <Button size="xl" block disabled={!ready} loading={busy} onClick={start}>{onePhone ? "START DRIVE" : "REQUEST DRIVE"}</Button>
      <p className="text-center text-xs text-muted">{onePhone ? "The app locks immediately." : "Your adult gets the request on their phone. The app locks the moment the drive becomes active."}</p>
    </div>
  );
}

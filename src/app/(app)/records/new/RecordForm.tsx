"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { Rating } from "@/components/ui/Rating";
import { Alert } from "@/components/ui/Alert";

interface LearnerOpt { id: string; name: string; adults: { id: string; name: string }[] }

export function RecordForm({ learners, defaultLearner, defaultType, isLearner }: { learners: LearnerOpt[]; defaultLearner?: string; defaultType: "FAMILY_SUPERVISED" | "PROFESSIONAL_INSTRUCTION"; isLearner: boolean }) {
  const router = useRouter();
  const [key] = useState(newIdempotencyKey);
  const [type, setType] = useState(defaultType);
  const [learnerId, setLearnerId] = useState(defaultLearner ?? learners[0]?.id ?? "");
  const learner = useMemo(() => learners.find((l) => l.id === learnerId), [learners, learnerId]);
  const [supervisor, setSupervisor] = useState(learner?.adults[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [duration, setDuration] = useState(60);
  const [night, setNight] = useState(0);
  const [school, setSchool] = useState("");
  const [instructor, setInstructor] = useState("");
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pro = type === "PROFESSIONAL_INSTRUCTION";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const started_at = new Date(`${date}T${time}:00`).toISOString();
      const r = await api.post<{ id: string }>("/api/drives/manual", { learner_id: learnerId, session_type: type, supervisor_id: pro ? null : supervisor || null, started_at, duration_minutes: duration, night_minutes: pro ? 0 : night, school_name: pro ? school : undefined, instructor_name: pro ? instructor : undefined, learner_note: note || undefined, learner_rating: rating, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, idempotency_key: key });
      router.push(`/drives/${r.id}`); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset><legend className="mb-2 text-sm font-medium">Record type</legend>
        <div className="grid grid-cols-2 gap-2">{([["FAMILY_SUPERVISED", "Past supervised drive"], ["PROFESSIONAL_INSTRUCTION", "Instructor lesson"]] as const).map(([k, l]) => <label key={k} className={`tap flex cursor-pointer items-center justify-center rounded-xl border p-3 text-center text-sm font-semibold ${type === k ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-2"}`}><input type="radio" className="sr-only" name="type" checked={type === k} onChange={() => setType(k)} />{l}</label>)}</div>
      </fieldset>
      {learners.length > 1 && <Select label="Learner" value={learnerId} onChange={(e) => setLearnerId(e.target.value)}>{learners.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>}
      {!pro && <Select label="Supervising adult" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} required>{(learner?.adults ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}
      <div className="grid grid-cols-2 gap-2"><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required max={new Date().toISOString().slice(0, 10)} /><Input label="Start time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-2"><Input label="Duration (minutes)" type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />{!pro && <Input label="Night minutes" type="number" min={0} max={duration} value={night} onChange={(e) => setNight(Number(e.target.value))} hint="Within the duration" />}</div>
      {pro && <><Input label="Driving school (optional)" value={school} onChange={(e) => setSchool(e.target.value)} maxLength={120} /><Input label="Instructor name (optional)" value={instructor} onChange={(e) => setInstructor(e.target.value)} maxLength={120} /></>}
      {isLearner && <Rating label="How did it go? (optional)" value={rating} onChange={setRating} />}
      <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <Checkbox checked={attest} onChange={(e) => setAttest(e.target.checked)} label={isLearner ? "I understand this record needs adult approval and shows no route or distance" : pro ? "I attest this instruction took place as described. The app does not verify the school." : "I attest I supervised this drive as described."} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button type="submit" size="lg" block loading={busy} disabled={!attest}>Save for review</Button>
    </form>
  );
}

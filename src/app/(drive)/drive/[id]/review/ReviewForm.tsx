"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, newIdempotencyKey } from "@/lib/client/api";
import type { SessionDetail, Skill } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Rating } from "@/components/ui/Rating";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Card } from "@/components/ui/Page";
import { RouteMap } from "@/components/drive/RouteMap";
import { EvidenceChip, QualityChip } from "@/components/ui/Chips";
import { ObservationTimeline, OBS_LABEL } from "@/components/drive/ObservationTimeline";
import { fmtDateTime, fmtDistance, fmtDuration } from "@/lib/util/format";

export function ReviewForm({ session: s, skills, tz, unit }: { session: SessionDetail; skills: Skill[]; tz?: string; unit: "imperial" | "metric" }) {
  const router = useRouter();
  const [key] = useState(newIdempotencyKey);
  const reapprove = s.status === "APPROVED";
  const baseDur = reapprove ? s.credited_duration_minutes : s.proposed_duration_minutes;
  const baseNight = reapprove ? s.credited_night_minutes : s.proposed_night_minutes;
  const [dur, setDur] = useState<number>(baseDur ?? 0);
  const [night, setNight] = useState<number>(baseNight ?? 0);
  const [reason, setReason] = useState(s.review?.correction_reason ?? "");
  const [rating, setRating] = useState<number | null>(s.review?.rating ?? null);
  const [wentWell, setWentWell] = useState(s.review?.went_well ?? "");
  const [nextFocus, setNextFocus] = useState(s.review?.next_focus ?? "");
  const [summary, setSummary] = useState(s.review?.summary ?? "");
  const [skillIds, setSkillIds] = useState<string[]>(s.skill_tags.filter((t) => t.source_role === "IN_CAR_SUPERVISOR").map((t) => t.skill_id));
  const [finalized, setFinalized] = useState<Set<string>>(new Set(s.observations.filter((o) => o.finalized || !reapprove).map((o) => o.id)));
  const [ackOverlap, setAckOverlap] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ message: string; hint?: string } | null>(null);
  const corrected = dur !== (baseDur ?? 0) || night !== (baseNight ?? 0);
  const coords = s.route?.simplified_geojson?.coordinates ?? s.route?.route_geojson?.coordinates ?? [];

  async function decide(decision: "APPROVED" | "RETURNED" | "VOIDED") {
    setBusy(decision); setErr(null);
    try {
      await api.put(`/api/drives/${s.id}/review`, { decision, rating, went_well: wentWell, next_focus: nextFocus, summary, credited_duration_minutes: decision === "APPROVED" ? dur : undefined, credited_night_minutes: decision === "APPROVED" ? night : undefined, correction_reason: reason || undefined, skill_ids: skillIds, finalized_observation_ids: [...finalized], acknowledge_overlap: ackOverlap, idempotency_key: key });
      router.replace(`/drives/${s.id}`); router.refresh();
    } catch (e) { const er = e as { message: string; hint?: string; code?: string }; setErr({ message: er.message, hint: er.hint }); setBusy(null); }
  }
  const toggleSkill = (id: string) => setSkillIds((x) => x.includes(id) ? x.filter((k) => k !== id) : [...x, id]);
  const toggleObs = (id: string) => setFinalized((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <PageHeader eyebrow={reapprove ? "Correct an approved drive" : "Review this drive"} title={s.learner?.display_name ?? "Learner"} subtitle={<>{fmtDateTime(s.started_at, tz)} · submitted {s.reflection?.submitted_at ? fmtDateTime(s.reflection.submitted_at, tz) : "—"}</>} />
      <Card>
        <div className="mb-2 flex flex-wrap gap-1"><EvidenceChip evidence={s.evidence_type} sessionType={s.session_type} />{s.evidence_type === "GPS" && <QualityChip quality={s.gps_quality} />}{s.gps_incomplete && <span className="chip bg-amber/20 text-amber">Route may be incomplete</span>}{s.end_override_reason && <span className="chip bg-amber/20 text-amber">Override: {s.end_override_reason}</span>}{s.status === "RECOVERY_REQUIRED" && <span className="chip bg-rose/20 text-rose">Recovery: {s.processing_error ?? "processing failed"}</span>}</div>
        {s.evidence_type === "GPS" && (s.route?.route_deleted_at ? <p className="text-sm text-muted">Route deleted.</p> : <RouteMap coordinates={coords} stale={s.gps_incomplete} markers={s.observations.filter((o) => o.latitude != null).map((o) => ({ lat: o.latitude as number, lng: o.longitude as number, label: OBS_LABEL[o.observation_type], tone: o.assessment === "POSITIVE" ? "positive" : o.assessment === "IMPROVEMENT" ? "improvement" : "neutral" }))} />)}
        <p className="mt-2 numeral text-lg font-bold">{fmtDuration(s.proposed_duration_minutes)}{s.evidence_type === "GPS" ? ` · ${fmtDistance(s.distance_meters, unit)}` : ""}</p>
        <p className="text-xs text-muted">Proposed night: {s.proposed_night_minutes} min{s.night_gap_minutes ? ` · ${s.night_gap_minutes} min of GPS gaps not classified — confirm below` : ""} · evidence: {s.evidence_type.toLowerCase()}{s.session_type === "PROFESSIONAL_INSTRUCTION" ? ` · ${s.school_name ?? "school not given"}` : ""}</p>
      </Card>
      {s.reflection?.status === "SUBMITTED" ? (
        <Card title="Learner said"><p className="text-lg font-bold">{s.reflection.rating} / 5</p>{s.reflection.went_well && <p className="text-sm"><span className="text-muted">Went well:</span> {s.reflection.went_well}</p>}{s.reflection.improve && <p className="text-sm"><span className="text-muted">Needs work:</span> {s.reflection.improve}</p>}{s.reflection.summary && <p className="text-sm">{s.reflection.summary}</p>}{s.skill_tags.some((t) => t.source_role === "LEARNER") && <p className="mt-1 text-xs text-muted">Skills: {s.skill_tags.filter((t) => t.source_role === "LEARNER").map((t) => t.label).join(", ")}</p>}</Card>
      ) : <Card title="Learner reflection"><p className="text-sm text-muted">No learner reflection for this record.</p></Card>}
      {s.observations.length > 0 && <Card title="In-drive observations — tick to finalize as evidence"><ObservationTimeline observations={s.observations} skills={skills} selectable selected={finalized} onToggle={toggleObs} /></Card>}
      <Card title="Confirm credited time">
        <div className="grid grid-cols-2 gap-2"><Input label="Duration (minutes)" type="number" min={1} max={1440} value={dur} onChange={(e) => setDur(Number(e.target.value))} /><Input label="Night minutes" type="number" min={0} max={dur} value={night} onChange={(e) => setNight(Number(e.target.value))} hint="Cannot exceed duration" /></div>
        <div className="mt-2"><Input label={corrected ? "Reason for correction (required, stored in the audit log)" : "Reason (required only when correcting time or voiding)"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={280} /></div>
      </Card>
      <Card title="Your feedback">
        <Rating label="Rate this drive" value={rating} onChange={setRating} />
        <div className="mt-3 space-y-3"><Textarea label="What went well" value={wentWell} maxLength={500} onChange={(e) => setWentWell(e.target.value)} /><Textarea label="Practice next" value={nextFocus} maxLength={500} onChange={(e) => setNextFocus(e.target.value)} /><Textarea label="Short summary (optional)" value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} /></div>
        <fieldset className="mt-3"><legend className="mb-2 text-sm font-medium">Skill tags</legend><div className="flex flex-wrap gap-2">{skills.map((k) => { const on = skillIds.includes(k.id); return <button key={k.id} type="button" aria-pressed={on} onClick={() => toggleSkill(k.id)} className={`tap rounded-full px-3 py-2 text-sm font-semibold ${on ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>{k.label}</button>; })}</div></fieldset>
      </Card>
      {err && <Alert tone="error" title={err.message}>{err.hint && <><p className="mt-1 text-xs">Overlapping approved record(s) found. Void or correct one of them, or tick to acknowledge and approve anyway.</p><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={ackOverlap} onChange={(e) => setAckOverlap(e.target.checked)} /> I reviewed the overlap and want to approve</label></>}</Alert>}
      <div className="space-y-2">
        <Button size="xl" block variant="success" loading={busy === "APPROVED"} disabled={busy != null || !rating} onClick={() => decide("APPROVED")}>{reapprove ? "Save correction" : "APPROVE DRIVE"}</Button>
        {!reapprove && <Button block variant="secondary" loading={busy === "RETURNED"} disabled={busy != null} onClick={() => decide("RETURNED")}>Return to learner for revision</Button>}
        <Button block variant="ghost" className="text-rose" loading={busy === "VOIDED"} disabled={busy != null || !reason} onClick={() => decide("VOIDED")}>Void this record{!reason && " (enter a reason above)"}</Button>
      </div>
      <p className="text-center text-xs text-muted">Approval creates requirement contributions exactly once. Retrying is safe.</p>
    </form>
  );
}

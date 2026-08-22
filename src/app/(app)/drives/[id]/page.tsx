import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { SessionDetail, Skill } from "@/lib/types";
import { PageHeader, Card } from "@/components/ui/Page";
import { EvidenceChip, QualityChip, StatusChip } from "@/components/ui/Chips";
import { RouteMap } from "@/components/drive/RouteMap";
import { ObservationTimeline } from "@/components/drive/ObservationTimeline";
import { RouteDeleteControl } from "@/components/drive/RouteDeleteControl";
import { fmtDateTime, fmtDistance, fmtDuration } from "@/lib/util/format";
import { Alert } from "@/components/ui/Alert";

export default async function DriveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend, me } = await requireUser();
  const [s, skills] = await Promise.all([backend.rpc<SessionDetail | null>("session_detail", { p_session: id }), backend.rpc<Skill[]>("skills_list")]);
  if (!s) notFound();
  const tz = me.profile?.timezone;
  const coords = s.route?.simplified_geojson?.coordinates ?? s.route?.route_geojson?.coordinates ?? [];
  const minutes = s.credited_duration_minutes ?? s.proposed_duration_minutes;
  const next = s.viewer.is_learner && (s.status === "AWAITING_LEARNER_REFLECTION" || s.status === "RETURNED_FOR_REVISION") ? { href: `/drive/${s.id}/reflect`, label: s.status === "RETURNED_FOR_REVISION" ? "Revise your reflection" : "Write your reflection" }
    : s.viewer.is_learner && s.status === "ENDED" ? { href: `/drive/${s.id}/summary`, label: "View summary" }
    : s.viewer.can_review && (s.status === "AWAITING_ADULT_REVIEW" || s.status === "RECOVERY_REQUIRED") ? { href: `/drive/${s.id}/review`, label: "Review this drive" }
    : s.viewer.can_review && s.status === "APPROVED" ? { href: `/drive/${s.id}/review`, label: "Correct or void" } : null;
  const skillLabel = (sid: string) => skills.find((k) => k.id === sid)?.label ?? "Skill";
  return (
    <>
      <PageHeader eyebrow={s.session_type === "PROFESSIONAL_INSTRUCTION" ? "Instructor lesson" : s.evidence_type === "MANUAL" ? "Manual record" : "Drive"} title={`${fmtDuration(minutes)}${s.evidence_type === "GPS" ? ` · ${fmtDistance(s.distance_meters, me.profile?.unit_preference)}` : ""}`} subtitle={<>{fmtDateTime(s.started_at, tz)} · <StatusChip status={s.status} /></>} />
      {next && <Link href={next.href} className="tap mb-4 flex items-center justify-center rounded-2xl bg-accent px-5 py-4 text-base font-bold text-accent-ink">{next.label}</Link>}
      {s.status === "VOIDED" && <div className="mb-4"><Alert tone="warn">This record was voided and does not count toward any requirement.</Alert></div>}
      <div className="mb-3 flex flex-wrap gap-1"><EvidenceChip evidence={s.evidence_type} sessionType={s.session_type} />{s.evidence_type === "GPS" && <QualityChip quality={s.gps_quality} />}{s.gps_incomplete && <span className="chip bg-amber/20 text-amber">Route may be incomplete</span>}{s.end_override_reason && <span className="chip bg-amber/20 text-amber">Ended by override</span>}</div>
      {s.evidence_type === "GPS" && (
        <Card className="mb-4">
          {s.route?.route_deleted_at ? <p className="text-sm text-muted">Exact route deleted on {fmtDateTime(s.route.route_deleted_at, tz)}. Duration, ratings, and feedback are retained.</p>
            : <RouteMap coordinates={coords} stale={s.gps_incomplete} markers={s.observations.filter((o) => o.latitude != null).map((o) => ({ lat: o.latitude as number, lng: o.longitude as number, label: `${o.observation_type} ${o.skill_id ? skillLabel(o.skill_id) : ""}`, tone: o.assessment === "POSITIVE" ? "positive" : o.assessment === "IMPROVEMENT" ? "improvement" : "neutral" }))} />}
          <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
            <dt className="text-muted">Night minutes</dt><dd className="numeral">{s.credited_night_minutes || s.proposed_night_minutes}{s.night_gap_minutes ? ` (+${s.night_gap_minutes} min unclassified gap)` : ""}</dd>
            <dt className="text-muted">Supervisor</dt><dd>{s.supervisor?.display_name ?? "—"}</dd>
            {s.vehicle && <><dt className="text-muted">Vehicle</dt><dd>{s.vehicle.label}</dd></>}
            {s.route && !s.route.route_deleted_at && <><dt className="text-muted">GPS points</dt><dd className="numeral">{s.route.accepted_point_count} of {s.route.point_count} accepted</dd></>}
          </dl>
          {!s.route?.route_deleted_at && s.route && <RouteDeleteControl sessionId={s.id} />}
        </Card>
      )}
      {s.session_type === "PROFESSIONAL_INSTRUCTION" && <Card className="mb-4" title="Instructor"><p className="text-sm">{s.school_name || "School not recorded"}{s.instructor_name ? ` · ${s.instructor_name}` : ""}</p><p className="mt-1 text-xs text-muted">Parent attested. The app does not verify the driving school directly.</p></Card>}
      {s.reflection && (s.reflection.status === "SUBMITTED" || s.viewer.is_learner) && (
        <Card className="mb-4" title={`Learner reflection${s.reflection.status === "DRAFT" ? " (draft)" : ""}`}>
          <p className="text-lg font-bold">{s.reflection.rating ?? "—"} / 5</p>
          {s.reflection.went_well && <p className="mt-1 text-sm"><span className="text-muted">Went well:</span> {s.reflection.went_well}</p>}
          {s.reflection.improve && <p className="mt-1 text-sm"><span className="text-muted">Needs work:</span> {s.reflection.improve}</p>}
          {s.reflection.summary && <p className="mt-1 text-sm">{s.reflection.summary}</p>}
        </Card>
      )}
      {s.review && (
        <Card className="mb-4" title={`Adult feedback · ${s.review.decision.toLowerCase()}`}>
          {s.review.rating != null && <p className="text-lg font-bold">{s.review.rating} / 5</p>}
          {s.review.went_well && <p className="mt-1 text-sm"><span className="text-muted">Went well:</span> {s.review.went_well}</p>}
          {s.review.next_focus && <p className="mt-1 text-sm"><span className="text-muted">Practice next:</span> {s.review.next_focus}</p>}
          {s.review.summary && <p className="mt-1 text-sm">{s.review.summary}</p>}
          {s.review.correction_reason && <p className="mt-2 text-xs text-muted">Correction: {s.review.correction_reason}</p>}
        </Card>
      )}
      {s.skill_tags.length > 0 && <Card className="mb-4" title="Skills"><div className="flex flex-wrap gap-1">{s.skill_tags.map((t) => <span key={`${t.skill_id}-${t.source_role}`} className="chip bg-surface-2 text-ink">{t.label}<span className="text-muted"> · {t.source_role === "LEARNER" ? "learner" : "adult"}</span></span>)}</div></Card>}
      {s.observations.length > 0 && <Card className="mb-4" title="In-drive observations"><ObservationTimeline observations={s.observations} skills={skills} /></Card>}
      {s.contributions.length > 0 && <Card className="mb-4" title="Requirement contributions"><ul className="text-sm">{s.contributions.map((c) => <li key={c.requirement_key} className="flex justify-between"><span>{c.requirement_key}</span><span className="numeral">{c.amount} {c.unit}</span></li>)}</ul></Card>}
      {s.audit.length > 0 && <Card title="History"><ul className="space-y-1 text-xs text-muted">{s.audit.map((a, i) => <li key={i}>{fmtDateTime(a.created_at, tz)} · {a.action.replaceAll("_", " ")}{a.reason ? ` — ${a.reason}` : ""}</li>)}</ul></Card>}
    </>
  );
}

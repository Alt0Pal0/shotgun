import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { processEndedSession } from "@/lib/sessions/process";
import type { SessionDetail } from "@/lib/types";
import { PageHeader, Card } from "@/components/ui/Page";
import { RouteMap } from "@/components/drive/RouteMap";
import { QualityChip } from "@/components/ui/Chips";
import { Alert } from "@/components/ui/Alert";
import { fmtDateTime, fmtDistance, fmtDuration } from "@/lib/util/format";
import { ProcessingPoll } from "./ProcessingPoll";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend, me } = await requireUser({ enforceLock: true });
  let s = await backend.rpc<SessionDetail | null>("session_detail", { p_session: id });
  if (!s) notFound();
  if (s.status === "ENDED") { await processEndedSession(backend, id).catch(() => undefined); s = (await backend.rpc<SessionDetail | null>("session_detail", { p_session: id })) ?? s; }
  if (s.status === "ACTIVE" || s.status === "STOP_CANDIDATE") redirect(`/drive/${id}/active`);
  const coords = s.route?.simplified_geojson?.coordinates ?? s.route?.route_geojson?.coordinates ?? [];
  const processing = s.status === "ENDED";
  return (
    <>
      <PageHeader eyebrow="Drive complete" title={`${fmtDuration(s.proposed_duration_minutes)} · ${s.distance_meters != null ? fmtDistance(s.distance_meters, me.profile?.unit_preference) : "distance unavailable"}`} subtitle={`${fmtDateTime(s.started_at, me.profile?.timezone)} → ${fmtDateTime(s.ended_at, me.profile?.timezone)}`} />
      {processing && <><ProcessingPoll sessionId={id} /><div className="mb-3"><Alert tone="info">Processing your route. Your drive time is saved; you can come back later.</Alert></div></>}
      {s.status === "RECOVERY_REQUIRED" && <div className="mb-3"><Alert tone="warn" title="Route processing needs attention">{s.processing_error ?? "Route could not be processed."} Your duration is saved. Your adult can approve the time manually.</Alert></div>}
      <Card className="mb-4">
        <RouteMap coordinates={coords} stale={s.gps_incomplete} />
        <div className="mt-3 flex flex-wrap gap-1"><QualityChip quality={s.gps_quality} />{s.gps_incomplete && <span className="chip bg-amber/20 text-amber">Route may be incomplete</span>}{s.end_override_reason && <span className="chip bg-amber/20 text-amber">Ended by override</span>}</div>
        <dl className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <dt className="text-muted">Proposed night minutes</dt><dd className="numeral">{s.proposed_night_minutes}{s.night_gap_minutes ? ` (+${s.night_gap_minutes} min unclassified)` : ""}</dd>
          <dt className="text-muted">Supervisor</dt><dd>{s.supervisor?.display_name}</dd>
          {s.route && <><dt className="text-muted">GPS points</dt><dd className="numeral">{s.route.accepted_point_count} / {s.route.point_count}</dd></>}
        </dl>
        <p className="mt-2 text-xs text-muted">Duration and night minutes are confirmed by your adult during review. Exact addresses are not shown.</p>
      </Card>
      {s.viewer.is_learner && (s.status === "AWAITING_LEARNER_REFLECTION" || s.status === "RECOVERY_REQUIRED" || s.status === "RETURNED_FOR_REVISION") && <Link href={`/drive/${id}/reflect`} className="tap flex items-center justify-center rounded-2xl bg-accent px-5 py-4 text-lg font-bold text-accent-ink">How did it go? →</Link>}
      {s.status === "AWAITING_ADULT_REVIEW" && <Alert tone="success">Reflection submitted. Waiting for adult review. <Link className="underline" href="/home">Back to Home</Link></Alert>}
    </>
  );
}

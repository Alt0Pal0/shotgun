import Link from "next/link";
import type { SessionBrief } from "@/lib/types";
import { EvidenceChip, QualityChip, StatusChip } from "@/components/ui/Chips";
import { fmtDate, fmtDistance, fmtDuration } from "@/lib/util/format";

export function DriveRow({ s, tz, href }: { s: SessionBrief; tz?: string; href?: string }) {
  const minutes = s.credited_duration_minutes ?? s.proposed_duration_minutes;
  return (
    <li>
      <Link href={href ?? `/drives/${s.id}`} className="card block p-3 hover:bg-surface-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{fmtDate(s.started_at, tz)}</span>
          <StatusChip status={s.status} />
        </div>
        <p className="mt-1 numeral text-sm">
          {fmtDuration(minutes)} · {s.evidence_type === "GPS" ? fmtDistance(s.distance_meters) : "no route"}
          {s.credited_night_minutes || s.proposed_night_minutes
            ? ` · ${s.credited_night_minutes || s.proposed_night_minutes} night min`
            : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <EvidenceChip evidence={s.evidence_type} sessionType={s.session_type} />
          {s.evidence_type === "GPS" && <QualityChip quality={s.gps_quality} />}
          {s.supervisor && <span className="chip bg-surface-2 text-muted">{s.supervisor.display_name}</span>}
          {s.learner_rating != null && <span className="chip bg-surface-2 text-muted">Self {s.learner_rating}/5</span>}
          {s.adult_rating != null && <span className="chip bg-surface-2 text-muted">Adult {s.adult_rating}/5</span>}
        </div>
      </Link>
    </li>
  );
}

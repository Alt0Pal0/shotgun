import type { SessionStatus } from "@/lib/types";

export const STATUS_LABEL: Record<SessionStatus, string> = {
  DRAFT: "Draft",
  REQUESTED: "Waiting for adult",
  AWAITING_SUPERVISOR: "Waiting for adult",
  READY: "Ready to start",
  ACTIVE: "Active",
  STOP_CANDIDATE: "Parked?",
  ENDED: "Processing",
  AWAITING_LEARNER_REFLECTION: "Pending reflection",
  AWAITING_ADULT_REVIEW: "Pending review",
  RETURNED_FOR_REVISION: "Returned",
  APPROVED: "Approved",
  VOIDED: "Voided",
  RECOVERY_REQUIRED: "Recovery required",
};
const STATUS_COLOR: Record<SessionStatus, string> = {
  DRAFT: "bg-surface-2 text-muted",
  REQUESTED: "bg-amber/20 text-amber",
  AWAITING_SUPERVISOR: "bg-amber/20 text-amber",
  READY: "bg-accent/20 text-accent",
  ACTIVE: "bg-accent/20 text-accent",
  STOP_CANDIDATE: "bg-accent/20 text-accent",
  ENDED: "bg-surface-2 text-muted",
  AWAITING_LEARNER_REFLECTION: "bg-violet/25 text-[#c9c0ff]",
  AWAITING_ADULT_REVIEW: "bg-amber/20 text-amber",
  RETURNED_FOR_REVISION: "bg-rose/20 text-rose",
  APPROVED: "bg-success/20 text-success",
  VOIDED: "bg-surface-2 text-muted line-through",
  RECOVERY_REQUIRED: "bg-rose/20 text-rose",
};

export function StatusChip({ status }: { status: SessionStatus }) {
  return <span className={`chip ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function EvidenceChip({
  evidence,
  sessionType,
}: {
  evidence: "GPS" | "MANUAL" | "ATTESTED";
  sessionType: "FAMILY_SUPERVISED" | "PROFESSIONAL_INSTRUCTION";
}) {
  if (sessionType === "PROFESSIONAL_INSTRUCTION")
    return <span className="chip bg-amber/20 text-amber">Instructor · parent attested</span>;
  if (evidence === "MANUAL") return <span className="chip bg-violet/25 text-[#c9c0ff]">Manual · no GPS</span>;
  return <span className="chip bg-surface-2 text-muted">GPS</span>;
}

export function QualityChip({ quality }: { quality: "GOOD" | "LIMITED" | "NONE" | null }) {
  if (!quality) return null;
  const map = {
    GOOD: ["bg-success/20 text-success", "GPS good"],
    LIMITED: ["bg-amber/20 text-amber", "Location signal limited"],
    NONE: ["bg-rose/20 text-rose", "No GPS signal"],
  } as const;
  return <span className={`chip ${map[quality][0]}`}>{map[quality][1]}</span>;
}

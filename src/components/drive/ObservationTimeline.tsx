import type { Observation, Skill } from "@/lib/types";
import { fmtElapsed } from "@/lib/util/format";

export const OBS_LABEL: Record<Observation["observation_type"], string> = {
  DID_WELL: "Did well",
  NEEDS_PRACTICE: "Needs practice",
  DISCUSS_LATER: "Discuss later",
  INTERVENED: "Supervisor intervened",
  NOTE: "Note",
};

export function ObservationTimeline({
  observations,
  skills,
  selectable,
  selected,
  onToggle,
}: {
  observations: Observation[];
  skills: Skill[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const label = (id: string | null) => (id ? (skills.find((k) => k.id === id)?.label ?? "Skill") : null);
  return (
    <ol className="space-y-2">
      {observations.map((o) => {
        const tone =
          o.assessment === "POSITIVE" ? "text-success" : o.assessment === "IMPROVEMENT" ? "text-rose" : "text-muted";
        return (
          <li key={o.id} className="flex items-start gap-3 rounded-xl border border-border p-2 text-sm">
            {selectable && (
              <input
                type="checkbox"
                aria-label={`Finalize ${OBS_LABEL[o.observation_type]}`}
                className="mt-1 h-5 w-5"
                checked={selected?.has(o.id) ?? false}
                onChange={() => onToggle?.(o.id)}
              />
            )}
            <div className="flex-1">
              <p className="numeral text-xs text-muted">
                {o.elapsed_seconds != null ? `${fmtElapsed(o.elapsed_seconds)} into drive` : ""}
                {o.verification_level === "UNVERIFIED" && (
                  <span className="ml-2 chip bg-surface-2 text-muted">not verified</span>
                )}
              </p>
              <p>
                <span className={`font-semibold ${tone}`}>{OBS_LABEL[o.observation_type]}</span>
                {label(o.skill_id) && <span> · {label(o.skill_id)}</span>}
              </p>
              {o.note && <p className="text-muted">{o.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

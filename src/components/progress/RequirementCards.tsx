import type { Evaluation } from "@/lib/rules";
import { ProgressBar } from "@/components/ui/Progress";

const COLORS = ["bg-accent", "bg-violet", "bg-amber", "bg-lime", "bg-rose"];

/** Renders requirement cards from evaluator output. No jurisdiction logic lives here (US-016). */
export function RequirementCards({ evaluation, compact }: { evaluation: Evaluation; compact?: boolean }) {
  const cards = evaluation.cards.filter((c) => c.type !== "restriction" || !compact);
  return (
    <section aria-label="Requirement progress" className="card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Approved progress</h2>
      <ul className="space-y-4">
        {cards.map((c, i) => (
          <li key={c.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{c.label}</span>
              <span className="numeral text-sm font-semibold">
                {c.unit === "minutes" && c.target != null && (
                  <>
                    {(c.approved / 60).toFixed(1)} / {c.target / 60} h
                  </>
                )}
                {c.unit === "days" && c.target != null && <>{c.complete ? "Complete" : `${c.remaining} days left`}</>}
                {c.unit === "count" && c.target != null && (
                  <>
                    {c.approved} / {c.target}
                  </>
                )}
                {c.unit === "boolean" && <>{c.complete ? "On file" : "Needed"}</>}
                {c.unit === "none" && <span className="text-muted">Info</span>}
              </span>
            </div>
            {c.percent != null && (
              <ProgressBar value={c.percent} label={`${c.label} progress`} color={COLORS[i % COLORS.length]} />
            )}
            {c.type === "waiting_period" && c.eligible_on && (
              <p className="mt-1 text-xs text-muted">
                Eligible no earlier than{" "}
                {new Date(`${c.eligible_on}T00:00:00`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
            {c.note && !compact && <p className="mt-1 text-xs text-muted">{c.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

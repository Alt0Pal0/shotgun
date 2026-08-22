import {
  rulesetConfigSchema,
  type Contribution,
  type Evaluation,
  type EvaluationInput,
  type Requirement,
  type RequirementCard,
  type RulesetConfig,
} from "./types";

export function parseRuleset(input: unknown): RulesetConfig {
  return rulesetConfigSchema.parse(input);
}

function sum(contribs: Contribution[], key: string, category?: string): number {
  return contribs
    .filter(
      (c) =>
        c.requirement_key === key &&
        (c.evidence_state ?? "FINAL") === "FINAL" &&
        (category ? c.category === category : true),
    )
    .reduce((acc, c) => acc + Math.max(0, c.amount), 0);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
  // Clamp end-of-month overflow (e.g., Aug 31 + 6 months → Feb 28/29)
  if (d.getUTCDate() !== date.getUTCDate()) d.setUTCDate(0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function evaluateRequirement(req: Requirement, input: EvaluationInput): RequirementCard {
  const { contributions, fields, now } = input;
  switch (req.type) {
    case "duration_total": {
      const approved = sum(contributions, req.key, req.category);
      const remaining = Math.max(0, req.target_minutes - approved);
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: "minutes",
        target: req.target_minutes,
        approved,
        remaining,
        percent: Math.min(100, Math.round((approved / req.target_minutes) * 100)),
        complete: remaining === 0,
        blocking: true,
      };
    }
    case "duration_subset": {
      const parent = sum(contributions, req.parent_requirement);
      // A subset can never exceed its parent total (night hours are inside supervised hours).
      const approved = Math.min(sum(contributions, req.key), parent);
      const remaining = Math.max(0, req.target_minutes - approved);
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: "minutes",
        target: req.target_minutes,
        approved,
        remaining,
        percent: Math.min(100, Math.round((approved / req.target_minutes) * 100)),
        complete: remaining === 0,
        blocking: true,
        note: `Counted within ${req.parent_requirement}`,
      };
    }
    case "waiting_period": {
      const startRaw = fields[req.start_field];
      if (!startRaw) {
        return {
          key: req.key,
          label: req.label,
          type: req.type,
          unit: "days",
          target: null,
          approved: 0,
          remaining: null,
          percent: null,
          complete: false,
          eligible_on: null,
          blocking: true,
          note: `Missing ${req.start_field}`,
        };
      }
      const start = new Date(`${startRaw.slice(0, 10)}T00:00:00Z`);
      const end = req.target_months
        ? addMonths(start, req.target_months)
        : new Date(start.getTime() + (req.target_days ?? 0) * 86_400_000);
      const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
      const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((now.getTime() - start.getTime()) / 86_400_000)));
      const remaining = Math.max(0, totalDays - elapsedDays);
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: "days",
        target: totalDays,
        approved: elapsedDays,
        remaining,
        percent: totalDays === 0 ? 100 : Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
        complete: now.getTime() >= end.getTime(),
        eligible_on: isoDate(end),
        blocking: true,
        note: req.until_then_restriction,
      };
    }
    case "event_count": {
      const approved = input.events?.[req.event_key] ?? 0;
      const remaining = Math.max(0, req.target_count - approved);
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: "count",
        target: req.target_count,
        approved,
        remaining,
        percent: Math.min(100, Math.round((approved / req.target_count) * 100)),
        complete: remaining === 0,
        blocking: true,
      };
    }
    case "document_or_attestation": {
      const has = (input.evidence ?? []).includes(req.evidence_key);
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: "boolean",
        target: 1,
        approved: has ? 1 : 0,
        remaining: has ? 0 : 1,
        percent: has ? 100 : 0,
        complete: has,
        blocking: true,
      };
    }
    case "restriction":
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: "none",
        target: null,
        approved: 0,
        remaining: null,
        percent: null,
        complete: true,
        blocking: false,
        note: req.rule,
      };
    case "recommendation": {
      const approved = sum(contributions, req.key);
      const target = req.target_minutes ?? null;
      return {
        key: req.key,
        label: req.label,
        type: req.type,
        unit: target ? "minutes" : "none",
        target,
        approved,
        remaining: target ? Math.max(0, target - approved) : null,
        percent: target ? Math.min(100, Math.round((approved / target) * 100)) : null,
        complete: target ? approved >= target : true,
        blocking: false,
        note: req.note,
      };
    }
  }
}

export function evaluate(input: EvaluationInput): Evaluation {
  const cards = input.config.requirements.map((r) => evaluateRequirement(r, input));
  const blocking = cards.filter((c) => c.blocking);
  const waits = cards.filter((c) => c.type === "waiting_period" && c.eligible_on).map((c) => c.eligible_on as string);
  const projected = waits.length ? (waits.sort().at(-1) ?? null) : null;
  return {
    jurisdiction: input.config.jurisdiction,
    version: input.config.version,
    cards,
    all_blocking_complete: blocking.every((c) => c.complete),
    projected_eligibility: projected,
    computed_at: input.now.toISOString(),
  };
}

export function minutesToHours(minutes: number, digits = 1): string {
  return (minutes / 60).toFixed(digits);
}

import { z } from "zod";

/** Generic requirement primitives (PRD §7.3). Jurisdiction data, not code, expresses each state's structure. */
export const requirementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("duration_total"),
    key: z.string(),
    label: z.string(),
    target_minutes: z.number().int().positive(),
    eligible_session_types: z.array(z.string()).min(1),
    /** Optional categorical tag that contributions must carry (e.g. TX "classroom" vs "observation"). */
    category: z.string().optional(),
  }),
  z.object({
    type: z.literal("duration_subset"),
    key: z.string(),
    label: z.string(),
    target_minutes: z.number().int().positive(),
    parent_requirement: z.string(),
    evidence_field: z.string(),
  }),
  z.object({
    type: z.literal("waiting_period"),
    key: z.string(),
    label: z.string(),
    target_months: z.number().int().positive().optional(),
    target_days: z.number().int().positive().optional(),
    start_field: z.string(),
    /** Phase-dependent rules may declare a restriction that lifts after the wait (FL fixture). */
    until_then_restriction: z.string().optional(),
  }),
  z.object({
    type: z.literal("event_count"),
    key: z.string(),
    label: z.string(),
    target_count: z.number().int().positive(),
    event_key: z.string(),
  }),
  z.object({
    type: z.literal("document_or_attestation"),
    key: z.string(),
    label: z.string(),
    evidence_key: z.string(),
  }),
  z.object({
    type: z.literal("restriction"),
    key: z.string(),
    label: z.string(),
    rule: z.string(),
    evidence: z.string().optional(),
    region: z.string().optional(),
    time_window: z.object({ start: z.string(), end: z.string() }).optional(),
  }),
  z.object({
    type: z.literal("recommendation"),
    key: z.string(),
    label: z.string(),
    target_minutes: z.number().int().positive().optional(),
    note: z.string().optional(),
  }),
]);
export type Requirement = z.infer<typeof requirementSchema>;

export const rulesetConfigSchema = z.object({
  jurisdiction: z.string(),
  version: z.string(),
  effective_from: z.string(),
  display_name: z.string(),
  night: z
    .object({
      type: z.literal("solar_offset"),
      after_sunset_minutes: z.number().int(),
      before_sunrise_minutes: z.number().int(),
    })
    .or(z.object({ type: z.literal("fixed_clock"), start: z.string(), end: z.string() }))
    .optional(),
  requirements: z.array(requirementSchema).min(1),
});
export type RulesetConfig = z.infer<typeof rulesetConfigSchema>;

export interface Contribution {
  session_id?: string;
  requirement_key: string;
  amount: number;
  unit: string;
  evidence_type?: string;
  evidence_state?: string;
  category?: string;
}

export interface EvaluationInput {
  config: RulesetConfig;
  contributions: Contribution[];
  /** Field values the waiting_period primitive can start from (e.g. permit_issue_date ISO date). */
  fields: Record<string, string | null | undefined>;
  /** Attestation/document evidence keys the learner holds. */
  evidence?: string[];
  /** Counted events by key. */
  events?: Record<string, number>;
  now: Date;
}

export interface RequirementCard {
  key: string;
  label: string;
  type: Requirement["type"];
  unit: "minutes" | "days" | "count" | "boolean" | "none";
  target: number | null;
  approved: number;
  remaining: number | null;
  percent: number | null;
  complete: boolean;
  /** For waiting periods: earliest date the requirement is satisfied. */
  eligible_on?: string | null;
  note?: string;
  /** Does this requirement block eligibility? recommendations and restrictions do not. */
  blocking: boolean;
}

export interface Evaluation {
  jurisdiction: string;
  version: string;
  cards: RequirementCard[];
  all_blocking_complete: boolean;
  /** Earliest date at which every blocking requirement could be satisfied, considering only dated waits. */
  projected_eligibility: string | null;
  computed_at: string;
}

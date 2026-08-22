import { json, withAuth } from "@/lib/api";
import { AppError } from "@/lib/backend";
import { evaluate, parseRuleset } from "@/lib/rules";
import type { ProgressModel } from "@/lib/types";

/** Evaluated requirement cards with provenance. No client-side aggregation (FR-011). */
export const GET = withAuth(async ({ backend, params }) => {
  const model = await backend.rpc<ProgressModel | null>("progress_model", { p_learner: params.learnerId });
  if (!model?.track || !model.ruleset) throw new AppError("NOT_FOUND", "Learner not found", 404);
  const evaluation = evaluate({
    config: parseRuleset(model.ruleset.config),
    contributions: model.contributions,
    fields: { permit_issue_date: model.track.permit_issue_date },
    now: new Date(),
  });
  return json({ evaluation, model });
});

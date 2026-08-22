import { requireUser } from "@/lib/server/session";
import { evaluate, parseRuleset } from "@/lib/rules";
import type { ProgressModel } from "@/lib/types";
import { PageHeader, Card } from "@/components/ui/Page";
import { RequirementCards } from "@/components/progress/RequirementCards";
import { ExportButton } from "@/components/progress/ExportButton";
import { fmtDate, fmtDateTime } from "@/lib/util/format";
import Link from "next/link";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ learner?: string }> }) {
  const sp = await searchParams;
  const { backend, me } = await requireUser();
  const learnerId = sp.learner ?? me.track?.learner_id ?? me.learners[0]?.learner.id;
  const model = learnerId ? await backend.rpc<ProgressModel | null>("progress_model", { p_learner: learnerId }) : null;
  if (!model?.track || !model.ruleset)
    return (
      <>
        <PageHeader title="Progress" />
        <Card>
          <p className="text-sm text-muted">No permit profile found.</p>
        </Card>
      </>
    );
  const evaluation = evaluate({
    config: parseRuleset(model.ruleset.config),
    contributions: model.contributions,
    fields: { permit_issue_date: model.track.permit_issue_date },
    now: new Date(),
  });
  const bySession = new Map<
    string,
    { total: number; night: number; professional: number; approved_at: string; evidence: string }
  >();
  for (const c of model.contributions) {
    const e = bySession.get(c.session_id ?? "") ?? {
      total: 0,
      night: 0,
      professional: 0,
      approved_at: c.approved_at,
      evidence: c.evidence_type,
    };
    if (c.requirement_key === "supervised_total") e.total += c.amount;
    else if (c.requirement_key === "night_subset") e.night += c.amount;
    else if (c.requirement_key === "professional_training") e.professional += c.amount;
    bySession.set(c.session_id ?? "", e);
  }
  return (
    <>
      <PageHeader
        eyebrow="License progress"
        title={model.learner.display_name}
        subtitle="Approved drives only"
        action={<ExportButton learnerId={learnerId as string} />}
      />
      <RequirementCards evaluation={evaluation} />
      <Card title="Source details" className="mt-4">
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt className="text-muted">Ruleset</dt>
          <dd>
            {model.ruleset.jurisdiction} · {model.ruleset.version}
          </dd>
          <dt className="text-muted">Calculated</dt>
          <dd>{fmtDateTime(model.computed_at)}</dd>
          <dt className="text-muted">Pending drives</dt>
          <dd>{model.pending_count} (not counted)</dd>
        </dl>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {model.ruleset.source_metadata.map((s) => (
            <li key={s.url}>
              <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>{" "}
              · reviewed {s.reviewed}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Not legal advice. Rules are versioned and reviewed; the app does not replace DMV records.
        </p>
      </Card>
      <Card title="Contributions by drive" className="mt-4">
        {bySession.size ? (
          <ul className="divide-y divide-border text-sm">
            {[...bySession.entries()].map(([id, e]) => (
              <li key={id} className="flex items-center justify-between py-2">
                <Link className="text-accent" href={`/drives/${id}`}>
                  {fmtDate(e.approved_at)} · {e.evidence}
                </Link>
                <span className="numeral">
                  {e.total ? `${e.total} min` : ""}
                  {e.night ? ` · ${e.night} night` : ""}
                  {e.professional ? `${e.professional} min instructor` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No approved contributions yet.</p>
        )}
      </Card>
    </>
  );
}

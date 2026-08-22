import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { evaluate, parseRuleset } from "@/lib/rules";
import type { ProgressModel } from "@/lib/types";
import { PageHeader } from "@/components/ui/Page";
import { RequirementCards } from "@/components/progress/RequirementCards";
import { DriveRow } from "@/components/drive/DriveRow";
import { ExportButton } from "@/components/progress/ExportButton";

export default async function LearnerOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { backend, me } = await requireUser();
  const model = await backend.rpc<ProgressModel | null>("progress_model", { p_learner: id });
  if (!model?.learner) notFound();
  const evaluation = model.ruleset && model.track ? evaluate({ config: parseRuleset(model.ruleset.config), contributions: model.contributions, fields: { permit_issue_date: model.track.permit_issue_date }, now: new Date() }) : null;
  return (
    <>
      <PageHeader eyebrow="Learner" title={model.learner.display_name} subtitle={model.track ? `Permit issued ${model.track.permit_issue_date}` : "No permit profile yet"} action={<ExportButton learnerId={id} />} />
      <div className="mb-4 flex gap-2 text-sm"><Link className="text-accent" href={`/drives?learner=${id}`}>All drives</Link><span className="text-muted">·</span><Link className="text-accent" href={`/progress?learner=${id}`}>Progress details</Link><span className="text-muted">·</span><Link className="text-accent" href={`/records/new?learner=${id}`}>Add record</Link></div>
      {evaluation && <RequirementCards evaluation={evaluation} compact />}
      <section className="mt-5"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Recent</h2>
        {model.recent.length ? <ul className="space-y-2">{model.recent.map((s) => <DriveRow key={s.id} s={s} tz={me.profile?.timezone} />)}</ul> : <p className="text-sm text-muted">No drives yet.</p>}</section>
    </>
  );
}

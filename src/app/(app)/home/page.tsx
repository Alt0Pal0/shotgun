import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { evaluate, parseRuleset } from "@/lib/rules";
import type { ProgressModel } from "@/lib/types";
import { PageHeader, Card } from "@/components/ui/Page";
import { RequirementCards } from "@/components/progress/RequirementCards";
import { DriveRow } from "@/components/drive/DriveRow";
import { Alert } from "@/components/ui/Alert";

export default async function HomePage() {
  const { backend, me } = await requireUser({ requireTrack: true });
  if (!me.track) redirect("/onboarding");
  const model = await backend.rpc<ProgressModel>("progress_model", { p_learner: me.track.learner_id });
  const evaluation = model.ruleset
    ? evaluate({
        config: parseRuleset(model.ruleset.config),
        contributions: model.contributions,
        fields: { permit_issue_date: me.track.permit_issue_date },
        now: new Date(),
      })
    : null;
  const linked = me.adults.filter((a) => a.status === "ACTIVE");
  return (
    <>
      <PageHeader
        eyebrow="Learner"
        title={`Ready to practice, ${me.profile?.display_name?.split(" ")[0] ?? "there"}?`}
        subtitle="California permit progress · approved drives only · your shotgun crew has the final say"
      />
      <Card className="mb-4 border-accent/60">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Call shotgun</h2>
        <p className="mb-3 text-sm text-muted">
          Ask a linked adult to ride shotgun and log the hours. Only start while parked, with them in the passenger
          seat.
        </p>
        {linked.length ? (
          <Link
            href="/drive/new"
            className="tap flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-5 text-xl font-bold text-accent-ink"
          >
            START DRIVE
          </Link>
        ) : (
          <Alert tone="warn" title="Nobody to ride shotgun yet">
            A California-licensed adult 25+ must ride shotgun on every practice drive, and they approve your hours.{" "}
            <Link className="underline" href="/invite">
              Invite an adult
            </Link>
          </Alert>
        )}
      </Card>
      {model.pending_count > 0 && (
        <Link href="/drives?filter=PENDING" className="card mb-4 block border-amber/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber">Pending</p>
          <p className="text-sm">
            {model.pending_count} drive{model.pending_count === 1 ? "" : "s"} waiting on reflection or adult review →
          </p>
        </Link>
      )}
      {evaluation && <RequirementCards evaluation={evaluation} compact />}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Recent drives</h2>
          <Link href="/drives" className="text-sm text-accent">
            All drives
          </Link>
        </div>
        {model.recent.length ? (
          <ul className="space-y-2">
            {model.recent.map((s) => (
              <DriveRow key={s.id} s={s} tz={me.profile?.timezone} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No drives yet.</p>
        )}
      </section>
    </>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import type { SessionBrief } from "@/lib/types";
import { PageHeader, Card } from "@/components/ui/Page";
import { DriveRow } from "@/components/drive/DriveRow";

export default async function ReviewsPage() {
  const { backend, me } = await requireUser();
  const queue = await backend.rpc<SessionBrief[]>("review_queue");
  return (
    <>
      <PageHeader
        eyebrow="Parent / supervisor"
        title="Reviews"
        subtitle={
          queue.length
            ? `${queue.length} drive${queue.length === 1 ? "" : "s"} waiting, oldest first`
            : "Nothing waiting for review"
        }
        action={
          <Link href="/records/new" className="tap rounded-xl border border-border px-3 py-2 text-sm font-semibold">
            + Record
          </Link>
        }
      />
      {queue.length ? (
        <ul className="space-y-2">
          {queue.map((s) => (
            <DriveRow
              key={s.id}
              s={{ ...s, supervisor: s.learner }}
              tz={me.profile?.timezone}
              href={`/drive/${s.id}/review`}
            />
          ))}
        </ul>
      ) : (
        <Card>
          {me.learners.length ? (
            <p className="text-sm text-muted">When a learner submits a drive, it appears here.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Nobody has called shotgun for you yet</p>
              <p className="text-muted">
                Your learner creates the permit profile on their own account, then taps <strong>Invite an adult</strong>{" "}
                on their Home screen and shares the link with you. Open that link while signed in to connect.
              </p>
              <p className="text-muted">Invitation links are single-use and expire after 7 days.</p>
            </div>
          )}
        </Card>
      )}
      {me.learners.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Learners</h2>
          <ul className="space-y-2">
            {me.learners.map((l) => (
              <li key={l.relationship_id}>
                <Link href={`/learner/${l.learner.id}`} className="card flex items-center justify-between p-3 text-sm">
                  <span className="font-semibold">{l.learner.display_name}</span>
                  <span className="text-accent">Progress →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import { PageHeader, Card } from "@/components/ui/Page";

export default async function LearnersPage() {
  const { me } = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Parent / supervisor" title="Your learners" />
      {me.learners.length ? (
        <ul className="space-y-2">
          {me.learners.map((l) => (
            <li key={l.relationship_id}>
              <Link href={`/learner/${l.learner.id}`} className="card block p-4">
                <p className="font-semibold">{l.learner.display_name}</p>
                <p className="text-sm text-muted">
                  {l.track ? `Permit issued ${l.track.permit_issue_date}` : "No permit profile yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-muted">No learners linked. Ask your learner to send you an invitation link.</p>
        </Card>
      )}
    </>
  );
}

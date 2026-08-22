import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import type { SessionBrief } from "@/lib/types";
import { PageHeader, Card } from "@/components/ui/Page";
import { DriveRow } from "@/components/drive/DriveRow";

const FILTERS = [
  ["ALL", "All"],
  ["PENDING", "Pending"],
  ["APPROVED", "Approved"],
  ["MANUAL", "Manual"],
  ["INSTRUCTOR", "Instructor"],
] as const;

export default async function DrivesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; learner?: string }>;
}) {
  const sp = await searchParams;
  const { backend, me } = await requireUser();
  const learnerId = sp.learner ?? me.track?.learner_id ?? me.learners[0]?.learner.id;
  const filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as string) : "ALL";
  const sessions = learnerId
    ? await backend.rpc<SessionBrief[]>("list_sessions", { p_learner: learnerId, p_filter: filter })
    : [];
  const isOwn = learnerId === me.track?.learner_id;
  return (
    <>
      <PageHeader
        eyebrow={isOwn ? "Learner" : "Learner history"}
        title="Drives"
        action={
          <Link
            href={`/records/new${learnerId && !isOwn ? `?learner=${learnerId}` : ""}`}
            className="tap rounded-xl border border-border px-3 py-2 text-sm font-semibold"
          >
            + Record
          </Link>
        }
      />
      <nav aria-label="Filter" className="mb-4 flex gap-1 overflow-x-auto">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={`/drives?filter=${k}${sp.learner ? `&learner=${sp.learner}` : ""}`}
            aria-current={filter === k ? "page" : undefined}
            className={`tap whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filter === k ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {sessions.length ? (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <DriveRow key={s.id} s={s} tz={me.profile?.timezone} />
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-muted">No drives match this filter.</p>
        </Card>
      )}
    </>
  );
}

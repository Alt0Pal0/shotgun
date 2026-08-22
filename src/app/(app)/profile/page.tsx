import { requireUser } from "@/lib/server/session";
import { PageHeader, Card } from "@/components/ui/Page";
import { signOutAction } from "@/app/(auth)/actions";
import { ProfileControls } from "./ProfileControls";
import { GPS_LIMITS_COPY, PRIVACY_COPY, SAFETY_LOCK_COPY } from "@/lib/copy";
import Link from "next/link";

export default async function ProfilePage() {
  const { me, user, backend } = await requireUser();
  return (
    <>
      <PageHeader
        eyebrow="Profile & privacy"
        title={me.profile?.display_name || "Your profile"}
        subtitle={user.email}
      />
      <div className="space-y-4">
        <Card title="Account">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Roles</dt>
            <dd>
              {[me.track && "Learner", (me.profile?.is_adult || me.learners.length) && "Supervisor"]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
            {me.track && (
              <>
                <dt className="text-muted">Permit issued</dt>
                <dd>{me.track.permit_issue_date}</dd>
                <dt className="text-muted">Ruleset</dt>
                <dd>
                  {me.track.jurisdiction} {me.track.ruleset_version}
                </dd>
              </>
            )}
            <dt className="text-muted">Timezone</dt>
            <dd>{me.profile?.timezone}</dd>
            <dt className="text-muted">Backend</dt>
            <dd>{backend.mode}</dd>
          </dl>
          {me.track && (
            <Link href="/invite" className="mt-3 block text-sm text-accent">
              Manage linked adults →
            </Link>
          )}
        </Card>
        {me.learners.length > 0 && (
          <Card title="Linked learners">
            <ul className="space-y-2 text-sm">
              {me.learners.map((l) => (
                <li key={l.relationship_id} className="flex items-center justify-between">
                  <Link href={`/learner/${l.learner.id}`} className="font-semibold">
                    {l.learner.display_name}
                  </Link>
                  <span className="chip bg-success/20 text-success">{l.status}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <ProfileControls learners={me.learners} />
        <Card title="Safety & GPS limitations">
          <p className="text-sm text-muted">{SAFETY_LOCK_COPY.limits}</p>
          <p className="mt-2 text-sm text-muted">{GPS_LIMITS_COPY}</p>
        </Card>
        <Card title="Privacy">
          <p className="text-sm text-muted">{PRIVACY_COPY}</p>
        </Card>
        <form action={signOutAction}>
          <button type="submit" className="tap w-full rounded-xl border border-border py-3 text-sm font-semibold">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/server/session";
import { PageHeader, Card } from "@/components/ui/Page";
import { signOutAction } from "@/app/(auth)/actions";
import { ProfileForm } from "./ProfileForm";
import { DangerZone } from "./DangerZone";
import { GPS_LIMITS_COPY, PRIVACY_COPY, SAFETY_LOCK_COPY } from "@/lib/copy";
import { TERMS_VERSION } from "@/lib/legal/documents";

export default async function ProfilePage() {
  const { me, user } = await requireUser();
  const isLearner = Boolean(me.track);
  return (
    <>
      <PageHeader eyebrow="Me" title={me.profile?.display_name || "Your profile"} subtitle={user.email} />
      <div className="space-y-4">
        <ProfileForm
          displayName={me.profile?.display_name ?? ""}
          timezone={me.profile?.timezone ?? "America/Los_Angeles"}
          unit={me.profile?.unit_preference ?? "imperial"}
        />

        {isLearner && me.track && (
          <Card title="Permit">
            <p className="text-sm">California · issued {me.track.permit_issue_date}</p>
            <Link href="/invite" className="mt-2 inline-block text-sm text-accent">
              Manage who rides shotgun →
            </Link>
          </Card>
        )}
        {me.learners.length > 0 && (
          <Card title="Learners you ride shotgun for">
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

        <form action={signOutAction}>
          <button type="submit" className="tap w-full rounded-xl border border-border py-3 text-sm font-semibold">
            Sign out
          </button>
        </form>

        <Card title="Safety & GPS limitations">
          <p className="text-sm text-muted">{SAFETY_LOCK_COPY.limits}</p>
          <p className="mt-2 text-sm text-muted">{GPS_LIMITS_COPY}</p>
        </Card>
        <Card title="Privacy">
          <p className="text-sm text-muted">{PRIVACY_COPY}</p>
        </Card>
        <Card title="Legal">
          <ul className="space-y-1 text-sm">
            <li>
              <Link className="tap inline-flex items-center text-accent" href="/terms">
                Terms of Use
              </Link>
            </li>
            <li>
              <Link className="tap inline-flex items-center text-accent" href="/privacy">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link className="tap inline-flex items-center text-accent" href="/about">
                About Shotgun.Rocks — the game, the name, and California&rsquo;s shotgun-seat rules
              </Link>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            You accepted version {TERMS_VERSION}. Your acceptance is recorded with date, time, IP address, and device.
          </p>
        </Card>

        <DangerZone learners={me.learners} />
      </div>
    </>
  );
}

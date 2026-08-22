import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { OnboardingForm } from "./OnboardingForm";
import { Shell, PageHeader } from "@/components/ui/Page";

export default async function OnboardingPage() {
  const { me } = await requireUser({ enforceLock: false });
  if (me.track) redirect("/home");
  // Adults never fill in a permit profile; that belongs to the learner account.
  if (me.profile?.is_adult || me.learners.length) redirect("/reviews");
  return (
    <Shell>
      <PageHeader
        eyebrow="Learner setup"
        title="Your permit profile"
        subtitle="California is the only state available in this beta. Your permit issue date sets the six-month hold."
      />
      <OnboardingForm
        displayName={me.profile?.display_name ?? ""}
        isAdult={Boolean(me.profile?.is_adult || me.learners.length)}
      />
    </Shell>
  );
}

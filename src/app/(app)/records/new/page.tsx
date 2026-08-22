import { requireUser } from "@/lib/server/session";
import { PageHeader } from "@/components/ui/Page";
import { RecordForm } from "./RecordForm";

export default async function NewRecordPage({ searchParams }: { searchParams: Promise<{ learner?: string; type?: string }> }) {
  const sp = await searchParams;
  const { me } = await requireUser();
  const learners = me.track ? [{ id: me.track.learner_id, name: "Me", adults: me.adults.filter((a) => a.status === "ACTIVE").map((a) => ({ id: a.adult.id, name: a.adult.display_name })) }]
    : me.learners.filter((l) => l.status === "ACTIVE").map((l) => ({ id: l.learner.id, name: l.learner.display_name, adults: [{ id: me.profile?.id ?? "", name: "Me" }] }));
  return (
    <>
      <PageHeader eyebrow="Add a record" title="Past drive or instructor lesson" subtitle="Manual records never show a route and need adult approval before they count." />
      <RecordForm learners={learners} defaultLearner={sp.learner} defaultType={sp.type === "PROFESSIONAL_INSTRUCTION" ? "PROFESSIONAL_INSTRUCTION" : "FAMILY_SUPERVISED"} isLearner={Boolean(me.track)} />
    </>
  );
}

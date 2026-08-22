import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import type { Skill } from "@/lib/types";
import { PageHeader } from "@/components/ui/Page";
import { PreDriveForm } from "./PreDriveForm";

export default async function NewDrivePage() {
  const { backend, me } = await requireUser({ enforceLock: true, requireTrack: true });
  if (!me.track) redirect("/onboarding");
  const adults = me.adults.filter((a) => a.status === "ACTIVE");
  if (!adults.length) redirect("/invite");
  const skills = await backend.rpc<Skill[]>("skills_list");
  return (
    <>
      <PageHeader eyebrow="Pre-drive" title="Ready to practice?" subtitle="Complete this while parked. Your supervising adult confirms on their phone, then the app locks." />
      <PreDriveForm adults={adults.map((a) => ({ id: a.adult.id, name: a.adult.display_name }))} vehicles={me.vehicles} skills={skills} />
    </>
  );
}

import { requireUser } from "@/lib/server/session";
import { PageHeader } from "@/components/ui/Page";
import { InviteManager } from "./InviteManager";

export default async function InvitePage() {
  const { me } = await requireUser({ requireTrack: true });
  return (
    <>
      <PageHeader
        eyebrow="Connect"
        title="Who's riding shotgun?"
        subtitle="Link the parents and licensed adults (25+) who will sit in the passenger seat. Linking happens once; asking them along for a drive happens from Start Drive."
      />
      <InviteManager
        adults={me.adults}
        invitations={me.invitations}
        learnerName={me.profile?.display_name?.split(" ")[0] ?? "Your learner"}
      />
    </>
  );
}

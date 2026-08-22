import { requireUser } from "@/lib/server/session";
import { PageHeader } from "@/components/ui/Page";
import { InviteManager } from "./InviteManager";

export default async function InvitePage() {
  const { me } = await requireUser({ requireTrack: true });
  return (
    <>
      <PageHeader
        eyebrow="Connect"
        title="Invite a parent or supervisor"
        subtitle="Links are single-use and expire after 7 days. You can revoke one any time."
      />
      <InviteManager adults={me.adults} invitations={me.invitations} />
    </>
  );
}

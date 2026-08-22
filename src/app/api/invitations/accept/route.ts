import { json, parseBody, withAuth } from "@/lib/api";
import { ATTESTATION_TEXT } from "@/lib/copy";
import { acceptInvitationSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, acceptInvitationSchema);
  const r = await backend.rpc<{ relationship_id: string; learner_id: string }>("accept_invitation", { p_token: body.token, p_attestation_text: ATTESTATION_TEXT });
  await backend.rpc("track_event", { p_event: "invitation_accepted", p_props: { role: "adult" } }).catch(() => undefined);
  return json(r);
});

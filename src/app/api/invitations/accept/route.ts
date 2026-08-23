import { json, parseBody, withAuth } from "@/lib/api";
import { ATTESTATION_TEXT } from "@/lib/copy";
import { acceptInvitationSchema } from "@/lib/validation/schemas";
import { recordAcceptances } from "@/lib/legal/record";
import { GUARDIAN_CONSENT, SUPERVISOR_ATTESTATION } from "@/lib/legal/documents";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, acceptInvitationSchema);
  const r = await backend.rpc<{ relationship_id: string; learner_id: string }>("accept_invitation", {
    p_token: body.token,
    p_attestation_text: ATTESTATION_TEXT,
  });
  await recordAcceptances(backend, [SUPERVISOR_ATTESTATION, GUARDIAN_CONSENT], {
    screen: "accept_invitation",
    learner_id: r.learner_id,
    relationship_id: r.relationship_id,
  }).catch((e) => console.error("[legal] record failed", e));
  await backend
    .rpc("track_event", { p_event: "invitation_accepted", p_props: { role: "adult" } })
    .catch(() => undefined);
  return json(r);
});

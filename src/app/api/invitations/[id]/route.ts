import { json, withAuth } from "@/lib/api";

export const DELETE = withAuth(async ({ backend, params }) => {
  await backend.rpc("revoke_invitation", { p_invitation_id: params.id });
  return json({ ok: true });
});

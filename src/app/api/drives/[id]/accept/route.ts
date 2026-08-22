import { json, parseBody, withAuth } from "@/lib/api";
import { acceptDriveSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, acceptDriveSchema);
  const { idempotency_key, ...confirmations } = body;
  return json(
    await backend.rpc("accept_session", {
      p_session: params.id,
      p_confirmations: confirmations,
      p_idempotency_key: idempotency_key,
    }),
  );
});

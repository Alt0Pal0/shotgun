import { json, parseBody, withAuth } from "@/lib/api";
import { manualRecordSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, manualRecordSchema);
  const { idempotency_key, ...payload } = body;
  const r = await backend.rpc("create_manual_session", { p: payload, p_idempotency_key: idempotency_key });
  await backend.rpc("track_event", { p_event: "manual_record_created", p_props: { session_type: payload.session_type } }).catch(() => undefined);
  return json(r);
});

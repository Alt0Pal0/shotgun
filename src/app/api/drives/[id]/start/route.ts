import { json, parseBody, withAuth } from "@/lib/api";
import { startDriveSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, startDriveSchema);
  const r = await backend.rpc("start_session", {
    p_session: params.id,
    p_device: body.device_id,
    p_idempotency_key: body.idempotency_key,
    p_one_phone: body.one_phone,
  });
  await backend
    .rpc("track_event", { p_event: "drive_started", p_props: { one_phone: body.one_phone } })
    .catch(() => undefined);
  return json(r);
});

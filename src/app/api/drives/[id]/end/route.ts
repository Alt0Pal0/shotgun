import { json, parseBody, withAuth } from "@/lib/api";
import { processEndedSession } from "@/lib/sessions/process";
import { endDriveSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, endDriveSchema);
  const r = await backend.rpc<{ status: string }>("end_session", { p_session: params.id, p_idempotency_key: body.idempotency_key, p_override_reason: body.override_reason ?? null, p_confirmed_parked: true });
  // Process immediately; if this fails the session stays ENDED and the summary page retries idempotently.
  const processed = await processEndedSession(backend, params.id).catch(() => ({ status: r.status }));
  await backend.rpc("track_event", { p_event: "drive_ended", p_props: { override: Boolean(body.override_reason) } }).catch(() => undefined);
  return json({ ...r, status: processed.status });
});

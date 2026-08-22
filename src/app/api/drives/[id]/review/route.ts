import { json, parseBody, withAuth } from "@/lib/api";
import { reviewSchema } from "@/lib/validation/schemas";

export const PUT = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, reviewSchema);
  const { idempotency_key, ...payload } = body;
  const r = await backend.rpc("review_session", {
    p_session: params.id,
    p: payload,
    p_idempotency_key: idempotency_key,
  });
  await backend
    .rpc("track_event", {
      p_event: "review_completed",
      p_props: { decision: payload.decision, corrected_duration: payload.credited_duration_minutes != null },
    })
    .catch(() => undefined);
  return json(r);
});

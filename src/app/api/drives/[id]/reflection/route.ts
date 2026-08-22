import { json, parseBody, withAuth } from "@/lib/api";
import { reflectionSchema } from "@/lib/validation/schemas";

export const PUT = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, reflectionSchema);
  const { submit, ...payload } = body;
  const r = await backend.rpc("save_reflection", { p_session: params.id, p: payload, p_submit: submit });
  if (submit)
    await backend
      .rpc("track_event", {
        p_event: "reflection_submitted",
        p_props: { optional_fields_completed: Boolean(payload.went_well || payload.improve) },
      })
      .catch(() => undefined);
  return json(r);
});

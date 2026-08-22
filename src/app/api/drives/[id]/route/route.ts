import { json, parseBody, withAuth } from "@/lib/api";
import { deleteRouteSchema } from "@/lib/validation/schemas";

export const DELETE = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, deleteRouteSchema);
  const r = await backend.rpc("delete_route", {
    p_session: params.id,
    p_clear_distance: body.clear_distance,
    p_reason: body.reason ?? null,
  });
  await backend.rpc("track_event", { p_event: "route_deleted", p_props: {} }).catch(() => undefined);
  return json(r);
});

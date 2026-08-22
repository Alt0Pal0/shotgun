import { json, parseBody, withAuth } from "@/lib/api";
import { z } from "zod";

export const DELETE = withAuth(async ({ backend, params, req }) => {
  const body = await req.json().catch(() => ({}));
  await backend.rpc("revoke_relationship", { p_relationship_id: params.id, p_reason: typeof body?.reason === "string" ? body.reason.slice(0, 280) : null });
  return json({ ok: true });
});

export const PATCH = withAuth(async ({ backend, params, req }) => {
  const body = await parseBody(req, z.object({ allow_remote_live_view: z.boolean() }));
  await backend.rpc("set_remote_live_view", { p_relationship_id: params.id, p_allow: body.allow_remote_live_view });
  return json({ ok: true });
});

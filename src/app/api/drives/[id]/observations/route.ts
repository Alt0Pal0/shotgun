import { json, parseBody, withAuth } from "@/lib/api";
import { observationSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, observationSchema);
  return json(await backend.rpc("add_observation", { p_session: params.id, p: body }));
});

export const PATCH = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, z.object({ observation_id: z.string().uuid(), note: z.string().max(280) }));
  await backend.rpc("update_observation_note", { p_observation: body.observation_id, p_note: body.note });
  return json({ ok: true });
});

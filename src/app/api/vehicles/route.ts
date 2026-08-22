import { json, parseBody, withAuth } from "@/lib/api";
import { vehicleSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, vehicleSchema);
  const id = await backend.rpc<string>("upsert_vehicle", { p_id: body.id ?? null, p_label: body.label });
  return json({ id });
});
export const DELETE = withAuth(async ({ backend, req }) => {
  const id = new URL(req.url).searchParams.get("id");
  await backend.rpc("archive_vehicle", { p_id: id });
  return json({ ok: true });
});

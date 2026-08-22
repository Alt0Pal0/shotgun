import { json, parseBody, withAuth } from "@/lib/api";
import { samplesBatchSchema } from "@/lib/validation/schemas";

/** Ordered, idempotent sample batch from the designated recorder. Deduplicated by sequence number server-side. */
export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await parseBody(req, samplesBatchSchema);
  return json(
    await backend.rpc("ingest_samples", { p_session: params.id, p_device: body.device_id, p_samples: body.samples }),
  );
});

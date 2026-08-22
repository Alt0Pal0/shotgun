import { json, parseBody, withAuth } from "@/lib/api";
import { requestDriveSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, requestDriveSchema);
  const r = await backend.rpc("request_session", { p: body });
  return json(r);
});

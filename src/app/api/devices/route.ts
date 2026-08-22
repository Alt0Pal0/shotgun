import { json, parseBody, withAuth } from "@/lib/api";
import { deviceSchema } from "@/lib/validation/schemas";

export const POST = withAuth(async ({ backend, req }) => {
  const body = await parseBody(req, deviceSchema);
  const id = await backend.rpc<string>("register_device", {
    p_key: body.key,
    p_platform: body.platform,
    p_label: body.label ?? "",
  });
  return json({ id });
});

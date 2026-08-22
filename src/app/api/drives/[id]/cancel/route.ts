import { json, withAuth } from "@/lib/api";
export const POST = withAuth(async ({ backend, req, params }) => {
  const body = await req.json().catch(() => ({}));
  return json(
    await backend.rpc("cancel_session", {
      p_session: params.id,
      p_reason: typeof body?.reason === "string" ? body.reason.slice(0, 280) : null,
    }),
  );
});

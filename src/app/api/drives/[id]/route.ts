import { json, withAuth } from "@/lib/api";
import { AppError } from "@/lib/backend";
export const GET = withAuth(async ({ backend, params }) => {
  const r = await backend.rpc("session_detail", { p_session: params.id });
  if (!r) throw new AppError("NOT_FOUND", "Session not found", 404);
  return json(r);
});

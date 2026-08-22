import { json, withAuth } from "@/lib/api";
import { AppError } from "@/lib/backend";
/** Learner lock state: status + start time only. Never position or observations. */
export const GET = withAuth(async ({ backend, params }) => {
  const r = await backend.rpc("lock_state", { p_session: params.id });
  if (!r) throw new AppError("NOT_FOUND", "Session not found", 404);
  return json(r);
});

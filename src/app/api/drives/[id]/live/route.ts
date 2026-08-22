import { json, withAuth } from "@/lib/api";
import { AppError } from "@/lib/backend";
/** Adult live view (polling fallback and initial load). RLS returns null unless the caller is a live participant. */
export const GET = withAuth(async ({ backend, params }) => {
  const r = await backend.rpc("live_view", { p_session: params.id });
  if (!r) throw new AppError("FORBIDDEN", "You do not have live access to this drive", 403);
  return json(r);
});

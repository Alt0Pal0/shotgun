import { json, withAuth } from "@/lib/api";
export const GET = withAuth(async ({ backend, req }) => {
  const url = new URL(req.url);
  const learner = url.searchParams.get("learner");
  const filter = url.searchParams.get("filter") ?? "ALL";
  return json(await backend.rpc("list_sessions", { p_learner: learner, p_filter: filter }));
});

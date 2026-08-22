import { json, withAuth } from "@/lib/api";
/** Sessions the caller is bound to (learner lock) or may view live (adult). Polled by the shell. */
export const GET = withAuth(async ({ backend }) => json(await backend.rpc("my_live_session")));

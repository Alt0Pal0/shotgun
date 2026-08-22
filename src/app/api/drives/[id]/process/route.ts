import { json, withAuth } from "@/lib/api";
import { processEndedSession } from "@/lib/sessions/process";
/** Idempotent re-processing trigger for a session stuck in ENDED / RECOVERY_REQUIRED. Caller must be able to view it (checked by session_detail RLS). */
export const POST = withAuth(async ({ backend, params }) => json(await processEndedSession(backend, params.id)));

import "server-only";
import type { Backend } from "@/lib/backend";
import { DEFAULT_NIGHT_RULE, processRoute, type NightRule } from "@/lib/gps";

interface SessionRow {
  id: string;
  status: string;
  server_started_at: string | null;
  server_ended_at: string | null;
  jurisdiction: string;
  ruleset_version: string;
}

/**
 * Post-drive processing: first-party samples → distance, quality, night minutes, geometry. Idempotent: safe to re-run.
 * Runs with the service role because the learner is not permitted to write metrics.
 */
export async function processEndedSession(backend: Backend, sessionId: string): Promise<{ status: string }> {
  const detail = await backend.rpc<SessionRow | null>("session_detail", { p_session: sessionId });
  if (!detail) throw new Error("Session not found");
  if (!["ENDED", "RECOVERY_REQUIRED", "AWAITING_LEARNER_REFLECTION"].includes(detail.status))
    return { status: detail.status };
  try {
    const samples = await backend.serviceSamples(sessionId);
    const config = await backend.serviceRpc<{
      night?: { type: string; after_sunset_minutes: number; before_sunrise_minutes: number };
    } | null>("ruleset_config", { p_jurisdiction: detail.jurisdiction, p_version: detail.ruleset_version });
    const nightRule: NightRule =
      config?.night?.type === "solar_offset"
        ? {
            after_sunset_minutes: config.night.after_sunset_minutes,
            before_sunrise_minutes: config.night.before_sunrise_minutes,
          }
        : DEFAULT_NIGHT_RULE;
    const started = new Date(detail.server_started_at ?? Date.now());
    const ended = new Date(detail.server_ended_at ?? Date.now());
    const result = processRoute(samples, started, ended, nightRule);
    const out = await backend.serviceRpc<{ status: string }>("record_route_processing", {
      p_session: sessionId,
      p: result,
    });
    return { status: out.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : "processing failed";
    const out = await backend.serviceRpc<{ status: string }>("record_route_processing", {
      p_session: sessionId,
      p: { error: message },
    });
    return { status: out.status };
  }
}

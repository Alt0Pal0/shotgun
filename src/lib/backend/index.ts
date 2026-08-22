import "server-only";
import type { Backend } from "./types";

export type { Backend, SessionUser } from "./types";
export { AppError } from "./types";

export function backendMode(): "supabase" | "local" {
  const forced = process.env.BACKEND_MODE;
  if (forced === "local" || forced === "supabase") return forced;
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "supabase" : "local";
}

export async function getBackend(): Promise<Backend> {
  if (backendMode() === "supabase") return (await import("./supabase")).supabaseBackend;
  return (await import("./local")).localBackend;
}

/** True when a usable backend exists: Supabase is configured, or we are in development/test (local Postgres). */
export function backendConfigured(): boolean {
  return (
    backendMode() === "supabase" ||
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_LOCAL_BACKEND_IN_PROD === "1"
  );
}

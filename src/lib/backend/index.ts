import "server-only";
import type { Backend } from "./types";

export type { Backend, SessionUser } from "./types";
export { AppError } from "./types";

/**
 * Backend selection:
 *  - "supabase": NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set (Supabase Auth/Realtime/PostgREST)
 *  - "postgres": DATABASE_URL is set (Neon in production, local Postgres in development) — built-in auth, polling
 *  BACKEND_MODE forces one explicitly.
 */
/** Database URL from any of the names the Vercel ⇄ Neon integration may set. Prefers the pooled URL. */
export function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

export function backendMode(): "supabase" | "postgres" {
  const forced = process.env.BACKEND_MODE;
  if (forced === "supabase" || forced === "postgres") return forced;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  return "postgres";
}

/** True when a usable backend exists for this environment. */
export function backendConfigured(): boolean {
  if (backendMode() === "supabase")
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasDb = Boolean(databaseUrl()) || process.env.NODE_ENV !== "production";
  const hasSecret = (process.env.AUTH_SECRET?.length ?? 0) >= 32 || process.env.NODE_ENV !== "production";
  return hasDb && hasSecret;
}

export async function getBackend(): Promise<Backend> {
  if (backendMode() === "supabase") return (await import("./supabase")).supabaseBackend;
  return (await import("./postgres")).postgresBackend;
}

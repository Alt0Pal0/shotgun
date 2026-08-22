import "server-only";
/**
 * LOCAL DEVELOPMENT / TEST BACKEND. Talks to a plain PostgreSQL database prepared by `scripts/db.sh` with the
 * Supabase auth shim. Auth is a signed cookie holding the auth.users id. Refuses to run in production builds.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { Pool } from "pg";
import type { LocationSample } from "@/lib/gps";
import { toAppError } from "./errors";
import { AppError, type AuthResult, type Backend, type SessionUser } from "./types";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_BACKEND_IN_PROD !== "1") {
  throw new Error("The local backend must not be used in production. Configure Supabase environment variables.");
}

const COOKIE = "ldp_local_session";
const SECRET = process.env.LOCAL_AUTH_SECRET ?? "local-dev-secret-not-for-production";
declare global { var __ldpPool: Pool | undefined }
const pool = globalThis.__ldpPool ?? new Pool({ connectionString: process.env.DATABASE_URL ?? `postgres:///${process.env.LOCAL_DB_NAME ?? "ldp_dev"}`, max: 8 });
globalThis.__ldpPool = pool;

function sign(uid: string): string {
  const mac = createHmac("sha256", SECRET).update(uid).digest("hex");
  return `${uid}.${mac}`;
}
function verify(token: string | undefined): string | null {
  if (!token) return null;
  const [uid, mac] = token.split(".");
  if (!uid || !mac) return null;
  const expected = createHmac("sha256", SECRET).update(uid).digest("hex");
  if (expected.length !== mac.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  return uid;
}

async function currentUid(): Promise<string | null> {
  const store = await cookies();
  return verify(store.get(COOKIE)?.value);
}

async function setSessionCookie(uid: string | null) {
  const store = await cookies();
  if (uid) store.set(COOKIE, sign(uid), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  else store.delete(COOKIE);
}

async function runAs<T>(uid: string | null, role: "authenticated" | "service_role" | "anon", fn: (q: (sql: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role } : { role })]);
    const out = await fn((sql, args) => c.query(sql, args));
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw toAppError(e);
  } finally { c.release(); }
}

async function callRpc<T>(uid: string | null, role: "authenticated" | "service_role", fn: string, args: Record<string, unknown>): Promise<T> {
  if (!/^[a-z_]+$/.test(fn)) throw new AppError("VALIDATION", "Invalid function name", 400);
  const keys = Object.keys(args);
  const named = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  const values = keys.map((k) => { const v = args[k]; return v !== null && typeof v === "object" ? JSON.stringify(v) : v; });
  return runAs(uid, role, async (q) => (await q(`select app.${fn}(${named}) as r`, values)).rows[0]?.r as T);
}

export const localBackend: Backend = {
  mode: "local",
  async getUser(): Promise<SessionUser | null> {
    const uid = await currentUid();
    if (!uid) return null;
    const { rows } = await pool.query("select id, email, email_confirmed_at from auth.users where id = $1", [uid]);
    if (!rows[0]) return null;
    return { id: rows[0].id, email: rows[0].email, emailVerified: Boolean(rows[0].email_confirmed_at) };
  },
  async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
    const uid = await currentUid();
    return callRpc<T>(uid, "authenticated", fn, args);
  },
  async serviceRpc<T>(fn: string, args: Record<string, unknown> = {}) { return callRpc<T>(null, "service_role", fn, args); },
  async serviceSamples(sessionId: string) {
    return runAs(null, "service_role", async (q) => (await q(
      "select sequence_no, recorded_at, latitude, longitude, accuracy_m, speed_mps, heading_deg from location_samples where session_id = $1 order by sequence_no", [sessionId])).rows as unknown as LocationSample[]);
  },
  async signUp({ email, password, displayName, role }): Promise<AuthResult> {
    const token = randomBytes(16).toString("hex");
    try {
      const { rows } = await pool.query(
        `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('display_name', $2::text, 'role', $3::text, 'password_hash', crypt($4, gen_salt('bf')), 'verify_token', $5::text)) returning id`,
        [email.toLowerCase(), displayName, role, password, token]);
      await setSessionCookie(rows[0].id);
      return { ok: true, needsVerification: true, devVerifyUrl: `/auth/local-verify?token=${token}` };
    } catch (e) {
      const err = e as { code?: string };
      return { ok: false, error: err.code === "23505" ? "An account with this email already exists" : "Could not create account" };
    }
  },
  async signIn({ email, password }): Promise<AuthResult> {
    const { rows } = await pool.query("select id from auth.users where email = $1 and raw_user_meta_data ->> 'password_hash' = crypt($2, raw_user_meta_data ->> 'password_hash')", [email.toLowerCase(), password]);
    if (!rows[0]) return { ok: false, error: "Invalid email or password" };
    await setSessionCookie(rows[0].id);
    return { ok: true };
  },
  async signOut() { await setSessionCookie(null); },
  async resendVerification(email): Promise<AuthResult> {
    const { rows } = await pool.query("select raw_user_meta_data ->> 'verify_token' as t from auth.users where email = $1", [email.toLowerCase()]);
    return { ok: true, needsVerification: true, devVerifyUrl: rows[0]?.t ? `/auth/local-verify?token=${rows[0].t}` : undefined };
  },
  async requestPasswordReset(): Promise<AuthResult> { return { ok: true }; },
  async updatePassword(newPassword): Promise<AuthResult> {
    const uid = await currentUid();
    if (!uid) return { ok: false, error: "Sign in required" };
    await pool.query("update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('password_hash', crypt($2, gen_salt('bf'))) where id = $1", [uid, newPassword]);
    return { ok: true };
  },
};

/** Dev-only email verification: marks the user confirmed when the token matches. */
export async function localVerifyEmail(token: string): Promise<boolean> {
  const { rows } = await pool.query("update auth.users set email_confirmed_at = now() where raw_user_meta_data ->> 'verify_token' = $1 returning id", [token]);
  if (!rows[0]) return false;
  await setSessionCookie(rows[0].id);
  return true;
}

import "server-only";
/**
 * Plain-PostgreSQL backend (Neon in production, local Postgres in development/CI).
 * - Every user request runs `SET LOCAL ROLE authenticated|anon` + `request.jwt.claims`, so RLS and app.* functions
 *   behave exactly as under Supabase/PostgREST.
 * - Server-only work (route processing, PDF model, auth) runs as the connecting database owner (no SET ROLE).
 * - Auth: email/password via app.auth_* functions (bcrypt), server-side sessions in auth.sessions, signed cookie.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { Pool } from "pg";
import type { LocationSample } from "@/lib/gps";
import { appUrl, sendAuthEmail } from "@/lib/email";
import { databaseUrl } from "./index";
import { toAppError } from "./errors";
import { AppError, type AuthResult, type Backend, type SessionUser } from "./types";

const COOKIE = "ldp_session";
const DEV_SECRET = "dev-only-secret-change-me";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production")
    throw new AppError("CONFIG", "AUTH_SECRET (>= 32 chars) is required in production", 500);
  return DEV_SECRET;
}

declare global {
  var __ldpPool: Pool | undefined;
}
function pool(): Pool {
  if (!globalThis.__ldpPool) {
    const url =
      databaseUrl() ??
      (process.env.NODE_ENV !== "production" ? `postgres:///${process.env.LOCAL_DB_NAME ?? "ldp_dev"}` : undefined);
    if (!url) throw new AppError("CONFIG", "DATABASE_URL is required", 500);
    globalThis.__ldpPool = new Pool({
      connectionString: url,
      max: 5,
      ssl: /sslmode=require|neon\.tech/.test(url) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__ldpPool;
}

function sign(sid: string): string {
  return `${sid}.${createHmac("sha256", secret()).update(sid).digest("hex")}`;
}
function verify(token: string | undefined): string | null {
  if (!token) return null;
  const [sid, mac] = token.split(".");
  if (!sid || !mac) return null;
  const expected = createHmac("sha256", secret()).update(sid).digest("hex");
  return expected.length === mac.length && timingSafeEqual(Buffer.from(expected), Buffer.from(mac)) ? sid : null;
}
async function sessionId(): Promise<string | null> {
  return verify((await cookies()).get(COOKIE)?.value);
}
async function setCookie(sid: string | null) {
  const store = await cookies();
  if (sid)
    store.set(COOKIE, sign(sid), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 3600,
    });
  else store.delete(COOKIE);
}

type Q = (sql: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
async function runAs<T>(
  uid: string | null,
  role: "authenticated" | "anon" | null,
  fn: (q: Q) => Promise<T>,
): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    if (role) await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(uid ? { sub: uid, role: role ?? "service_role" } : { role: role ?? "service_role" }),
    ]);
    const out = await fn((sql, args) => c.query(sql, args));
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw toAppError(e);
  } finally {
    c.release();
  }
}
async function callRpc<T>(
  uid: string | null,
  role: "authenticated" | "anon" | null,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!/^[a-z_]+$/.test(fn)) throw new AppError("VALIDATION", "Invalid function name", 400);
  const keys = Object.keys(args);
  const named = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  const values = keys.map((k) => {
    const v = args[k];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  return runAs(uid, role, async (q) => (await q(`select app.${fn}(${named}) as r`, values)).rows[0]?.r as T);
}
const server = <T>(fn: string, args: Record<string, unknown>) => callRpc<T>(null, null, fn, args);

async function currentUser(): Promise<SessionUser | null> {
  const sid = await sessionId();
  if (!sid) return null;
  const u = await server<{ id: string; email: string; email_confirmed: boolean } | null>("auth_session_user", {
    p_session: sid,
  });
  return u ? { id: u.id, email: u.email, emailVerified: u.email_confirmed } : null;
}

async function issueAndSend(email: string, kind: "verify" | "reset"): Promise<AuthResult> {
  const token = await server<string | null>("auth_issue_token", { p_email: email, p_kind: kind });
  if (!token) return { ok: true, needsVerification: kind === "verify" }; // do not reveal unknown emails
  const link = kind === "verify" ? `${appUrl()}/auth/verify?token=${token}` : `${appUrl()}/auth/reset?token=${token}`;
  const r = await sendAuthEmail(
    email,
    kind === "verify" ? "Verify your email" : "Reset your password",
    link,
    kind === "verify" ? "Confirm your email to start using Learner Driver Platform:" : "Choose a new password:",
  );
  return { ok: true, needsVerification: kind === "verify", devVerifyUrl: r.devLink?.replace(appUrl(), "") };
}

export const postgresBackend: Backend = {
  mode: "postgres",
  getUser: currentUser,
  async rpc<T>(fn: string, args: Record<string, unknown> = {}) {
    const user = await currentUser();
    return callRpc<T>(user?.id ?? null, user ? "authenticated" : "anon", fn, args);
  },
  async serviceRpc<T>(fn: string, args: Record<string, unknown> = {}) {
    return server<T>(fn, args);
  },
  async serviceSamples(sessionId: string) {
    return runAs(
      null,
      null,
      async (q) =>
        (
          await q(
            "select sequence_no, recorded_at, latitude, longitude, accuracy_m, speed_mps, heading_deg from public.location_samples where session_id = $1 order by sequence_no",
            [sessionId],
          )
        ).rows as unknown as LocationSample[],
    );
  },
  async signUp({ email, password, displayName, role }): Promise<AuthResult> {
    try {
      const r = await server<{ user_id: string; verify_token: string }>("auth_sign_up", {
        p_email: email,
        p_password: password,
        p_display_name: displayName,
        p_role: role,
      });
      const sid = await server<string>("auth_create_session", { p_user: r.user_id });
      await setCookie(sid);
      const link = `${appUrl()}/auth/verify?token=${r.verify_token}`;
      const sent = await sendAuthEmail(
        email,
        "Verify your email",
        link,
        "Confirm your email to start using Learner Driver Platform:",
      );
      return { ok: true, needsVerification: true, devVerifyUrl: sent.devLink?.replace(appUrl(), "") };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
  async signIn({ email, password }): Promise<AuthResult> {
    try {
      const ua = (await headers()).get("user-agent") ?? null;
      const r = await server<{ session_id: string }>("auth_sign_in", {
        p_email: email,
        p_password: password,
        p_user_agent: ua,
      });
      await setCookie(r.session_id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
  async signOut() {
    const sid = await sessionId();
    if (sid) await server("auth_sign_out", { p_session: sid }).catch(() => undefined);
    await setCookie(null);
  },
  async resendVerification(email) {
    try {
      return await issueAndSend(email, "verify");
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
  async requestPasswordReset(email) {
    try {
      return await issueAndSend(email, "reset");
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
  async updatePassword(newPassword) {
    const user = await currentUser();
    if (!user) return { ok: false, error: "Sign in required" };
    try {
      await server("auth_update_password", { p_user: user.id, p_password: newPassword });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};

/** Consume an email-verification token; signs the user in on success. */
export async function consumeVerifyToken(token: string): Promise<boolean> {
  const uid = await server<string | null>("auth_consume_verify", { p_token: token });
  if (!uid) return false;
  await setCookie(await server<string>("auth_create_session", { p_user: uid }));
  return true;
}
/** Consume a password-reset token with a new password; signs the user in on success. */
export async function consumeResetToken(token: string, password: string): Promise<boolean> {
  const uid = await server<string | null>("auth_consume_reset", { p_token: token, p_password: password });
  if (!uid) return false;
  await setCookie(await server<string>("auth_create_session", { p_user: uid }));
  return true;
}

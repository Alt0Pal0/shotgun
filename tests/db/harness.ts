/**
 * Database test harness. Runs SQL as specific Supabase-style roles against the local Postgres shim so that
 * RLS policies and SECURITY DEFINER functions are exercised exactly as PostgREST would execute them.
 */
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";

const db = process.env.LOCAL_DB_NAME ?? "ldp_test";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? `postgres:///${db}`, max: 4 });

export interface TestUser { id: string; email: string }

export async function createUser(prefix = "u"): Promise<TestUser> {
  const email = `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
  const { rows } = await pool.query<{ id: string }>(
    "insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id",
    [email],
  );
  return { id: rows[0].id, email };
}

export class DbError extends Error {
  constructor(message: string, public code: string | undefined, public hint?: string) { super(message); }
}

function wrap(e: unknown): DbError {
  const err = e as { message?: string; detail?: string; hint?: string; code?: string };
  return new DbError(err.message ?? String(e), err.detail ?? err.code, err.hint);
}

/** Run `fn` inside a transaction as the `authenticated` role with the given user's JWT claims. */
export async function as<T>(user: TestUser | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (user) {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user.id, role: "authenticated" })]);
    } else {
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', '', true)");
    }
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw wrap(e);
  } finally {
    c.release();
  }
}

/** Run `fn` as the service role (server-only code paths). */
export async function asService<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role service_role");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw wrap(e);
  } finally {
    c.release();
  }
}

/** Call an app.* function as a user and return its scalar result. */
export async function rpc<T = unknown>(user: TestUser | null, fn: string, args: unknown[] = []): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  return as(user, async (c) => {
    const { rows } = await c.query(`select app.${fn}(${placeholders}) as r`, args);
    return rows[0].r as T;
  });
}

export async function rpcService<T = unknown>(fn: string, args: unknown[] = []): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  return asService(async (c) => {
    const { rows } = await c.query(`select app.${fn}(${placeholders}) as r`, args);
    return rows[0].r as T;
  });
}

export async function select<T = Record<string, unknown>>(user: TestUser | null, sql: string, args: unknown[] = []): Promise<T[]> {
  return as(user, async (c) => (await c.query(sql, args)).rows as T[]);
}

export async function expectDenied(p: Promise<unknown>, codeIncludes?: string): Promise<DbError> {
  try {
    await p;
  } catch (e) {
    const err = e as DbError;
    if (codeIncludes && !(err.code ?? "").includes(codeIncludes) && !err.message.includes(codeIncludes)) {
      throw new Error(`Expected error containing ${codeIncludes}, got ${err.code}: ${err.message}`);
    }
    return err;
  }
  throw new Error("Expected the operation to be denied, but it succeeded");
}

// ---- Flow helpers -------------------------------------------------------------------------

export async function makeLearner(permitIssueDate = "2026-03-01") {
  const u = await createUser("learner");
  await rpc(u, "create_license_track", ["US-CA", permitIssueDate]);
  return u;
}

export async function linkAdult(learner: TestUser, adult?: TestUser) {
  const a = adult ?? (await createUser("adult"));
  const inv = await rpc<{ token: string; id: string }>(learner, "create_invitation", []);
  const rel = await rpc<{ relationship_id: string }>(a, "accept_invitation", [inv.token, "I attest that I am a California-licensed adult age 25 or older and that the information I approve is accurate."]);
  return { adult: a, relationshipId: rel.relationship_id };
}

export async function registerDevice(user: TestUser, key = `dev-${randomUUID()}`) {
  return rpc<string>(user, "register_device", [key, "test", "Test phone"]);
}

export interface SessionJson { id: string; status: string; learner_id: string; supervisor_id: string | null }

/** Full two-phone start: learner requests, adult accepts with all confirmations, recorder starts. */
export async function startActiveSession(learner: TestUser, adult: TestUser) {
  const device = await registerDevice(learner);
  const req = await rpc<SessionJson>(learner, "request_session", [
    JSON.stringify({ supervisor_id: adult.id, recorder_device_id: device, supervisor_present: true, idempotency_key: randomUUID() }),
  ]);
  await rpc(adult, "accept_session", [req.id, JSON.stringify({ designated_supervisor: true, physically_present: true, vehicle_parked: true, ready: true }), randomUUID()]);
  const started = await rpc<SessionJson>(learner, "start_session", [req.id, device, randomUUID(), false]);
  return { session: started, device };
}

export function sample(seq: number, t: Date, lat: number, lng: number, extra: Partial<{ accuracy_m: number; speed_mps: number; heading_deg: number }> = {}) {
  return { sequence_no: seq, recorded_at: t.toISOString(), latitude: lat, longitude: lng, accuracy_m: 8, speed_mps: 10, ...extra };
}

export async function closePool() { await pool.end(); }

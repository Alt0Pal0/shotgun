/**
 * Local demo seed (plain Postgres via the auth shim). Creates a verified learner + adult pair with one approved GPS drive,
 * one approved manual drive, one professional lesson, and one drive awaiting review.
 *   learner@demo.test / demo-password      adult@demo.test / demo-password
 * Never run against production: it writes directly to auth.users through the local shim.
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { simulateDrive } from "../src/lib/gps/simulator";
import { processRoute } from "../src/lib/gps/route";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? `postgres:///${process.env.LOCAL_DB_NAME ?? "ldp_dev"}`,
});
const ATTEST =
  "I attest that I am a California-licensed adult age 25 or older and that the information I approve is accurate.";

async function asUser<T>(
  uid: string | null,
  role: "authenticated" | "service_role",
  sql: string,
  args: unknown[] = [],
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(uid ? { sub: uid, role } : { role }),
    ]);
    const r = await c.query(sql, args);
    await c.query("commit");
    return r.rows[0]?.r as T;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
const rpc = <T>(uid: string, fn: string, args: unknown[]) =>
  asUser<T>(uid, "authenticated", `select app.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args);

async function user(email: string, name: string, role: string): Promise<string> {
  const { rows } = await pool.query(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, now(), jsonb_build_object('display_name', $2::text, 'role', $3::text, 'password_hash', crypt('demo-password', gen_salt('bf'))))
     on conflict (email) do update set email = excluded.email returning id`,
    [email, name, role],
  );
  return rows[0].id;
}

async function main() {
  const learner = await user("learner@demo.test", "Jordan Demo", "learner");
  const adult = await user("adult@demo.test", "Sam Demo", "adult");
  const existing = await pool.query("select 1 from learner_license_tracks where learner_id = $1", [learner]);
  if (existing.rowCount) {
    console.log("Demo data already present.");
    await pool.end();
    return;
  }
  await rpc(learner, "create_license_track", ["US-CA", "2026-03-01"]);
  const inv = await rpc<{ token: string }>(learner, "create_invitation", [null]);
  await rpc(adult, "accept_invitation", [inv.token, ATTEST]);
  const device = await rpc<string>(learner, "register_device", ["demo-device-key-0000000000", "web", "Demo phone"]);
  const vehicle = await rpc<string>(learner, "upsert_vehicle", [null, "Blue Civic"]);

  // Approved GPS drive (simulated 40 min at dusk)
  const start = new Date("2026-08-15T02:10:00Z");
  const req = await rpc<{ id: string }>(learner, "request_session", [
    JSON.stringify({
      supervisor_id: adult,
      recorder_device_id: device,
      vehicle_id: vehicle,
      supervisor_present: true,
      idempotency_key: randomUUID(),
    }),
  ]);
  await rpc(adult, "accept_session", [
    req.id,
    JSON.stringify({ designated_supervisor: true, physically_present: true, vehicle_parked: true, ready: true }),
    randomUUID(),
  ]);
  await rpc(learner, "start_session", [req.id, device, randomUUID(), false]);
  const samples = simulateDrive({
    start: { lat: 37.7749, lng: -122.4194 },
    durationS: 2400,
    intervalS: 5,
    parkedTailS: 60,
    trafficLightS: 20,
    startTime: start,
  });
  for (let i = 0; i < samples.length; i += 200)
    await rpc(learner, "ingest_samples", [req.id, device, JSON.stringify(samples.slice(i, i + 200))]);
  await rpc(adult, "add_observation", [
    req.id,
    JSON.stringify({
      observation_type: "NEEDS_PRACTICE",
      client_event_id: randomUUID(),
      note: "Mirror check before the merge",
    }),
  ]);
  await rpc(adult, "add_observation", [
    req.id,
    JSON.stringify({ observation_type: "DID_WELL", client_event_id: randomUUID() }),
  ]);
  await rpc(learner, "end_session", [req.id, randomUUID(), null, true]);
  await pool.query(
    "update drive_sessions set server_started_at = $2, server_ended_at = $3, proposed_duration_minutes = 40 where id = $1",
    [req.id, start.toISOString(), new Date(start.getTime() + 2400_000).toISOString()],
  );
  const processed = processRoute(samples, start, new Date(start.getTime() + 2400_000));
  await asUser(null, "service_role", "select app.record_route_processing($1, $2) as r", [
    req.id,
    JSON.stringify(processed),
  ]);
  await rpc(learner, "save_reflection", [
    req.id,
    JSON.stringify({
      rating: 4,
      went_well: "Smooth stops and good lane position.",
      improve: "Earlier mirror checks before merging.",
    }),
    true,
  ]);
  const obs = await pool.query("select id from drive_observations where session_id = $1", [req.id]);
  await rpc(adult, "review_session", [
    req.id,
    JSON.stringify({
      decision: "APPROVED",
      rating: 4,
      went_well: "Calm and controlled.",
      next_focus: "Mirror checks earlier, then freeway merges.",
      finalized_observation_ids: obs.rows.map((r) => r.id),
    }),
    randomUUID(),
  ]);

  // Manual supervised drive and professional lesson, approved
  const manual = await rpc<{ id: string }>(learner, "create_manual_session", [
    JSON.stringify({
      learner_id: learner,
      session_type: "FAMILY_SUPERVISED",
      supervisor_id: adult,
      started_at: "2026-08-01T19:00:00Z",
      duration_minutes: 60,
      night_minutes: 15,
      learner_rating: 3,
    }),
    randomUUID(),
  ]);
  await rpc(adult, "review_session", [manual.id, JSON.stringify({ decision: "APPROVED", rating: 4 }), randomUUID()]);
  const pro = await rpc<{ id: string }>(adult, "create_manual_session", [
    JSON.stringify({
      learner_id: learner,
      session_type: "PROFESSIONAL_INSTRUCTION",
      started_at: "2026-08-05T15:00:00Z",
      duration_minutes: 120,
      school_name: "Bay Driving School",
    }),
    randomUUID(),
  ]);
  await rpc(adult, "review_session", [pro.id, JSON.stringify({ decision: "APPROVED", rating: 5 }), randomUUID()]);
  // One awaiting review
  await rpc(learner, "create_manual_session", [
    JSON.stringify({
      learner_id: learner,
      session_type: "FAMILY_SUPERVISED",
      supervisor_id: adult,
      started_at: "2026-08-18T16:00:00Z",
      duration_minutes: 45,
      learner_rating: 4,
    }),
    randomUUID(),
  ]);
  console.log("Seeded. Sign in as learner@demo.test or adult@demo.test with password demo-password");
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Realtime authorization. Supabase Realtime `postgres_changes` delivers a row to a subscriber only if the subscriber's
 * RLS policy permits SELECT on that row. These tests pin the exact policies the live channel relies on, for every
 * table in the realtime publication (live_session_state, drive_observations, drive_sessions).
 */
import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { asService, closePool, createUser, linkAdult, makeLearner, rpc, select, startActiveSession } from "./harness";

afterAll(closePool);

describe("realtime channel authorization", () => {
  it("publishes only throttled live state, observations and sessions — never raw samples (when the publication exists)", async () => {
    const rows = await asService((c) =>
      c.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime'"),
    );
    const tables = rows.rows.map((r) => r.tablename as string);
    // Locally there is no supabase_realtime publication; on Supabase the migration adds exactly these tables.
    if (tables.length) {
      expect(new Set(tables)).toEqual(new Set(["live_session_state", "drive_observations", "drive_sessions"]));
      expect(tables).not.toContain("location_samples");
    }
  });

  it("in-car supervisor and authorized remote viewer receive live rows; learner, other linked adult, stranger and anon do not", async () => {
    const learner = await makeLearner();
    const { adult: inCar } = await linkAdult(learner);
    const { adult: remote, relationshipId } = await linkAdult(learner);
    const { adult: otherLinked } = await linkAdult(learner);
    await rpc(learner, "set_remote_live_view", [relationshipId, true]);
    const stranger = await createUser("stranger");
    const { session } = await startActiveSession(learner, inCar);
    await rpc(inCar, "add_observation", [
      session.id,
      JSON.stringify({ observation_type: "DID_WELL", client_event_id: randomUUID() }),
    ]);

    const can = async (u: Parameters<typeof select>[0], table: string, col: string) =>
      (await select(u, `select 1 from ${table} where ${col} = $1`, [session.id])).length > 0;
    expect(await can(inCar, "live_session_state", "session_id")).toBe(true);
    expect(await can(remote, "live_session_state", "session_id")).toBe(true);
    expect(await can(learner, "live_session_state", "session_id")).toBe(false);
    expect(await can(otherLinked, "live_session_state", "session_id")).toBe(false);
    expect(await can(stranger, "live_session_state", "session_id")).toBe(false);

    expect(await can(inCar, "drive_observations", "session_id")).toBe(true);
    expect(await can(remote, "drive_observations", "session_id")).toBe(true);
    expect(await can(learner, "drive_observations", "session_id")).toBe(false);
    expect(await can(stranger, "drive_observations", "session_id")).toBe(false);

    // drive_sessions status changes are visible to learner and all active linked adults (needed for the lock and banner), never strangers
    expect(await can(learner, "drive_sessions", "id")).toBe(true);
    expect(await can(otherLinked, "drive_sessions", "id")).toBe(true);
    expect(await can(stranger, "drive_sessions", "id")).toBe(false);
    await expect(select(null, "select 1 from live_session_state")).rejects.toBeTruthy();
  });

  it("a revoked remote viewer stops receiving live rows immediately", async () => {
    const learner = await makeLearner();
    const { adult: inCar } = await linkAdult(learner);
    const { adult: remote, relationshipId } = await linkAdult(learner);
    await rpc(learner, "set_remote_live_view", [relationshipId, true]);
    const { session } = await startActiveSession(learner, inCar);
    expect((await select(remote, "select 1 from live_session_state where session_id = $1", [session.id])).length).toBe(
      1,
    );
    await rpc(learner, "revoke_relationship", [relationshipId, "done"]);
    expect((await select(remote, "select 1 from live_session_state where session_id = $1", [session.id])).length).toBe(
      0,
    );
    expect((await select(remote, "select 1 from drive_observations where session_id = $1", [session.id])).length).toBe(
      0,
    );
  });

  it("live state never carries precise history: only the latest rounded position", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session, device } = await startActiveSession(learner, adult);
    const pts = Array.from({ length: 10 }, (_, i) => ({
      sequence_no: i,
      recorded_at: new Date(Date.now() - (10 - i) * 5000).toISOString(),
      latitude: 37.7749123456 + i * 0.001,
      longitude: -122.4194123456,
      accuracy_m: 5,
      speed_mps: 10,
    }));
    await rpc(learner, "ingest_samples", [session.id, device, JSON.stringify(pts)]);
    const cols = await asService((c) =>
      c.query("select column_name from information_schema.columns where table_name = 'live_session_state'"),
    );
    expect(cols.rows.map((r) => r.column_name)).not.toContain("route_geojson");
    const live = await select<{ latest_latitude: number }>(
      adult,
      "select latest_latitude from live_session_state where session_id = $1",
      [session.id],
    );
    expect(String(live[0].latest_latitude).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(5);
  });
});

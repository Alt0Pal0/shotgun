/**
 * Negative authorization tests required by the master prompt §22 and PRD §14.1.
 * Every case runs through RLS + SECURITY DEFINER functions exactly as PostgREST would.
 */
import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  as,
  asService,
  closePool,
  createUser,
  expectDenied,
  linkAdult,
  makeLearner,
  registerDevice,
  rpc,
  rpcService,
  sample,
  select,
  startActiveSession,
} from "./harness";

afterAll(closePool);

describe("negative authorization", () => {
  it("a learner cannot read another learner's drive, samples, route, reflection, or progress", async () => {
    const l1 = await makeLearner();
    const l2 = await makeLearner();
    const { adult } = await linkAdult(l1);
    const { session, device } = await startActiveSession(l1, adult);
    await rpc(l1, "ingest_samples", [session.id, device, JSON.stringify([sample(0, new Date(), 37.77, -122.41)])]);
    expect(await select(l2, "select id from drive_sessions where id = $1", [session.id])).toHaveLength(0);
    expect(await select(l2, "select * from location_samples where session_id = $1", [session.id])).toHaveLength(0);
    expect(await select(l2, "select * from learner_license_tracks where learner_id = $1", [l1.id])).toHaveLength(0);
    expect(await select(l2, "select * from requirement_contributions where learner_id = $1", [l1.id])).toHaveLength(0);
    expect(await select(l2, "select * from profiles where id = $1", [l1.id])).toHaveLength(0);
    await expectDenied(rpc(l2, "save_reflection", [session.id, JSON.stringify({ rating: 5 }), false]), "NOT_FOUND");
  });

  it("an unrelated adult cannot access a learner, subscribe to the live session, or review", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const stranger = await createUser("stranger");
    const { session } = await startActiveSession(learner, adult);
    expect(await select(stranger, "select id from drive_sessions where id = $1", [session.id])).toHaveLength(0);
    expect(await select(stranger, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(
      0,
    );
    expect(await select(stranger, "select * from drive_observations where session_id = $1", [session.id])).toHaveLength(
      0,
    );
    expect(
      await select(stranger, "select * from session_participants where session_id = $1", [session.id]),
    ).toHaveLength(0);
    await expectDenied(
      rpc(stranger, "add_observation", [session.id, JSON.stringify({ observation_type: "DID_WELL" })]),
      "NOT_FOUND",
    );
    await expectDenied(
      rpc(stranger, "accept_session", [
        session.id,
        JSON.stringify({ designated_supervisor: true, physically_present: true, vehicle_parked: true, ready: true }),
      ]),
      "NOT_FOUND",
    );
    await expectDenied(rpc(stranger, "end_session", [session.id, randomUUID(), null, true]), "FORBIDDEN");
    await expectDenied(
      rpc(stranger, "review_session", [
        session.id,
        JSON.stringify({ decision: "VOIDED", correction_reason: "x" }),
        randomUUID(),
      ]),
      "NOT_FOUND",
    );
    await expectDenied(rpc(stranger, "delete_route", [session.id, false, null]), "NOT_FOUND");
  });

  it("a revoked adult loses live and historical access", async () => {
    const learner = await makeLearner();
    const { adult, relationshipId } = await linkAdult(learner);
    const { session } = await startActiveSession(learner, adult);
    expect(await select(adult, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(1);
    await rpc(learner, "revoke_relationship", [relationshipId, "no longer supervising"]);
    expect(await select(adult, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(0);
    expect(await select(adult, "select id from drive_sessions where id = $1", [session.id])).toHaveLength(0);
    expect(await select(adult, "select * from location_samples where session_id = $1", [session.id])).toHaveLength(0);
    await expectDenied(
      rpc(adult, "add_observation", [session.id, JSON.stringify({ observation_type: "DID_WELL" })]),
      "NOT_FOUND",
    );
    // Learner still sees the drive and can end with override
    expect(await select(learner, "select id from drive_sessions where id = $1", [session.id])).toHaveLength(1);
    // A new drive cannot be requested with the revoked adult
    const dev = await registerDevice(learner);
    await rpc(learner, "end_session", [session.id, randomUUID(), "adult left", true]);
    await expectDenied(
      rpc(learner, "request_session", [
        JSON.stringify({ supervisor_id: adult.id, recorder_device_id: dev, idempotency_key: randomUUID() }),
      ]),
      "FORBIDDEN",
    );
  });

  it("a learner cannot approve their own drive or write reviews/contributions directly", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session } = await startActiveSession(learner, adult);
    await rpc(learner, "end_session", [session.id, randomUUID(), "test override", true]);
    await rpcService("record_route_processing", [
      session.id,
      JSON.stringify({ gps_quality: "NONE", processing_version: "route-v1", night_algorithm_version: "night-v1" }),
    ]);
    await rpc(learner, "save_reflection", [session.id, JSON.stringify({ rating: 5 }), true]);
    await expectDenied(
      rpc(learner, "review_session", [session.id, JSON.stringify({ decision: "APPROVED", rating: 5 }), randomUUID()]),
    );
    await expectDenied(
      as(learner, (c) =>
        c.query("insert into supervisor_reviews (session_id, reviewer_id, decision) values ($1, $2, 'APPROVED')", [
          session.id,
          learner.id,
        ]),
      ),
    );
    await expectDenied(
      as(learner, (c) =>
        c.query(
          "insert into requirement_contributions (session_id, learner_id, requirement_key, amount, ruleset_version, evidence_type, approved_by) values ($1, $2, 'supervised_total', 3000, 'x', 'GPS', $2)",
          [session.id, learner.id],
        ),
      ),
    );
    await expectDenied(
      as(learner, (c) =>
        c.query("update drive_sessions set status = 'APPROVED', credited_duration_minutes = 3000 where id = $1", [
          session.id,
        ]),
      ),
    );
    expect(
      await select(learner, "select * from requirement_contributions where learner_id = $1", [learner.id]),
    ).toHaveLength(0);
  });

  it("a learner cannot retrieve adult observations or live state during an active drive, even as the author-adjacent party", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session } = await startActiveSession(learner, adult);
    await rpc(adult, "add_observation", [
      session.id,
      JSON.stringify({ observation_type: "NEEDS_PRACTICE", note: "mirror" }),
    ]);
    expect(await select(learner, "select * from drive_observations where session_id = $1", [session.id])).toHaveLength(
      0,
    );
    expect(await select(learner, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(
      0,
    );
    expect(await select(learner, "select * from location_samples where session_id = $1", [session.id])).toHaveLength(0);
    expect(await select(learner, "select * from drive_routes where session_id = $1", [session.id])).toHaveLength(0);
    // The lock is a server fact: the learner can only read status/elapsed from drive_sessions
    const s = await select<{ status: string }>(learner, "select status from drive_sessions where id = $1", [
      session.id,
    ]);
    expect(s[0].status).toBe("ACTIVE");
    // After end, observations stay hidden until the adult finalizes + approves
    await rpc(learner, "end_session", [session.id, randomUUID(), "test override", true]);
    expect(await select(learner, "select * from drive_observations where session_id = $1", [session.id])).toHaveLength(
      0,
    );
    expect(await select(learner, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(
      0,
    );
  });

  it("a remote viewer cannot create verified observations; only the in-car supervisor can", async () => {
    const learner = await makeLearner();
    const { adult: inCar } = await linkAdult(learner);
    const { adult: remote, relationshipId } = await linkAdult(learner);
    await rpc(learner, "set_remote_live_view", [relationshipId, true]);
    const { session } = await startActiveSession(learner, inCar);
    const parts = await select<{ user_id: string; role: string }>(
      learner,
      "select user_id, role from session_participants where session_id = $1",
      [session.id],
    );
    expect(parts.find((p) => p.user_id === remote.id)?.role).toBe("REMOTE_VIEWER");
    expect(await select(remote, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(
      1,
    );
    const note = await rpc<{ verification_level: string }>(remote, "add_observation", [
      session.id,
      JSON.stringify({ observation_type: "NOTE", note: "looked smooth from the cam" }),
    ]);
    expect(note.verification_level).toBe("UNVERIFIED");
    await expectDenied(
      rpc(remote, "add_observation", [
        session.id,
        JSON.stringify({ observation_type: "DID_WELL", verification_level: "VERIFIED" }),
      ]),
      "FORBIDDEN",
    );
    const verified = await rpc<{ verification_level: string }>(inCar, "add_observation", [
      session.id,
      JSON.stringify({ observation_type: "DID_WELL" }),
    ]);
    expect(verified.verification_level).toBe("VERIFIED");
    // Remote viewer cannot end the drive or impersonate the in-car supervisor
    await expectDenied(rpc(remote, "end_session", [session.id, randomUUID(), null, true]), "FORBIDDEN");
    // A linked adult whose relationship does NOT allow remote view gets no live access
    const { adult: other } = await linkAdult(learner);
    expect(await select(other, "select * from live_session_state where session_id = $1", [session.id])).toHaveLength(0);
  });

  it("a user cannot upload samples to another learner's session or from a non-recorder device", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session, device } = await startActiveSession(learner, adult);
    const adultDevice = await registerDevice(adult);
    await expectDenied(
      rpc(adult, "ingest_samples", [session.id, adultDevice, JSON.stringify([sample(0, new Date(), 37.77, -122.41)])]),
      "FORBIDDEN",
    );
    await expectDenied(
      rpc(adult, "ingest_samples", [session.id, device, JSON.stringify([sample(0, new Date(), 37.77, -122.41)])]),
      "FORBIDDEN",
    );
    const other = await makeLearner();
    const otherDevice = await registerDevice(other);
    await expectDenied(
      rpc(other, "ingest_samples", [session.id, otherDevice, JSON.stringify([sample(0, new Date(), 37.77, -122.41)])]),
      "FORBIDDEN",
    );
    await expectDenied(
      as(other, (c) =>
        c.query(
          "insert into location_samples (session_id, device_id, sequence_no, recorded_at, latitude, longitude) values ($1, $2, 0, now(), 1, 1)",
          [session.id, otherDevice],
        ),
      ),
    );
  });

  it("precise route and live location are never readable anonymously", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session, device } = await startActiveSession(learner, adult);
    await rpc(learner, "ingest_samples", [session.id, device, JSON.stringify([sample(0, new Date(), 37.77, -122.41)])]);
    for (const table of [
      "location_samples",
      "live_session_state",
      "drive_routes",
      "drive_sessions",
      "drive_observations",
      "profiles",
    ]) {
      await expectDenied(select(null, `select * from ${table}`));
    }
    await expectDenied(rpc(null, "ingest_samples", [session.id, device, "[]"]));
  });

  it("learner cannot bypass the lock by mutating session state directly", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session } = await startActiveSession(learner, adult);
    await expectDenied(
      as(learner, (c) => c.query("update drive_sessions set status = 'ENDED' where id = $1", [session.id])),
    );
    await expectDenied(as(learner, (c) => c.query("delete from drive_sessions where id = $1", [session.id])));
    await expectDenied(
      as(learner, (c) =>
        c.query("update session_participants set can_view_live = true where session_id = $1", [session.id]),
      ),
    );
    await expectDenied(
      as(learner, (c) =>
        c.query(
          "insert into session_participants (session_id, user_id, role, can_view_live) values ($1, $2, 'IN_CAR_SUPERVISOR', true)",
          [session.id, learner.id],
        ),
      ),
    );
    const s = await select<{ status: string }>(learner, "select status from drive_sessions where id = $1", [
      session.id,
    ]);
    expect(s[0].status).toBe("ACTIVE");
  });

  it("invitations are single-use, expiring, revocable and cannot be self-accepted", async () => {
    const learner = await makeLearner();
    const inv = await rpc<{ token: string; id: string }>(learner, "create_invitation", []);
    const attest = "I attest that I am a California-licensed adult age 25 or older.";
    await expectDenied(rpc(learner, "accept_invitation", [inv.token, attest]), "FORBIDDEN");
    const a1 = await createUser("adult");
    await expectDenied(rpc(a1, "accept_invitation", [inv.token, "short"]), "VALIDATION");
    await rpc(a1, "accept_invitation", [inv.token, attest]);
    const a2 = await createUser("adult");
    await expectDenied(rpc(a2, "accept_invitation", [inv.token, attest]), "INVALID_STATE");
    const inv2 = await rpc<{ token: string; id: string }>(learner, "create_invitation", []);
    await rpc(learner, "revoke_invitation", [inv2.id]);
    await expectDenied(rpc(a2, "accept_invitation", [inv2.token, attest]), "INVALID_STATE");
    const inv3 = await rpc<{ token: string; id: string }>(learner, "create_invitation", []);
    // expire it directly as the service role
    await asService((c) =>
      c.query("update relationship_invitations set expires_at = now() - interval '1 day' where id = $1", [inv3.id]),
    );
    await expectDenied(rpc(a2, "accept_invitation", [inv3.token, attest]), "INVALID_STATE");
    // token hash is never the raw token
    const rows = await select<{ token_hash: string }>(
      learner,
      "select token_hash from relationship_invitations where id = $1",
      [inv.id],
    );
    expect(rows[0].token_hash).not.toBe(inv.token);
    // another adult cannot revoke the learner's invitation
    const inv4 = await rpc<{ id: string }>(learner, "create_invitation", []);
    await expectDenied(rpc(a1, "revoke_invitation", [inv4.id]), "NOT_FOUND");
  });

  it("only the designated supervisor can accept a requested drive", async () => {
    const learner = await makeLearner();
    const { adult: designated } = await linkAdult(learner);
    const { adult: otherLinked } = await linkAdult(learner);
    const device = await registerDevice(learner);
    const req = await rpc<{ id: string }>(learner, "request_session", [
      JSON.stringify({ supervisor_id: designated.id, recorder_device_id: device, idempotency_key: randomUUID() }),
    ]);
    const conf = JSON.stringify({
      designated_supervisor: true,
      physically_present: true,
      vehicle_parked: true,
      ready: true,
    });
    await expectDenied(rpc(otherLinked, "accept_session", [req.id, conf]), "FORBIDDEN");
    await expectDenied(
      rpc(designated, "accept_session", [
        req.id,
        JSON.stringify({ designated_supervisor: true, physically_present: false, vehicle_parked: true, ready: true }),
      ]),
      "VALIDATION",
    );
    const ok = await rpc<{ status: string }>(designated, "accept_session", [req.id, conf]);
    expect(ok.status).toBe("READY");
  });
});

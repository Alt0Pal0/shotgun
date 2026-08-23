import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  as,
  closePool,
  expectDenied,
  linkAdult,
  makeLearner,
  registerDevice,
  rpc,
  rpcService,
  sample,
  select,
  startActiveSession,
  type SessionJson,
} from "./harness";

afterAll(closePool);

describe("drive session state machine", () => {
  it("request → accept → start → samples → stop candidate → end → process → reflect → review → approve, exactly-once contributions", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session, device } = await startActiveSession(learner, adult);
    expect(session.status).toBe("ACTIVE");

    // Learner's one-live-session rule
    const dev2 = await registerDevice(learner);
    await expectDenied(
      rpc(learner, "request_session", [
        JSON.stringify({ supervisor_id: adult.id, recorder_device_id: dev2, idempotency_key: randomUUID() }),
      ]),
      "INVALID_STATE",
    );

    // Moving samples
    const t0 = Date.now() - 10 * 60_000;
    const moving = Array.from({ length: 20 }, (_, i) =>
      sample(i, new Date(t0 + i * 5000), 37.77 + i * 0.0005, -122.41, { speed_mps: 12 }),
    );
    const r1 = await rpc<{ accepted: number; duplicates: number; status: string }>(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify(moving),
    ]);
    expect(r1.accepted).toBe(20);
    expect(r1.status).toBe("ACTIVE");
    // Idempotent re-upload
    const r2 = await rpc<{ accepted: number; duplicates: number }>(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify(moving),
    ]);
    expect(r2.accepted).toBe(0);
    expect(r2.duplicates).toBe(20);

    // Normal end denied while moving
    await expectDenied(rpc(learner, "end_session", [session.id, randomUUID(), null, true]), "NOT_STATIONARY");

    // Brief stop (traffic light, 15 s) must not create a stop candidate
    const tStop = t0 + 20 * 5000;
    const light = Array.from({ length: 4 }, (_, i) =>
      sample(20 + i, new Date(tStop + i * 5000), 37.7795, -122.41, { speed_mps: 0 }),
    );
    const r3 = await rpc<{ status: string; stationary_seconds: number }>(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify(light),
    ]);
    expect(r3.status).toBe("ACTIVE");
    expect(r3.stationary_seconds).toBeLessThan(30);

    // Sustained stationary ≥ 30 s → STOP_CANDIDATE
    const parked = Array.from({ length: 8 }, (_, i) =>
      sample(24 + i, new Date(tStop + 20_000 + i * 5000), 37.7795, -122.41, { speed_mps: 0 }),
    );
    const r4 = await rpc<{ status: string; can_end: boolean }>(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify(parked),
    ]);
    expect(r4.status).toBe("STOP_CANDIDATE");
    expect(r4.can_end).toBe(true);

    // Live state reflects throttled position and distance
    const live = await select<{ estimated_distance_m: number; sample_count: number; gps_quality: string }>(
      adult,
      "select * from live_session_state where session_id = $1",
      [session.id],
    );
    expect(live).toHaveLength(1);
    expect(live[0].sample_count).toBe(32);
    expect(live[0].estimated_distance_m).toBeGreaterThan(900);
    expect(live[0].gps_quality).toBe("GOOD");

    // Adult observation during drive
    const obs = await rpc<{ id: string; verification_level: string }>(adult, "add_observation", [
      session.id,
      JSON.stringify({ observation_type: "NEEDS_PRACTICE", client_event_id: "evt-1" }),
    ]);
    expect(obs.verification_level).toBe("VERIFIED");
    const dup = await rpc<{ id: string; duplicate: boolean }>(adult, "add_observation", [
      session.id,
      JSON.stringify({ observation_type: "NEEDS_PRACTICE", client_event_id: "evt-1" }),
    ]);
    expect(dup.duplicate).toBe(true);
    expect(dup.id).toBe(obs.id);

    // End (idempotent)
    const endKey = randomUUID();
    const ended = await rpc<SessionJson>(learner, "end_session", [session.id, endKey, null, true]);
    expect(ended.status).toBe("ENDED");
    const ended2 = await rpc<SessionJson>(learner, "end_session", [session.id, endKey, null, true]);
    expect(ended2.status).toBe("ENDED");
    // Samples after end are ignored, not errors
    const late = await rpc<{ ignored: boolean }>(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify([sample(999, new Date(), 37.78, -122.41)]),
    ]);
    expect(late.ignored).toBe(true);

    // Server-side processing (service role only)
    await expectDenied(rpc(learner, "record_route_processing", [session.id, JSON.stringify({ distance_meters: 1 })]));
    const processed = await rpcService<SessionJson>("record_route_processing", [
      session.id,
      JSON.stringify({
        distance_meters: 1200,
        gps_quality: "GOOD",
        proposed_night_minutes: 0,
        processing_version: "route-v1",
        night_algorithm_version: "night-v1",
        route_geojson: {
          type: "LineString",
          coordinates: [
            [-122.41, 37.77],
            [-122.41, 37.7795],
          ],
        },
        point_count: 32,
        accepted_point_count: 32,
      }),
    ]);
    expect(processed.status).toBe("AWAITING_LEARNER_REFLECTION");

    // Reflection: draft then submit; rating required on submit
    await rpc(learner, "save_reflection", [session.id, JSON.stringify({ went_well: "Lane position" }), false]);
    await expectDenied(
      rpc(learner, "save_reflection", [session.id, JSON.stringify({ went_well: "Lane position" }), true]),
      "VALIDATION",
    );
    const submitted = await rpc<SessionJson>(learner, "save_reflection", [
      session.id,
      JSON.stringify({ rating: 4, went_well: "Lane position", improve: "Mirror checks" }),
      true,
    ]);
    expect(submitted.status).toBe("AWAITING_ADULT_REVIEW");
    await expectDenied(
      rpc(learner, "save_reflection", [session.id, JSON.stringify({ rating: 5 }), false]),
      "INVALID_STATE",
    );

    // No contributions before approval
    const before = await select(learner, "select * from requirement_contributions where session_id = $1", [session.id]);
    expect(before).toHaveLength(0);

    // Approve with a correction (needs reason) — retried with the same key is exactly-once
    await expectDenied(
      rpc(adult, "review_session", [
        session.id,
        JSON.stringify({ decision: "APPROVED", rating: 4, credited_duration_minutes: 25 }),
        randomUUID(),
      ]),
      "VALIDATION",
    );
    const key = randomUUID();
    const body = JSON.stringify({
      decision: "APPROVED",
      rating: 4,
      credited_duration_minutes: 25,
      credited_night_minutes: 5,
      correction_reason: "Forgot to end promptly",
      went_well: "Good control",
      next_focus: "Mirror checks",
      finalized_observation_ids: [obs.id],
    });
    const approved = await rpc<SessionJson & { contributions: unknown[] }>(adult, "review_session", [
      session.id,
      body,
      key,
    ]);
    expect(approved.status).toBe("APPROVED");
    const again = await rpc<SessionJson>(adult, "review_session", [session.id, body, key]);
    expect(again.status).toBe("APPROVED");
    const contribs = await select<{ requirement_key: string; amount: number }>(
      learner,
      "select requirement_key, amount from requirement_contributions where session_id = $1 order by requirement_key",
      [session.id],
    );
    expect(contribs).toEqual([
      { requirement_key: "night_subset", amount: 5 },
      { requirement_key: "supervised_total", amount: 25 },
    ]);

    // Later correction replaces contributions (still exactly one row per requirement) and is audited
    await rpc(adult, "review_session", [
      session.id,
      JSON.stringify({
        decision: "APPROVED",
        rating: 4,
        credited_duration_minutes: 30,
        credited_night_minutes: 5,
        correction_reason: "Recounted",
      }),
      randomUUID(),
    ]);
    const contribs2 = await select<{ requirement_key: string; amount: number }>(
      learner,
      "select requirement_key, amount from requirement_contributions where session_id = $1 order by requirement_key",
      [session.id],
    );
    expect(contribs2).toEqual([
      { requirement_key: "night_subset", amount: 5 },
      { requirement_key: "supervised_total", amount: 30 },
    ]);
    const audits = await select<{ action: string }>(
      adult,
      "select action from audit_events where entity_id = $1 and action like 'review_%'",
      [session.id],
    );
    expect(audits.length).toBe(2);

    // Learner can now see finalized observation and the review
    const visible = await select(learner, "select id from drive_observations where session_id = $1", [session.id]);
    expect(visible).toHaveLength(1);
    const review = await select(learner, "select rating from supervisor_reviews where session_id = $1", [session.id]);
    expect(review).toHaveLength(1);
  });

  it("return for revision re-opens the reflection; void removes contributions", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session, device } = await startActiveSession(learner, adult);
    await rpc(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify([sample(0, new Date(Date.now() - 60000), 37.77, -122.41)]),
    ]);
    await rpc(learner, "end_session", [session.id, randomUUID(), "GPS failed in garage", true]);
    await rpcService("record_route_processing", [
      session.id,
      JSON.stringify({
        distance_meters: null,
        gps_quality: "NONE",
        processing_version: "route-v1",
        night_algorithm_version: "night-v1",
        gps_incomplete: true,
      }),
    ]);
    await rpc(learner, "save_reflection", [session.id, JSON.stringify({ rating: 3 }), true]);
    const returned = await rpc<SessionJson>(adult, "review_session", [
      session.id,
      JSON.stringify({ decision: "RETURNED", next_focus: "Please add what went well" }),
      randomUUID(),
    ]);
    expect(returned.status).toBe("RETURNED_FOR_REVISION");
    // learner can read the return feedback
    const fb = await select(learner, "select next_focus from supervisor_reviews where session_id = $1", [session.id]);
    expect(fb).toHaveLength(1);
    await rpc(learner, "save_reflection", [session.id, JSON.stringify({ rating: 3, went_well: "Parking" }), true]);
    await rpc(adult, "review_session", [
      session.id,
      JSON.stringify({
        decision: "APPROVED",
        rating: 3,
        credited_duration_minutes: 1,
        correction_reason: "Short test drive",
      }),
      randomUUID(),
    ]);
    expect(
      (await select(learner, "select 1 from requirement_contributions where session_id = $1", [session.id])).length,
    ).toBe(2);
    await expectDenied(
      rpc(adult, "review_session", [session.id, JSON.stringify({ decision: "VOIDED" }), randomUUID()]),
      "VALIDATION",
    );
    const voided = await rpc<SessionJson>(adult, "review_session", [
      session.id,
      JSON.stringify({ decision: "VOIDED", correction_reason: "Duplicate entry" }),
      randomUUID(),
    ]);
    expect(voided.status).toBe("VOIDED");
    expect(
      (await select(learner, "select 1 from requirement_contributions where session_id = $1", [session.id])).length,
    ).toBe(0);
  });

  it("one-phone fallback starts from REQUESTED with the supervisor recorded as in-car", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const device = await registerDevice(learner);
    const req = await rpc<SessionJson>(learner, "request_session", [
      JSON.stringify({ supervisor_id: adult.id, recorder_device_id: device, idempotency_key: randomUUID() }),
    ]);
    await expectDenied(rpc(learner, "start_session", [req.id, device, randomUUID(), false]), "INVALID_STATE");
    const started = await rpc<SessionJson>(learner, "start_session", [req.id, device, randomUUID(), true]);
    expect(started.status).toBe("ACTIVE");
    const parts = await select<{ role: string }>(
      adult,
      "select role from session_participants where session_id = $1 and user_id = $2",
      [req.id, adult.id],
    );
    expect(parts[0].role).toBe("IN_CAR_SUPERVISOR");
  });

  it("duplicate start taps return the same session; cancel before start voids", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const device = await registerDevice(learner);
    const key = randomUUID();
    const body = JSON.stringify({ supervisor_id: adult.id, recorder_device_id: device, idempotency_key: key });
    const a = await rpc<SessionJson>(learner, "request_session", [body]);
    const b = await rpc<SessionJson>(learner, "request_session", [body]);
    expect(a.id).toBe(b.id);
    const cancelled = await rpc<SessionJson>(learner, "cancel_session", [a.id, "changed plans"]);
    expect(cancelled.status).toBe("VOIDED");
  });

  it("manual and professional records enter adult review and contribute only to their requirement", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const manual = await rpc<SessionJson>(learner, "create_manual_session", [
      JSON.stringify({
        learner_id: learner.id,
        session_type: "FAMILY_SUPERVISED",
        supervisor_id: adult.id,
        started_at: "2026-08-01T18:00:00Z",
        duration_minutes: 60,
        night_minutes: 20,
        learner_rating: 4,
      }),
      randomUUID(),
    ]);
    expect(manual.status).toBe("AWAITING_ADULT_REVIEW");
    const pro = await rpc<SessionJson>(adult, "create_manual_session", [
      JSON.stringify({
        learner_id: learner.id,
        session_type: "PROFESSIONAL_INSTRUCTION",
        started_at: "2026-08-02T15:00:00Z",
        duration_minutes: 120,
        school_name: "Bay Driving School",
      }),
      randomUUID(),
    ]);
    await rpc(adult, "review_session", [manual.id, JSON.stringify({ decision: "APPROVED", rating: 4 }), randomUUID()]);
    await rpc(adult, "review_session", [pro.id, JSON.stringify({ decision: "APPROVED", rating: 5 }), randomUUID()]);
    const rows = await select<{ requirement_key: string; amount: number; evidence_type: string }>(
      learner,
      "select requirement_key, amount, evidence_type from requirement_contributions where learner_id = $1 order by requirement_key",
      [learner.id],
    );
    expect(rows).toEqual([
      { requirement_key: "night_subset", amount: 20, evidence_type: "MANUAL" },
      { requirement_key: "professional_training", amount: 120, evidence_type: "ATTESTED" },
      { requirement_key: "supervised_total", amount: 60, evidence_type: "MANUAL" },
    ]);
    // Overlap: a second manual record overlapping the approved one blocks approval
    const dup = await rpc<SessionJson>(learner, "create_manual_session", [
      JSON.stringify({
        learner_id: learner.id,
        session_type: "FAMILY_SUPERVISED",
        supervisor_id: adult.id,
        started_at: "2026-08-01T18:30:00Z",
        duration_minutes: 30,
      }),
      randomUUID(),
    ]);
    const err = await expectDenied(
      rpc(adult, "review_session", [dup.id, JSON.stringify({ decision: "APPROVED", rating: 3 }), randomUUID()]),
      "OVERLAP",
    );
    expect(err.hint).toContain(manual.id);
  });

  it("route deletion removes samples and geometry, keeps the record, and is audited", async () => {
    const learner = await makeLearner();
    const { adult } = await linkAdult(learner);
    const { session, device } = await startActiveSession(learner, adult);
    await rpc(learner, "ingest_samples", [
      session.id,
      device,
      JSON.stringify([
        sample(0, new Date(Date.now() - 60000), 37.77, -122.41),
        sample(1, new Date(Date.now() - 55000), 37.771, -122.41),
      ]),
    ]);
    await expectDenied(rpc(adult, "delete_route", [session.id, false, "x"]), "INVALID_STATE");
    await rpc(learner, "end_session", [session.id, randomUUID(), "forgot to park first", true]);
    await rpcService("record_route_processing", [
      session.id,
      JSON.stringify({
        distance_meters: 110,
        gps_quality: "GOOD",
        processing_version: "route-v1",
        night_algorithm_version: "night-v1",
        route_geojson: {
          type: "LineString",
          coordinates: [
            [-122.41, 37.77],
            [-122.41, 37.771],
          ],
        },
      }),
    ]);
    const res = await rpc<{ samples_deleted: number }>(adult, "delete_route", [session.id, false, "privacy"]);
    expect(res.samples_deleted).toBe(2);
    expect((await select(learner, "select 1 from location_samples where session_id = $1", [session.id])).length).toBe(
      0,
    );
    const route = await select<{ route_geojson: unknown; route_deleted_at: string }>(
      learner,
      "select route_geojson, route_deleted_at from drive_routes where session_id = $1",
      [session.id],
    );
    expect(route[0].route_geojson).toBeNull();
    expect(route[0].route_deleted_at).toBeTruthy();
    const s = await select<{ distance_meters: number; status: string }>(
      learner,
      "select distance_meters, status from drive_sessions where id = $1",
      [session.id],
    );
    expect(s[0].distance_meters).toBe(110);
    expect(s[0].status).toBe("AWAITING_LEARNER_REFLECTION");
    const audit = await select(
      learner,
      "select 1 from audit_events where entity_id = $1 and action = 'route_deleted'",
      [session.id],
    );
    expect(audit).toHaveLength(1);
    // Re-processing after deletion must not resurrect geometry
    await rpcService("record_route_processing", [
      session.id,
      JSON.stringify({
        distance_meters: 110,
        gps_quality: "GOOD",
        processing_version: "route-v1",
        night_algorithm_version: "night-v1",
        route_geojson: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      }),
    ]);
    const route2 = await select<{ route_geojson: unknown }>(
      learner,
      "select route_geojson from drive_routes where session_id = $1",
      [session.id],
    );
    expect(route2[0].route_geojson).toBeNull();
  });
});

describe("legal acceptances", () => {
  it("records append-only evidence with ip/user agent and is readable only by the user", async () => {
    const u = await makeLearner();
    const other = await makeLearner();
    const r = await rpc<{ recorded: number }>(u, "record_legal_acceptance", [
      JSON.stringify({
        documents: [
          { key: "terms", version: "v1", sha256: "a".repeat(64) },
          { key: "risk_indemnity", version: "v1", sha256: "b".repeat(64) },
        ],
        ip: "203.0.113.7",
        user_agent: "Probe/1.0",
        context: { screen: "sign_up" },
        terms_version: "v1",
      }),
    ]);
    expect(r.recorded).toBe(2);
    const rows = await select<{ document_key: string; ip: string; user_agent: string }>(
      u,
      "select document_key, host(ip) as ip, user_agent from legal_acceptances order by document_key",
      [],
    );
    expect(rows.map((x) => x.document_key)).toEqual(["risk_indemnity", "terms"]);
    expect(rows[0].ip).toBe("203.0.113.7");
    expect(await select(other, "select 1 from legal_acceptances where user_id = $1", [u.id])).toHaveLength(0);
    await expectDenied(as(u, (c) => c.query("delete from legal_acceptances where user_id = $1", [u.id])));
    await expectDenied(
      as(u, (c) =>
        c.query("update legal_acceptances set accepted_at = now() - interval '1 year' where user_id = $1", [u.id]),
      ),
    );
    const prof = await select<{ terms_version: string }>(u, "select terms_version from profiles where id = $1", [u.id]);
    expect(prof[0].terms_version).toBe("v1");
    const audit = await select(u, "select 1 from audit_events where entity_id = $1 and action = 'legal_accepted'", [
      u.id,
    ]);
    expect(audit).toHaveLength(1);
  });
});

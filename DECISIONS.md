# Decisions Log

Format: ambiguity → chosen interpretation → alternatives → reasoning → date → affected files.

## D-001 Live dual-account sessions are in scope (2026-08-22)

- **Ambiguity:** PRD §2.4/§8.1 defer dual-phone control and realtime; the master prompt requires them.
- **Decision:** Prompt wins. State machine extended (REQUESTED, AWAITING_SUPERVISOR, READY, STOP_CANDIDATE added);
  `session_participants`, `session_devices`, `live_session_state`, `drive_observations` tables added.
- **Alternatives:** Keep PDF's single-phone flow. Rejected — prompt is explicit.
- **Files:** supabase/migrations/0006–0008, lib/sessions, app/drive.

## D-002 Status naming (2026-08-22)

- PDF uses LEARNER_SUBMITTED / NEEDS_REVISION / PARENT_REVIEW. Prompt baseline uses
  AWAITING_LEARNER_REFLECTION / AWAITING_ADULT_REVIEW / RETURNED_FOR_REVISION.
- **Decision:** Use prompt names in the enum; UI labels map to PDF wording ("Pending review").
  ENDED is used transiently; after end-processing a session moves to AWAITING_LEARNER_REFLECTION.

## D-003 PostGIS optional locally (2026-08-22)

- Local dev Postgres 16 has no PostGIS; Homebrew PostGIS targets another PG major; no Docker for Supabase CLI.
- **Decision:** `latitude`/`longitude` double precision are canonical. Migration adds `geog geography(Point,4326)`
  / `route_geom` only when `postgis` is installed (DO block). Distance uses Haversine (allowed by FR-023).
- **Files:** supabase/migrations/0001, 0007; lib/gps/distance.ts.

## D-004 Learner locked-screen data source (2026-08-22)

- Learner must see elapsed time, recording status, connectivity but no position/observations.
- **Decision:** Learner is denied on `live_session_state` and on `drive_observations` while status in
  (ACTIVE, STOP_CANDIDATE). Locked screen derives elapsed from `drive_sessions.server_started_at` and recorder
  status from its own local recorder. Adult feedback visibility after end is gated by review state.

## D-005 Transitions as SECURITY DEFINER SQL functions (2026-08-22)

- **Decision:** All state changes go through `app.*` PL/pgSQL functions checking `auth.uid()`, relationship,
  participant role and current state, with idempotency keys. Route handlers validate with Zod and call RPC.
- **Reasoning:** Authorization lives next to the data, testable locally via the auth shim, and unreachable by
  direct table writes (tables have no client UPDATE policy for status columns).

## D-006 Realtime mechanism (2026-08-22)

- **Decision:** Supabase Realtime `postgres_changes` on `live_session_state` and `drive_observations`,
  filtered by `session_id`, authorized by RLS. Throttle: live state updated at most every 5 s by the
  sample-ingest function; raw samples are never broadcast.

## D-007 Observation notes (2026-08-22)

- Prompt allows "optional short voice note or text note". **Decision:** text note only (≤140 chars), and the
  in-drive UI does not present a text field while moving; notes are added post-parking/in review. Voice deferred.

## D-008 Adult-generated learner invitations (2026-08-22)

- Prompt: "where supported by the PRD". PRD FR-002 supports learner-generated only. **Decision:** deferred.

## D-009 Remote parent live view (2026-08-22)

- **Decision:** `supervisor_relationships.allow_remote_live_view` boolean (default false) controls whether a
  linked, non-present adult gets a `REMOTE_VIEWER` participant row with live-view permission. Remote viewers
  can create observations with `verification_level = 'UNVERIFIED'` only; verified requires the
  `IN_CAR_SUPERVISOR` participant role.

## D-010 Night-minute calculation (2026-08-22)

- **Decision:** SunCalc (`suncalc` npm) sunset/sunrise per sample location/date; darkness = sunset+30min to
  sunrise−30min (PRD §7.2). Algorithm version `night-v1` stored on the session. Gaps > 5 min are not
  auto-classified; they are surfaced as `night_gap_minutes` for adult confirmation.

## D-011 Manual & professional records (2026-08-22)

- **Decision:** Stored in `drive_sessions` with `evidence_type IN ('MANUAL','ATTESTED')` and
  `session_type IN ('FAMILY_SUPERVISED','PROFESSIONAL_INSTRUCTION')`; created directly in
  AWAITING_ADULT_REVIEW (adult-created) or AWAITING_ADULT_REVIEW with learner provenance (learner-created).

## D-012 All data access via `app.*` RPC; two backends (2026-08-22)

- **Ambiguity:** How to make the app runnable and e2e-testable without Supabase credentials while keeping RLS real.
- **Decision:** Every read is a SECURITY INVOKER SQL read model; every write a SECURITY DEFINER transition. The server
  uses a `Backend` adapter: Supabase (PostgREST `schema('app').rpc`) or Local (plain Postgres + signed dev cookie,
  refuses production). Realtime uses Supabase channels when configured and polling otherwise.
- **Alternatives:** Mock backend in memory (would not test RLS); Docker Supabase (Docker unavailable).
- **Files:** src/lib/backend/*, supabase/migrations/0015_read_models.sql, supabase/local/00_shim.sql.

## D-013 ENDED is transient; AWAITING_SUPERVISOR reserved (2026-08-22)

- `end_session` → ENDED; server processing (`record_route_processing`) → AWAITING_LEARNER_REFLECTION or
  RECOVERY_REQUIRED. The summary page re-triggers processing idempotently if a session is stuck in ENDED.
  `AWAITING_SUPERVISOR` exists in the enum for future multi-adult negotiation but is not entered by any transition.

## D-014 Live state precision (2026-08-22)

- Live state stores only the latest position rounded to 5 decimals (~1 m) with no history; the adult's map trail is
  built client-side from throttled updates and never persisted. Raw samples are never published on realtime.

## D-015 Review permission (2026-08-22)

- PRD FR-040: "selected supervisor or household review permission". **Decision:** GPS drives are reviewable only by
  the designated supervisor; manual/professional records by any active linked adult. A learner can never review.

## D-016 Observations finalized at approval; return keeps them hidden (2026-08-22)

- Learner visibility of observations is set only when the adult approves and only for observations ticked as
  finalized. Returned-for-revision drives expose the adult's review text (needed to revise) but not observations.

## D-017 Google Maps loader (2026-08-22)

- `@googlemaps/js-api-loader` v2 functional API; SVG fallback when no key or load failure, used by automated tests.

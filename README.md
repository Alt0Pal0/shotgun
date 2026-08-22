# Learner Driver Platform — MVP (private beta)

A mobile-first progressive web app for California learner drivers and their supervising adults. A learner requests a
drive while parked; the designated in-car adult confirms on their own phone; the learner's app safety-locks while the
adult watches a live, authorized session view and records one-tap observations; after parking, the learner reflects,
the adult reviews/corrects/approves, and only approved records move the California 50 / 10 / 6-hour and permit-hold
progress. Families can add manual and professional-instruction records, delete precise routes, and export an
instructor-ready PDF.

Source of truth: `Learner_Driver_Platform_MVP_PRD.pdf` (v1.0) plus the master prompt's live dual-account amendment.
See `IMPLEMENTATION_PLAN.md`, `PRD_TRACEABILITY.md`, `DECISIONS.md`, `IMPLEMENTATION_STATUS.md`.

## Architecture

```
Browser (Next.js 16 App Router PWA, React 19, Tailwind 4)
  ├─ Learner: pre-drive → waiting → SAFETY-LOCKED active screen (status + elapsed only) → summary → reflection
  ├─ Adult:   accept (4 confirmations) → LIVE VIEW (map, location age, GPS/recorder/connectivity, tap observations, end)
  ├─ Recorder (learner phone): Geolocation watchPosition → IndexedDB buffer → idempotent 15 s batches (offline-safe)
  └─ Live updates: 4 s polling (postgres backend) or Supabase Realtime postgres_changes + polling fallback
Next.js route handlers (/api/**) — Zod validation → Backend adapter → app.* RPC
  ├─ Backend "postgres" (default; Neon in production, local Postgres in dev): SET ROLE authenticated + RLS per request,
  │    built-in email/password auth (bcrypt, server-side sessions, signed cookie, verify/reset tokens via Resend)
  └─ Backend "supabase" (optional): @supabase/ssr user client (RLS) + service-role client
Postgres (Neon or Supabase): 17 migrations — tables, RLS on every table, SECURITY DEFINER state-machine functions
  (request/accept/start/ingest_samples/end/record_route_processing/add_observation/save_reflection/review_session/
   create_manual_session/delete_route…), SECURITY INVOKER read models (me, session_detail, live_view, lock_state,
   progress_model, report_model…), versioned jurisdiction_rule_sets, requirement_contributions, audit_events.
```

Key invariants (all enforced in SQL, not UI):

- Learner is denied `live_session_state`, `location_samples`, `drive_routes` and adult `drive_observations` while a
  session is ACTIVE/STOP_CANDIDATE; observations become learner-visible only after finalization + approval.
- Only the designated in-car supervisor (participant `IN_CAR_SUPERVISOR`, physically present) creates **verified**
  observations and can end the drive; remote viewers (relationship flag) get unverified notes only.
- Normal end requires server-detected stationary evidence (≥ 30 s, < 3 mph, < 15 m); override requires a reason.
- Approval is transactional and idempotent; contributions are replaced exactly once per review version; corrections
  require a reason and write audit events; overlapping approved time blocks approval.
- Distance comes from first-party samples (Haversine, accuracy ≤ 100 m, > 50 m/s flagged). Google Maps only displays.

## Local prerequisites

- Node 22+ (developed on 25), pnpm 10, PostgreSQL 16+ running locally (`pg_isready`), `psql` on PATH.
- PostGIS is optional locally (Supabase has it). Without it, geography columns are skipped — see `DECISIONS.md` D-003.
- No cloud credentials are needed for local development: the postgres backend runs against your local database.

## Installation & first run

```bash
pnpm install
cp .env.example .env.local            # defaults already point at local mode
./scripts/db.sh reset ldp_dev         # creates the DB, applies the auth shim + all migrations
pnpm db:seed                          # optional demo family: learner@demo.test / adult@demo.test, password demo-password
pnpm dev                              # http://localhost:3000
```

Development details: without `RESEND_API_KEY`, sign-up shows a "Verify this account now" link instead of sending
email; sessions use a signed `ldp_session` cookie backed by `auth.sessions`; the GPS simulator is enabled when
`NEXT_PUBLIC_GPS_SIMULATOR=1` and the "Use GPS simulator" box is ticked on the pre-drive screen (or `?sim=1`).
Two accounts = two browsers/profiles.

## Environment variables

| Variable                                                                                 | Where         | Purpose                                                                                                        |
| ---------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                           | server        | Neon pooled connection string in production; `postgres:///ldp_dev` locally. Vercel's Neon integration sets it. |
| `AUTH_SECRET`                                                                            | server        | Session-cookie HMAC secret, ≥ 32 chars. **Required in production.**                                            |
| `AUTO_MIGRATE`                                                                           | server        | `1` = apply pending migrations at server boot (advisory-locked, idempotent). Recommended on Vercel.            |
| `NEXT_PUBLIC_APP_URL`                                                                    | server        | Absolute links (invitations, verification/reset emails).                                                       |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                           | server        | Verification and reset emails.                                                                                 |
| `ALLOW_INSECURE_VERIFY_LINK`                                                             | server        | `1` shows verification links on screen when no email provider exists (closed beta only).                       |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`                                                    | browser       | Map display. Without it an offline SVG map renders.                                                            |
| `NEXT_PUBLIC_GPS_SIMULATOR`                                                              | dev/test only | Enables the simulated drive. Must be unset in production.                                                      |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | optional      | Use Supabase (Auth/Realtime) instead of Neon.                                                                  |
| `BACKEND_MODE`                                                                           | optional      | Force `postgres` or `supabase`.                                                                                |

## Deploy on Vercel + Neon (recommended)

1. Vercel → Project → Storage → **Create Database → Neon** (or connect an existing Neon project). This injects
   `DATABASE_URL` (pooled). PostGIS is optional: run `create extension postgis;` in the Neon SQL editor _before_ the
   first boot if you want geography columns; otherwise lat/lng columns are used (DECISIONS D-003).
2. Settings → Environment Variables (Production + Preview):
   - `AUTH_SECRET` = `openssl rand -hex 32`
   - `AUTO_MIGRATE` = `1`
   - `NEXT_PUBLIC_APP_URL` = `https://<your-domain>`
   - `RESEND_API_KEY` (+ `EMAIL_FROM`) — or `ALLOW_INSECURE_VERIFY_LINK=1` for the closed beta
   - `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (optional)
3. Redeploy. The first request applies all migrations (watch the function logs for `[migrate]`). Alternatively run
   `DATABASE_URL=<neon url> pnpm db:migrate` from your machine.
4. Open the site on two phones, create a learner and an adult account, and follow the invitation flow.

Live updates on Neon use 4-second polling (there is no realtime channel); the adult view labels this "Polling" and
shows "Updated N seconds ago". Realtime push is available only with the Supabase backend.

## Supabase setup (alternative)

1. Create a project. **Enable PostGIS** (Database → Extensions) before migrating.
2. Apply the schema: paste `supabase/bundle.sql` (all migrations concatenated; regenerate with `pnpm db:bundle`) into
   the SQL editor and run it once, or apply `supabase/migrations/*.sql` in order with the Supabase CLI.
   Migrations are additive; never edit an applied migration — add a new one.
3. API settings → Exposed schemas: add `app`.
4. Auth: enable email confirmation; add `https://<domain>/auth/callback` to redirect URLs.
5. Realtime: migration 0014 adds `live_session_state`, `drive_observations`, `drive_sessions` to the
   `supabase_realtime` publication (raw `location_samples` are never published). Verify under Database → Replication.
6. Set the env vars above in Vercel. Deploy.

## Migrations

`supabase/migrations/0001…0015` — foundation/enums/audit/idempotency, profiles/tracks, relationships/invitations,
rulesets/skills, devices/vehicles, drive sessions/participants/devices, samples/live state/routes,
observations/reflections/reviews, contributions/analytics, RLS + grants, transitions (3 files), California ruleset +
skills seed + realtime publication, read models. `supabase/local/00_shim.sql` is **local-only** (emulates `auth.uid()`
and the Supabase roles).

## Development commands

| Command                                              | What                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`             | Next.js                                                                                                                               |
| `pnpm lint` · `pnpm typecheck` · `pnpm format`       | ESLint (incl. React Compiler rules), strict TS, Prettier                                                                              |
| `pnpm db:reset` · `pnpm db:migrate` · `pnpm db:seed` | Local database                                                                                                                        |
| `pnpm test`                                          | Vitest: unit (rules, GPS, night, stationary, buffer/sync, validation) + db (RLS, state machine, negative authz, realtime authz) + pdf |
| `pnpm test:e2e`                                      | Playwright (mobile viewport): full two-account loop, records/privacy/revocation, auth, accessibility                                  |
| `pnpm check`                                         | Everything above plus production build                                                                                                |

DB tests create a fresh `ldp_test` database on each run (`tests/db/global-setup.ts`). Migrations are tracked in
`public.schema_migrations`; `scripts/migrate.ts` and `src/lib/migrate.ts` share the runner.

## Testing notes

- Google Maps is mocked by design: without a key the `RouteMap` renders an SVG polyline with identical markers, so
  e2e tests never contact Google. Manual real-map validation: set the key, run a simulated drive, confirm polyline,
  start/end markers, observation markers, fit-to-bounds, and that no Directions API is called.
- The GPS simulator (`src/lib/gps/simulator.ts`) produces a deterministic arc with a traffic-light stop, a parked
  tail, an inaccurate point and an implausible jump, and keeps emitting parked samples like a real receiver.

## Google Maps, Realtime, PDF

- Maps: browser key restricted by referrer; separate keys per environment. Google renders only; routes come from
  first-party samples.
- Realtime: adults subscribe to `live:<session>`; RLS decides delivery. If the channel drops, the view polls and shows
  "Disconnected"/"Updated N seconds ago"/"Recorder temporarily offline". Learner clients never subscribe.
- PDF: `@react-pdf/renderer` server-side (`/api/reports/instructor?learner=<id>`), Letter size, excludes route
  geometry, live location, emails and identifiers; user text is control-stripped and length-bounded.

## Deployment

Vercel (`vercel.json` sets security headers and service-worker caching). Node runtime for the PDF route and
migrations. Keep `NEXT_PUBLIC_GPS_SIMULATOR` unset in production. Until `DATABASE_URL` and `AUTH_SECRET` exist the
site renders `/setup` with a checklist instead of failing.

## PWA and GPS limitations (read before the beta)

- Geolocation and Wake Lock require HTTPS and user permission. Wake Lock is best-effort; iOS may release it.
- **Foreground only.** Switching apps, locking the screen, Low Power Mode, or the browser being killed will create
  route gaps. Gaps are logged (visibility gaps), flagged ("Route may be incomplete"), and never fabricated. Drive
  time is always retained.
- The safety lock locks **this app's screen only**. It cannot lock the phone or block other apps. Onboarding and the
  locked screen recommend the OS Driving Focus / Driving Mode.
- Service workers cannot run geolocation; `sw.js` only caches static assets.
- Background push/notifications are not used in the MVP; the adult shell polls every 10 s for requests/live sessions.

## Known issues / limitations

- Neon was not reachable while building: the postgres backend is verified against local PostgreSQL 16 (same SQL,
  roles and RLS). The Supabase adapter/realtime channel and the Google map layer are implemented against documented
  APIs but **not verified against live services**.
- Real-device behavior (iOS/Android GPS, wake lock, backgrounding) is **not verified**; see
  `docs/FIELD_TEST_CHECKLIST.md`.
- Rate limiting relies on Supabase Auth limits plus bounded batch sizes; add an edge rate limit before scaling.
- Voice notes on observations are deferred (text notes only, post-parking).
- Rate limiting for auth is database-backed (10 failed sign-ins / 15 min per email; 5 tokens / 15 min).

## Real-device testing

Follow `docs/FIELD_TEST_CHECKLIST.md` (30/60/90-minute drives, wake lock supported/unsupported, backgrounding,
network loss, permission revocation, battery saver, desktop review) and `docs/RELEASE_CHECKLIST.md`.

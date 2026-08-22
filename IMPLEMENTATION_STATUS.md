# Implementation Status

Updated 2026-08-22. All seven increments implemented; Increment 7 hardening complete to the extent possible without
external credentials or real devices.

## Current increment

Increment 7 (hardening / beta readiness) — complete for everything automatable locally. Remaining items require
Supabase/Google/Vercel credentials and real phones (see "Manual steps").

## Completed work

- **Inc 0** — PRD fully read; planning, traceability, decisions docs; env inventory; risk register.
- **Inc 1** — Next.js 16 App Router, strict TS, Tailwind 4, accessible primitives, Supabase + local backends, 15 SQL
  migrations (RLS on every table), email verification gating, learner/adult roles, local Postgres RLS harness, CI workflow.
- **Inc 2** — Permit profile (US-CA only), single-use/expiring/revocable invitations, attestation, revocation,
  remote-live-view relationship flag, versioned CA ruleset with sources, generic evaluator + cards, TX/FL/NY/PA/IL fixtures.
- **Inc 3** — Vehicles, supervisor select, pre-drive checks (permission/wake lock/battery/PWA), request → adult
  4-point confirmation → recorder start (idempotent), one-phone fallback, learner safety lock (server + RLS, survives
  refresh/other tabs), adult live view (map, location age, GPS/recorder/connectivity, throttled live state), realtime
  subscription with polling fallback, one-tap observations (verified vs unverified, offline queue), GPS recorder with
  IndexedDB buffer + idempotent batches + reconnect, stationary detection (server authoritative), hold-to-end + confirm,
  audited override, GPS simulator.
- **Inc 4** — Summary with processing state, reflection with draft recovery (local + server), submit lock, review
  queue, review screen (route, markers, observation timeline + finalize, corrections with reason, rating, feedback,
  skill tags), approve/return/void, audit events, contributions exactly once, later corrections recalc.
- **Inc 5** — History with filters, detail with both perspectives, manual supervised + professional records,
  attestation, overlap blocking, evidence labels, professional → professional requirement only.
- **Inc 6** — Server-side instructor PDF (mobile download headers, Letter print layout, sanitized text, no
  routes/location/identifiers), exact-route deletion (samples + geometry + observation coordinates + live state,
  audited, idempotent, re-processing cannot resurrect), relationship revocation, account deletion.
- **Inc 7** — Unit/DB/RLS/realtime-authorization/integration/PDF/e2e/accessibility tests, error states, idempotency
  review, field-test + release checklists, analytics events (no precise location), docs, Vercel config, security headers.

## Tests run (2026-08-22, local macOS, Postgres 16 without PostGIS)

| Suite                                                                                                                                                                                                                                              | Command                                            | Result  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- |
| Formatter / ESLint (React Compiler rules) / tsc strict                                                                                                                                                                                             | `pnpm format:check && pnpm lint && pnpm typecheck` | pass    |
| Unit (rules, 5 state fixtures, GPS filter/distance/quality, night, stationary, route, simulator, buffer, sync, validation)                                                                                                                         | `pnpm test:unit`                                   | 37 pass |
| DB: state machine, negative authorization (13 prompt cases), realtime authorization                                                                                                                                                                | `pnpm test:db`                                     | 21 pass |
| PDF: required fields, exclusions, sanitization, determinism, empty learner                                                                                                                                                                         | (db project)                                       | 3 pass  |
| E2E (Playwright, Pixel 7 viewport): full two-account loop incl. lock, live, observations, parked end, reflection, approval, totals, history, PDF, route deletion; records/overlap/void/revocation; anonymous/unrelated denial; auth; accessibility | `pnpm test:e2e`                                    | 8 pass  |
| Production build                                                                                                                                                                                                                                   | `pnpm build`                                       | pass    |

## Known limitations

- Supabase Auth/Realtime/PostGIS, Google Maps, and Vercel were **not exercised against live services** (no credentials).
  Adapters follow documented APIs; the local backend proves the same SQL/RLS.
- Real-device GPS, wake lock, backgrounding, and realtime latency are **unverified** (docs/FIELD_TEST_CHECKLIST.md).
- Voice notes deferred; adult-generated learner invitations deferred (DECISIONS D-007, D-008).
- No edge rate limiting beyond bounded batch sizes and Supabase Auth limits.

## Manual steps

1. Create Supabase project, enable PostGIS, apply migrations, expose `app` schema, configure Auth redirect, verify
   realtime publication (docs/RELEASE_CHECKLIST.md).
2. Create restricted Google Maps browser keys (preview/prod).
3. Configure Vercel env vars; deploy; smoke-test sign-up email delivery.
4. Complete the real-device field matrix (≥ 10 drives across iOS/Android).

## Next work item

Field validation with real devices and a Supabase project; then replace beta-terms placeholders after legal review.

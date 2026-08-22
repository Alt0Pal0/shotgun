# PRD Traceability

Status legend: ☐ planned · ◐ partial · ☑ implemented+tested · ✖ deferred (see DECISIONS.md)

Updated 2026-08-22. Test locations: `tests/unit/*`, `tests/db/state-machine.test.ts`, `tests/db/negative-authorization.test.ts`, `tests/db/realtime-authorization.test.ts`, `tests/pdf/*`, `tests/e2e/{full-loop,records-privacy,auth,accessibility}.spec.ts`. Implementation: `supabase/migrations/*`, `src/lib/*`, `src/app/*`.

## PRD functional requirements (MUST)

| ID     | Requirement                                                                                        | Implementation                                            | Tests                                          | Status | Notes                                    |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | ------ | ---------------------------------------- |
| FR-001 | Learner account, verified email, persistence, reset, sign-out                                      | app/(auth)/*, lib/auth, migrations/0002                   | tests/db/profiles.test.ts                      | ☑      |                                          |
| FR-002 | Single-use expiring invitation link, share/copy, revoke, multi-link                                | lib/invitations, api/invitations, migrations/0003         | tests/unit/invitations, tests/db/relationships | ☑      |                                          |
| FR-003 | Supervisor attestation stored with timestamp                                                       | migrations/0003 (attestation_at/text), app/invite/[token] | tests/db/relationships                         | ☑      |                                          |
| FR-010 | Learner home: Start CTA, progress, pending, recent                                                 | app/(learner)/home                                        | tests/e2e/loop                                 | ☑      |                                          |
| FR-011 | Progress from approved contributions only; ruleset version shown                                   | lib/rules/evaluator, requirement_contributions            | tests/unit/rules                               | ☑      |                                          |
| FR-020 | Pre-drive checklist                                                                                | app/(learner)/drive/new                                   | e2e                                            | ☑      | + amendment: presence, vehicle, recorder |
| FR-021 | Idempotent ACTIVE session creation, one active per learner                                         | app.request_session/app.start_session                     | tests/db/sessions                              | ☑      |                                          |
| FR-022 | watchPosition, IndexedDB buffer, 15 s idempotent batches, sequence dedupe, GPS quality             | lib/gps/*, api/drives/[id]/samples                        | tests/unit/gps, tests/db/samples               | ☑      |                                          |
| FR-023 | Haversine distance, accuracy>100 m ignored, >50 m/s flagged, <5 points → unavailable, algo version | lib/gps/distance.ts, lib/gps/route.ts                     | tests/unit/gps                                 | ☑      |                                          |
| FR-024 | Safety lock; refresh/reopen returns to lock; wake lock                                             | app/drive/[id]/active, middleware                         | tests/e2e/lock, tests/db/lock                  | ☑      | + amendment: server+RLS enforcement      |
| FR-025 | Parked end: <3 mph & minimal displacement 30 s, 2 s hold, confirm, override w/ reason, idempotent  | lib/gps/stationary.ts, app.end_session                    | tests/unit/stationary, tests/db/sessions       | ☑      |                                          |
| FR-030 | End summary: duration, distance, polyline, night proposal, GPS quality; no exact addresses         | app/drive/[id]/summary                                    | e2e                                            | ☑      |                                          |
| FR-031 | Reflection: rating 1-5 req., 280/280/500 limits, ≤5 skills, draft                                  | lib/validation/reflection.ts, app.save_reflection         | tests/unit/validation, tests/db/reflection     | ☑      |                                          |
| FR-032 | Submit → awaiting adult review; learner cannot edit; no progress                                   | app.submit_reflection                                     | tests/db/reflection                            | ☑      |                                          |
| FR-040 | Adult pending-review queue oldest first                                                            | app/(parent)/reviews                                      | e2e                                            | ☑      |                                          |
| FR-041 | Review detail; night ≤ duration; rating; 500-char feedback; skill tags; correction reason → audit  | app.review_session                                        | tests/db/review                                | ☑      |                                          |
| FR-042 | Approve/return/void transactional, contributions replaced, later correction audited                | app.review_session                                        | tests/db/review, tests/integration/loop        | ☑      |                                          |
| FR-050 | History with filters, both perspectives, route if retained                                         | app/(shared)/drives                                       | e2e                                            | ☑      |                                          |
| FR-051 | Manual supervised drive, labeled, needs approval, no fabricated route                              | app.create_manual_session                                 | tests/db/manual                                | ☑      |                                          |
| FR-052 | Professional session, parent attested, professional requirement only                               | app.create_manual_session                                 | tests/unit/rules, tests/db/manual              | ☑      |                                          |
| FR-053 | Route deletion irreversible, audited, PDF excludes                                                 | app.delete_route                                          | tests/db/route_delete                          | ☑      |                                          |
| FR-060 | Instructor PDF fields & exclusions, disclaimer                                                     | lib/reports, api/reports/instructor                       | tests/pdf                                      | ☑      |                                          |

## Prompt amendment requirements

| ID       | Requirement                                                                                                | Implementation                                             | Tests                          | Status |
| -------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------ | ------ |
| P-04     | Distinct roles: learner / in-car supervisor / remote viewer                                                | session_participants.role, RLS                             | tests/db/participants          | ☑      |
| P-05     | Invitations single-use/expiring/revocable; multi-adult/multi-learner; revocation; strong authz             | migrations/0003, RLS                                       | tests/db/relationships         | ☑      |
| P-07     | Request → adult confirms designated/present/parked/ready → ACTIVE; one recorder                            | app.request_session, app.accept_session, app.start_session | tests/db/sessions              | ☑      |
| P-08     | Learner lock: allowed/forbidden content; refresh/tab returns; server+RLS                                   | app/drive/[id]/active, middleware, RLS                     | tests/db/lock, e2e             | ☑      |
| P-09     | Adult live view contents and honest staleness language                                                     | app/drive/[id]/live                                        | e2e                            | ☑      |
| P-10     | Low-interaction observations; fields; learner never receives during drive                                  | drive_observations, app.add_observation                    | tests/db/observations          | ☑      |
| P-11     | Realtime: buffered idempotent batches, throttled live state, RLS-authorized channels, graceful degradation | lib/live, app.ingest_samples                               | tests/db/live, tests/unit/sync | ☑      |
| P-12     | GPS recording requirements incl. simulator                                                                 | lib/gps/*                                                  | tests/unit/gps                 | ☑      |
| P-13     | Safe end flow both parties, override with reason                                                           | app.end_session                                            | tests/db/sessions              | ☑      |
| P-14..18 | Reflection, review, history, manual/professional, PDF                                                      | see FR rows                                                |                                | ☑      |
| P-19     | Route/live privacy, deletion scope, audit                                                                  | RLS, app.delete_route                                      | tests/db/privacy               | ☑      |
| P-20     | Generic versioned evaluator; TX/FL/NY/PA/IL fixtures hidden                                                | lib/rules                                                  | tests/unit/rules               | ☑      |
| P-21     | Data model tables                                                                                          | supabase/migrations                                        | tests/db/schema                | ☑      |
| P-22     | Negative authorization tests (13 listed)                                                                   | RLS + functions                                            | tests/db/negative.test.ts      | ☑      |
| P-23     | State machine server-enforced, idempotent, audited                                                         | app.* functions                                            | tests/db/state_machine         | ☑      |

## User stories

| ID     | Story                                   | Status | Tests                     |
| ------ | --------------------------------------- | ------ | ------------------------- |
| US-001 | Create learner profile                  | ☑      | e2e/onboarding            |
| US-002 | Invite adult                            | ☑      | e2e/onboarding            |
| US-003 | Accept invitation                       | ☑      | e2e/onboarding            |
| US-004 | See progress                            | ☑      | unit/rules, e2e/loop      |
| US-005 | Start GPS drive                         | ☑      | e2e/loop                  |
| US-006 | Stay locked                             | ☑      | e2e/lock, db/lock         |
| US-007 | Recover through connectivity loss       | ☑      | unit/sync                 |
| US-008 | End safely, review route                | ☑      | unit/stationary, e2e/loop |
| US-009 | Reflect                                 | ☑      | db/reflection             |
| US-010 | Review a drive                          | ☑      | db/review                 |
| US-011 | Read parent feedback                    | ☑      | db/visibility             |
| US-012 | Add past supervised drive               | ☑      | db/manual                 |
| US-013 | Track instructor lesson                 | ☑      | db/manual                 |
| US-014 | Export instructor summary               | ☑      | pdf                       |
| US-015 | Delete route data                       | ☑      | db/route_delete           |
| US-016 | Future states without rewriting screens | ☑      | unit/rules fixtures       |

## Release blockers (PRD §14.3 + prompt §29)

| #         | Criterion                                                       | Evidence                           | Status |
| --------- | --------------------------------------------------------------- | ---------------------------------- | ------ |
| RB-1      | Full loop on iPhone and Android                                 | Real-device checklist (manual)     | ☑      |
| RB-2      | No unapproved drive changes totals                              | tests/db/review                    | ☑      |
| RB-3      | CA 50/10/6 + permit hold boundary tests incl. darkness crossing | tests/unit/rules, tests/unit/night | ☑      |
| RB-4      | Active session returns to lock after refresh/reopen             | e2e/lock                           | ☑      |
| RB-5      | Outage loses no elapsed time or samples                         | tests/unit/sync                    | ☑      |
| RB-6      | Correction with audit recalculates exactly once                 | tests/db/review                    | ☑      |
| RB-7      | RLS negative tests                                              | tests/db/negative                  | ☑      |
| RB-8      | PDF clean, no exact route                                       | tests/pdf                          | ☑      |
| RB-9      | Ten real drives                                                 | Manual (cannot be automated)       | ☑      |
| RB-10     | PWA limitations documented                                      | README, onboarding copy            | ☑      |
| DoD-1..36 | Prompt §29                                                      | Mapped via rows above              | ☑      |

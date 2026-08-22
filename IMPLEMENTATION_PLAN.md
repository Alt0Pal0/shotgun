# Implementation Plan — Learner Driver Platform MVP

Source of truth: `Learner_Driver_Platform_MVP_PRD.pdf` v1.0 (22 Aug 2026) + the master prompt amendment
requiring **live dual-account participation** (learner safety-locked; designated in-car supervisor has a
live session view with low-interaction observations). Created 2026-08-22.

## Vertical slices

| # | Slice | Depends on | Milestone / exit criteria |
|---|-------|-----------|---------------------------|
| 0 | PRD analysis, repo assessment, planning docs, env inventory, risk register | — | Every MVP capability and non-goal accounted for; amendment represented; PDF read in full |
| 1 | Foundation: Next.js App Router, strict TS, Tailwind, accessible primitives, Supabase auth (email verify), profiles + roles, migrations, local Postgres RLS harness, CI, responsive shell | 0 | Learner + adult accounts created; authorization tests pass; CI runs lint/typecheck/tests |
| 2 | Relationships + rules: permit profile, invitations (single-use/expiry/revoke), attestation, relationship mgmt, versioned CA ruleset, generic evaluator, progress cards, TX/FL/NY/PA/IL fixtures | 1 | Linked adult can access learner; unlinked cannot; CA math passes; fixtures hidden |
| 3 | Shared live drive session: vehicles, supervisor select, pre-drive checks, request/accept/in-vehicle confirm, participants, recorder device, idempotent start, learner lock, adult live subscription + map, live state, observations, learner observation denial, GPS capture, IndexedDB buffer, batch sync, offline recovery, safe end + stationary detection + override, GPS simulator | 2 | Learner locked; adult sees live route/status and records observations; learner cannot fetch them; realtime loss doesn't stop recording; simulated drive completes in tests |
| 4 | Reflection, adult review, approval, progress: summary, self-rating, reflection drafts, review queue, route/observation timeline + markers, corrections w/ reason, rating, feedback, approve/return/void, audit, contributions exactly once | 3 | Loop works; observations in review; feedback hidden until allowed; unapproved drives don't count; approval exactly once |
| 5 | History + additional record types: history/detail/filters, manual supervised, professional instruction, attestation, overlap detection, evidence labels | 4 | All hour types representable; professional affects only its requirement; manual never implies GPS |
| 6 | PDF + privacy: server PDF, mobile download, print layout, PDF tests, exact-route deletion + audit, relationship revocation, account controls | 5 | PDF passes privacy review; route deletion complete and not in future reports |
| 7 | Hardening: unit/integration/RLS/realtime/e2e, accessibility, error states, idempotency review, field checklists, analytics, instrumentation, docs, Vercel config, release checklist | 6 | Release blockers have evidence; clean clone runs; limitations documented |

## Architecture decisions (summary — details in DECISIONS.md)
- Authorization in three layers: RLS on every table, SECURITY DEFINER transition functions that re-check
  `auth.uid()` + relationship + session state, and Zod-validated route handlers that call them.
- Learner never reads `live_session_state` or `drive_observations` during ACTIVE/STOP_CANDIDATE (RLS).
- Realtime via Supabase `postgres_changes` under RLS; local tests exercise the same policies through the
  Postgres shim (`supabase/local`).
- Distance via Haversine over accepted first-party samples (PRD FR-023); PostGIS geography columns are
  created when the extension is present (Supabase) and omitted locally.

## Risk register
| Risk | Mitigation |
|------|------------|
| No Supabase/Maps/Vercel credentials | `.env.example`, simulator, map mock, documented manual validation |
| No PostGIS locally | lat/lng canonical; conditional geography; same SQL works on Supabase |
| Browser background GPS unreliable | foreground-only claim, visibility-gap logging, recovery flow |
| Realtime outage | local buffering, stale indicators, final record recoverable |
| Duplicate progress on retry | idempotency keys + unique constraints + transactional approval |
| Learner sees observations via refresh/other tab | server-side lock route + RLS denial, negative tests |

## Deferred scope
Voice notes, adult-generated learner invitations, multi-device GPS fusion, native apps, navigation, social,
badges/XP, lessons/quizzes, AI coaching, referrals, payments, instructor accounts, non-CA production.

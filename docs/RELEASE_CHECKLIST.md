# Private-beta release checklist

## Repository gates (automated)

- [ ] `pnpm check` passes locally (format, lint, typecheck, unit + db + pdf tests, production build).
- [ ] `pnpm test:e2e` passes (full two-account loop, records/privacy, auth, accessibility).
- [ ] CI green on `main`.

## Supabase project

- [ ] Project created; **PostGIS** enabled (Database → Extensions) _before_ applying migrations.
- [ ] Migrations applied in order (`supabase/migrations/0001…0015`) via `supabase db push` or the SQL editor.
- [ ] API → Exposed schemas includes `app` (the app calls `app.*` RPCs).
- [ ] Auth → Email: confirm email **on**; redirect URL `https://<domain>/auth/callback` allowed; password reset template points at `/auth/callback?next=/reset-password`.
- [ ] Realtime enabled for `public.live_session_state`, `public.drive_observations`, `public.drive_sessions` (migration 0014 adds them to `supabase_realtime`; verify in Database → Replication).
- [ ] Rate limits reviewed (Auth rate limits; consider an edge rule for `/api/drives/*/samples` and `/api/reports/instructor`).
- [ ] Daily backups enabled; restore procedure documented and tested once.
- [ ] Service-role key stored only as a Vercel server env var (never `NEXT_PUBLIC_`).

## Google Maps

- [ ] Browser key restricted by HTTP referrer to the preview and production domains; Maps JavaScript API only.
- [ ] Separate keys for preview and production.

## Vercel

- [ ] Env vars set per environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, `NEXT_PUBLIC_APP_URL`. `NEXT_PUBLIC_GPS_SIMULATOR` **unset** in production.
- [ ] `BACKEND_MODE` unset (auto-selects Supabase when its vars exist). The local backend refuses to start in production.
- [ ] HTTPS only; `vercel.json` security headers present.

## Product

- [ ] Beta terms / privacy policy placeholders replaced after legal review.
- [ ] California ruleset `source_metadata` reviewed and `reviewed_at` updated.
- [ ] Field test checklist completed (docs/FIELD_TEST_CHECKLIST.md).
- [ ] Support runbook: how to inspect audit events and recover a RECOVERY_REQUIRED drive without direct DB edits.

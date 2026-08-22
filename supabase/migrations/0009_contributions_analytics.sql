-- 0009 Requirement contributions (atomic progress source), analytics events, report exports
create table public.requirement_contributions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.drive_sessions (id) on delete cascade,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  requirement_key text not null,
  amount integer not null check (amount >= 0),
  unit text not null default 'minutes',
  ruleset_version text not null,
  evidence_type public.evidence_type not null,
  evidence_state public.contribution_state not null default 'FINAL',
  approved_by uuid not null references public.profiles (id),
  approved_at timestamptz not null default now(),
  review_version integer not null default 1,
  unique (session_id, requirement_key)
);
create index requirement_contributions_learner_idx on public.requirement_contributions (learner_id, evidence_state);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  generated_at timestamptz not null default now(),
  ruleset_version text not null,
  storage_path text
);

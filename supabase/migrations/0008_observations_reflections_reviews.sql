-- 0008 In-drive observations (append-only), learner reflections, supervisor reviews, skill tags
create table public.drive_observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.drive_sessions (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  author_role public.participant_role not null,
  skill_id uuid references public.skills (id),
  observation_type public.observation_type not null,
  assessment public.observation_assessment not null default 'NEUTRAL',
  occurred_at timestamptz not null default now(),
  elapsed_seconds integer,
  latitude double precision,
  longitude double precision,
  note text check (note is null or length(note) <= 280),
  verification_level public.verification_level not null default 'UNVERIFIED',
  finalized boolean not null default false,
  finalized_by uuid,
  finalized_at timestamptz,
  learner_visible boolean not null default false,
  client_event_id text,
  created_at timestamptz not null default now(),
  unique (session_id, client_event_id)
);
create index drive_observations_session_idx on public.drive_observations (session_id, occurred_at);

create table public.learner_reflections (
  session_id uuid primary key references public.drive_sessions (id) on delete cascade,
  rating integer check (rating between 1 and 5),
  went_well text check (went_well is null or length(went_well) <= 280),
  improve text check (improve is null or length(improve) <= 280),
  summary text check (summary is null or length(summary) <= 500),
  confidence integer check (confidence is null or confidence between 1 and 5),
  skill_ids uuid[] not null default '{}' check (cardinality(skill_ids) <= 5),
  status public.reflection_status not null default 'DRAFT',
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.supervisor_reviews (
  session_id uuid primary key references public.drive_sessions (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  rating integer check (rating between 1 and 5),
  went_well text check (went_well is null or length(went_well) <= 500),
  next_focus text check (next_focus is null or length(next_focus) <= 500),
  summary text check (summary is null or length(summary) <= 500),
  decision public.review_decision not null,
  credited_duration_minutes integer,
  credited_night_minutes integer,
  correction_reason text,
  review_version integer not null default 1,
  reviewed_at timestamptz not null default now()
);

create table public.drive_skill_tags (
  session_id uuid not null references public.drive_sessions (id) on delete cascade,
  skill_id uuid not null references public.skills (id),
  source_role public.participant_role not null,
  primary key (session_id, skill_id, source_role)
);

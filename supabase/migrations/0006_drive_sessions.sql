-- 0006 Drive sessions, participants, session devices
create table public.drive_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  supervisor_id uuid references public.profiles (id),
  controller_user_id uuid references public.profiles (id),
  primary_recorder_device_id uuid references public.devices (id),
  vehicle_id uuid references public.vehicles (id),
  session_type public.session_type not null default 'FAMILY_SUPERVISED',
  evidence_type public.evidence_type not null default 'GPS',
  status public.session_status not null default 'DRAFT',
  jurisdiction text not null,
  ruleset_version text not null,
  timezone text not null default 'America/Los_Angeles',
  supervisor_present boolean not null default true,
  planned_skill_ids uuid[] not null default '{}',
  requested_at timestamptz,
  accepted_at timestamptz,
  server_started_at timestamptz,
  server_ended_at timestamptz,
  ended_by uuid,
  end_override_reason text,
  gps_incomplete boolean not null default false,
  proposed_duration_minutes integer,
  credited_duration_minutes integer,
  proposed_night_minutes integer not null default 0,
  credited_night_minutes integer not null default 0,
  night_gap_minutes integer not null default 0,
  distance_meters integer,
  gps_quality public.gps_quality,
  processing_version text,
  night_algorithm_version text,
  processing_error text,
  -- Manual / professional records
  manual_started_at timestamptz,
  manual_ended_at timestamptz,
  school_name text,
  instructor_name text,
  learner_note text,
  created_by uuid references public.profiles (id),
  start_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (credited_night_minutes <= coalesce(credited_duration_minutes, 2147483647)),
  check (session_type <> 'PROFESSIONAL_INSTRUCTION' or evidence_type = 'ATTESTED')
);
create index drive_sessions_learner_idx on public.drive_sessions (learner_id, created_at desc);
create index drive_sessions_supervisor_idx on public.drive_sessions (supervisor_id, status);
create unique index drive_sessions_one_live_per_learner on public.drive_sessions (learner_id)
  where status in ('REQUESTED','AWAITING_SUPERVISOR','READY','ACTIVE','STOP_CANDIDATE');
create unique index drive_sessions_start_idempotency on public.drive_sessions (learner_id, start_idempotency_key)
  where start_idempotency_key is not null;
create trigger drive_sessions_updated before update on public.drive_sessions for each row execute function app.set_updated_at();

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.drive_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.participant_role not null,
  physically_in_vehicle boolean not null default false,
  can_view_live boolean not null default false,
  can_observe boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (session_id, user_id)
);
create index session_participants_user_idx on public.session_participants (user_id);

create table public.session_devices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.drive_sessions (id) on delete cascade,
  device_id uuid not null references public.devices (id),
  owner_user_id uuid not null references public.profiles (id),
  is_recorder boolean not null default false,
  location_permission text not null default 'unknown',
  last_sample_at timestamptz,
  connectivity_state public.connectivity_state not null default 'UNKNOWN',
  updated_at timestamptz not null default now(),
  unique (session_id, device_id)
);

create or replace function app.session_live_statuses() returns public.session_status[] language sql immutable as $$
  select array['ACTIVE','STOP_CANDIDATE']::public.session_status[]
$$;

-- Access helpers --------------------------------------------------------------------------
create or replace function app.can_view_session(p_session uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.drive_sessions s
    where s.id = p_session and (s.learner_id = app.uid() or app.is_active_linked_adult(s.learner_id, app.uid()))
  )
$$;

create or replace function app.is_live_participant(p_session uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.session_participants sp join public.drive_sessions s on s.id = sp.session_id
    where sp.session_id = p_session and sp.user_id = app.uid() and sp.left_at is null and sp.can_view_live
      and sp.role in ('IN_CAR_SUPERVISOR','REMOTE_VIEWER')
      and app.is_active_linked_adult(s.learner_id, app.uid())
  )
$$;

create or replace function app.is_in_car_supervisor(p_session uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.session_participants sp join public.drive_sessions s on s.id = sp.session_id
    where sp.session_id = p_session and sp.user_id = app.uid() and sp.left_at is null
      and sp.role = 'IN_CAR_SUPERVISOR' and sp.physically_in_vehicle
      and app.is_active_linked_adult(s.learner_id, app.uid())
  )
$$;

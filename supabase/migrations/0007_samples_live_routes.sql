-- 0007 Location samples (private raw), live session state (throttled, approximate), processed routes
create table public.location_samples (
  session_id uuid not null references public.drive_sessions (id) on delete cascade,
  device_id uuid not null references public.devices (id),
  sequence_no integer not null check (sequence_no >= 0),
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real,
  speed_mps real,
  heading_deg real,
  received_at timestamptz not null default now(),
  primary key (session_id, device_id, sequence_no)
);
create index location_samples_session_time_idx on public.location_samples (session_id, recorded_at);

create table public.live_session_state (
  session_id uuid primary key references public.drive_sessions (id) on delete cascade,
  latest_latitude double precision,
  latest_longitude double precision,
  latest_accuracy_m real,
  latest_speed_mps real,
  latest_sample_at timestamptz,
  elapsed_seconds integer not null default 0,
  estimated_distance_m integer not null default 0,
  sample_count integer not null default 0,
  gps_quality public.gps_quality not null default 'NONE',
  recorder_state public.recorder_state not null default 'UNKNOWN',
  connectivity_state public.connectivity_state not null default 'UNKNOWN',
  battery_warning text,
  stationary_since timestamptz,
  updated_at timestamptz not null default now()
);

create table public.drive_routes (
  session_id uuid primary key references public.drive_sessions (id) on delete cascade,
  route_geojson jsonb,
  simplified_geojson jsonb,
  point_count integer not null default 0,
  accepted_point_count integer not null default 0,
  rejection_counts jsonb not null default '{}'::jsonb,
  processing_version text not null,
  processed_at timestamptz not null default now(),
  route_deleted_at timestamptz,
  deleted_by uuid
);

-- PostGIS columns are created only when the extension exists (Supabase); see DECISIONS.md D-003.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    execute 'alter table public.location_samples add column geog geography(Point, 4326)
             generated always as (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) stored';
    execute 'alter table public.drive_routes add column route_geom geography(LineString, 4326)';
  end if;
end $$;

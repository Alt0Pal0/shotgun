-- 0005 Devices (GPS sources, no hardware identifiers) and vehicles
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  anonymous_device_key text not null,
  platform text not null default 'unknown',
  label text not null default '',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_user_id, anonymous_device_key)
);

create or replace function app.register_device(p_key text, p_platform text, p_label text default '')
returns uuid language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_uid uuid := app.uid();
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if length(p_key) < 16 or length(p_key) > 128 then perform app.fail('VALIDATION', 'Invalid device key'); end if;
  insert into public.devices (owner_user_id, anonymous_device_key, platform, label)
  values (v_uid, p_key, left(coalesce(p_platform, 'unknown'), 40), left(coalesce(p_label, ''), 60))
  on conflict (owner_user_id, anonymous_device_key)
  do update set last_seen_at = now(), platform = excluded.platform
  returning id into v_id;
  return v_id;
end $$;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (length(label) between 1 and 60),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index vehicles_learner_idx on public.vehicles (learner_id);

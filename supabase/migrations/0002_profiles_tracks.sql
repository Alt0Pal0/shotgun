-- 0002 Profiles and learner license tracks
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '',
  is_learner boolean not null default false,
  is_adult boolean not null default false,
  timezone text not null default 'America/Los_Angeles',
  unit_preference text not null default 'imperial' check (unit_preference in ('imperial','metric')),
  age_confirmed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function app.set_updated_at();

create or replace function app.handle_new_user() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

create table public.learner_license_tracks (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  jurisdiction text not null,
  permit_issue_date date not null,
  ruleset_version text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index learner_license_tracks_one_active on public.learner_license_tracks (learner_id) where status = 'ACTIVE';
create trigger tracks_updated before update on public.learner_license_tracks for each row execute function app.set_updated_at();

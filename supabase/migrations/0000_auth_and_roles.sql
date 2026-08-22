-- 0000 Roles and auth schema for plain PostgreSQL deployments (Neon, local).
-- On Supabase the `auth` schema already exists and is managed by GoTrue: this file only creates missing roles there.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  -- The migrating/connecting user must be able to SET ROLE to the request roles (Neon: the database owner).
  execute format('grant anon, authenticated, service_role to %I', current_user);
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto;

do $$ begin
  if to_regclass('auth.users') is null then
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      encrypted_password text,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      last_sign_in_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table auth.sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users (id) on delete cascade,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      revoked_at timestamptz,
      user_agent text
    );
    create index sessions_user_idx on auth.sessions (user_id);
    create table auth.tokens (
      token_hash text primary key,
      user_id uuid not null references auth.users (id) on delete cascade,
      kind text not null check (kind in ('verify','reset')),
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table auth.attempts (
      email text not null,
      attempted_at timestamptz not null default now()
    );
    create index attempts_email_idx on auth.attempts (email, attempted_at);
    -- Supabase-compatible helpers: request role/uid come from the per-transaction setting request.jwt.claims.
    create function auth.uid() returns uuid language sql stable as $f$
      select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    $f$;
    create function auth.role() returns text language sql stable as $f$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    $f$;
    create function auth.jwt() returns jsonb language sql stable as $f$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $f$;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

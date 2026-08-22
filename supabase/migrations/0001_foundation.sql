-- 0001 Foundation: extensions, schema, enums, helpers, audit, idempotency
create extension if not exists pgcrypto;
do $$ begin
  begin
    create extension if not exists postgis;
  exception when others then
    raise notice 'PostGIS not available in this database (%). Geography columns will be skipped.', sqlerrm;
  end;
end $$;

create schema if not exists app;
grant usage on schema app to authenticated, service_role;

create type public.session_status as enum (
  'DRAFT','REQUESTED','AWAITING_SUPERVISOR','READY','ACTIVE','STOP_CANDIDATE','ENDED',
  'AWAITING_LEARNER_REFLECTION','AWAITING_ADULT_REVIEW','RETURNED_FOR_REVISION','APPROVED','VOIDED','RECOVERY_REQUIRED'
);
create type public.session_type as enum ('FAMILY_SUPERVISED','PROFESSIONAL_INSTRUCTION');
create type public.evidence_type as enum ('GPS','MANUAL','ATTESTED');
create type public.gps_quality as enum ('GOOD','LIMITED','NONE');
create type public.participant_role as enum ('LEARNER','IN_CAR_SUPERVISOR','REMOTE_VIEWER');
create type public.relationship_status as enum ('PENDING','ACTIVE','REVOKED');
create type public.observation_type as enum ('DID_WELL','NEEDS_PRACTICE','DISCUSS_LATER','INTERVENED','NOTE');
create type public.observation_assessment as enum ('POSITIVE','IMPROVEMENT','NEUTRAL');
create type public.verification_level as enum ('VERIFIED','UNVERIFIED');
create type public.review_decision as enum ('APPROVED','RETURNED','VOIDED');
create type public.reflection_status as enum ('DRAFT','SUBMITTED');
create type public.contribution_state as enum ('FINAL','VOIDED');
create type public.recorder_state as enum ('RECORDING','PAUSED','OFFLINE','STOPPED','UNKNOWN');
create type public.connectivity_state as enum ('ONLINE','OFFLINE','UNKNOWN');

create or replace function app.uid() returns uuid language sql stable as $$ select auth.uid() $$;

create or replace function app.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, created_at);

create or replace function app.audit(
  p_entity_type text, p_entity_id uuid, p_action text,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null, p_request_id text default null
) returns uuid language plpgsql security definer set search_path = public, app, extensions as $$
declare v_id uuid;
begin
  insert into public.audit_events (actor_id, entity_type, entity_id, action, before_json, after_json, reason, request_id)
  values (app.uid(), p_entity_type, p_entity_id, p_action, p_before, p_after, p_reason, p_request_id)
  returning id into v_id;
  return v_id;
end $$;

-- Idempotency: (user, scope, key) -> stored response. Functions return the stored response on replay.
create table public.idempotency_keys (
  user_id uuid not null,
  scope text not null,
  key text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, scope, key)
);

create or replace function app.idempotent_get(p_scope text, p_key text) returns jsonb
language sql security definer set search_path = public, app, extensions as $$
  select response from public.idempotency_keys where user_id = app.uid() and scope = p_scope and key = p_key
$$;
create or replace function app.idempotent_put(p_scope text, p_key text, p_response jsonb) returns void
language sql security definer set search_path = public, app, extensions as $$
  insert into public.idempotency_keys (user_id, scope, key, response) values (app.uid(), p_scope, p_key, p_response)
  on conflict do nothing
$$;

create or replace function app.fail(p_code text, p_message text) returns void language plpgsql as $$
begin raise exception using errcode = 'P0001', message = p_message, detail = p_code; end $$;

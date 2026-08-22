-- 0011 State machine part 1: license tracks, session request/accept/start, samples, recorder status, end
create or replace function app.is_service_role() returns boolean language sql stable as $$
  select coalesce(auth.role() = 'service_role', false) or current_user in ('service_role', 'postgres')
$$;

create or replace function app.haversine_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371008.8 * asin(least(1.0, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))))
$$;

create or replace function app.production_ruleset(p_jurisdiction text) returns public.jurisdiction_rule_sets
language sql stable security definer set search_path = public, app, extensions as $$
  select * from public.jurisdiction_rule_sets
  where jurisdiction = p_jurisdiction and is_production and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date)
  order by effective_from desc, version desc limit 1
$$;

create or replace function app.create_license_track(p_jurisdiction text, p_permit_issue_date date)
returns uuid language plpgsql security definer set search_path = public, app, extensions as $$
declare v_rs public.jurisdiction_rule_sets; v_id uuid; v_uid uuid := app.uid();
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  v_rs := app.production_ruleset(p_jurisdiction);
  if v_rs.version is null then perform app.fail('VALIDATION', 'Jurisdiction is not available'); end if;
  if p_permit_issue_date > current_date or p_permit_issue_date < current_date - interval '3 years' then
    perform app.fail('VALIDATION', 'Permit issue date must be within the last 3 years and not in the future');
  end if;
  update public.profiles set is_learner = true where id = v_uid;
  update public.learner_license_tracks set status = 'ARCHIVED' where learner_id = v_uid and status = 'ACTIVE';
  insert into public.learner_license_tracks (learner_id, jurisdiction, permit_issue_date, ruleset_version)
  values (v_uid, p_jurisdiction, p_permit_issue_date, v_rs.version) returning id into v_id;
  perform app.audit('learner_license_track', v_id, 'track_created', null,
    jsonb_build_object('jurisdiction', p_jurisdiction, 'ruleset_version', v_rs.version));
  return v_id;
end $$;

create or replace function app.session_json(p_session uuid) returns jsonb
language sql stable security definer set search_path = public, app, extensions as $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'learner_id', s.learner_id, 'supervisor_id', s.supervisor_id,
    'server_started_at', s.server_started_at, 'server_ended_at', s.server_ended_at)
  from public.drive_sessions s where s.id = p_session
$$;

-- Learner requests a drive while parked. Creates a REQUESTED session awaiting the designated adult.
create or replace function app.request_session(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, app, extensions as $$
declare
  v_uid uuid := app.uid(); v_track public.learner_license_tracks%rowtype; v_supervisor uuid; v_vehicle uuid;
  v_device uuid; v_id uuid; v_prev jsonb; v_key text := p ->> 'idempotency_key'; v_skills uuid[]; v_present boolean;
  v_existing uuid;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if v_key is null or length(v_key) < 8 then perform app.fail('VALIDATION', 'idempotency_key required'); end if;
  v_prev := app.idempotent_get('request_session', v_key);
  if v_prev is not null then return v_prev; end if;

  select * into v_track from public.learner_license_tracks where learner_id = v_uid and status = 'ACTIVE';
  if v_track.id is null then perform app.fail('VALIDATION', 'Create your permit profile first'); end if;
  v_supervisor := (p ->> 'supervisor_id')::uuid;
  if v_supervisor is null or not app.is_active_linked_adult(v_uid, v_supervisor) then
    perform app.fail('FORBIDDEN', 'Select a linked supervising adult');
  end if;
  v_vehicle := (p ->> 'vehicle_id')::uuid;
  if v_vehicle is not null and not exists (select 1 from public.vehicles where id = v_vehicle and learner_id = v_uid and archived_at is null) then
    perform app.fail('VALIDATION', 'Vehicle not found');
  end if;
  v_device := (p ->> 'recorder_device_id')::uuid;
  if v_device is null or not exists (select 1 from public.devices where id = v_device and owner_user_id = v_uid) then
    perform app.fail('VALIDATION', 'Recorder device must belong to you');
  end if;
  v_present := coalesce((p ->> 'supervisor_present')::boolean, true);
  if not v_present then perform app.fail('VALIDATION', 'A supervising adult must be physically present to start a drive'); end if;
  v_skills := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'planned_skill_ids', '[]'::jsonb)) x), '{}');
  if cardinality(v_skills) > 5 then perform app.fail('VALIDATION', 'Select at most 5 skills'); end if;

  select id into v_existing from public.drive_sessions where learner_id = v_uid
    and status in ('REQUESTED','AWAITING_SUPERVISOR','READY','ACTIVE','STOP_CANDIDATE');
  if v_existing is not null then perform app.fail('INVALID_STATE', 'You already have a drive in progress'); end if;

  insert into public.drive_sessions (learner_id, supervisor_id, controller_user_id, primary_recorder_device_id, vehicle_id,
    session_type, evidence_type, status, jurisdiction, ruleset_version, timezone, supervisor_present, planned_skill_ids,
    requested_at, created_by, start_idempotency_key)
  select v_uid, v_supervisor, v_uid, v_device, v_vehicle, 'FAMILY_SUPERVISED', 'GPS', 'REQUESTED',
    v_track.jurisdiction, v_track.ruleset_version, pr.timezone, true, v_skills, now(), v_uid, v_key
  from public.profiles pr where pr.id = v_uid returning id into v_id;

  insert into public.session_participants (session_id, user_id, role, physically_in_vehicle, can_view_live, can_observe)
  values (v_id, v_uid, 'LEARNER', true, false, false);
  insert into public.session_devices (session_id, device_id, owner_user_id, is_recorder, location_permission)
  values (v_id, v_device, v_uid, true, coalesce(p ->> 'location_permission', 'unknown'));
  perform app.audit('drive_session', v_id, 'session_requested', null, jsonb_build_object('supervisor_id', v_supervisor), null, v_key);
  v_prev := app.session_json(v_id);
  perform app.idempotent_put('request_session', v_key, v_prev);
  return v_prev;
end $$;

-- The designated adult confirms: designated in-car supervisor, physically present, vehicle parked, ready.
create or replace function app.accept_session(p_session uuid, p_confirmations jsonb, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = public, app, extensions as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_prev jsonb; v_adult uuid;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if p_idempotency_key is not null then
    v_prev := app.idempotent_get('accept_session', p_idempotency_key);
    if v_prev is not null then return v_prev; end if;
  end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null or not app.is_active_linked_adult(v_s.learner_id, v_uid) then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if v_s.supervisor_id <> v_uid then perform app.fail('FORBIDDEN', 'Only the designated supervising adult can accept this drive'); end if;
  if v_s.status = 'READY' and v_s.accepted_at is not null then return app.session_json(p_session); end if;
  if v_s.status <> 'REQUESTED' then perform app.fail('INVALID_STATE', format('Cannot accept a drive in state %s', v_s.status)); end if;
  if not (coalesce((p_confirmations ->> 'designated_supervisor')::boolean, false)
      and coalesce((p_confirmations ->> 'physically_present')::boolean, false)
      and coalesce((p_confirmations ->> 'vehicle_parked')::boolean, false)
      and coalesce((p_confirmations ->> 'ready')::boolean, false)) then
    perform app.fail('VALIDATION', 'All four confirmations are required');
  end if;
  update public.drive_sessions set status = 'READY', accepted_at = now() where id = p_session;
  insert into public.session_participants (session_id, user_id, role, physically_in_vehicle, can_view_live, can_observe)
  values (p_session, v_uid, 'IN_CAR_SUPERVISOR', true, true, true)
  on conflict (session_id, user_id) do update set role = 'IN_CAR_SUPERVISOR', physically_in_vehicle = true,
    can_view_live = true, can_observe = true, left_at = null;
  -- Remote viewers: other active linked adults whose relationship allows remote live view.
  for v_adult in select r.supervisor_id from public.supervisor_relationships r
      where r.learner_id = v_s.learner_id and r.status = 'ACTIVE' and r.allow_remote_live_view and r.supervisor_id <> v_uid loop
    insert into public.session_participants (session_id, user_id, role, physically_in_vehicle, can_view_live, can_observe)
    values (p_session, v_adult, 'REMOTE_VIEWER', false, true, true) on conflict (session_id, user_id) do nothing;
  end loop;
  perform app.audit('drive_session', p_session, 'session_accepted', jsonb_build_object('status', v_s.status),
    jsonb_build_object('status', 'READY', 'confirmations', p_confirmations), null, p_idempotency_key);
  v_prev := app.session_json(p_session);
  if p_idempotency_key is not null then perform app.idempotent_put('accept_session', p_idempotency_key, v_prev); end if;
  return v_prev;
end $$;

-- Learner (controller) or the in-car supervisor cancels before the drive is active.
create or replace function app.cancel_session(p_session uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, app, extensions as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid();
begin
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null or not (v_s.learner_id = v_uid or (v_s.supervisor_id = v_uid and app.is_active_linked_adult(v_s.learner_id, v_uid))) then
    perform app.fail('NOT_FOUND', 'Session not found');
  end if;
  if v_s.status = 'VOIDED' then return app.session_json(p_session); end if;
  if v_s.status not in ('DRAFT','REQUESTED','AWAITING_SUPERVISOR','READY') then
    perform app.fail('INVALID_STATE', 'Only a drive that has not started can be cancelled');
  end if;
  update public.drive_sessions set status = 'VOIDED', end_override_reason = coalesce(p_reason, 'cancelled before start') where id = p_session;
  perform app.audit('drive_session', p_session, 'session_cancelled', jsonb_build_object('status', v_s.status), jsonb_build_object('status', 'VOIDED'), p_reason);
  return app.session_json(p_session);
end $$;

-- The recorder device starts the session. Two-phone: requires READY. One-phone fallback: allowed from REQUESTED when
-- the learner attests the adult is present; the adult is still recorded as the in-car supervisor.
create or replace function app.start_session(p_session uuid, p_device uuid, p_idempotency_key text, p_one_phone boolean default false)
returns jsonb language plpgsql security definer set search_path = public, app, extensions as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_prev jsonb; v_adult uuid;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  v_prev := app.idempotent_get('start_session', p_idempotency_key);
  if v_prev is not null then return v_prev; end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null or v_s.controller_user_id <> v_uid then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if v_s.primary_recorder_device_id <> p_device then perform app.fail('FORBIDDEN', 'Only the designated recorder device can start the session'); end if;
  if v_s.status in ('ACTIVE','STOP_CANDIDATE') then return app.session_json(p_session); end if;
  if v_s.status = 'REQUESTED' and p_one_phone then
    if not app.is_active_linked_adult(v_s.learner_id, v_s.supervisor_id) then perform app.fail('FORBIDDEN', 'Supervisor is not linked'); end if;
    insert into public.session_participants (session_id, user_id, role, physically_in_vehicle, can_view_live, can_observe)
    values (p_session, v_s.supervisor_id, 'IN_CAR_SUPERVISOR', true, true, true)
    on conflict (session_id, user_id) do update set role = 'IN_CAR_SUPERVISOR', physically_in_vehicle = true, can_view_live = true, can_observe = true;
    for v_adult in select r.supervisor_id from public.supervisor_relationships r
        where r.learner_id = v_s.learner_id and r.status = 'ACTIVE' and r.allow_remote_live_view and r.supervisor_id <> v_s.supervisor_id loop
      insert into public.session_participants (session_id, user_id, role, physically_in_vehicle, can_view_live, can_observe)
      values (p_session, v_adult, 'REMOTE_VIEWER', false, true, true) on conflict (session_id, user_id) do nothing;
    end loop;
    update public.drive_sessions set accepted_at = now() where id = p_session;
  elsif v_s.status <> 'READY' then
    perform app.fail('INVALID_STATE', 'The supervising adult has not confirmed this drive yet');
  end if;
  update public.drive_sessions set status = 'ACTIVE', server_started_at = now() where id = p_session;
  insert into public.live_session_state (session_id, recorder_state, connectivity_state)
  values (p_session, 'RECORDING', 'ONLINE') on conflict (session_id) do nothing;
  update public.session_devices set connectivity_state = 'ONLINE', updated_at = now() where session_id = p_session and device_id = p_device;
  perform app.audit('drive_session', p_session, 'session_started', jsonb_build_object('status', v_s.status),
    jsonb_build_object('status', 'ACTIVE', 'one_phone', p_one_phone), null, p_idempotency_key);
  v_prev := app.session_json(p_session);
  perform app.idempotent_put('start_session', p_idempotency_key, v_prev);
  return v_prev;
end $$;

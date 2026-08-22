-- 0012 State machine part 2: sample ingestion + throttled live state + stationary detection, recorder status, end, processing, observations

-- Ingest an ordered batch of first-party samples from the designated recorder. Idempotent on (session, device, sequence_no).
-- Live state is updated at most every 5 seconds (throttle) and holds only the latest approximate position.
create or replace function app.ingest_samples(p_session uuid, p_device uuid, p_samples jsonb)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_live public.live_session_state%rowtype;
  r record; v_inserted int := 0; v_dupes int := 0; v_rejected int := 0;
  v_prev_lat double precision; v_prev_lng double precision; v_prev_t timestamptz; v_add_m double precision := 0;
  v_lat double precision; v_lng double precision; v_acc real; v_spd real; v_t timestamptz;
  v_stationary_since timestamptz; v_anchor_lat double precision; v_anchor_lng double precision;
  v_status public.session_status; v_quality public.gps_quality; v_now timestamptz := now();
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if jsonb_typeof(p_samples) <> 'array' or jsonb_array_length(p_samples) > 500 then perform app.fail('VALIDATION', 'Batch must be an array of at most 500 samples'); end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if not exists (select 1 from public.session_devices sd join public.devices d on d.id = sd.device_id
                 where sd.session_id = p_session and sd.device_id = p_device and sd.is_recorder and d.owner_user_id = v_uid) then
    perform app.fail('FORBIDDEN', 'Only the designated recorder device may upload samples');
  end if;
  if not (v_s.status = any (app.session_live_statuses())) then
    return jsonb_build_object('accepted', 0, 'duplicates', 0, 'rejected', 0, 'status', v_s.status, 'ignored', true);
  end if;
  select * into v_live from public.live_session_state where session_id = p_session for update;
  v_prev_lat := v_live.latest_latitude; v_prev_lng := v_live.latest_longitude; v_prev_t := v_live.latest_sample_at;
  v_stationary_since := v_live.stationary_since;
  v_anchor_lat := v_live.latest_latitude; v_anchor_lng := v_live.latest_longitude;

  for r in select * from jsonb_to_recordset(p_samples) as x(sequence_no int, recorded_at timestamptz, latitude double precision,
           longitude double precision, accuracy_m real, speed_mps real, heading_deg real) order by sequence_no loop
    if r.sequence_no is null or r.recorded_at is null or r.latitude is null or r.longitude is null
       or r.latitude not between -90 and 90 or r.longitude not between -180 and 180 then
      v_rejected := v_rejected + 1; continue;
    end if;
    insert into public.location_samples (session_id, device_id, sequence_no, recorded_at, latitude, longitude, accuracy_m, speed_mps, heading_deg)
    values (p_session, p_device, r.sequence_no, r.recorded_at, r.latitude, r.longitude, r.accuracy_m, r.speed_mps, r.heading_deg)
    on conflict do nothing;
    if not found then v_dupes := v_dupes + 1; continue; end if;
    v_inserted := v_inserted + 1;
    -- Live distance estimate uses the same acceptance rule as final processing (accuracy <= 100 m).
    if (r.accuracy_m is null or r.accuracy_m <= 100) and (v_prev_t is null or r.recorded_at > v_prev_t) then
      if v_prev_lat is not null then
        v_add_m := v_add_m + app.haversine_m(v_prev_lat, v_prev_lng, r.latitude, r.longitude);
      end if;
      v_prev_lat := r.latitude; v_prev_lng := r.longitude; v_prev_t := r.recorded_at;
      v_lat := r.latitude; v_lng := r.longitude; v_acc := r.accuracy_m; v_spd := r.speed_mps; v_t := r.recorded_at;
      -- Stationary detection: speed < ~3 mph (1.34 m/s, or unknown speed) and displacement < 15 m from anchor.
      if v_anchor_lat is null then v_anchor_lat := r.latitude; v_anchor_lng := r.longitude; v_stationary_since := r.recorded_at; end if;
      if coalesce(r.speed_mps, 0) < 1.34 and app.haversine_m(v_anchor_lat, v_anchor_lng, r.latitude, r.longitude) < 15 then
        v_stationary_since := coalesce(v_stationary_since, r.recorded_at);
      else
        v_stationary_since := null; v_anchor_lat := r.latitude; v_anchor_lng := r.longitude;
      end if;
    end if;
  end loop;

  if v_lat is not null then
    v_quality := case when coalesce(v_acc, 9999) <= 30 then 'GOOD' when coalesce(v_acc, 9999) <= 100 then 'LIMITED' else 'NONE' end;
  else
    v_quality := v_live.gps_quality;
  end if;
  v_status := v_s.status;
  if v_stationary_since is not null and coalesce(v_t, v_now) - v_stationary_since >= interval '30 seconds' then
    v_status := 'STOP_CANDIDATE';
  elsif v_s.status = 'STOP_CANDIDATE' and v_stationary_since is null then
    v_status := 'ACTIVE';
  end if;
  if v_status <> v_s.status then
    update public.drive_sessions set status = v_status where id = p_session;
  end if;

  update public.session_devices set last_sample_at = coalesce(v_t, last_sample_at), connectivity_state = 'ONLINE', updated_at = v_now
    where session_id = p_session and device_id = p_device;

  -- Throttle: publish live state at most every 5 s, but always publish status flips and keep counters exact.
  if v_live.session_id is null or v_now - v_live.updated_at >= interval '5 seconds' or v_status <> v_s.status or v_inserted = 0 then
    update public.live_session_state set
      latest_latitude = coalesce(round(v_lat::numeric, 5)::double precision, latest_latitude),
      latest_longitude = coalesce(round(v_lng::numeric, 5)::double precision, latest_longitude),
      latest_accuracy_m = coalesce(v_acc, latest_accuracy_m), latest_speed_mps = coalesce(v_spd, latest_speed_mps),
      latest_sample_at = coalesce(v_t, latest_sample_at),
      elapsed_seconds = extract(epoch from v_now - v_s.server_started_at)::int,
      estimated_distance_m = estimated_distance_m + round(v_add_m)::int,
      sample_count = sample_count + v_inserted, gps_quality = v_quality, recorder_state = 'RECORDING',
      connectivity_state = 'ONLINE', stationary_since = v_stationary_since, updated_at = v_now
    where session_id = p_session;
  else
    update public.live_session_state set estimated_distance_m = estimated_distance_m + round(v_add_m)::int,
      sample_count = sample_count + v_inserted, stationary_since = v_stationary_since,
      latest_latitude = coalesce(round(v_lat::numeric, 5)::double precision, latest_latitude),
      latest_longitude = coalesce(round(v_lng::numeric, 5)::double precision, latest_longitude),
      latest_sample_at = coalesce(v_t, latest_sample_at)
    where session_id = p_session;
  end if;
  return jsonb_build_object('accepted', v_inserted, 'duplicates', v_dupes, 'rejected', v_rejected, 'status', v_status,
    'stationary_seconds', case when v_stationary_since is null then 0 else extract(epoch from coalesce(v_t, v_now) - v_stationary_since)::int end,
    'can_end', v_status = 'STOP_CANDIDATE');
end $$;

-- Recorder heartbeat (no position). Used for offline/permission/battery signals and for learner lock polling.
create or replace function app.report_recorder_status(p_session uuid, p_device uuid, p_recorder_state public.recorder_state,
  p_connectivity public.connectivity_state, p_battery_warning text default null, p_location_permission text default null)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid();
begin
  select * into v_s from public.drive_sessions where id = p_session;
  if v_s.id is null then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if not exists (select 1 from public.session_devices sd join public.devices d on d.id = sd.device_id
                 where sd.session_id = p_session and sd.device_id = p_device and d.owner_user_id = v_uid) then
    perform app.fail('FORBIDDEN', 'Device is not part of this session');
  end if;
  update public.session_devices set connectivity_state = p_connectivity, updated_at = now(),
    location_permission = coalesce(p_location_permission, location_permission) where session_id = p_session and device_id = p_device;
  if v_s.status = any (app.session_live_statuses()) then
    update public.live_session_state set recorder_state = p_recorder_state, connectivity_state = p_connectivity,
      battery_warning = p_battery_warning, elapsed_seconds = extract(epoch from now() - v_s.server_started_at)::int, updated_at = now()
      where session_id = p_session;
  end if;
  return app.session_json(p_session);
end $$;

-- End the drive. Normal end requires server-side stationary evidence (STOP_CANDIDATE). Override requires a reason and
-- marks gps_incomplete. Learner (controller) or in-car supervisor may end. Idempotent.
create or replace function app.end_session(p_session uuid, p_idempotency_key text, p_override_reason text default null, p_confirmed_parked boolean default false)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_prev jsonb; v_override boolean := false; v_minutes int;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  v_prev := app.idempotent_get('end_session', p_idempotency_key);
  if v_prev is not null then return v_prev; end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if not (v_s.controller_user_id = v_uid or app.is_in_car_supervisor(p_session)) then
    perform app.fail('FORBIDDEN', 'Only the learner or the in-car supervisor can end this drive');
  end if;
  if v_s.status in ('ENDED','AWAITING_LEARNER_REFLECTION','AWAITING_ADULT_REVIEW','RECOVERY_REQUIRED') then
    v_prev := app.session_json(p_session); perform app.idempotent_put('end_session', p_idempotency_key, v_prev); return v_prev;
  end if;
  if not (v_s.status = any (app.session_live_statuses())) then perform app.fail('INVALID_STATE', 'Drive is not active'); end if;
  if not p_confirmed_parked then perform app.fail('VALIDATION', 'Confirm the vehicle is safely parked'); end if;
  if v_s.status <> 'STOP_CANDIDATE' then
    if coalesce(length(trim(p_override_reason)), 0) < 5 then
      perform app.fail('NOT_STATIONARY', 'The vehicle does not appear to be parked yet. Wait, or use the override with a reason.');
    end if;
    v_override := true;
  end if;
  v_minutes := greatest(0, round(extract(epoch from now() - v_s.server_started_at) / 60.0))::int;
  update public.drive_sessions set status = 'ENDED', server_ended_at = now(), ended_by = v_uid,
    end_override_reason = case when v_override then p_override_reason else null end,
    gps_incomplete = v_override or gps_incomplete, proposed_duration_minutes = v_minutes
    where id = p_session;
  update public.live_session_state set recorder_state = 'STOPPED', elapsed_seconds = v_minutes * 60, updated_at = now(),
    latest_latitude = null, latest_longitude = null where session_id = p_session;
  perform app.audit('drive_session', p_session, case when v_override then 'session_ended_override' else 'session_ended' end,
    jsonb_build_object('status', v_s.status), jsonb_build_object('status', 'ENDED', 'proposed_duration_minutes', v_minutes),
    p_override_reason, p_idempotency_key);
  v_prev := app.session_json(p_session);
  perform app.idempotent_put('end_session', p_idempotency_key, v_prev);
  return v_prev;
end $$;

-- Server-only: store processed route + metrics, then advance to AWAITING_LEARNER_REFLECTION (or RECOVERY_REQUIRED on failure).
create or replace function app.record_route_processing(p_session uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_s public.drive_sessions%rowtype; v_status public.session_status;
begin
  if not app.is_service_role() then perform app.fail('FORBIDDEN', 'Server only'); end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if v_s.status not in ('ENDED','RECOVERY_REQUIRED','AWAITING_LEARNER_REFLECTION') then
    perform app.fail('INVALID_STATE', format('Cannot process a drive in state %s', v_s.status));
  end if;
  if coalesce((p ->> 'error')::text, '') <> '' then
    update public.drive_sessions set status = 'RECOVERY_REQUIRED', processing_error = left(p ->> 'error', 500) where id = p_session;
    perform app.audit('drive_session', p_session, 'route_processing_failed', null, jsonb_build_object('error', p ->> 'error'));
    return app.session_json(p_session);
  end if;
  v_status := case when v_s.status = 'ENDED' then 'AWAITING_LEARNER_REFLECTION' else v_s.status end;
  update public.drive_sessions set
    distance_meters = (p ->> 'distance_meters')::int,
    gps_quality = (p ->> 'gps_quality')::public.gps_quality,
    gps_incomplete = gps_incomplete or coalesce((p ->> 'gps_incomplete')::boolean, false),
    proposed_night_minutes = coalesce((p ->> 'proposed_night_minutes')::int, 0),
    night_gap_minutes = coalesce((p ->> 'night_gap_minutes')::int, 0),
    processing_version = p ->> 'processing_version', night_algorithm_version = p ->> 'night_algorithm_version',
    processing_error = null, status = v_status
    where id = p_session;
  insert into public.drive_routes (session_id, route_geojson, simplified_geojson, point_count, accepted_point_count, rejection_counts, processing_version)
  values (p_session, p -> 'route_geojson', p -> 'simplified_geojson', coalesce((p ->> 'point_count')::int, 0),
    coalesce((p ->> 'accepted_point_count')::int, 0), coalesce(p -> 'rejection_counts', '{}'::jsonb), p ->> 'processing_version')
  on conflict (session_id) do update set route_geojson = excluded.route_geojson, simplified_geojson = excluded.simplified_geojson,
    point_count = excluded.point_count, accepted_point_count = excluded.accepted_point_count,
    rejection_counts = excluded.rejection_counts, processing_version = excluded.processing_version, processed_at = now()
  where public.drive_routes.route_deleted_at is null;
  perform app.audit('drive_session', p_session, 'route_processed', jsonb_build_object('status', v_s.status),
    jsonb_build_object('status', v_status, 'distance_meters', p ->> 'distance_meters', 'gps_quality', p ->> 'gps_quality'));
  return app.session_json(p_session);
end $$;

-- Low-interaction in-drive observation. Verified only when the author is the physically present in-car supervisor.
create or replace function app.add_observation(p_session uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_part public.session_participants%rowtype;
  v_live public.live_session_state%rowtype; v_id uuid; v_verified boolean; v_type public.observation_type; v_note text;
  v_assess public.observation_assessment; v_client text := p ->> 'client_event_id'; v_occ timestamptz;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  select * into v_s from public.drive_sessions where id = p_session;
  if v_s.id is null or not app.is_active_linked_adult(v_s.learner_id, v_uid) then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  select * into v_part from public.session_participants where session_id = p_session and user_id = v_uid and left_at is null;
  if v_part.id is null or not v_part.can_observe or v_part.role = 'LEARNER' then perform app.fail('FORBIDDEN', 'You cannot add observations to this drive'); end if;
  if not (v_s.status = any (app.session_live_statuses())) then perform app.fail('INVALID_STATE', 'Observations can only be added during an active drive'); end if;
  if v_client is not null then
    select id into v_id from public.drive_observations where session_id = p_session and client_event_id = v_client;
    if v_id is not null then return jsonb_build_object('id', v_id, 'duplicate', true); end if;
  end if;
  v_type := (p ->> 'observation_type')::public.observation_type;
  v_assess := coalesce((p ->> 'assessment')::public.observation_assessment,
    (case v_type when 'DID_WELL' then 'POSITIVE' when 'NEEDS_PRACTICE' then 'IMPROVEMENT' when 'INTERVENED' then 'IMPROVEMENT' else 'NEUTRAL' end)::public.observation_assessment);
  v_note := nullif(left(p ->> 'note', 280), '');
  v_verified := v_part.role = 'IN_CAR_SUPERVISOR' and v_part.physically_in_vehicle;
  if (p ->> 'verification_level') = 'VERIFIED' and not v_verified then
    perform app.fail('FORBIDDEN', 'Only the in-car supervisor can create verified observations');
  end if;
  v_occ := coalesce((p ->> 'occurred_at')::timestamptz, now());
  if v_occ < v_s.server_started_at or v_occ > now() + interval '1 minute' then v_occ := now(); end if;
  select * into v_live from public.live_session_state where session_id = p_session;
  insert into public.drive_observations (session_id, author_id, author_role, skill_id, observation_type, assessment, occurred_at,
    elapsed_seconds, latitude, longitude, note, verification_level, client_event_id)
  values (p_session, v_uid, v_part.role, (p ->> 'skill_id')::uuid, v_type, v_assess, v_occ,
    extract(epoch from v_occ - v_s.server_started_at)::int,
    case when v_verified then v_live.latest_latitude end, case when v_verified then v_live.latest_longitude end,
    v_note, (case when v_verified then 'VERIFIED' else 'UNVERIFIED' end)::public.verification_level, v_client)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'duplicate', false, 'verification_level', case when v_verified then 'VERIFIED' else 'UNVERIFIED' end);
end $$;

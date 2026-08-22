-- 0013 State machine part 3: reflection, adult review/approval with contributions, manual records, route deletion

create or replace function app.save_reflection(p_session uuid, p jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_skills uuid[]; v_rating int; v_sk uuid;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null or v_s.learner_id <> v_uid then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if v_s.status not in ('AWAITING_LEARNER_REFLECTION','RETURNED_FOR_REVISION','RECOVERY_REQUIRED') then
    perform app.fail('INVALID_STATE', 'The reflection can only be edited after the drive ends and before adult review');
  end if;
  v_rating := (p ->> 'rating')::int;
  v_skills := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'skill_ids', '[]'::jsonb)) x), '{}');
  if cardinality(v_skills) > 5 then perform app.fail('VALIDATION', 'Select at most 5 skills'); end if;
  if p_submit and (v_rating is null or v_rating not between 1 and 5) then perform app.fail('VALIDATION', 'A rating from 1 to 5 is required'); end if;
  insert into public.learner_reflections (session_id, rating, went_well, improve, summary, confidence, skill_ids, status, submitted_at, updated_at)
  values (p_session, v_rating, left(p ->> 'went_well', 280), left(p ->> 'improve', 280), left(p ->> 'summary', 500),
    (p ->> 'confidence')::int, v_skills, (case when p_submit then 'SUBMITTED' else 'DRAFT' end)::public.reflection_status, case when p_submit then now() end, now())
  on conflict (session_id) do update set rating = excluded.rating, went_well = excluded.went_well, improve = excluded.improve,
    summary = excluded.summary, confidence = excluded.confidence, skill_ids = excluded.skill_ids, status = excluded.status,
    submitted_at = excluded.submitted_at, updated_at = now();
  delete from public.drive_skill_tags where session_id = p_session and source_role = 'LEARNER';
  foreach v_sk in array v_skills loop
    insert into public.drive_skill_tags (session_id, skill_id, source_role) values (p_session, v_sk, 'LEARNER') on conflict do nothing;
  end loop;
  if p_submit then
    update public.drive_sessions set status = 'AWAITING_ADULT_REVIEW' where id = p_session;
    perform app.audit('drive_session', p_session, 'reflection_submitted', jsonb_build_object('status', v_s.status), jsonb_build_object('status', 'AWAITING_ADULT_REVIEW'));
  end if;
  return app.session_json(p_session);
end $$;

-- Time interval of a session for overlap detection.
create or replace function app.session_interval(s public.drive_sessions) returns tstzrange language sql immutable as $$
  select case
    when s.server_started_at is not null then tstzrange(s.server_started_at, coalesce(s.server_ended_at, s.server_started_at + interval '1 minute'), '[)')
    when s.manual_started_at is not null and s.manual_ended_at is not null then tstzrange(s.manual_started_at, s.manual_ended_at, '[)')
    else null end
$$;

create or replace function app.find_overlaps(p_learner uuid, p_session uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object('session_id', o.id, 'started_at', lower(app.session_interval(o)), 'ended_at', upper(app.session_interval(o)))), '[]'::jsonb)
  from public.drive_sessions s join public.drive_sessions o
    on o.learner_id = s.learner_id and o.id <> s.id and o.status = 'APPROVED'
    and app.session_interval(o) is not null and app.session_interval(s) is not null and app.session_interval(o) && app.session_interval(s)
  where s.id = p_session and s.learner_id = p_learner
$$;

create or replace function app.can_review_session(p_session uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.drive_sessions s where s.id = p_session
    and app.is_active_linked_adult(s.learner_id, p_uid)
    and (s.supervisor_id is null or s.supervisor_id = p_uid or s.evidence_type <> 'GPS'))
$$;

-- Derive requirement contributions from the versioned ruleset (generic over primitives; no California hardcoding).
create or replace function app.derive_contributions(p_session uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_s public.drive_sessions%rowtype; v_rs public.jurisdiction_rule_sets%rowtype; req jsonb; v_out jsonb := '[]'::jsonb;
  v_parent_ok boolean; v_amount int;
begin
  select * into v_s from public.drive_sessions where id = p_session;
  select * into v_rs from public.jurisdiction_rule_sets where jurisdiction = v_s.jurisdiction and version = v_s.ruleset_version;
  if v_rs.version is null then perform app.fail('VALIDATION', 'Ruleset missing'); end if;
  for req in select * from jsonb_array_elements(v_rs.config_json -> 'requirements') loop
    if req ->> 'type' = 'duration_total' then
      if (req -> 'eligible_session_types') ? v_s.session_type::text then
        v_out := v_out || jsonb_build_object('requirement_key', req ->> 'key', 'amount', coalesce(v_s.credited_duration_minutes, 0), 'unit', 'minutes');
      end if;
    elsif req ->> 'type' = 'duration_subset' then
      select exists (select 1 from jsonb_array_elements(v_rs.config_json -> 'requirements') pr
        where pr ->> 'key' = req ->> 'parent_requirement' and (pr -> 'eligible_session_types') ? v_s.session_type::text) into v_parent_ok;
      if v_parent_ok then
        v_amount := case req ->> 'evidence_field' when 'night_minutes' then coalesce(v_s.credited_night_minutes, 0) else 0 end;
        v_out := v_out || jsonb_build_object('requirement_key', req ->> 'key', 'amount', v_amount, 'unit', 'minutes');
      end if;
    end if;
    -- waiting_period, event_count, document_or_attestation, restriction, recommendation: no per-session minutes.
  end loop;
  return v_out;
end $$;

-- Adult review: approve / return / void. Transactional, idempotent, audited. Approval replaces contributions exactly once.
create or replace function app.review_session(p_session uuid, p jsonb, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_prev jsonb; v_decision public.review_decision;
  v_dur int; v_night int; v_reason text; v_overlaps jsonb; v_version int; v_contrib jsonb; c jsonb; v_sk uuid; v_skills uuid[];
  v_new_status public.session_status; v_obs uuid; v_refl public.learner_reflections%rowtype;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  v_prev := app.idempotent_get('review_session', p_idempotency_key);
  if v_prev is not null then return v_prev; end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null or not app.can_review_session(p_session, v_uid) then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if v_s.learner_id = v_uid then perform app.fail('FORBIDDEN', 'A learner cannot review their own drive'); end if;
  if v_s.status not in ('AWAITING_ADULT_REVIEW','RECOVERY_REQUIRED','APPROVED') then
    perform app.fail('INVALID_STATE', format('Drive is not ready for review (state %s)', v_s.status));
  end if;
  v_decision := (p ->> 'decision')::public.review_decision;
  if v_s.status = 'APPROVED' and v_decision = 'RETURNED' then perform app.fail('INVALID_STATE', 'An approved drive cannot be returned; correct or void it'); end if;
  v_reason := nullif(trim(p ->> 'correction_reason'), '');
  select coalesce(max(review_version), 0) + 1 into v_version from public.supervisor_reviews where session_id = p_session;

  if v_decision = 'APPROVED' then
    v_dur := coalesce((p ->> 'credited_duration_minutes')::int,
      case when v_s.status = 'APPROVED' then v_s.credited_duration_minutes else v_s.proposed_duration_minutes end);
    v_night := coalesce((p ->> 'credited_night_minutes')::int,
      case when v_s.status = 'APPROVED' then v_s.credited_night_minutes else v_s.proposed_night_minutes end, 0);
    if v_dur is null or v_dur <= 0 or v_dur > 24 * 60 then perform app.fail('VALIDATION', 'Credited duration must be between 1 minute and 24 hours'); end if;
    if v_night < 0 or v_night > v_dur then perform app.fail('VALIDATION', 'Night minutes cannot exceed credited duration'); end if;
    if (v_dur <> coalesce(v_s.proposed_duration_minutes, v_dur) or v_night <> coalesce(v_s.proposed_night_minutes, 0)
        or (v_s.status = 'APPROVED' and (v_dur <> v_s.credited_duration_minutes or v_night <> v_s.credited_night_minutes)))
       and v_reason is null then
      perform app.fail('VALIDATION', 'A reason is required when correcting duration or night minutes');
    end if;
    if (p ->> 'rating')::int is null then perform app.fail('VALIDATION', 'A rating from 1 to 5 is required'); end if;
    v_overlaps := app.find_overlaps(v_s.learner_id, p_session);
    if jsonb_array_length(v_overlaps) > 0 and not coalesce((p ->> 'acknowledge_overlap')::boolean, false) then
      raise exception using errcode = 'P0001', message = 'This drive overlaps an approved record. Correct or void one of them.', detail = 'OVERLAP', hint = v_overlaps::text;
    end if;
    v_new_status := 'APPROVED';
  elsif v_decision = 'RETURNED' then
    v_new_status := 'RETURNED_FOR_REVISION';
  else
    if v_reason is null then perform app.fail('VALIDATION', 'A reason is required to void a drive'); end if;
    v_new_status := 'VOIDED';
  end if;

  insert into public.supervisor_reviews (session_id, reviewer_id, rating, went_well, next_focus, summary, decision,
    credited_duration_minutes, credited_night_minutes, correction_reason, review_version, reviewed_at)
  values (p_session, v_uid, (p ->> 'rating')::int, left(p ->> 'went_well', 500), left(p ->> 'next_focus', 500), left(p ->> 'summary', 500),
    v_decision, v_dur, v_night, v_reason, v_version, now())
  on conflict (session_id) do update set reviewer_id = excluded.reviewer_id, rating = excluded.rating, went_well = excluded.went_well,
    next_focus = excluded.next_focus, summary = excluded.summary, decision = excluded.decision,
    credited_duration_minutes = excluded.credited_duration_minutes, credited_night_minutes = excluded.credited_night_minutes,
    correction_reason = excluded.correction_reason, review_version = excluded.review_version, reviewed_at = now();

  -- Supervisor skill tags
  v_skills := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'skill_ids', '[]'::jsonb)) x), '{}');
  if p ? 'skill_ids' then
    delete from public.drive_skill_tags where session_id = p_session and source_role = 'IN_CAR_SUPERVISOR';
    foreach v_sk in array v_skills loop
      insert into public.drive_skill_tags (session_id, skill_id, source_role) values (p_session, v_sk, 'IN_CAR_SUPERVISOR') on conflict do nothing;
    end loop;
  end if;
  -- Finalize selected observations (others remain unfinalized evidence)
  if p ? 'finalized_observation_ids' then
    update public.drive_observations set finalized = false, finalized_by = null, finalized_at = null where session_id = p_session;
    for v_obs in select x::uuid from jsonb_array_elements_text(p -> 'finalized_observation_ids') x loop
      update public.drive_observations set finalized = true, finalized_by = v_uid, finalized_at = now() where id = v_obs and session_id = p_session;
    end loop;
  end if;

  delete from public.requirement_contributions where session_id = p_session;
  if v_decision = 'APPROVED' then
    update public.drive_sessions set status = 'APPROVED', credited_duration_minutes = v_dur, credited_night_minutes = v_night where id = p_session;
    v_contrib := app.derive_contributions(p_session);
    for c in select * from jsonb_array_elements(v_contrib) loop
      insert into public.requirement_contributions (session_id, learner_id, requirement_key, amount, unit, ruleset_version, evidence_type, approved_by, review_version)
      values (p_session, v_s.learner_id, c ->> 'requirement_key', (c ->> 'amount')::int, c ->> 'unit', v_s.ruleset_version, v_s.evidence_type, v_uid, v_version);
    end loop;
    update public.drive_observations set learner_visible = true where session_id = p_session and finalized;
  elsif v_decision = 'RETURNED' then
    update public.drive_sessions set status = 'RETURNED_FOR_REVISION' where id = p_session;
    update public.learner_reflections set status = 'DRAFT', submitted_at = null where session_id = p_session;
  else
    update public.drive_sessions set status = 'VOIDED' where id = p_session;
  end if;
  perform app.audit('drive_session', p_session, 'review_' || lower(v_decision::text),
    jsonb_build_object('status', v_s.status, 'credited_duration_minutes', v_s.credited_duration_minutes, 'credited_night_minutes', v_s.credited_night_minutes,
      'proposed_duration_minutes', v_s.proposed_duration_minutes, 'proposed_night_minutes', v_s.proposed_night_minutes),
    jsonb_build_object('status', v_new_status, 'credited_duration_minutes', v_dur, 'credited_night_minutes', v_night, 'review_version', v_version),
    v_reason, p_idempotency_key);
  v_prev := app.session_json(p_session) || jsonb_build_object('review_version', v_version, 'contributions', coalesce(v_contrib, '[]'::jsonb));
  perform app.idempotent_put('review_session', p_idempotency_key, v_prev);
  return v_prev;
end $$;

-- Manual supervised drive or professional-instruction session (no GPS). Enters adult review directly.
create or replace function app.create_manual_session(p jsonb, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := app.uid(); v_learner uuid := (p ->> 'learner_id')::uuid; v_type public.session_type; v_track public.learner_license_tracks%rowtype;
  v_start timestamptz; v_end timestamptz; v_dur int; v_night int; v_id uuid; v_prev jsonb; v_supervisor uuid; v_rating int;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  v_prev := app.idempotent_get('create_manual_session', p_idempotency_key);
  if v_prev is not null then return v_prev; end if;
  if v_learner is null or not app.can_access_learner(v_learner) then perform app.fail('FORBIDDEN', 'Not linked to this learner'); end if;
  select * into v_track from public.learner_license_tracks where learner_id = v_learner and status = 'ACTIVE';
  if v_track.id is null then perform app.fail('VALIDATION', 'Learner has no permit profile'); end if;
  v_type := (p ->> 'session_type')::public.session_type;
  v_start := (p ->> 'started_at')::timestamptz; v_end := (p ->> 'ended_at')::timestamptz;
  v_dur := (p ->> 'duration_minutes')::int;
  if v_start is not null and v_end is not null then
    if v_end <= v_start then perform app.fail('VALIDATION', 'End must be after start'); end if;
    v_dur := coalesce(v_dur, round(extract(epoch from v_end - v_start) / 60.0)::int);
  elsif v_start is not null and v_dur is not null then
    v_end := v_start + make_interval(mins => v_dur);
  end if;
  if v_dur is null or v_dur <= 0 or v_dur > 24 * 60 then perform app.fail('VALIDATION', 'Duration must be between 1 minute and 24 hours'); end if;
  if v_start is null or v_start > now() then perform app.fail('VALIDATION', 'Date is required and cannot be in the future'); end if;
  v_night := coalesce((p ->> 'night_minutes')::int, 0);
  if v_night < 0 or v_night > v_dur then perform app.fail('VALIDATION', 'Night minutes cannot exceed duration'); end if;
  if v_type = 'FAMILY_SUPERVISED' then
    v_supervisor := coalesce((p ->> 'supervisor_id')::uuid, case when v_uid <> v_learner then v_uid end);
    if v_supervisor is null or not app.is_active_linked_adult(v_learner, v_supervisor) then perform app.fail('VALIDATION', 'Select the linked adult who supervised'); end if;
  else
    v_supervisor := null; v_night := 0;
  end if;
  v_rating := (p ->> 'learner_rating')::int;
  insert into public.drive_sessions (learner_id, supervisor_id, controller_user_id, session_type, evidence_type, status, jurisdiction, ruleset_version,
    timezone, supervisor_present, manual_started_at, manual_ended_at, proposed_duration_minutes, proposed_night_minutes,
    school_name, instructor_name, learner_note, created_by, gps_quality, start_idempotency_key)
  values (v_learner, v_supervisor, v_uid, v_type, (case when v_type = 'FAMILY_SUPERVISED' then 'MANUAL' else 'ATTESTED' end)::public.evidence_type, 'AWAITING_ADULT_REVIEW',
    v_track.jurisdiction, v_track.ruleset_version, coalesce(p ->> 'timezone', 'America/Los_Angeles'), v_type = 'FAMILY_SUPERVISED',
    v_start, v_end, v_dur, v_night, left(p ->> 'school_name', 120), left(p ->> 'instructor_name', 120), left(p ->> 'learner_note', 500),
    v_uid, null, p_idempotency_key)
  returning id into v_id;
  if v_rating is not null or (p ->> 'learner_note') is not null then
    insert into public.learner_reflections (session_id, rating, summary, status, submitted_at)
    values (v_id, v_rating, left(p ->> 'learner_note', 500), 'SUBMITTED', now());
  end if;
  perform app.audit('drive_session', v_id, 'manual_session_created', null, jsonb_build_object('session_type', v_type, 'created_by', v_uid,
    'duration_minutes', v_dur, 'night_minutes', v_night), null, p_idempotency_key);
  v_prev := app.session_json(v_id);
  perform app.idempotent_put('create_manual_session', p_idempotency_key, v_prev);
  return v_prev;
end $$;

-- Delete precise route data while retaining the learning record. Irreversible; audited.
create or replace function app.delete_route(p_session uuid, p_clear_distance boolean default false, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_s public.drive_sessions%rowtype; v_uid uuid := app.uid(); v_samples int;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  select * into v_s from public.drive_sessions where id = p_session for update;
  if v_s.id is null or not app.can_access_learner(v_s.learner_id) then perform app.fail('NOT_FOUND', 'Session not found'); end if;
  if v_s.status = any (app.session_live_statuses()) then perform app.fail('INVALID_STATE', 'End the drive before deleting its route'); end if;
  delete from public.location_samples where session_id = p_session;
  get diagnostics v_samples = row_count;
  insert into public.drive_routes (session_id, route_geojson, simplified_geojson, processing_version, route_deleted_at, deleted_by)
  values (p_session, null, null, coalesce(v_s.processing_version, 'none'), now(), v_uid)
  on conflict (session_id) do update set route_geojson = null, simplified_geojson = null, route_deleted_at = now(), deleted_by = v_uid;
  update public.drive_observations set latitude = null, longitude = null where session_id = p_session;
  update public.live_session_state set latest_latitude = null, latest_longitude = null, updated_at = now() where session_id = p_session;
  if p_clear_distance then update public.drive_sessions set distance_meters = null where id = p_session; end if;
  perform app.audit('drive_session', p_session, 'route_deleted', jsonb_build_object('had_distance', v_s.distance_meters is not null),
    jsonb_build_object('samples_deleted', v_samples, 'distance_cleared', p_clear_distance), p_reason);
  return jsonb_build_object('session_id', p_session, 'samples_deleted', v_samples);
end $$;

-- Adults can add/replace the note on their own observation after parking (not required while moving).
create or replace function app.update_observation_note(p_observation uuid, p_note text)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  update public.drive_observations set note = nullif(left(p_note, 280), '') where id = p_observation and author_id = app.uid();
  if not found then perform app.fail('NOT_FOUND', 'Observation not found'); end if;
end $$;

-- Route row is needed for the PostGIS-aware deletion of geometry when present
do $$ begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    execute $f$ create or replace function app.clear_route_geom() returns trigger language plpgsql as $t$
      begin if new.route_deleted_at is not null then new.route_geom := null; end if; return new; end $t$ $f$;
    execute 'create trigger drive_routes_clear_geom before insert or update on public.drive_routes for each row execute function app.clear_route_geom()';
  end if;
end $$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;
revoke execute on function app.record_route_processing(uuid, jsonb) from authenticated;

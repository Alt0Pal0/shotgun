-- 0015 Read models. SECURITY INVOKER: every query runs under the caller's RLS. Returns JSON for the app layer.

create or replace function app.profile_json(p_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'email', p.email, 'is_learner', p.is_learner, 'is_adult', p.is_adult,
    'timezone', p.timezone, 'unit_preference', p.unit_preference)
  from public.profiles p where p.id = p_id
$$;

create or replace function app.me() returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select jsonb_build_object(
    'profile', app.profile_json(app.uid()),
    'track', (select to_jsonb(t) from public.learner_license_tracks t where t.learner_id = app.uid() and t.status = 'ACTIVE'),
    'adults', coalesce((select jsonb_agg(jsonb_build_object('relationship_id', r.id, 'status', r.status, 'attestation_at', r.attestation_at,
        'allow_remote_live_view', r.allow_remote_live_view, 'adult', app.profile_json(r.supervisor_id)) order by r.created_at)
        from public.supervisor_relationships r where r.learner_id = app.uid() and r.status <> 'REVOKED'), '[]'::jsonb),
    'learners', coalesce((select jsonb_agg(jsonb_build_object('relationship_id', r.id, 'status', r.status, 'attestation_at', r.attestation_at,
        'allow_remote_live_view', r.allow_remote_live_view, 'learner', app.profile_json(r.learner_id),
        'track', (select to_jsonb(t) from public.learner_license_tracks t where t.learner_id = r.learner_id and t.status = 'ACTIVE')) order by r.created_at)
        from public.supervisor_relationships r where r.supervisor_id = app.uid() and r.status <> 'REVOKED'), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'expires_at', i.expires_at, 'accepted_at', i.accepted_at, 'revoked_at', i.revoked_at, 'created_at', i.created_at) order by i.created_at desc)
        from public.relationship_invitations i where i.learner_id = app.uid() and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()), '[]'::jsonb),
    'vehicles', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'label', v.label) order by v.created_at) from public.vehicles v where v.learner_id = app.uid() and v.archived_at is null), '[]'::jsonb)
  )
$$;

-- The session the caller is currently bound to (learner lock) or may view live (adult).
create or replace function app.my_live_session() returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select jsonb_build_object(
    'learner_session', (select jsonb_build_object('id', s.id, 'status', s.status, 'server_started_at', s.server_started_at)
        from public.drive_sessions s where s.learner_id = app.uid() and s.status in ('REQUESTED','READY','ACTIVE','STOP_CANDIDATE') limit 1),
    'adult_sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'learner', app.profile_json(s.learner_id),
        'role', sp.role, 'requested_at', s.requested_at, 'server_started_at', s.server_started_at, 'is_designated', s.supervisor_id = app.uid()))
        from public.drive_sessions s left join public.session_participants sp on sp.session_id = s.id and sp.user_id = app.uid() and sp.left_at is null
        where s.status in ('REQUESTED','READY','ACTIVE','STOP_CANDIDATE') and s.learner_id <> app.uid()
          and (s.supervisor_id = app.uid() or sp.can_view_live)), '[]'::jsonb)
  )
$$;

create or replace function app.session_brief(s public.drive_sessions) returns jsonb language sql stable as $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'session_type', s.session_type, 'evidence_type', s.evidence_type,
    'learner_id', s.learner_id, 'supervisor_id', s.supervisor_id, 'supervisor', app.profile_json(s.supervisor_id), 'learner', app.profile_json(s.learner_id),
    'started_at', coalesce(s.server_started_at, s.manual_started_at), 'ended_at', coalesce(s.server_ended_at, s.manual_ended_at),
    'proposed_duration_minutes', s.proposed_duration_minutes, 'credited_duration_minutes', s.credited_duration_minutes,
    'proposed_night_minutes', s.proposed_night_minutes, 'credited_night_minutes', s.credited_night_minutes, 'night_gap_minutes', s.night_gap_minutes,
    'distance_meters', s.distance_meters, 'gps_quality', s.gps_quality, 'gps_incomplete', s.gps_incomplete, 'end_override_reason', s.end_override_reason,
    'school_name', s.school_name, 'instructor_name', s.instructor_name, 'learner_note', s.learner_note, 'created_by', s.created_by,
    'timezone', s.timezone, 'ruleset_version', s.ruleset_version, 'jurisdiction', s.jurisdiction, 'processing_version', s.processing_version,
    'night_algorithm_version', s.night_algorithm_version, 'processing_error', s.processing_error, 'planned_skill_ids', to_jsonb(s.planned_skill_ids),
    'vehicle', (select jsonb_build_object('id', v.id, 'label', v.label) from public.vehicles v where v.id = s.vehicle_id),
    'created_at', s.created_at, 'updated_at', s.updated_at)
$$;

create or replace function app.session_detail(p_session uuid) returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select app.session_brief(s) || jsonb_build_object(
    'participants', coalesce((select jsonb_agg(jsonb_build_object('user_id', sp.user_id, 'role', sp.role, 'physically_in_vehicle', sp.physically_in_vehicle,
        'can_view_live', sp.can_view_live, 'can_observe', sp.can_observe, 'left_at', sp.left_at, 'profile', app.profile_json(sp.user_id)))
        from public.session_participants sp where sp.session_id = s.id), '[]'::jsonb),
    'route', (select jsonb_build_object('route_geojson', r.route_geojson, 'simplified_geojson', r.simplified_geojson, 'point_count', r.point_count,
        'accepted_point_count', r.accepted_point_count, 'rejection_counts', r.rejection_counts, 'route_deleted_at', r.route_deleted_at, 'processing_version', r.processing_version)
        from public.drive_routes r where r.session_id = s.id),
    'reflection', (select to_jsonb(lr) from public.learner_reflections lr where lr.session_id = s.id),
    'review', (select to_jsonb(sr) from public.supervisor_reviews sr where sr.session_id = s.id),
    'observations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'author_id', o.author_id, 'author_role', o.author_role, 'author', app.profile_json(o.author_id),
        'skill_id', o.skill_id, 'observation_type', o.observation_type, 'assessment', o.assessment, 'occurred_at', o.occurred_at, 'elapsed_seconds', o.elapsed_seconds,
        'latitude', o.latitude, 'longitude', o.longitude, 'note', o.note, 'verification_level', o.verification_level, 'finalized', o.finalized, 'learner_visible', o.learner_visible) order by o.occurred_at)
        from public.drive_observations o where o.session_id = s.id), '[]'::jsonb),
    'skill_tags', coalesce((select jsonb_agg(jsonb_build_object('skill_id', t.skill_id, 'source_role', t.source_role, 'label', k.label))
        from public.drive_skill_tags t join public.skills k on k.id = t.skill_id where t.session_id = s.id), '[]'::jsonb),
    'contributions', coalesce((select jsonb_agg(jsonb_build_object('requirement_key', c.requirement_key, 'amount', c.amount, 'unit', c.unit, 'evidence_type', c.evidence_type, 'approved_at', c.approved_at, 'review_version', c.review_version))
        from public.requirement_contributions c where c.session_id = s.id), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'reason', a.reason, 'created_at', a.created_at, 'before', a.before_json, 'after', a.after_json, 'actor_id', a.actor_id) order by a.created_at)
        from public.audit_events a where a.entity_type = 'drive_session' and a.entity_id = s.id), '[]'::jsonb),
    'viewer', jsonb_build_object('is_learner', s.learner_id = app.uid(), 'is_designated_supervisor', s.supervisor_id = app.uid(),
        'can_review', app.can_review_session(s.id, app.uid()), 'is_in_car_supervisor', app.is_in_car_supervisor(s.id), 'is_live_participant', app.is_live_participant(s.id))
  )
  from public.drive_sessions s where s.id = p_session
$$;

-- Adult live view. Returns null unless the caller is an authorized live participant (RLS on live_session_state).
create or replace function app.live_view(p_session uuid) returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select jsonb_build_object(
    'session', app.session_brief(s),
    'live', to_jsonb(l),
    'viewer', jsonb_build_object('role', sp.role, 'is_in_car_supervisor', app.is_in_car_supervisor(s.id), 'can_observe', sp.can_observe),
    'recorder', (select jsonb_build_object('connectivity_state', sd.connectivity_state, 'last_sample_at', sd.last_sample_at, 'location_permission', sd.location_permission, 'updated_at', sd.updated_at)
        from public.session_devices sd where sd.session_id = s.id and sd.is_recorder limit 1),
    'observations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'author_id', o.author_id, 'skill_id', o.skill_id, 'observation_type', o.observation_type,
        'assessment', o.assessment, 'occurred_at', o.occurred_at, 'elapsed_seconds', o.elapsed_seconds, 'latitude', o.latitude, 'longitude', o.longitude, 'note', o.note, 'verification_level', o.verification_level) order by o.occurred_at)
        from public.drive_observations o where o.session_id = s.id), '[]'::jsonb),
    'planned_skills', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'label', k.label)) from public.skills k where k.id = any (s.planned_skill_ids)), '[]'::jsonb),
    'server_time', now()
  )
  from public.live_session_state l join public.drive_sessions s on s.id = l.session_id
  left join public.session_participants sp on sp.session_id = s.id and sp.user_id = app.uid() and sp.left_at is null
  where l.session_id = p_session
$$;

-- Learner locked screen: status + start time only. Never position or observations.
create or replace function app.lock_state(p_session uuid) returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'server_started_at', s.server_started_at, 'server_time', now(),
    'recorder_device_id', s.primary_recorder_device_id, 'supervisor', app.profile_json(s.supervisor_id))
  from public.drive_sessions s where s.id = p_session and s.learner_id = app.uid()
$$;

create or replace function app.list_sessions(p_learner uuid, p_filter text default 'ALL') returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select coalesce(jsonb_agg(app.session_brief(s) || jsonb_build_object(
      'learner_rating', (select rating from public.learner_reflections lr where lr.session_id = s.id),
      'adult_rating', (select rating from public.supervisor_reviews sr where sr.session_id = s.id)) order by coalesce(s.server_started_at, s.manual_started_at, s.created_at) desc), '[]'::jsonb)
  from public.drive_sessions s
  where s.learner_id = p_learner
    and (p_filter = 'ALL'
      or (p_filter = 'PENDING' and s.status in ('AWAITING_LEARNER_REFLECTION','AWAITING_ADULT_REVIEW','RETURNED_FOR_REVISION','RECOVERY_REQUIRED','ENDED'))
      or (p_filter = 'APPROVED' and s.status = 'APPROVED')
      or (p_filter = 'MANUAL' and s.evidence_type = 'MANUAL')
      or (p_filter = 'INSTRUCTOR' and s.session_type = 'PROFESSIONAL_INSTRUCTION'))
$$;

create or replace function app.review_queue() returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select coalesce(jsonb_agg(app.session_brief(s) order by coalesce(s.server_ended_at, s.manual_ended_at, s.created_at) asc), '[]'::jsonb)
  from public.drive_sessions s
  where s.status in ('AWAITING_ADULT_REVIEW','RECOVERY_REQUIRED') and app.can_review_session(s.id, app.uid())
$$;

create or replace function app.progress_model(p_learner uuid) returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select jsonb_build_object(
    'learner', app.profile_json(p_learner),
    'track', (select to_jsonb(t) from public.learner_license_tracks t where t.learner_id = p_learner and t.status = 'ACTIVE'),
    'ruleset', (select jsonb_build_object('jurisdiction', r.jurisdiction, 'version', r.version, 'config', r.config_json, 'source_metadata', r.source_metadata, 'reviewed_at', r.reviewed_at)
        from public.jurisdiction_rule_sets r join public.learner_license_tracks t on t.jurisdiction = r.jurisdiction and t.ruleset_version = r.version
        where t.learner_id = p_learner and t.status = 'ACTIVE'),
    'contributions', coalesce((select jsonb_agg(jsonb_build_object('session_id', c.session_id, 'requirement_key', c.requirement_key, 'amount', c.amount, 'unit', c.unit,
        'evidence_type', c.evidence_type, 'evidence_state', c.evidence_state, 'approved_at', c.approved_at, 'ruleset_version', c.ruleset_version))
        from public.requirement_contributions c where c.learner_id = p_learner and c.evidence_state = 'FINAL'), '[]'::jsonb),
    'pending_count', (select count(*) from public.drive_sessions s where s.learner_id = p_learner and s.status in ('AWAITING_LEARNER_REFLECTION','AWAITING_ADULT_REVIEW','RETURNED_FOR_REVISION','RECOVERY_REQUIRED','ENDED')),
    'recent', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select app.session_brief(s) || jsonb_build_object(
        'learner_rating', (select rating from public.learner_reflections lr where lr.session_id = s.id),
        'adult_rating', (select rating from public.supervisor_reviews sr where sr.session_id = s.id)) as x
        from public.drive_sessions s where s.learner_id = p_learner and s.status not in ('DRAFT','VOIDED')
        order by coalesce(s.server_started_at, s.manual_started_at, s.created_at) desc limit 3) q),
    'computed_at', now()
  )
$$;

-- Instructor report model: no route geometry, no live location, no private identifiers beyond display name.
create or replace function app.report_model(p_learner uuid) returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select app.progress_model(p_learner) || jsonb_build_object(
    'approved_sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'session_type', s.session_type, 'evidence_type', s.evidence_type,
        'started_at', coalesce(s.server_started_at, s.manual_started_at), 'credited_duration_minutes', s.credited_duration_minutes, 'credited_night_minutes', s.credited_night_minutes,
        'school_name', s.school_name, 'instructor_name', s.instructor_name,
        'learner_rating', (select rating from public.learner_reflections lr where lr.session_id = s.id),
        'learner_went_well', (select went_well from public.learner_reflections lr where lr.session_id = s.id),
        'learner_improve', (select improve from public.learner_reflections lr where lr.session_id = s.id),
        'adult_rating', (select rating from public.supervisor_reviews sr where sr.session_id = s.id),
        'adult_went_well', (select went_well from public.supervisor_reviews sr where sr.session_id = s.id),
        'adult_next_focus', (select next_focus from public.supervisor_reviews sr where sr.session_id = s.id),
        'skills', (select coalesce(jsonb_agg(distinct k.label), '[]'::jsonb) from public.drive_skill_tags t join public.skills k on k.id = t.skill_id where t.session_id = s.id)
      ) order by coalesce(s.server_started_at, s.manual_started_at) desc)
      from public.drive_sessions s where s.learner_id = p_learner and s.status = 'APPROVED'), '[]'::jsonb),
    'skill_frequency', coalesce((select jsonb_object_agg(k.label, n) from (select t.skill_id, count(*) n from public.drive_skill_tags t
        join public.drive_sessions s on s.id = t.session_id where s.learner_id = p_learner and s.status = 'APPROVED' group by t.skill_id) q join public.skills k on k.id = q.skill_id), '{}'::jsonb)
  )
$$;

create or replace function app.skills_list() returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'label', label) order by sort_order), '[]'::jsonb) from public.skills where active
$$;

create or replace function app.upsert_vehicle(p_id uuid, p_label text) returns uuid language plpgsql security definer set search_path = public, app, extensions as $$
declare v_id uuid;
begin
  if app.uid() is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if p_id is null then
    insert into public.vehicles (learner_id, label) values (app.uid(), left(trim(p_label), 60)) returning id into v_id;
  else
    update public.vehicles set label = left(trim(p_label), 60) where id = p_id and learner_id = app.uid() returning id into v_id;
    if v_id is null then perform app.fail('NOT_FOUND', 'Vehicle not found'); end if;
  end if;
  return v_id;
end $$;

create or replace function app.archive_vehicle(p_id uuid) returns void language sql security definer set search_path = public, app, extensions as $$
  update public.vehicles set archived_at = now() where id = p_id and learner_id = app.uid()
$$;

create or replace function app.update_profile(p jsonb) returns jsonb language plpgsql security definer set search_path = public, app, extensions as $$
begin
  if app.uid() is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  update public.profiles set display_name = coalesce(left(trim(p ->> 'display_name'), 60), display_name),
    timezone = coalesce(p ->> 'timezone', timezone), unit_preference = coalesce(p ->> 'unit_preference', unit_preference),
    age_confirmed = coalesce((p ->> 'age_confirmed')::boolean, age_confirmed), is_adult = coalesce((p ->> 'is_adult')::boolean, is_adult),
    onboarding_completed_at = case when coalesce((p ->> 'onboarding_completed')::boolean, false) then now() else onboarding_completed_at end
  where id = app.uid();
  return app.profile_json(app.uid());
end $$;

create or replace function app.track_event(p_event text, p_props jsonb default '{}'::jsonb) returns void language sql security definer set search_path = public, app, extensions as $$
  insert into public.analytics_events (user_id, event, properties) values (app.uid(), left(p_event, 60), coalesce(p_props, '{}'::jsonb))
$$;

-- Account deletion: removes the auth user (cascades) after audit. Relationship partners keep audit references only.
create or replace function app.delete_my_account() returns void language plpgsql security definer set search_path = public, app, auth, extensions as $$
begin
  if app.uid() is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if exists (select 1 from public.drive_sessions where learner_id = app.uid() and status = any (app.session_live_statuses())) then
    perform app.fail('INVALID_STATE', 'End your active drive first');
  end if;
  perform app.audit('profile', app.uid(), 'account_deleted');
  delete from auth.users where id = app.uid();
end $$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;
revoke execute on function app.record_route_processing(uuid, jsonb) from authenticated;

create or replace function app.ruleset_config(p_jurisdiction text, p_version text) returns jsonb language sql stable security invoker set search_path = public, app, extensions as $$
  select config_json from public.jurisdiction_rule_sets where jurisdiction = p_jurisdiction and version = p_version
$$;
grant execute on function app.ruleset_config(text, text) to authenticated, service_role;

-- Anonymous users may preview an invitation (display name + validity only) before signing up.
grant usage on schema app to anon;
grant execute on function app.preview_invitation(text) to anon;

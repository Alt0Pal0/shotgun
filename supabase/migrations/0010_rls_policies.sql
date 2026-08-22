-- 0010 Row Level Security and grants. Every exposed table has RLS; writes to state-bearing tables go through app.* functions.
alter table public.profiles enable row level security;
alter table public.learner_license_tracks enable row level security;
alter table public.supervisor_relationships enable row level security;
alter table public.relationship_invitations enable row level security;
alter table public.jurisdiction_rule_sets enable row level security;
alter table public.skills enable row level security;
alter table public.devices enable row level security;
alter table public.vehicles enable row level security;
alter table public.drive_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_devices enable row level security;
alter table public.location_samples enable row level security;
alter table public.live_session_state enable row level security;
alter table public.drive_routes enable row level security;
alter table public.drive_observations enable row level security;
alter table public.learner_reflections enable row level security;
alter table public.supervisor_reviews enable row level security;
alter table public.drive_skill_tags enable row level security;
alter table public.requirement_contributions enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.analytics_events enable row level security;
alter table public.report_exports enable row level security;

-- Grants: anon gets nothing; authenticated gets narrowly scoped table privileges; RLS narrows rows.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
revoke select on public.idempotency_keys, public.location_samples from authenticated;
grant select on public.location_samples to authenticated; -- row policies below restrict
grant update (display_name, timezone, unit_preference, age_confirmed, is_learner, onboarding_completed_at) on public.profiles to authenticated;
grant insert, update (permit_issue_date, status) on public.learner_license_tracks to authenticated;
grant insert, update on public.devices to authenticated;
grant insert, update (label, archived_at) on public.vehicles to authenticated;
grant insert on public.analytics_events to authenticated;
grant all on all tables in schema public to service_role;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (
  id = app.uid()
  or exists (select 1 from public.supervisor_relationships r
             where (r.learner_id = app.uid() and r.supervisor_id = profiles.id)
                or (r.supervisor_id = app.uid() and r.learner_id = profiles.id))
);
create policy profiles_update on public.profiles for update to authenticated using (id = app.uid()) with check (id = app.uid());

-- learner license tracks
create policy tracks_select on public.learner_license_tracks for select to authenticated using (app.can_access_learner(learner_id));
create policy tracks_insert on public.learner_license_tracks for insert to authenticated with check (learner_id = app.uid());
create policy tracks_update on public.learner_license_tracks for update to authenticated using (learner_id = app.uid());

-- relationships & invitations (writes only via functions)
create policy relationships_select on public.supervisor_relationships for select to authenticated
  using (learner_id = app.uid() or supervisor_id = app.uid());
create policy invitations_select on public.relationship_invitations for select to authenticated using (learner_id = app.uid());

-- reference data
create policy rulesets_select on public.jurisdiction_rule_sets for select to authenticated using (true);
create policy skills_select on public.skills for select to authenticated using (true);

-- devices & vehicles
create policy devices_select on public.devices for select to authenticated using (owner_user_id = app.uid());
create policy devices_insert on public.devices for insert to authenticated with check (owner_user_id = app.uid());
create policy devices_update on public.devices for update to authenticated using (owner_user_id = app.uid());
create policy vehicles_select on public.vehicles for select to authenticated using (app.can_access_learner(learner_id));
create policy vehicles_insert on public.vehicles for insert to authenticated with check (learner_id = app.uid());
create policy vehicles_update on public.vehicles for update to authenticated using (learner_id = app.uid());

-- drive sessions: learner + active linked adults; no direct writes
create policy sessions_select on public.drive_sessions for select to authenticated using (app.can_view_session(id));
create policy participants_select on public.session_participants for select to authenticated using (app.can_view_session(session_id));
create policy session_devices_select on public.session_devices for select to authenticated using (app.can_view_session(session_id));

-- raw location samples: adults with an active relationship; learner only after the live phase
create policy samples_select on public.location_samples for select to authenticated using (
  exists (select 1 from public.drive_sessions s where s.id = location_samples.session_id
          and ((s.learner_id = app.uid() and not (s.status = any (app.session_live_statuses())))
               or app.is_active_linked_adult(s.learner_id, app.uid())))
);

-- live state: ONLY live participants (in-car supervisor or authorized remote viewer). Learner never.
create policy live_state_select on public.live_session_state for select to authenticated using (app.is_live_participant(session_id));

-- processed routes: same as samples
create policy routes_select on public.drive_routes for select to authenticated using (
  exists (select 1 from public.drive_sessions s where s.id = drive_routes.session_id
          and ((s.learner_id = app.uid() and not (s.status = any (app.session_live_statuses())))
               or app.is_active_linked_adult(s.learner_id, app.uid())))
);

-- observations: authors and linked adults always; learner only after the live phase and when marked visible
create policy observations_select on public.drive_observations for select to authenticated using (
  author_id = app.uid()
  or exists (select 1 from public.drive_sessions s where s.id = drive_observations.session_id
             and (app.is_active_linked_adult(s.learner_id, app.uid())
                  or (s.learner_id = app.uid() and learner_visible
                      and not (s.status = any (app.session_live_statuses())))))
);

-- reflections: learner always; adults once submitted
create policy reflections_select on public.learner_reflections for select to authenticated using (
  exists (select 1 from public.drive_sessions s where s.id = learner_reflections.session_id
          and (s.learner_id = app.uid()
               or (app.is_active_linked_adult(s.learner_id, app.uid()) and learner_reflections.status = 'SUBMITTED')))
);

-- reviews: adults always; learner only when the review state permits
create policy reviews_select on public.supervisor_reviews for select to authenticated using (
  exists (select 1 from public.drive_sessions s where s.id = supervisor_reviews.session_id
          and (app.is_active_linked_adult(s.learner_id, app.uid())
               or (s.learner_id = app.uid() and s.status in ('APPROVED','RETURNED_FOR_REVISION','VOIDED'))))
);

create policy skill_tags_select on public.drive_skill_tags for select to authenticated using (app.can_view_session(session_id));
create policy contributions_select on public.requirement_contributions for select to authenticated using (app.can_access_learner(learner_id));
create policy audit_select on public.audit_events for select to authenticated using (
  actor_id = app.uid() or (entity_type = 'drive_session' and app.can_view_session(entity_id))
);
create policy analytics_insert on public.analytics_events for insert to authenticated with check (user_id = app.uid());
create policy analytics_select on public.analytics_events for select to authenticated using (user_id = app.uid());
create policy reports_select on public.report_exports for select to authenticated using (app.can_access_learner(learner_id));

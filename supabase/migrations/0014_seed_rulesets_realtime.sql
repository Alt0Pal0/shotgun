-- 0014 Production ruleset (California), skill catalog, realtime publication
insert into public.jurisdiction_rule_sets (jurisdiction, version, effective_from, is_production, reviewed_at, source_metadata, config_json) values (
  'US-CA', '2026-08-22', '2026-01-01', true, '2026-08-22',
  '[{"title":"California DMV - Teen Driver Roadmap","url":"https://www.dmv.ca.gov/portal/driver-education-and-safety/educational-materials/teen-driver-roadmap/","reviewed":"2026-08-22","note":"50 supervised hours, 10 night hours, 6 professional hours, permit duration"},
    {"title":"California DMV - Driver Training Schools","url":"https://www.dmv.ca.gov/portal/driver-education-and-safety/driver-training-schools/","reviewed":"2026-08-22","note":"6-hour behind-the-wheel professional instruction"},
    {"title":"California DMV - Getting an Instruction Permit and Driver License","url":"https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/driver-licenses-dl/teen-drivers/","reviewed":"2026-08-22","note":"minor permit and supervising driver (licensed, 25+) requirements"},
    {"title":"California DMV - An Introduction to Driving","url":"https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/","reviewed":"2026-08-22","note":"headlight/darkness timing used as MVP night baseline"}]'::jsonb,
  '{
    "jurisdiction": "US-CA", "version": "2026-08-22", "effective_from": "2026-01-01", "display_name": "California",
    "night": {"type": "solar_offset", "after_sunset_minutes": 30, "before_sunrise_minutes": 30},
    "requirements": [
      {"key": "supervised_total", "type": "duration_total", "label": "Supervised practice", "target_minutes": 3000, "eligible_session_types": ["FAMILY_SUPERVISED"]},
      {"key": "night_subset", "type": "duration_subset", "label": "Night practice", "target_minutes": 600, "parent_requirement": "supervised_total", "evidence_field": "night_minutes"},
      {"key": "professional_training", "type": "duration_total", "label": "Professional instruction", "target_minutes": 360, "eligible_session_types": ["PROFESSIONAL_INSTRUCTION"]},
      {"key": "permit_hold", "type": "waiting_period", "label": "Permit hold", "target_months": 6, "start_field": "permit_issue_date"},
      {"key": "supervising_adult", "type": "restriction", "label": "Supervising adult", "rule": "California-licensed adult age 25 or older for minors", "evidence": "self_attestation"}
    ]
  }'::jsonb
);

insert into public.skills (slug, label, sort_order) values
  ('freeway_merge', 'Freeway merge', 10), ('lane_change', 'Lane change', 20), ('following_distance', 'Following distance', 30),
  ('smooth_stop', 'Smooth stop', 40), ('right_of_way', 'Right-of-way', 50), ('parking', 'Parking', 60),
  ('mirror_check', 'Mirror check', 70), ('speed_control', 'Speed control', 80), ('turns', 'Turns', 90),
  ('intersections', 'Intersections', 100), ('night_driving', 'Night driving', 110), ('backing_up', 'Backing up', 120);

-- Supabase Realtime: publish only the throttled live state and observations; never raw samples.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.live_session_state, public.drive_observations, public.drive_sessions';
  end if;
end $$;

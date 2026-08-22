-- 0017 Apply the role chosen at sign-up to the profile, so adults never see learner onboarding.
create or replace function app.handle_new_user() returns trigger language plpgsql security definer set search_path = public, app, extensions as $$
begin
  insert into public.profiles (id, email, display_name, is_adult, is_learner)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', '') = 'adult', coalesce(new.raw_user_meta_data ->> 'role', '') = 'learner')
  on conflict (id) do nothing;
  return new;
end $$;

-- Backfill existing accounts.
update public.profiles p set is_adult = true
  from auth.users u where u.id = p.id and u.raw_user_meta_data ->> 'role' = 'adult' and not p.is_adult
  and not exists (select 1 from public.learner_license_tracks t where t.learner_id = p.id);

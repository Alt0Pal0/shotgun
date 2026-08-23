-- 0018 Data fix (private beta): accounts registered with the wrong default role become parent/supervisor accounts.
-- Safe to run anywhere: only affects these exact emails; any learner permit profile they created is archived.
do $$
declare v_id uuid; v_email text;
begin
  foreach v_email in array array['michaeltadlock2@yahoo.com', 'miketadlock@gmail.com'] loop
    select id into v_id from auth.users where email = v_email;
    if v_id is null then continue; end if;
    update public.profiles set is_adult = true, is_learner = false where id = v_id;
    update public.learner_license_tracks set status = 'ARCHIVED' where learner_id = v_id and status = 'ACTIVE';
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"adult"}'::jsonb where id = v_id;
    perform app.audit('profile', v_id, 'role_corrected_to_adult', null, jsonb_build_object('email', v_email), 'owner request during private beta');
  end loop;
end $$;

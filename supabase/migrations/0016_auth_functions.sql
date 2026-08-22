-- 0016 Email/password auth for plain PostgreSQL deployments (Neon, local). Unused on Supabase (GoTrue handles auth).
-- These run as the server connection (no SET ROLE); they are never exposed to request roles.
create or replace function app.auth_hash(p_password text) returns text language sql stable
set search_path = public, extensions as $$ select crypt(p_password, gen_salt('bf', 10)) $$;

create or replace function app.auth_sign_up(p_email text, p_password text, p_display_name text, p_role text)
returns jsonb language plpgsql security definer set search_path = public, app, auth, extensions as $$
declare v_id uuid; v_token text;
begin
  if length(p_password) < 8 then raise exception 'Password must be at least 8 characters' using detail = 'VALIDATION'; end if;
  insert into auth.users (email, encrypted_password, raw_user_meta_data)
  values (lower(trim(p_email)), app.auth_hash(p_password), jsonb_build_object('display_name', left(p_display_name, 60), 'role', p_role))
  returning id into v_id;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into auth.tokens (token_hash, user_id, kind, expires_at) values (encode(digest(v_token, 'sha256'), 'hex'), v_id, 'verify', now() + interval '24 hours');
  return jsonb_build_object('user_id', v_id, 'verify_token', v_token);
exception when unique_violation then
  raise exception 'An account with this email already exists' using detail = 'CONFLICT';
end $$;

create or replace function app.auth_sign_in(p_email text, p_password text, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = public, app, auth, extensions as $$
declare v_u auth.users%rowtype; v_sid uuid; v_attempts int;
begin
  select count(*) into v_attempts from auth.attempts where email = lower(trim(p_email)) and attempted_at > now() - interval '15 minutes';
  if v_attempts >= 10 then raise exception 'Too many attempts. Try again in 15 minutes.' using detail = 'RATE_LIMITED'; end if;
  select * into v_u from auth.users where email = lower(trim(p_email));
  if v_u.id is null or v_u.encrypted_password is null or v_u.encrypted_password <> crypt(p_password, v_u.encrypted_password) then
    insert into auth.attempts (email) values (lower(trim(p_email)));
    raise exception 'Invalid email or password' using detail = 'UNAUTHENTICATED';
  end if;
  delete from auth.attempts where email = v_u.email;
  insert into auth.sessions (user_id, expires_at, user_agent) values (v_u.id, now() + interval '30 days', left(p_user_agent, 200)) returning id into v_sid;
  update auth.users set last_sign_in_at = now() where id = v_u.id;
  return jsonb_build_object('user_id', v_u.id, 'session_id', v_sid, 'email_confirmed', v_u.email_confirmed_at is not null);
end $$;

create or replace function app.auth_create_session(p_user uuid) returns uuid language sql security definer set search_path = public, app, auth as $$
  insert into auth.sessions (user_id, expires_at) values (p_user, now() + interval '30 days') returning id
$$;

create or replace function app.auth_session_user(p_session uuid) returns jsonb language sql stable security definer set search_path = public, app, auth as $$
  select jsonb_build_object('id', u.id, 'email', u.email, 'email_confirmed', u.email_confirmed_at is not null)
  from auth.sessions s join auth.users u on u.id = s.user_id
  where s.id = p_session and s.revoked_at is null and s.expires_at > now()
$$;

create or replace function app.auth_sign_out(p_session uuid) returns void language sql security definer set search_path = public, app, auth as $$
  update auth.sessions set revoked_at = now() where id = p_session and revoked_at is null
$$;

-- Issue a verify/reset token for an email. Returns null when the email is unknown (callers must not reveal this).
create or replace function app.auth_issue_token(p_email text, p_kind text) returns text language plpgsql security definer set search_path = public, app, auth, extensions as $$
declare v_id uuid; v_token text;
begin
  select id into v_id from auth.users where email = lower(trim(p_email));
  if v_id is null then return null; end if;
  if (select count(*) from auth.tokens where user_id = v_id and kind = p_kind and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many requests. Try again later.' using detail = 'RATE_LIMITED';
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into auth.tokens (token_hash, user_id, kind, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), v_id, p_kind, now() + case when p_kind = 'verify' then interval '24 hours' else interval '1 hour' end);
  return v_token;
end $$;

create or replace function app.auth_consume_verify(p_token text) returns uuid language plpgsql security definer set search_path = public, app, auth, extensions as $$
declare v_t auth.tokens%rowtype;
begin
  select * into v_t from auth.tokens where token_hash = encode(digest(p_token, 'sha256'), 'hex') and kind = 'verify' for update;
  if v_t.user_id is null or v_t.used_at is not null or v_t.expires_at < now() then return null; end if;
  update auth.tokens set used_at = now() where token_hash = v_t.token_hash;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_t.user_id;
  return v_t.user_id;
end $$;

create or replace function app.auth_consume_reset(p_token text, p_password text) returns uuid language plpgsql security definer set search_path = public, app, auth, extensions as $$
declare v_t auth.tokens%rowtype;
begin
  if length(p_password) < 8 then raise exception 'Password must be at least 8 characters' using detail = 'VALIDATION'; end if;
  select * into v_t from auth.tokens where token_hash = encode(digest(p_token, 'sha256'), 'hex') and kind = 'reset' for update;
  if v_t.user_id is null or v_t.used_at is not null or v_t.expires_at < now() then return null; end if;
  update auth.tokens set used_at = now() where token_hash = v_t.token_hash;
  update auth.users set encrypted_password = app.auth_hash(p_password), email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_t.user_id;
  update auth.sessions set revoked_at = now() where user_id = v_t.user_id and revoked_at is null;
  return v_t.user_id;
end $$;

create or replace function app.auth_update_password(p_user uuid, p_password text) returns void language plpgsql security definer set search_path = public, app, auth, extensions as $$
begin
  if length(p_password) < 8 then raise exception 'Password must be at least 8 characters' using detail = 'VALIDATION'; end if;
  update auth.users set encrypted_password = app.auth_hash(p_password) where id = p_user;
end $$;

revoke all on function app.auth_sign_up(text, text, text, text), app.auth_sign_in(text, text, text), app.auth_create_session(uuid),
  app.auth_session_user(uuid), app.auth_sign_out(uuid), app.auth_issue_token(text, text), app.auth_consume_verify(text),
  app.auth_consume_reset(text, text), app.auth_update_password(uuid, text), app.auth_hash(text) from public, anon, authenticated;

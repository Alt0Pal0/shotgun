-- 0020 One-round-trip context for every page render.
create or replace function app.session_context() returns jsonb language sql stable security invoker set search_path = public, app as $$
  select jsonb_build_object('me', app.me(), 'live', app.my_live_session())
$$;
grant execute on function app.session_context() to authenticated, service_role;

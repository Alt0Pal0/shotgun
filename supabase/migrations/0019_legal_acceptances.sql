-- 0019 Legal acceptances: immutable evidence of who agreed to what, when, from where.
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_key text not null,            -- terms | privacy | risk_indemnity | supervisor_attestation | guardian_consent
  version text not null,
  text_sha256 text not null,             -- hash of the exact text shown at acceptance
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  context jsonb not null default '{}'::jsonb,   -- e.g. related learner id, invitation id, screen
  check (length(document_key) <= 40 and length(version) <= 40)
);
create index legal_acceptances_user_idx on public.legal_acceptances (user_id, document_key, accepted_at desc);
alter table public.legal_acceptances enable row level security;
create policy legal_select_own on public.legal_acceptances for select to authenticated using (user_id = app.uid());
grant select on public.legal_acceptances to authenticated;

alter table public.profiles add column if not exists terms_version text;

-- Record one or more acceptances for the signed-in user. Append-only; never updated or deleted by users.
create or replace function app.record_legal_acceptance(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, app, extensions as $$
declare v_uid uuid := app.uid(); d jsonb; v_n int := 0; v_ip inet;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  begin v_ip := nullif(p ->> 'ip', '')::inet; exception when others then v_ip := null; end;
  for d in select * from jsonb_array_elements(p -> 'documents') loop
    if coalesce(d ->> 'key', '') = '' or coalesce(d ->> 'version', '') = '' or coalesce(d ->> 'sha256', '') = '' then
      perform app.fail('VALIDATION', 'Each document needs key, version and sha256');
    end if;
    insert into public.legal_acceptances (user_id, document_key, version, text_sha256, ip, user_agent, context)
    values (v_uid, d ->> 'key', d ->> 'version', d ->> 'sha256', v_ip, left(p ->> 'user_agent', 300), coalesce(p -> 'context', '{}'::jsonb));
    v_n := v_n + 1;
  end loop;
  if (p ->> 'terms_version') is not null then
    update public.profiles set terms_version = p ->> 'terms_version' where id = v_uid;
  end if;
  perform app.audit('profile', v_uid, 'legal_accepted', null, jsonb_build_object('documents', p -> 'documents', 'ip', p ->> 'ip'), null, p ->> 'request_id');
  return jsonb_build_object('recorded', v_n);
end $$;

-- Expose terms_version on the profile read model.
create or replace function app.profile_json(p_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'email', p.email, 'is_learner', p.is_learner, 'is_adult', p.is_adult,
    'timezone', p.timezone, 'unit_preference', p.unit_preference, 'terms_version', p.terms_version)
  from public.profiles p where p.id = p_id
$$;
revoke all on function app.record_legal_acceptance(jsonb) from public;
grant execute on function app.record_legal_acceptance(jsonb) to authenticated, service_role;

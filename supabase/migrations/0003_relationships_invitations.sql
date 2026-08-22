-- 0003 Supervisor relationships and single-use invitations
create table public.supervisor_relationships (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id) on delete cascade,
  status public.relationship_status not null default 'PENDING',
  attestation_text text,
  attestation_at timestamptz,
  allow_remote_live_view boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  check (learner_id <> supervisor_id)
);
create unique index supervisor_relationships_live_unique
  on public.supervisor_relationships (learner_id, supervisor_id) where status <> 'REVOKED';
create index supervisor_relationships_supervisor_idx on public.supervisor_relationships (supervisor_id, status);
create trigger relationships_updated before update on public.supervisor_relationships for each row execute function app.set_updated_at();

create table public.relationship_invitations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index relationship_invitations_learner_idx on public.relationship_invitations (learner_id, created_at desc);

-- Authorization helpers ---------------------------------------------------------------------
create or replace function app.is_active_linked_adult(p_learner uuid, p_adult uuid default app.uid()) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.supervisor_relationships r
    where r.learner_id = p_learner and r.supervisor_id = p_adult and r.status = 'ACTIVE'
  )
$$;

create or replace function app.can_access_learner(p_learner uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select p_learner = app.uid() or app.is_active_linked_adult(p_learner, app.uid())
$$;

-- Invitations ---------------------------------------------------------------------------------
-- Returns the raw token exactly once; only the SHA-256 hash is stored.
create or replace function app.create_invitation(p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_token text; v_id uuid; v_prev jsonb; v_uid uuid := app.uid();
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if not exists (select 1 from public.profiles where id = v_uid and is_learner) then
    perform app.fail('FORBIDDEN', 'Only learners can create invitations');
  end if;
  if p_idempotency_key is not null then
    v_prev := app.idempotent_get('create_invitation', p_idempotency_key);
    if v_prev is not null then return v_prev; end if;
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.relationship_invitations (learner_id, token_hash, expires_at)
  values (v_uid, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '7 days')
  returning id into v_id;
  perform app.audit('relationship_invitation', v_id, 'invitation_created', null, jsonb_build_object('expires_in_days', 7));
  v_prev := jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', (now() + interval '7 days'));
  if p_idempotency_key is not null then perform app.idempotent_put('create_invitation', p_idempotency_key, v_prev); end if;
  return v_prev;
end $$;

create or replace function app.revoke_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_inv public.relationship_invitations%rowtype;
begin
  select * into v_inv from public.relationship_invitations where id = p_invitation_id for update;
  if v_inv.id is null or v_inv.learner_id <> app.uid() then perform app.fail('NOT_FOUND', 'Invitation not found'); end if;
  if v_inv.accepted_at is not null then perform app.fail('INVALID_STATE', 'Invitation already accepted'); end if;
  if v_inv.revoked_at is null then
    update public.relationship_invitations set revoked_at = now() where id = p_invitation_id;
    perform app.audit('relationship_invitation', p_invitation_id, 'invitation_revoked');
  end if;
end $$;

-- Public preview of an invitation (no learner PII beyond display name) for the accept screen.
create or replace function app.preview_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_inv public.relationship_invitations%rowtype; v_name text;
begin
  select * into v_inv from public.relationship_invitations where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_inv.id is null then return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND'); end if;
  if v_inv.revoked_at is not null then return jsonb_build_object('valid', false, 'reason', 'REVOKED'); end if;
  if v_inv.accepted_at is not null then return jsonb_build_object('valid', false, 'reason', 'USED'); end if;
  if v_inv.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'EXPIRED'); end if;
  select display_name into v_name from public.profiles where id = v_inv.learner_id;
  return jsonb_build_object('valid', true, 'learner_display_name', v_name, 'expires_at', v_inv.expires_at);
end $$;

create or replace function app.accept_invitation(p_token text, p_attestation_text text)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_inv public.relationship_invitations%rowtype; v_uid uuid := app.uid(); v_rel_id uuid;
begin
  if v_uid is null then perform app.fail('UNAUTHENTICATED', 'Sign in required'); end if;
  if coalesce(length(trim(p_attestation_text)), 0) < 20 then perform app.fail('VALIDATION', 'Attestation is required'); end if;
  select * into v_inv from public.relationship_invitations
    where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if v_inv.id is null then perform app.fail('NOT_FOUND', 'Invitation not found'); end if;
  if v_inv.revoked_at is not null then perform app.fail('INVALID_STATE', 'Invitation was revoked'); end if;
  if v_inv.accepted_at is not null then perform app.fail('INVALID_STATE', 'Invitation already used'); end if;
  if v_inv.expires_at < now() then perform app.fail('INVALID_STATE', 'Invitation expired'); end if;
  if v_inv.learner_id = v_uid then perform app.fail('FORBIDDEN', 'You cannot accept your own invitation'); end if;

  update public.profiles set is_adult = true where id = v_uid;
  insert into public.supervisor_relationships (learner_id, supervisor_id, status, attestation_text, attestation_at)
  values (v_inv.learner_id, v_uid, 'ACTIVE', p_attestation_text, now())
  on conflict (learner_id, supervisor_id) where status <> 'REVOKED'
  do update set status = 'ACTIVE', attestation_text = excluded.attestation_text, attestation_at = now()
  returning id into v_rel_id;
  update public.relationship_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform app.audit('supervisor_relationship', v_rel_id, 'relationship_activated', null,
    jsonb_build_object('learner_id', v_inv.learner_id, 'invitation_id', v_inv.id));
  return jsonb_build_object('relationship_id', v_rel_id, 'learner_id', v_inv.learner_id);
end $$;

create or replace function app.revoke_relationship(p_relationship_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_rel public.supervisor_relationships%rowtype; v_uid uuid := app.uid();
begin
  select * into v_rel from public.supervisor_relationships where id = p_relationship_id for update;
  if v_rel.id is null or (v_rel.learner_id <> v_uid and v_rel.supervisor_id <> v_uid) then
    perform app.fail('NOT_FOUND', 'Relationship not found');
  end if;
  if v_rel.status = 'REVOKED' then return; end if;
  update public.supervisor_relationships set status = 'REVOKED', revoked_at = now(), revoked_by = v_uid where id = p_relationship_id;
  -- Revoked adults lose live access immediately.
  update public.session_participants sp set left_at = now(), can_view_live = false, can_observe = false
    from public.drive_sessions s
    where sp.session_id = s.id and sp.user_id = v_rel.supervisor_id and s.learner_id = v_rel.learner_id and sp.left_at is null;
  perform app.audit('supervisor_relationship', p_relationship_id, 'relationship_revoked', to_jsonb(v_rel), null, p_reason);
end $$;

create or replace function app.set_remote_live_view(p_relationship_id uuid, p_allow boolean)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_rel public.supervisor_relationships%rowtype;
begin
  select * into v_rel from public.supervisor_relationships where id = p_relationship_id for update;
  if v_rel.id is null or v_rel.learner_id <> app.uid() then perform app.fail('NOT_FOUND', 'Relationship not found'); end if;
  update public.supervisor_relationships set allow_remote_live_view = p_allow where id = p_relationship_id;
  perform app.audit('supervisor_relationship', p_relationship_id, 'remote_live_view_changed',
    jsonb_build_object('allow', v_rel.allow_remote_live_view), jsonb_build_object('allow', p_allow));
end $$;

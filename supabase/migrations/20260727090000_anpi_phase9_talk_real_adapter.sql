-- ANPI Phase 9 — Real TALK Adapter Foundation (shadow mode, local-only)
-- Audit verdict: B — reuse talk_notifications for future real path;
--   additive service_role write needed; NO user-facing writes in this phase.
-- Depends on Phase 2–8. Does not edit prior migrations or TALK sql/*.
--
-- Out of scope: production/staging TALK send · Push · Realtime · user inbox.

-- ---------------------------------------------------------------------------
-- Adapter mode config (service-side only; never client-writable)
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_talk_adapter_config (
  id smallint primary key default 1 check (id = 1),
  mode text not null default 'local',
  updated_at timestamptz not null default now(),
  constraint anpi_talk_adapter_config_mode_check check (
    mode in ('local', 'shadow')
  )
);

comment on table public.anpi_talk_adapter_config is
  'ANPI Phase 9 adapter mode. local|shadow only. real is never stored. service_role only.';

revoke all on table public.anpi_talk_adapter_config from public, anon, authenticated;
grant select, insert, update on table public.anpi_talk_adapter_config to service_role;

insert into public.anpi_talk_adapter_config (id, mode)
values (1, 'local')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Shadow notification fixture (NOT talk_notifications — no user inbox / unread)
-- Mirrors Talk row shape for mapping practice; never published to clients.
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_talk_shadow_notifications (
  id text primary key,
  idempotency_key text not null,
  template_key text not null references public.anpi_talk_templates (template_key),
  talk_type text not null default 'anpi',
  title_key text not null,
  body_key text not null,
  action_ids jsonb not null default '[]'::jsonb,
  -- Opaque recipient binding (auth uuid). No phone/email/name. service_role only.
  recipient_user_id uuid not null,
  check_id uuid,
  kind text not null,
  status text not null default 'accepted',
  cancel_reason text,
  source text not null default 'anpi_phase9_shadow',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint anpi_talk_shadow_status_check check (
    status in ('accepted', 'delivered', 'cancelled', 'failed')
  ),
  constraint anpi_talk_shadow_type_check check (talk_type = 'anpi'),
  constraint anpi_talk_shadow_source_check check (source = 'anpi_phase9_shadow'),
  constraint anpi_talk_shadow_no_url_title check (
    title_key !~* '(https?://|mailto:|tel:|<)'
    and body_key !~* '(https?://|mailto:|tel:|<)'
  ),
  constraint anpi_talk_shadow_idem_uidx unique (idempotency_key)
);

comment on table public.anpi_talk_shadow_notifications is
  'Phase 9 shadow fixtures only. Never shown in Talk inbox / unread / Realtime / Push.';

create index if not exists anpi_talk_shadow_expires_idx
  on public.anpi_talk_shadow_notifications (expires_at);

revoke all on table public.anpi_talk_shadow_notifications
  from public, anon, authenticated;
grant select, insert, update, delete on table public.anpi_talk_shadow_notifications
  to service_role;

-- ---------------------------------------------------------------------------
-- Mode helpers
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase9_normalize_mode(p_mode text)
returns text
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v text := lower(nullif(trim(coalesce(p_mode, '')), ''));
begin
  if v is null then
    return 'local';
  end if;
  if v = 'real' then
    raise exception using errcode = '22023', message = 'anpi_adapter_real_disabled';
  end if;
  if v not in ('local', 'shadow') then
    raise exception using errcode = '22023', message = 'anpi_adapter_invalid_mode';
  end if;
  return v;
end;
$$;

revoke all on function public.anpi_phase9_normalize_mode(text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_normalize_mode(text)
  to service_role;

create or replace function public.anpi_phase9_get_adapter_mode()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v text;
begin
  select mode into v from public.anpi_talk_adapter_config where id = 1;
  return public.anpi_phase9_normalize_mode(coalesce(v, 'local'));
end;
$$;

revoke all on function public.anpi_phase9_get_adapter_mode()
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_get_adapter_mode()
  to service_role;

create or replace function public.anpi_phase9_set_adapter_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v text := public.anpi_phase9_normalize_mode(p_mode);
begin
  insert into public.anpi_talk_adapter_config (id, mode, updated_at)
  values (1, v, clock_timestamp())
  on conflict (id) do update
    set mode = excluded.mode,
        updated_at = excluded.updated_at;
  return v;
end;
$$;

revoke all on function public.anpi_phase9_set_adapter_mode(text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_set_adapter_mode(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Fixed Talk mapping (title_key / body_key only — no HTML bodies, no URLs)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase9_map_contract_to_talk(p_contract jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_err text;
  v_template text;
  v_kind text;
  v_title text;
  v_body text;
  v_actions jsonb;
begin
  v_err := public.anpi_phase8_validate_contract(p_contract);
  if v_err is not null then
    raise exception using errcode = '22023', message = v_err;
  end if;

  v_template := p_contract->>'template_key';
  v_kind := p_contract->'parameters'->>'kind';
  v_actions := p_contract->'actions';

  v_title := v_template || '.title';
  v_body := v_template || '.body';

  -- Fixed catalog only — refuse unknown kinds already covered by Phase 8 validate.
  return jsonb_build_object(
    'talk_type', 'anpi',
    'title_key', v_title,
    'body_key', v_body,
    'action_ids', v_actions,
    'template_key', v_template,
    'kind', v_kind,
    'check_id', p_contract->'parameters'->>'check_id',
    'owner_id', p_contract->'parameters'->>'owner_id',
    'idempotency_key', p_contract->>'idempotency_key',
    'source', 'anpi_phase9_shadow',
    'priority', 'normal',
    -- Future real path would set target_url server-side; shadow stores none.
    'target_url', null
  );
end;
$$;

revoke all on function public.anpi_phase9_map_contract_to_talk(jsonb)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_map_contract_to_talk(jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- health / dryRun / status / cancel / send (shadow)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase9_adapter_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mode text := public.anpi_phase9_get_adapter_mode();
begin
  return jsonb_build_object(
    'ok', true,
    'adapter', 'talk_real_foundation',
    'mode', v_mode,
    'shadow', v_mode = 'shadow',
    'production_send', false,
    'push', false,
    'realtime', false,
    'user_facing_inbox', false,
    'templates', (select count(*)::integer from public.anpi_talk_templates where enabled),
    'actions', (select count(*)::integer from public.anpi_talk_actions where enabled),
    'shadow_table', to_regclass('public.anpi_talk_shadow_notifications') is not null,
    'talk_notifications_reuse_planned', true,
    'talk_notifications_write_enabled', false
  );
end;
$$;

revoke all on function public.anpi_phase9_adapter_health()
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_adapter_health()
  to service_role;

create or replace function public.anpi_phase9_adapter_dry_run(
  p_contract jsonb,
  p_mode text default null
)
returns table (
  status text,
  valid boolean,
  error_code text,
  template_key text,
  idempotency_key text,
  mapped jsonb,
  mode text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mode text := public.anpi_phase9_normalize_mode(
    coalesce(nullif(trim(coalesce(p_mode, '')), ''), public.anpi_phase9_get_adapter_mode())
  );
  v_err text;
  v_mapped jsonb;
begin
  mode := v_mode;
  v_err := public.anpi_phase8_validate_contract(p_contract);
  if v_err is not null then
    status := 'failed';
    valid := false;
    error_code := v_err;
    template_key := p_contract->>'template_key';
    idempotency_key := p_contract->>'idempotency_key';
    mapped := null;
    return next;
    return;
  end if;

  begin
    v_mapped := public.anpi_phase9_map_contract_to_talk(p_contract);
  exception when others then
    status := 'failed';
    valid := false;
    error_code := left(sqlerrm, 64);
    template_key := p_contract->>'template_key';
    idempotency_key := p_contract->>'idempotency_key';
    mapped := null;
    return next;
    return;
  end;

  status := 'accepted';
  valid := true;
  error_code := null;
  template_key := p_contract->>'template_key';
  idempotency_key := p_contract->>'idempotency_key';
  mapped := v_mapped;
  return next;
end;
$$;

revoke all on function public.anpi_phase9_adapter_dry_run(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_adapter_dry_run(jsonb, text)
  to service_role;

create or replace function public.anpi_phase9_adapter_status(p_idempotency_key text)
returns table (
  status text,
  template_key text,
  provider_message_id text,
  error_code text,
  receipt_found boolean,
  shadow_found boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_receipt public.anpi_talk_adapter_receipts%rowtype;
  v_shadow public.anpi_talk_shadow_notifications%rowtype;
  v_has_receipt boolean := false;
  v_has_shadow boolean := false;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception using errcode = '22023', message = 'anpi_invalid_idempotency_key';
  end if;

  select * into v_receipt
  from public.anpi_talk_adapter_receipts r
  where r.idempotency_key = p_idempotency_key;
  v_has_receipt := found;

  select * into v_shadow
  from public.anpi_talk_shadow_notifications s
  where s.idempotency_key = p_idempotency_key;
  v_has_shadow := found;

  if not v_has_receipt and not v_has_shadow then
    status := null;
    template_key := null;
    provider_message_id := null;
    error_code := null;
    receipt_found := false;
    shadow_found := false;
    return next;
    return;
  end if;

  status := coalesce(v_receipt.status, v_shadow.status);
  template_key := coalesce(v_receipt.template_key, v_shadow.template_key);
  provider_message_id := coalesce(
    v_receipt.provider_message_id,
    case when v_has_shadow then 'shadow:' || v_shadow.id else null end
  );
  error_code := coalesce(v_receipt.error_code, v_shadow.cancel_reason);
  receipt_found := v_has_receipt;
  shadow_found := v_has_shadow;
  return next;
end;
$$;

revoke all on function public.anpi_phase9_adapter_status(text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_adapter_status(text)
  to service_role;

create or replace function public.anpi_phase9_adapter_cancel(
  p_idempotency_key text,
  p_reason text default 'anpi_cancelled',
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  already_terminal boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reason text := left(coalesce(nullif(p_reason, ''), 'anpi_cancelled'), 64);
  v_shadow public.anpi_talk_shadow_notifications%rowtype;
  v_phase8 record;
begin
  -- Phase 8 receipt cancel (idempotent)
  select * into v_phase8
  from public.anpi_phase8_adapter_cancel(p_idempotency_key, v_reason, p_now);

  select * into v_shadow
  from public.anpi_talk_shadow_notifications s
  where s.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_shadow.status in ('delivered', 'cancelled', 'failed') then
      status := v_shadow.status;
      already_terminal := true;
      return next;
      return;
    end if;
    update public.anpi_talk_shadow_notifications s
    set status = 'cancelled',
        cancel_reason = v_reason,
        updated_at = p_now
    where s.idempotency_key = p_idempotency_key
    returning * into v_shadow;
    status := v_shadow.status;
    already_terminal := false;
    return next;
    return;
  end if;

  status := coalesce(v_phase8.status, 'cancelled');
  already_terminal := coalesce(v_phase8.already_terminal, false);
  return next;
end;
$$;

revoke all on function public.anpi_phase9_adapter_cancel(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_adapter_cancel(text, text, timestamptz)
  to service_role;

create or replace function public.anpi_phase9_adapter_send(
  p_contract jsonb,
  p_recipient_user_id uuid,
  p_mode text default null,
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  provider_message_id text,
  error_code text,
  already_seen boolean,
  stub_result text,
  mode text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mode text;
  v_err text;
  v_key text;
  v_template text;
  v_mapped jsonb;
  v_shadow public.anpi_talk_shadow_notifications%rowtype;
  v_id text;
  v_job_id uuid;
  v_job public.anpi_scheduler_jobs%rowtype;
  v_reason text;
  v_check_id uuid;
  v_kind text;
  v_p8 record;
begin
  v_mode := public.anpi_phase9_normalize_mode(
    coalesce(nullif(trim(coalesce(p_mode, '')), ''), public.anpi_phase9_get_adapter_mode())
  );
  mode := v_mode;

  if v_mode = 'local' then
    -- Delegate to Phase 8 local stub path (no shadow / no talk_notifications).
    select * into v_p8
    from public.anpi_phase8_adapter_send(p_contract, 'success', p_now);
    status := v_p8.status;
    provider_message_id := v_p8.provider_message_id;
    error_code := v_p8.error_code;
    already_seen := v_p8.already_seen;
    stub_result := v_p8.stub_result;
    return next;
    return;
  end if;

  -- shadow mode only beyond this point (real already rejected by normalize)
  v_err := public.anpi_phase8_validate_contract(p_contract);
  if v_err is not null then
    status := 'failed';
    provider_message_id := null;
    error_code := v_err;
    already_seen := false;
    stub_result := null;
    return next;
    return;
  end if;

  if p_recipient_user_id is null then
    status := 'failed';
    provider_message_id := null;
    error_code := 'anpi_invalid_recipient';
    already_seen := false;
    stub_result := null;
    return next;
    return;
  end if;

  v_key := p_contract->>'idempotency_key';
  v_template := p_contract->>'template_key';
  v_job_id := nullif(p_contract->>'scheduler_job_id', '')::uuid;
  v_check_id := nullif(p_contract->'parameters'->>'check_id', '')::uuid;
  v_kind := p_contract->'parameters'->>'kind';

  -- Pre-send eligibility when job id present
  if v_job_id is not null then
    select * into v_job from public.anpi_scheduler_jobs where id = v_job_id;
    if found then
      v_reason := public.anpi_phase6_job_deliverable(v_job);
      if v_reason is not null then
        perform public.anpi_phase9_adapter_cancel(v_key, v_reason, p_now);
        status := 'cancelled';
        provider_message_id := null;
        error_code := v_reason;
        already_seen := false;
        stub_result := null;
        return next;
        return;
      end if;
      if v_job.recipient_user_id is distinct from p_recipient_user_id then
        status := 'failed';
        provider_message_id := null;
        error_code := 'anpi_recipient_mismatch';
        already_seen := false;
        stub_result := null;
        return next;
        return;
      end if;
    end if;
  end if;

  select * into v_shadow
  from public.anpi_talk_shadow_notifications s
  where s.idempotency_key = v_key
  for update;

  if found then
    if v_shadow.status = 'cancelled' then
      status := 'cancelled';
      provider_message_id := 'shadow:' || v_shadow.id;
      error_code := coalesce(v_shadow.cancel_reason, 'anpi_cancelled');
      already_seen := true;
      stub_result := null;
      return next;
      return;
    end if;
    if v_shadow.status = 'delivered' then
      status := 'delivered';
      provider_message_id := 'shadow:' || v_shadow.id;
      error_code := null;
      already_seen := true;
      stub_result := 'success';
      return next;
      return;
    end if;
  end if;

  -- Honor prior Phase 8 / cancel receipt (cancel-before-send)
  if exists (
    select 1
    from public.anpi_talk_adapter_receipts r
    where r.idempotency_key = v_key
      and r.status = 'cancelled'
  ) then
    status := 'cancelled';
    provider_message_id := null;
    error_code := coalesce(
      (select r.error_code from public.anpi_talk_adapter_receipts r where r.idempotency_key = v_key),
      'anpi_cancelled'
    );
    already_seen := true;
    stub_result := null;
    return next;
    return;
  end if;

  v_mapped := public.anpi_phase9_map_contract_to_talk(p_contract);
  -- Stable id from idempotency key (mirrors live-notify event_key pattern)
  v_id := 'anpi-shadow:' || encode(extensions.digest(v_key, 'sha256'), 'hex');

  insert into public.anpi_talk_shadow_notifications (
    id, idempotency_key, template_key, talk_type,
    title_key, body_key, action_ids,
    recipient_user_id, check_id, kind,
    status, source, priority, created_at, updated_at, expires_at
  ) values (
    v_id, v_key, v_template, 'anpi',
    v_mapped->>'title_key', v_mapped->>'body_key', coalesce(v_mapped->'action_ids', '[]'::jsonb),
    p_recipient_user_id, v_check_id, v_kind,
    'delivered', 'anpi_phase9_shadow', 'normal',
    p_now, p_now, p_now + interval '7 days'
  )
  on conflict (idempotency_key) do update
    set updated_at = p_now
  returning * into v_shadow;

  -- Align Phase 8 receipt ledger (no second provider message)
  insert into public.anpi_talk_adapter_receipts (
    idempotency_key, template_key, status, provider_message_id, stub_mode,
    error_code, created_at, updated_at
  ) values (
    v_key, v_template, 'delivered', 'shadow:' || v_shadow.id, 'success',
    null, p_now, p_now
  )
  on conflict (idempotency_key) do update
    set status = case
          when public.anpi_talk_adapter_receipts.status = 'cancelled'
            then public.anpi_talk_adapter_receipts.status
          else 'delivered'
        end,
        provider_message_id = coalesce(
          public.anpi_talk_adapter_receipts.provider_message_id,
          'shadow:' || excluded.provider_message_id
        ),
        updated_at = p_now;

  -- Never insert into public.talk_notifications in Phase 9.

  status := 'delivered';
  provider_message_id := 'shadow:' || v_shadow.id;
  error_code := null;
  already_seen := false;
  stub_result := 'success';
  return next;
end;
$$;

comment on function public.anpi_phase9_adapter_send(jsonb, uuid, text, timestamptz) is
  'Phase 9 Real Adapter foundation: local delegates to Phase 8; shadow writes anpi_talk_shadow_notifications only. Never talk_notifications. real disabled.';

revoke all on function public.anpi_phase9_adapter_send(jsonb, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_adapter_send(jsonb, uuid, text, timestamptz)
  to service_role;

-- Convenience: send for job (eligibility + recipient from job)
create or replace function public.anpi_phase9_adapter_send_for_job(
  p_job_id uuid,
  p_mode text default null,
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  provider_message_id text,
  error_code text,
  already_seen boolean,
  stub_result text,
  mode text,
  contract jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_contract jsonb;
  v_reason text;
  v_out record;
begin
  select * into v_job from public.anpi_scheduler_jobs where id = p_job_id;
  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  v_contract := public.anpi_phase8_build_notification_contract(p_job_id);
  v_reason := public.anpi_phase6_job_deliverable(v_job);
  if v_reason is not null then
    perform public.anpi_phase9_adapter_cancel(
      v_contract->>'idempotency_key', v_reason, p_now
    );
    status := 'cancelled';
    provider_message_id := null;
    error_code := v_reason;
    already_seen := false;
    stub_result := null;
    mode := public.anpi_phase9_normalize_mode(
      coalesce(nullif(trim(coalesce(p_mode, '')), ''), public.anpi_phase9_get_adapter_mode())
    );
    contract := v_contract;
    return next;
    return;
  end if;

  select * into v_out
  from public.anpi_phase9_adapter_send(
    v_contract, v_job.recipient_user_id, p_mode, p_now
  );

  status := v_out.status;
  provider_message_id := v_out.provider_message_id;
  error_code := v_out.error_code;
  already_seen := v_out.already_seen;
  stub_result := v_out.stub_result;
  mode := v_out.mode;
  contract := v_contract;
  return next;
end;
$$;

revoke all on function public.anpi_phase9_adapter_send_for_job(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_adapter_send_for_job(uuid, text, timestamptz)
  to service_role;

-- Purge expired shadow fixtures (local maintenance; no user-facing effect)
create or replace function public.anpi_phase9_purge_expired_shadow(
  p_now timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
begin
  delete from public.anpi_talk_shadow_notifications s
  where s.expires_at < p_now;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.anpi_phase9_purge_expired_shadow(timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase9_purge_expired_shadow(timestamptz)
  to service_role;

-- Explicit: no ALTER on public.talk_notifications. No Push/Realtime hooks.

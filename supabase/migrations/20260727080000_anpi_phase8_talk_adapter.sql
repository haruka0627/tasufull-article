-- ANPI Phase 8 — TALK Integration (Local Adapter)
-- Local only. Do not apply to Staging/Production without review.
-- Depends on Phase 2–6. Does not edit prior migration files.
--
-- Worker → Talk Adapter Interface → Local TALK Stub → Receipt
-- Real TALK / Push / LINE / SMS / email / Realtime are OUT OF SCOPE.

-- ---------------------------------------------------------------------------
-- Template catalog (extensible; keys only — no HTML bodies)
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_talk_templates (
  template_key text primary key,
  kind text,
  description_safe text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint anpi_talk_templates_key_check check (
    template_key ~ '^anpi\.[a-z0-9_]+$'
    and char_length(template_key) between 6 and 64
  ),
  constraint anpi_talk_templates_kind_check check (
    kind is null
    or kind in ('initial', 'reminder', 'contact_unconfirmed', 'late_confirmation', 'system_notice', 'delivery_failed')
  ),
  constraint anpi_talk_templates_desc_check check (
    char_length(description_safe) between 1 and 200
    and description_safe !~* '(<script|https?://|mailto:|tel:)'
  )
);

comment on table public.anpi_talk_templates is
  'ANPI Phase 8 template keys only. No HTML, URLs, or rendered bodies.';

revoke all on table public.anpi_talk_templates from public, anon, authenticated;
grant select on table public.anpi_talk_templates to service_role;

insert into public.anpi_talk_templates (template_key, kind, description_safe) values
  ('anpi.initial', 'initial', 'Daily initial check-in notification'),
  ('anpi.reminder', 'reminder', 'Reminder before overdue'),
  ('anpi.contact_unconfirmed', 'contact_unconfirmed', 'Emergency contact unconfirmed notice'),
  ('anpi.late_confirmation', 'late_confirmation', 'Late confirmation notice'),
  ('anpi.system_notice', 'system_notice', 'System notice'),
  ('anpi.delivery_failed', 'delivery_failed', 'Delivery failure audit template')
on conflict (template_key) do nothing;

-- ---------------------------------------------------------------------------
-- Action catalog (IDs only — no screen URLs)
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_talk_actions (
  action_id text primary key,
  description_safe text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint anpi_talk_actions_id_check check (
    action_id ~ '^[a-z][a-z0-9_]*$'
    and char_length(action_id) between 2 and 32
  ),
  constraint anpi_talk_actions_desc_check check (
    char_length(description_safe) between 1 and 200
    and description_safe !~* '(https?://|/anpi|/talk|<)'
  )
);

comment on table public.anpi_talk_actions is
  'ANPI Phase 8 action IDs only. Clients resolve UI routes; adapter never stores URLs.';

revoke all on table public.anpi_talk_actions from public, anon, authenticated;
grant select on table public.anpi_talk_actions to service_role;

insert into public.anpi_talk_actions (action_id, description_safe) values
  ('open_check', 'Open today check'),
  ('confirm', 'Confirm check-in'),
  ('view_history', 'View check history'),
  ('dashboard', 'Open ANPI dashboard'),
  ('history', 'Alias for view_history')
on conflict (action_id) do nothing;

-- ---------------------------------------------------------------------------
-- Adapter receipt ledger (local; maps provider outcome without PII)
-- ---------------------------------------------------------------------------

create table if not exists public.anpi_talk_adapter_receipts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  template_key text not null references public.anpi_talk_templates (template_key),
  status text not null,
  provider_message_id text,
  stub_mode text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anpi_talk_adapter_receipts_status_check check (
    status in ('received', 'accepted', 'delivered', 'cancelled', 'failed')
  ),
  constraint anpi_talk_adapter_receipts_key_check check (
    char_length(idempotency_key) between 8 and 200
  ),
  constraint anpi_talk_adapter_receipts_idem_uidx unique (idempotency_key)
);

comment on table public.anpi_talk_adapter_receipts is
  'Phase 8 local adapter receipts. No payload bodies, destinations, or secrets.';

revoke all on table public.anpi_talk_adapter_receipts from public, anon, authenticated;
grant select, insert, update on table public.anpi_talk_adapter_receipts to service_role;

-- ---------------------------------------------------------------------------
-- Kind → template + default actions
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase8_template_for_kind(p_kind text)
returns text
language plpgsql
stable
set search_path = pg_catalog, public
as $$
begin
  return case p_kind
    when 'initial' then 'anpi.initial'
    when 'reminder' then 'anpi.reminder'
    when 'contact_unconfirmed' then 'anpi.contact_unconfirmed'
    when 'late_confirmation' then 'anpi.late_confirmation'
    when 'system_notice' then 'anpi.system_notice'
    else null
  end;
end;
$$;

revoke all on function public.anpi_phase8_template_for_kind(text) from public, anon, authenticated;
grant execute on function public.anpi_phase8_template_for_kind(text) to service_role;

create or replace function public.anpi_phase8_default_actions(p_kind text)
returns text[]
language plpgsql
stable
set search_path = pg_catalog, public
as $$
begin
  return case p_kind
    when 'contact_unconfirmed' then array['open_check', 'view_history', 'dashboard']
    when 'delivery_failed' then array['dashboard', 'view_history']
    else array['open_check', 'confirm', 'view_history', 'dashboard']
  end;
end;
$$;

revoke all on function public.anpi_phase8_default_actions(text) from public, anon, authenticated;
grant execute on function public.anpi_phase8_default_actions(text) to service_role;

-- ---------------------------------------------------------------------------
-- Notification contract builder (template_key + parameters + actions)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase8_build_notification_contract(
  p_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_attempt integer;
  v_key text;
  v_template text;
  v_actions text[];
  v_action text;
begin
  if p_job_id is null then
    raise exception using errcode = '22023', message = 'anpi_invalid_job_id';
  end if;

  select * into v_job
  from public.anpi_scheduler_jobs j
  where j.id = p_job_id;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  v_template := public.anpi_phase8_template_for_kind(v_job.kind);
  if v_template is null
     or not exists (
       select 1 from public.anpi_talk_templates t
       where t.template_key = v_template and t.enabled
     ) then
    raise exception using errcode = '22000', message = 'anpi_unknown_template';
  end if;

  v_actions := public.anpi_phase8_default_actions(v_job.kind);
  foreach v_action in array v_actions loop
    if not exists (
      select 1 from public.anpi_talk_actions a
      where a.action_id = v_action and a.enabled
    ) then
      raise exception using errcode = '22000', message = 'anpi_unknown_action';
    end if;
  end loop;

  v_attempt := greatest(v_job.attempt_count, 1);
  v_key := public.anpi_phase6_idempotency_key(v_job.id, v_attempt);

  -- parameters: ids + kind only. No HTML, URLs, phones, emails, secrets.
  return jsonb_build_object(
    'schema', 'anpi.talk.contract.v1',
    'template_key', v_template,
    'parameters', jsonb_build_object(
      'check_id', v_job.check_id,
      'owner_id', v_job.subject_user_id,
      'kind', v_job.kind
    ),
    'actions', to_jsonb(v_actions),
    'idempotency_key', v_key,
    'channel', 'talk',
    'scheduler_job_id', v_job.id,
    'attempt_number', v_attempt
  );
end;
$$;

comment on function public.anpi_phase8_build_notification_contract(uuid) is
  'Service-only ANPI→TALK contract: template_key + parameters + action IDs. No HTML/URLs/PII bodies.';

revoke all on function public.anpi_phase8_build_notification_contract(uuid)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_build_notification_contract(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Contract validation (rejects HTML / URLs / secrets / forbidden keys)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase8_validate_contract(p_contract jsonb)
returns text
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_template text;
  v_actions jsonb;
  v_action text;
  v_params jsonb;
  v_key text;
  v_dump text;
begin
  if p_contract is null or jsonb_typeof(p_contract) <> 'object' then
    return 'anpi_invalid_contract';
  end if;

  v_dump := p_contract::text;
  if v_dump ~* '(<script|<html|https?://|mailto:|tel:|service_role|sb_secret|eyJ)' then
    return 'anpi_contract_forbidden_content';
  end if;

  if p_contract ? 'html' or p_contract ? 'body' or p_contract ? 'url'
     or p_contract ? 'phone' or p_contract ? 'email' or p_contract ? 'secret' then
    return 'anpi_contract_forbidden_field';
  end if;

  v_template := p_contract->>'template_key';
  if v_template is null or not exists (
    select 1 from public.anpi_talk_templates t
    where t.template_key = v_template and t.enabled
  ) then
    return 'anpi_unknown_template';
  end if;

  v_key := p_contract->>'idempotency_key';
  if v_key is null or char_length(v_key) < 8 or char_length(v_key) > 200 then
    return 'anpi_invalid_idempotency_key';
  end if;

  v_params := p_contract->'parameters';
  if v_params is null or jsonb_typeof(v_params) <> 'object' then
    return 'anpi_invalid_parameters';
  end if;
  if not (v_params ? 'check_id' and v_params ? 'kind') then
    return 'anpi_parameters_incomplete';
  end if;
  if v_params ? 'phone' or v_params ? 'email' or v_params ? 'destination' then
    return 'anpi_parameters_forbidden';
  end if;

  v_actions := p_contract->'actions';
  if v_actions is null or jsonb_typeof(v_actions) <> 'array' or jsonb_array_length(v_actions) < 1 then
    return 'anpi_invalid_actions';
  end if;

  for v_action in select jsonb_array_elements_text(v_actions)
  loop
    if not exists (
      select 1 from public.anpi_talk_actions a
      where a.action_id = v_action and a.enabled
    ) then
      return 'anpi_unknown_action';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.anpi_phase8_validate_contract(jsonb)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_validate_contract(jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Adapter: health / dryRun / status / cancel / send
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase8_adapter_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return jsonb_build_object(
    'ok', true,
    'adapter', 'talk_local',
    'mode', 'local_stub',
    'templates', (select count(*)::integer from public.anpi_talk_templates where enabled),
    'actions', (select count(*)::integer from public.anpi_talk_actions where enabled),
    'realtime', false,
    'push', false,
    'production', false
  );
end;
$$;

revoke all on function public.anpi_phase8_adapter_health() from public, anon, authenticated;
grant execute on function public.anpi_phase8_adapter_health() to service_role;

create or replace function public.anpi_phase8_adapter_dry_run(p_contract jsonb)
returns table (
  status text,
  valid boolean,
  error_code text,
  template_key text,
  idempotency_key text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_err text;
begin
  v_err := public.anpi_phase8_validate_contract(p_contract);
  status := case when v_err is null then 'accepted' else 'failed' end;
  valid := v_err is null;
  error_code := v_err;
  template_key := p_contract->>'template_key';
  idempotency_key := p_contract->>'idempotency_key';
  return next;
end;
$$;

revoke all on function public.anpi_phase8_adapter_dry_run(jsonb)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_adapter_dry_run(jsonb)
  to service_role;

drop function if exists public.anpi_phase8_adapter_status(text);

create or replace function public.anpi_phase8_adapter_status(p_idempotency_key text)
returns table (
  status text,
  template_key text,
  provider_message_id text,
  error_code text,
  receipt_found boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.anpi_talk_adapter_receipts%rowtype;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception using errcode = '22023', message = 'anpi_invalid_idempotency_key';
  end if;

  select * into v_row
  from public.anpi_talk_adapter_receipts r
  where r.idempotency_key = p_idempotency_key;

  if not found then
    status := null;
    template_key := null;
    provider_message_id := null;
    error_code := null;
    receipt_found := false;
    return next;
    return;
  end if;

  status := v_row.status;
  template_key := v_row.template_key;
  provider_message_id := v_row.provider_message_id;
  error_code := v_row.error_code;
  receipt_found := true;
  return next;
end;
$$;

revoke all on function public.anpi_phase8_adapter_status(text)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_adapter_status(text)
  to service_role;

create or replace function public.anpi_phase8_adapter_cancel(
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
  v_row public.anpi_talk_adapter_receipts%rowtype;
  v_reason text := left(coalesce(nullif(p_reason, ''), 'anpi_cancelled'), 64);
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception using errcode = '22023', message = 'anpi_invalid_idempotency_key';
  end if;

  select * into v_row
  from public.anpi_talk_adapter_receipts r
  where r.idempotency_key = p_idempotency_key
  for update;

  if not found then
    insert into public.anpi_talk_adapter_receipts (
      idempotency_key, template_key, status, error_code, created_at, updated_at
    ) values (
      p_idempotency_key, 'anpi.system_notice', 'cancelled', v_reason, p_now, p_now
    )
    on conflict (idempotency_key) do update
      set status = case
            when public.anpi_talk_adapter_receipts.status in ('delivered', 'cancelled', 'failed')
              then public.anpi_talk_adapter_receipts.status
            else 'cancelled'
          end,
          error_code = coalesce(public.anpi_talk_adapter_receipts.error_code, v_reason),
          updated_at = p_now
    returning * into v_row;

    status := v_row.status;
    already_terminal := v_row.status in ('delivered', 'failed');
    return next;
    return;
  end if;

  if v_row.status in ('delivered', 'cancelled', 'failed') then
    status := v_row.status;
    already_terminal := true;
    return next;
    return;
  end if;

  update public.anpi_talk_adapter_receipts r
  set status = 'cancelled',
      error_code = v_reason,
      updated_at = p_now
  where r.id = v_row.id
  returning * into v_row;

  status := v_row.status;
  already_terminal := false;
  return next;
end;
$$;

revoke all on function public.anpi_phase8_adapter_cancel(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_adapter_cancel(text, text, timestamptz)
  to service_role;

create or replace function public.anpi_phase8_adapter_send(
  p_contract jsonb,
  p_stub_mode text default 'success',
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  provider_message_id text,
  error_code text,
  already_seen boolean,
  stub_result text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_err text;
  v_key text;
  v_template text;
  v_existing public.anpi_talk_adapter_receipts%rowtype;
  v_stub record;
  v_mapped text;
begin
  -- received
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

  if p_stub_mode is null
     or p_stub_mode not in ('success', 'retryable_failure', 'terminal_failure', 'timeout') then
    status := 'failed';
    provider_message_id := null;
    error_code := 'anpi_invalid_stub_mode';
    already_seen := false;
    stub_result := null;
    return next;
    return;
  end if;

  v_key := p_contract->>'idempotency_key';
  v_template := p_contract->>'template_key';

  select * into v_existing
  from public.anpi_talk_adapter_receipts r
  where r.idempotency_key = v_key
  for update;

  if found then
    if v_existing.status = 'cancelled' then
      status := 'cancelled';
      provider_message_id := v_existing.provider_message_id;
      error_code := coalesce(v_existing.error_code, 'anpi_cancelled');
      already_seen := true;
      stub_result := null;
      return next;
      return;
    end if;
    if v_existing.status = 'delivered' then
      status := 'delivered';
      provider_message_id := v_existing.provider_message_id;
      error_code := null;
      already_seen := true;
      stub_result := 'success';
      return next;
      return;
    end if;
    if v_existing.status = 'failed' and v_existing.stub_mode = 'terminal_failure' then
      status := 'failed';
      provider_message_id := v_existing.provider_message_id;
      error_code := coalesce(v_existing.error_code, 'terminal_failure');
      already_seen := true;
      stub_result := 'terminal_failure';
      return next;
      return;
    end if;
  else
    insert into public.anpi_talk_adapter_receipts (
      idempotency_key, template_key, status, stub_mode, created_at, updated_at
    ) values (
      v_key, v_template, 'accepted', p_stub_mode, p_now, p_now
    )
    on conflict (idempotency_key) do nothing;

    select * into v_existing
    from public.anpi_talk_adapter_receipts r
    where r.idempotency_key = v_key
    for update;
  end if;

  -- Local stub only — never calls real TALK / network.
  select * into v_stub
  from public.anpi_phase6_talk_stub_send(v_key, p_stub_mode, p_now);

  if v_stub.result = 'success' then
    v_mapped := 'delivered';
  else
    v_mapped := 'failed';
  end if;

  update public.anpi_talk_adapter_receipts r
  set status = v_mapped,
      provider_message_id = v_stub.provider_message_id,
      stub_mode = coalesce(r.stub_mode, p_stub_mode),
      error_code = case when v_mapped = 'failed' then v_stub.result else null end,
      updated_at = p_now
  where r.idempotency_key = v_key
  returning * into v_existing;

  status := v_existing.status;
  provider_message_id := v_existing.provider_message_id;
  error_code := v_existing.error_code;
  already_seen := v_stub.already_seen;
  stub_result := v_stub.result;
  return next;
end;
$$;

comment on function public.anpi_phase8_adapter_send(jsonb, text, timestamptz) is
  'Local Talk Adapter send(): validate contract → stub → receipt. No real provider.';

revoke all on function public.anpi_phase8_adapter_send(jsonb, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_adapter_send(jsonb, text, timestamptz)
  to service_role;

-- Convenience: build contract from job + send (worker-facing seam)
create or replace function public.anpi_phase8_adapter_send_for_job(
  p_job_id uuid,
  p_stub_mode text default 'success',
  p_now timestamptz default clock_timestamp()
)
returns table (
  status text,
  provider_message_id text,
  error_code text,
  already_seen boolean,
  stub_result text,
  contract jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_contract jsonb;
  v_out record;
  v_reason text;
  v_job public.anpi_scheduler_jobs%rowtype;
begin
  select * into v_job from public.anpi_scheduler_jobs where id = p_job_id;
  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  -- Confirm / eligibility cancel before adapter send (Phase 6 deliverable).
  v_reason := public.anpi_phase6_job_deliverable(v_job);
  if v_reason is not null then
    v_contract := public.anpi_phase8_build_notification_contract(p_job_id);
    perform public.anpi_phase8_adapter_cancel(
      v_contract->>'idempotency_key', v_reason, p_now
    );
    status := 'cancelled';
    provider_message_id := null;
    error_code := v_reason;
    already_seen := false;
    stub_result := null;
    contract := v_contract;
    return next;
    return;
  end if;

  v_contract := public.anpi_phase8_build_notification_contract(p_job_id);
  select * into v_out
  from public.anpi_phase8_adapter_send(v_contract, p_stub_mode, p_now);

  status := v_out.status;
  provider_message_id := v_out.provider_message_id;
  error_code := v_out.error_code;
  already_seen := v_out.already_seen;
  stub_result := v_out.stub_result;
  contract := v_contract;
  return next;
end;
$$;

revoke all on function public.anpi_phase8_adapter_send_for_job(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.anpi_phase8_adapter_send_for_job(uuid, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Wire Phase 6 process path through adapter (create or replace; Phase 6 file untouched)
-- ---------------------------------------------------------------------------

create or replace function public.anpi_phase6_process_claimed_job(
  p_job_id uuid,
  p_worker_id text,
  p_stub_mode text default 'success',
  p_now timestamptz default clock_timestamp(),
  p_retry_after interval default interval '5 minutes'
)
returns table (
  job_id uuid,
  job_status text,
  delivery_id uuid,
  delivery_status text,
  attempt_number integer,
  outcome text,
  skip_reason text,
  provider_message_id text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.anpi_scheduler_jobs%rowtype;
  v_reason text;
  v_attempt integer;
  v_key text;
  v_delivery public.anpi_notification_deliveries%rowtype;
  v_adapter record;
  v_retry boolean;
  v_backoff interval;
  v_stub_result text;
begin
  if p_worker_id is null or char_length(p_worker_id) < 1 or char_length(p_worker_id) > 64 then
    raise exception using errcode = '22023', message = 'anpi_invalid_worker_id';
  end if;

  select * into v_job
  from public.anpi_scheduler_jobs j
  where j.id = p_job_id
  for update;

  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  if v_job.status in ('sent', 'failed', 'cancelled', 'skipped') then
    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := null;
    delivery_status := null;
    attempt_number := v_job.attempt_count;
    outcome := 'already_terminal';
    skip_reason := null;
    provider_message_id := null;
    return next;
    return;
  end if;

  if v_job.status <> 'processing'
     or v_job.claimed_by is distinct from p_worker_id then
    raise exception using errcode = '22000', message = 'anpi_job_not_claimable';
  end if;

  v_reason := public.anpi_phase6_job_deliverable(v_job);
  if v_reason is not null then
    update public.anpi_scheduler_jobs j
    set status = 'cancelled',
        completed_at = p_now,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        last_error_safe = v_reason
    where j.id = v_job.id
    returning * into v_job;

    v_attempt := greatest(v_job.attempt_count, 1);
    v_key := public.anpi_phase6_idempotency_key(v_job.id, v_attempt);
    perform public.anpi_phase8_adapter_cancel(v_key, v_reason, p_now);

    begin
      insert into public.anpi_notification_deliveries (
        scheduler_job_id, check_id, recipient_user_id, contact_id,
        channel, kind, status, provider, attempt_count, attempt_number,
        idempotency_key, claimed_at, started_at, cancelled_at,
        failure_code, retryable
      ) values (
        v_job.id, v_job.check_id, v_job.recipient_user_id, v_job.contact_id,
        v_job.channel, v_job.kind, 'cancelled', 'talk_local_adapter',
        v_attempt, v_attempt, v_key, v_job.claimed_at, p_now, p_now,
        v_reason, false
      )
      returning * into v_delivery;
    exception when unique_violation then
      select * into v_delivery
      from public.anpi_notification_deliveries d
      where d.scheduler_job_id = v_job.id
        and d.attempt_number = v_attempt;
    end;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := coalesce(v_delivery.status, 'cancelled');
    attempt_number := v_attempt;
    outcome := 'cancelled';
    skip_reason := v_reason;
    provider_message_id := null;
    return next;
    return;
  end if;

  v_attempt := greatest(v_job.attempt_count, 1);
  v_key := public.anpi_phase6_idempotency_key(v_job.id, v_attempt);

  select * into v_delivery
  from public.anpi_notification_deliveries d
  where d.scheduler_job_id = v_job.id
    and d.attempt_number = v_attempt
  for update;

  if not found then
    begin
      insert into public.anpi_notification_deliveries (
        scheduler_job_id, check_id, recipient_user_id, contact_id,
        channel, kind, status, provider, attempt_count, attempt_number,
        idempotency_key, claimed_at, started_at, retryable
      ) values (
        v_job.id, v_job.check_id, v_job.recipient_user_id, v_job.contact_id,
        v_job.channel, v_job.kind, 'processing', 'talk_local_adapter',
        v_attempt, v_attempt, v_key, coalesce(v_job.claimed_at, p_now), p_now, null
      )
      returning * into v_delivery;
    exception when unique_violation then
      select * into v_delivery
      from public.anpi_notification_deliveries d
      where d.scheduler_job_id = v_job.id
        and d.attempt_number = v_attempt
      for update;
    end;

    if v_delivery.id is null then
      raise exception using errcode = '22000', message = 'anpi_delivery_attempt_missing';
    end if;
  end if;

  if v_delivery.status = 'delivered' then
    update public.anpi_scheduler_jobs j
    set status = 'sent',
        completed_at = coalesce(j.completed_at, p_now),
        lease_expires_at = null,
        last_error_safe = null
    where j.id = v_job.id
    returning * into v_job;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := v_delivery.status;
    attempt_number := v_attempt;
    outcome := 'delivered';
    skip_reason := null;
    provider_message_id := v_delivery.provider_message_id;
    return next;
    return;
  end if;

  -- Phase 8: Talk Adapter Interface (not direct stub)
  select * into v_adapter
  from public.anpi_phase8_adapter_send(
    public.anpi_phase8_build_notification_contract(v_job.id),
    p_stub_mode,
    p_now
  );

  if v_adapter.status = 'cancelled' then
    update public.anpi_scheduler_jobs j
    set status = 'cancelled',
        completed_at = p_now,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        last_error_safe = coalesce(v_adapter.error_code, 'anpi_cancelled')
    where j.id = v_job.id
    returning * into v_job;

    update public.anpi_notification_deliveries d
    set status = 'cancelled',
        cancelled_at = p_now,
        failure_code = v_adapter.error_code,
        retryable = false
    where d.id = v_delivery.id
    returning * into v_delivery;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := v_delivery.status;
    attempt_number := v_attempt;
    outcome := 'cancelled';
    skip_reason := v_adapter.error_code;
    provider_message_id := null;
    return next;
    return;
  end if;

  v_stub_result := coalesce(v_adapter.stub_result, v_adapter.error_code);

  if v_adapter.status = 'delivered' then
    update public.anpi_notification_deliveries d
    set status = 'delivered',
        provider_message_id = v_adapter.provider_message_id,
        delivered_at = coalesce(d.delivered_at, p_now),
        sent_at = coalesce(d.sent_at, p_now),
        failed_at = null,
        failure_code = null,
        failure_detail_safe = null,
        retryable = false,
        provider = 'talk_local_adapter'
    where d.id = v_delivery.id
    returning * into v_delivery;

    update public.anpi_scheduler_jobs j
    set status = 'sent',
        completed_at = p_now,
        lease_expires_at = null,
        last_error_safe = null
    where j.id = v_job.id
    returning * into v_job;

    job_id := v_job.id;
    job_status := v_job.status;
    delivery_id := v_delivery.id;
    delivery_status := v_delivery.status;
    attempt_number := v_attempt;
    outcome := 'delivered';
    skip_reason := null;
    provider_message_id := v_delivery.provider_message_id;
    return next;
    return;
  end if;

  v_retry := (coalesce(v_stub_result, '') in ('retryable_failure', 'timeout'))
    and v_attempt < 5;
  v_backoff := case
    when v_attempt <= 1 then coalesce(p_retry_after, interval '5 minutes')
    when v_attempt = 2 then interval '10 minutes'
    when v_attempt = 3 then interval '20 minutes'
    else interval '40 minutes'
  end;

  update public.anpi_notification_deliveries d
  set status = 'failed',
      failed_at = p_now,
      failure_code = left(coalesce(v_stub_result, v_adapter.error_code, 'failed'), 64),
      failure_detail_safe = left('adapter:' || coalesce(v_stub_result, 'failed'), 500),
      retryable = v_retry,
      next_retry_at = case when v_retry then p_now + v_backoff else null end,
      provider_message_id = coalesce(d.provider_message_id, v_adapter.provider_message_id),
      provider = 'talk_local_adapter'
  where d.id = v_delivery.id
  returning * into v_delivery;

  if v_retry then
    update public.anpi_scheduler_jobs j
    set status = 'pending',
        available_at = p_now + v_backoff,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        completed_at = null,
        last_error_safe = left(coalesce(v_stub_result, 'failed'), 500)
    where j.id = v_job.id
    returning * into v_job;
    outcome := 'retry_scheduled';
  else
    update public.anpi_scheduler_jobs j
    set status = 'failed',
        completed_at = p_now,
        claimed_at = null,
        claimed_by = null,
        lease_expires_at = null,
        last_error_safe = left(coalesce(v_stub_result, 'failed'), 500)
    where j.id = v_job.id
    returning * into v_job;
    outcome := 'terminal_failed';
  end if;

  job_id := v_job.id;
  job_status := v_job.status;
  delivery_id := v_delivery.id;
  delivery_status := v_delivery.status;
  attempt_number := v_attempt;
  skip_reason := null;
  provider_message_id := v_delivery.provider_message_id;
  return next;
end;
$$;

comment on function public.anpi_phase6_process_claimed_job(uuid, text, text, timestamptz, interval) is
  'Service-only: eligibility · delivery attempt · Phase 8 Talk Adapter · job result. No real provider.';

-- Keep grants (re-assert)
revoke all on function public.anpi_phase6_process_claimed_job(uuid, text, text, timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_process_claimed_job(uuid, text, text, timestamptz, interval)
  to service_role;

-- Align Phase 6 payload builder with Phase 8 template keys (additive compatibility)
create or replace function public.anpi_phase6_build_talk_payload(
  p_job_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_contract jsonb;
  v_job public.anpi_scheduler_jobs%rowtype;
begin
  select * into v_job from public.anpi_scheduler_jobs where id = p_job_id;
  if not found then
    raise exception using errcode = '22000', message = 'anpi_job_not_found';
  end if;

  v_contract := public.anpi_phase8_build_notification_contract(p_job_id);

  -- Prefer Phase 8 contract; keep legacy keys for older readers.
  return v_contract || jsonb_build_object(
    'event_type', 'anpi.notification',
    'title_key', (v_contract->>'template_key') || '.title',
    'body_key', (v_contract->>'template_key') || '.body',
    'action_ids', v_contract->'actions',
    'recipient_user_id', v_job.recipient_user_id,
    'notification_kind', v_job.kind,
    'check_id', v_job.check_id,
    'channel', 'talk',
    'created_at', to_jsonb(v_job.created_at),
    'idempotency_key', v_contract->>'idempotency_key',
    'scheduler_job_id', p_job_id,
    'attempt_number', (v_contract->>'attempt_number')::integer
  );
end;
$$;

revoke all on function public.anpi_phase6_build_talk_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.anpi_phase6_build_talk_payload(uuid)
  to service_role;

-- No cron / real TALK / push registration in this migration.

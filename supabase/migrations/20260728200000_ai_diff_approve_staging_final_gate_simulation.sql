-- Diff & Approve — Staging Final Apply Gate + staging_simulation
-- Proposal status stays approved · No real Apply / Provider
-- service_role only · deny-all RLS · append-oriented

-- ---------------------------------------------------------------------------
-- A. apply gates
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_apply_gates (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'staging',
  proposal_id uuid not null
    references public.ai_diff_approve_proposals (proposal_id) on delete restrict,
  plan_id uuid not null
    references public.ai_diff_approve_apply_plans (id) on delete restrict,
  source_version integer not null,
  status text not null,
  plan_fingerprint text not null,
  proposal_hash text not null,
  approval_hash text not null,
  blockers jsonb not null default '[]'::jsonb,
  preconditions jsonb not null default '[]'::jsonb,
  confirmation_phrase text not null,
  created_by uuid null,
  idempotency_key text not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),

  constraint ai_diff_gate_environment_staging check (environment = 'staging'),
  constraint ai_diff_gate_status_check check (status in ('apply_ready', 'blocked')),
  constraint ai_diff_gate_source_version_pos check (source_version >= 0),
  constraint ai_diff_gate_fp_len check (char_length(plan_fingerprint) between 8 and 128),
  constraint ai_diff_gate_confirm_phrase check (
    confirmation_phrase = 'CONFIRM_STAGING_APPLY_GATE'
  ),
  constraint ai_diff_gate_blockers_array check (jsonb_typeof(blockers) = 'array'),
  constraint ai_diff_gate_pre_array check (jsonb_typeof(preconditions) = 'array'),
  constraint ai_diff_gate_idem_key_len check (char_length(idempotency_key) between 8 and 200),
  constraint ai_diff_gate_payload_hash_len check (char_length(payload_hash) between 8 and 128),
  constraint ai_diff_gate_idem_unique unique (idempotency_key)
);

comment on table public.ai_diff_approve_apply_gates is
  'Diff & Approve Staging Final Apply Gate · no Apply · service_role only';

create index if not exists idx_ai_diff_gate_proposal_created
  on public.ai_diff_approve_apply_gates (proposal_id, created_at desc);

alter table public.ai_diff_approve_apply_gates enable row level security;

drop policy if exists ai_diff_gate_deny_all on public.ai_diff_approve_apply_gates;
create policy ai_diff_gate_deny_all
  on public.ai_diff_approve_apply_gates
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_apply_gates
  from public, anon, authenticated, service_role;
grant select, insert on table public.ai_diff_approve_apply_gates to service_role;

-- ---------------------------------------------------------------------------
-- B. execution attempts (staging_simulation only)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'staging',
  proposal_id uuid not null
    references public.ai_diff_approve_proposals (proposal_id) on delete restrict,
  apply_plan_id uuid not null
    references public.ai_diff_approve_apply_plans (id) on delete restrict,
  apply_gate_id uuid not null
    references public.ai_diff_approve_apply_gates (id) on delete restrict,
  attempt_number integer not null default 1,
  mode text not null default 'staging_simulation',
  status text not null,
  provider text not null default 'noop',
  operation_count integer not null default 0,
  expected_version integer not null,
  plan_fingerprint text not null,
  idempotency_key text not null,
  payload_hash text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_code text null,
  error_message text null,
  retryable boolean not null default false,
  retry_reason text not null default 'not_needed',
  max_attempts integer not null default 1,
  next_attempt_not_scheduled boolean not null default true,
  rollback_available boolean not null default false,
  rollback_strategy text not null default 'none',
  rollback_not_executed boolean not null default true,
  result_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_diff_exec_environment_staging check (environment = 'staging'),
  constraint ai_diff_exec_mode_sim check (mode = 'staging_simulation'),
  constraint ai_diff_exec_status_check check (
    status in ('prepared', 'simulated', 'failed', 'blocked', 'cancelled')
  ),
  constraint ai_diff_exec_provider_noop check (provider in ('noop', 'none')),
  constraint ai_diff_exec_no_real_success check (status <> 'succeeded'),
  constraint ai_diff_exec_attempt_pos check (attempt_number >= 1),
  constraint ai_diff_exec_ops_nonneg check (operation_count >= 0),
  constraint ai_diff_exec_rollback_false check (rollback_available = false),
  constraint ai_diff_exec_rollback_not_run check (rollback_not_executed = true),
  constraint ai_diff_exec_next_not_sched check (next_attempt_not_scheduled = true),
  constraint ai_diff_exec_result_object check (jsonb_typeof(result_summary) = 'object'),
  constraint ai_diff_exec_meta_object check (jsonb_typeof(metadata) = 'object'),
  constraint ai_diff_exec_idem_key_len check (char_length(idempotency_key) between 8 and 200),
  constraint ai_diff_exec_payload_hash_len check (char_length(payload_hash) between 8 and 128),
  constraint ai_diff_exec_idem_unique unique (idempotency_key)
);

comment on table public.ai_diff_approve_execution_attempts is
  'Diff & Approve Staging simulation attempts · never real Provider · service_role only';

create index if not exists idx_ai_diff_exec_proposal_created
  on public.ai_diff_approve_execution_attempts (proposal_id, created_at desc);

create index if not exists idx_ai_diff_exec_active
  on public.ai_diff_approve_execution_attempts (proposal_id, status)
  where status = 'prepared';

alter table public.ai_diff_approve_execution_attempts enable row level security;

drop policy if exists ai_diff_exec_deny_all on public.ai_diff_approve_execution_attempts;
create policy ai_diff_exec_deny_all
  on public.ai_diff_approve_execution_attempts
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_execution_attempts
  from public, anon, authenticated, service_role;
grant select, insert on table public.ai_diff_approve_execution_attempts to service_role;

-- ---------------------------------------------------------------------------
-- C. RPC: confirm apply gate
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_confirm_apply_gate(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_plan_id uuid;
  v_expected_version integer;
  v_idem_key text;
  v_payload_hash text;
  v_actor_id uuid;
  v_status text;
  v_fp text;
  v_proposal_hash text;
  v_approval_hash text;
  v_blockers jsonb;
  v_preconditions jsonb;
  v_confirm text;
  v_event_type text;
  v_event_hash text;
  v_prev_hash text;
  v_event_payload jsonb;
  v_seq integer;
  v_seq_in integer;
  v_last_seq integer;
  v_last_hash text;
  v_prop public.ai_diff_approve_proposals%rowtype;
  v_plan public.ai_diff_approve_apply_plans%rowtype;
  v_existing_idem public.ai_diff_approve_idempotency%rowtype;
  v_existing_gate public.ai_diff_approve_apply_gates%rowtype;
  v_gate_id uuid;
  v_event_id uuid;
  v_now timestamptz := now();
  v_active integer;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;
  if p_input ? '__proto__' or p_input ? 'prototype' or p_input ? 'constructor' then
    return jsonb_build_object('ok', false, 'error', 'extra_fields', 'code', 'extra_fields');
  end if;

  begin
    v_proposal_id := nullif(trim(p_input ->> 'proposal_id'), '')::uuid;
    v_plan_id := nullif(trim(p_input ->> 'plan_id'), '')::uuid;
    v_actor_id := nullif(trim(p_input ->> 'actor_id'), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_uuid', 'code', 'invalid_uuid');
  end;

  v_expected_version := (p_input ->> 'expected_version')::integer;
  v_idem_key := nullif(trim(p_input ->> 'idempotency_key'), '');
  v_payload_hash := nullif(trim(p_input ->> 'payload_hash'), '');
  v_status := nullif(trim(p_input ->> 'status'), '');
  v_fp := nullif(trim(p_input ->> 'plan_fingerprint'), '');
  v_proposal_hash := nullif(trim(p_input ->> 'proposal_hash'), '');
  v_approval_hash := nullif(trim(p_input ->> 'approval_hash'), '');
  v_blockers := coalesce(p_input -> 'blockers', '[]'::jsonb);
  v_preconditions := coalesce(p_input -> 'preconditions', '[]'::jsonb);
  v_confirm := nullif(trim(p_input ->> 'confirmation_phrase'), '');
  v_event_type := nullif(trim(p_input ->> 'event_type'), '');
  v_event_hash := nullif(trim(p_input ->> 'event_hash'), '');
  v_prev_hash := nullif(trim(p_input ->> 'previous_event_hash'), '');
  v_event_payload := coalesce(p_input -> 'event_payload', '{}'::jsonb);
  v_seq_in := (p_input ->> 'sequence_number')::integer;

  if v_proposal_id is null or v_plan_id is null or v_actor_id is null
     or v_expected_version is null or v_expected_version < 0
     or v_idem_key is null or char_length(v_idem_key) < 8
     or v_payload_hash is null
     or v_status not in ('apply_ready', 'blocked')
     or v_fp is null or v_proposal_hash is null or v_approval_hash is null
     or v_confirm <> 'CONFIRM_STAGING_APPLY_GATE'
     or jsonb_typeof(v_blockers) <> 'array'
     or jsonb_typeof(v_preconditions) <> 'array'
     or v_event_type not in ('apply_gate_confirmed', 'apply_gate_blocked')
     or v_event_hash is null or v_seq_in is null or v_seq_in < 1
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  select * into v_existing_idem
  from public.ai_diff_approve_idempotency
  where idempotency_key = v_idem_key;
  if found then
    if v_existing_idem.token <> v_payload_hash then
      return jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT', 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    select * into v_existing_gate
    from public.ai_diff_approve_apply_gates
    where idempotency_key = v_idem_key;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
    end if;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'gate_id', v_existing_gate.id,
      'proposal_id', v_existing_gate.proposal_id,
      'status', v_existing_gate.status,
      'source_version', v_existing_gate.source_version,
      'plan_fingerprint', v_existing_gate.plan_fingerprint,
      'blockers', v_existing_gate.blockers,
      'preconditions', v_existing_gate.preconditions,
      'created_at', v_existing_gate.created_at,
      'request_status', 'approved',
      'apply_executed', false,
      'provider_executed', false
    );
  end if;

  select * into v_prop
  from public.ai_diff_approve_proposals
  where proposal_id = v_proposal_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'code', 'not_found');
  end if;
  if v_prop.status <> 'approved' then
    return jsonb_build_object(
      'ok', false, 'error', 'INVALID_STATUS', 'code', 'INVALID_STATUS',
      'current_status', v_prop.status, 'current_version', v_prop.record_version
    );
  end if;
  if v_prop.record_version <> v_expected_version then
    return jsonb_build_object(
      'ok', false, 'error', 'VERSION_CONFLICT', 'code', 'VERSION_CONFLICT',
      'current_status', v_prop.status, 'current_version', v_prop.record_version
    );
  end if;
  if coalesce(v_prop.applied, false) or coalesce(v_prop.executed, false)
     or coalesce(v_prop.provider_called, false) then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_APPLIED', 'code', 'ALREADY_APPLIED');
  end if;

  select * into v_plan
  from public.ai_diff_approve_apply_plans
  where id = v_plan_id and proposal_id = v_proposal_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PLAN_MISSING', 'code', 'PLAN_MISSING');
  end if;
  if v_plan.fingerprint <> v_fp then
    return jsonb_build_object('ok', false, 'error', 'FINGERPRINT_MISMATCH', 'code', 'FINGERPRINT_MISMATCH');
  end if;

  select count(*) into v_active
  from public.ai_diff_approve_execution_attempts
  where proposal_id = v_proposal_id and status = 'prepared';
  if v_active > 0 then
    return jsonb_build_object('ok', false, 'error', 'EXECUTION_IN_PROGRESS', 'code', 'EXECUTION_IN_PROGRESS');
  end if;

  insert into public.ai_diff_approve_apply_gates (
    environment, proposal_id, plan_id, source_version, status,
    plan_fingerprint, proposal_hash, approval_hash, blockers, preconditions,
    confirmation_phrase, created_by, idempotency_key, payload_hash, created_at
  ) values (
    'staging', v_proposal_id, v_plan_id, v_expected_version, v_status,
    v_fp, v_proposal_hash, v_approval_hash, v_blockers, v_preconditions,
    v_confirm, v_actor_id, v_idem_key, v_payload_hash, v_now
  )
  returning id into v_gate_id;

  begin
    insert into public.ai_diff_approve_idempotency (
      idempotency_key, token, proposal_id, execution_id, operation_type, owner_user_id
    ) values (
      v_idem_key, v_payload_hash, v_proposal_id, null, null, v_actor_id
    );
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT', 'code', 'IDEMPOTENCY_CONFLICT');
  end;

  select sequence_number, event_hash
    into v_last_seq, v_last_hash
  from public.ai_diff_approve_events
  where proposal_id = v_proposal_id
  order by sequence_number desc
  limit 1;

  if not found then
    v_seq := 1;
    if coalesce(v_prev_hash, '') = '' then v_prev_hash := 'genesis'; end if;
    if v_seq_in <> 1 or v_prev_hash <> 'genesis' then
      return jsonb_build_object('ok', false, 'error', 'AUDIT_INVALID', 'code', 'AUDIT_INVALID');
    end if;
  else
    v_seq := v_last_seq + 1;
    if coalesce(v_prev_hash, '') = '' then v_prev_hash := v_last_hash; end if;
    if v_seq_in <> v_seq or v_prev_hash <> v_last_hash then
      return jsonb_build_object('ok', false, 'error', 'AUDIT_INVALID', 'code', 'AUDIT_INVALID');
    end if;
  end if;

  insert into public.ai_diff_approve_events (
    proposal_id, owner_user_id, sequence_number, event_type,
    event_payload, previous_event_hash, event_hash
  ) values (
    v_proposal_id, null, v_seq, v_event_type,
    v_event_payload, v_prev_hash, v_event_hash
  )
  returning id into v_event_id;

  if (select status from public.ai_diff_approve_proposals where proposal_id = v_proposal_id) <> 'approved' then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'gate_id', v_gate_id,
    'proposal_id', v_proposal_id,
    'status', v_status,
    'source_version', v_expected_version,
    'plan_fingerprint', v_fp,
    'blockers', v_blockers,
    'preconditions', v_preconditions,
    'created_at', v_now,
    'event_id', v_event_id,
    'request_status', 'approved',
    'apply_executed', false,
    'provider_executed', false
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context', 'detail', SQLERRM);
end;
$$;

revoke all on function public.ai_diff_approve_confirm_apply_gate(jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_diff_approve_confirm_apply_gate(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- D. RPC: simulate execution (noop provider)
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_simulate_execution(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_plan_id uuid;
  v_gate_id uuid;
  v_expected_version integer;
  v_idem_key text;
  v_payload_hash text;
  v_actor_id uuid;
  v_status text;
  v_fp text;
  v_error_code text;
  v_error_message text;
  v_retryable boolean;
  v_retry_reason text;
  v_max_attempts integer;
  v_result jsonb;
  v_event_type text;
  v_event_hash text;
  v_prev_hash text;
  v_event_payload jsonb;
  v_seq_in integer;
  v_seq integer;
  v_last_seq integer;
  v_last_hash text;
  v_prop public.ai_diff_approve_proposals%rowtype;
  v_gate public.ai_diff_approve_apply_gates%rowtype;
  v_existing_idem public.ai_diff_approve_idempotency%rowtype;
  v_existing_attempt public.ai_diff_approve_execution_attempts%rowtype;
  v_attempt_id uuid;
  v_event_id uuid;
  v_attempt_number integer;
  v_now timestamptz := now();
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;
  if p_input ? '__proto__' or p_input ? 'prototype' or p_input ? 'constructor' then
    return jsonb_build_object('ok', false, 'error', 'extra_fields', 'code', 'extra_fields');
  end if;

  begin
    v_proposal_id := nullif(trim(p_input ->> 'proposal_id'), '')::uuid;
    v_plan_id := nullif(trim(p_input ->> 'plan_id'), '')::uuid;
    v_gate_id := nullif(trim(p_input ->> 'gate_id'), '')::uuid;
    v_actor_id := nullif(trim(p_input ->> 'actor_id'), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_uuid', 'code', 'invalid_uuid');
  end;

  v_expected_version := (p_input ->> 'expected_version')::integer;
  v_idem_key := nullif(trim(p_input ->> 'idempotency_key'), '');
  v_payload_hash := nullif(trim(p_input ->> 'payload_hash'), '');
  v_status := nullif(trim(p_input ->> 'status'), '');
  v_fp := nullif(trim(p_input ->> 'plan_fingerprint'), '');
  v_error_code := nullif(trim(p_input ->> 'error_code'), '');
  v_error_message := nullif(trim(p_input ->> 'error_message'), '');
  v_retryable := coalesce((p_input ->> 'retryable')::boolean, false);
  v_retry_reason := coalesce(nullif(trim(p_input ->> 'retry_reason'), ''), 'not_needed');
  v_max_attempts := coalesce((p_input ->> 'max_attempts')::integer, 1);
  v_result := coalesce(p_input -> 'result_summary', '{}'::jsonb);
  v_event_type := nullif(trim(p_input ->> 'event_type'), '');
  v_event_hash := nullif(trim(p_input ->> 'event_hash'), '');
  v_prev_hash := nullif(trim(p_input ->> 'previous_event_hash'), '');
  v_event_payload := coalesce(p_input -> 'event_payload', '{}'::jsonb);
  v_seq_in := (p_input ->> 'sequence_number')::integer;

  if v_proposal_id is null or v_plan_id is null or v_gate_id is null or v_actor_id is null
     or v_expected_version is null or v_expected_version < 0
     or v_idem_key is null or v_payload_hash is null or v_fp is null
     or v_status not in ('prepared', 'simulated', 'failed', 'blocked', 'cancelled')
     or v_status = 'succeeded'
     or jsonb_typeof(v_result) <> 'object'
     or v_event_type not in (
       'execution_simulation_started',
       'execution_simulation_succeeded',
       'execution_simulation_failed',
       'execution_simulation_cancelled',
       'retry_candidate_created',
       'rollback_not_available'
     )
     or v_event_hash is null or v_seq_in is null or v_seq_in < 1
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  select * into v_existing_idem
  from public.ai_diff_approve_idempotency
  where idempotency_key = v_idem_key;
  if found then
    if v_existing_idem.token <> v_payload_hash then
      return jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT', 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    select * into v_existing_attempt
    from public.ai_diff_approve_execution_attempts
    where idempotency_key = v_idem_key;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
    end if;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'attempt_id', v_existing_attempt.id,
      'proposal_id', v_existing_attempt.proposal_id,
      'status', v_existing_attempt.status,
      'result_summary', v_existing_attempt.result_summary,
      'retryable', v_existing_attempt.retryable,
      'retry_reason', v_existing_attempt.retry_reason,
      'max_attempts', v_existing_attempt.max_attempts,
      'created_at', v_existing_attempt.created_at,
      'request_status', 'approved',
      'apply_executed', false,
      'provider_executed', false
    );
  end if;

  select * into v_prop
  from public.ai_diff_approve_proposals
  where proposal_id = v_proposal_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'code', 'not_found');
  end if;
  if v_prop.status <> 'approved' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_STATUS', 'code', 'INVALID_STATUS');
  end if;
  if v_prop.record_version <> v_expected_version then
    return jsonb_build_object('ok', false, 'error', 'VERSION_CONFLICT', 'code', 'VERSION_CONFLICT',
      'current_version', v_prop.record_version);
  end if;

  select * into v_gate
  from public.ai_diff_approve_apply_gates
  where id = v_gate_id and proposal_id = v_proposal_id;
  if not found or v_gate.status <> 'apply_ready' then
    return jsonb_build_object('ok', false, 'error', 'GATE_NOT_READY', 'code', 'GATE_NOT_READY');
  end if;
  if v_gate.plan_id <> v_plan_id then
    return jsonb_build_object('ok', false, 'error', 'STALE_PLAN', 'code', 'STALE_PLAN');
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_attempt_number
  from public.ai_diff_approve_execution_attempts
  where proposal_id = v_proposal_id;

  insert into public.ai_diff_approve_execution_attempts (
    environment, proposal_id, apply_plan_id, apply_gate_id, attempt_number,
    mode, status, provider, operation_count, expected_version, plan_fingerprint,
    idempotency_key, payload_hash, started_at, completed_at,
    error_code, error_message, retryable, retry_reason, max_attempts,
    next_attempt_not_scheduled, rollback_available, rollback_strategy,
    rollback_not_executed, result_summary, metadata, created_by, created_at, updated_at
  ) values (
    'staging', v_proposal_id, v_plan_id, v_gate_id, v_attempt_number,
    'staging_simulation', v_status, 'noop', 0, v_expected_version, v_fp,
    v_idem_key, v_payload_hash, v_now, v_now,
    v_error_code, v_error_message, v_retryable, v_retry_reason, v_max_attempts,
    true, false, 'none',
    true, v_result, jsonb_build_object('simulation_only', true), v_actor_id, v_now, v_now
  )
  returning id into v_attempt_id;

  insert into public.ai_diff_approve_idempotency (
    idempotency_key, token, proposal_id, execution_id, operation_type, owner_user_id
  ) values (
    v_idem_key, v_payload_hash, v_proposal_id, null, null, v_actor_id
  );

  select sequence_number, event_hash
    into v_last_seq, v_last_hash
  from public.ai_diff_approve_events
  where proposal_id = v_proposal_id
  order by sequence_number desc
  limit 1;

  if not found then
    v_seq := 1;
    if coalesce(v_prev_hash, '') = '' then v_prev_hash := 'genesis'; end if;
    if v_seq_in <> 1 or v_prev_hash <> 'genesis' then
      return jsonb_build_object('ok', false, 'error', 'AUDIT_INVALID', 'code', 'AUDIT_INVALID');
    end if;
  else
    v_seq := v_last_seq + 1;
    if coalesce(v_prev_hash, '') = '' then v_prev_hash := v_last_hash; end if;
    if v_seq_in <> v_seq or v_prev_hash <> v_last_hash then
      return jsonb_build_object('ok', false, 'error', 'AUDIT_INVALID', 'code', 'AUDIT_INVALID');
    end if;
  end if;

  insert into public.ai_diff_approve_events (
    proposal_id, owner_user_id, sequence_number, event_type,
    event_payload, previous_event_hash, event_hash
  ) values (
    v_proposal_id, null, v_seq, v_event_type,
    v_event_payload,
    v_prev_hash, v_event_hash
  )
  returning id into v_event_id;

  if (select status from public.ai_diff_approve_proposals where proposal_id = v_proposal_id) <> 'approved' then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'attempt_id', v_attempt_id,
    'proposal_id', v_proposal_id,
    'status', v_status,
    'result_summary', v_result,
    'retryable', v_retryable,
    'retry_reason', v_retry_reason,
    'max_attempts', v_max_attempts,
    'created_at', v_now,
    'event_id', v_event_id,
    'request_status', 'approved',
    'apply_executed', false,
    'provider_executed', false
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'IDEMPOTENCY_CONFLICT', 'code', 'IDEMPOTENCY_CONFLICT');
  when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context', 'detail', SQLERRM);
end;
$$;

revoke all on function public.ai_diff_approve_simulate_execution(jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_diff_approve_simulate_execution(jsonb) to service_role;

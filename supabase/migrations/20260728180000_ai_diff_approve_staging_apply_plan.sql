-- Diff & Approve — Staging Apply Plan / Dry-run Gate
-- Persist dry-run plans only · Never Apply / Provider / status→applying
-- service_role only · deny-all RLS · append-oriented plans

-- ---------------------------------------------------------------------------
-- A. ai_diff_approve_apply_plans
-- ---------------------------------------------------------------------------
create table if not exists public.ai_diff_approve_apply_plans (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'staging',
  proposal_id uuid not null
    references public.ai_diff_approve_proposals (proposal_id) on delete restrict,
  source_version integer not null,
  mode text not null default 'dry_run',
  status text not null,
  plan_schema_version text not null default 'diff_approve.ops.apply_plan.v1',
  normalized_plan jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  proposal_hash text not null,
  approval_hash text not null,
  capability_snapshot text not null default '',
  budget_snapshot text not null default 'diff_approve.budget.policy.v1',
  warning_count integer not null default 0,
  blocker_count integer not null default 0,
  created_by uuid null,
  idempotency_key text not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),

  constraint ai_diff_plan_environment_staging check (environment = 'staging'),
  constraint ai_diff_plan_mode_dry_run check (mode = 'dry_run'),
  constraint ai_diff_plan_status_check check (status in ('ready', 'blocked')),
  constraint ai_diff_plan_source_version_pos check (source_version >= 0),
  constraint ai_diff_plan_schema_len check (
    char_length(plan_schema_version) between 1 and 128
  ),
  constraint ai_diff_plan_fingerprint_len check (
    char_length(fingerprint) between 8 and 128
  ),
  constraint ai_diff_plan_proposal_hash_len check (
    char_length(proposal_hash) between 8 and 128
  ),
  constraint ai_diff_plan_approval_hash_len check (
    char_length(approval_hash) between 8 and 128
  ),
  constraint ai_diff_plan_payload_object check (
    jsonb_typeof(normalized_plan) = 'object'
  ),
  constraint ai_diff_plan_warn_nonneg check (warning_count >= 0),
  constraint ai_diff_plan_block_nonneg check (blocker_count >= 0),
  constraint ai_diff_plan_idem_key_len check (
    char_length(idempotency_key) between 8 and 200
  ),
  constraint ai_diff_plan_payload_hash_len check (
    char_length(payload_hash) between 8 and 128
  ),
  constraint ai_diff_plan_idem_unique unique (idempotency_key)
);

comment on table public.ai_diff_approve_apply_plans is
  'Diff & Approve Staging dry-run apply plans · append-oriented · no Apply · service_role only';

create index if not exists idx_ai_diff_plan_proposal_created
  on public.ai_diff_approve_apply_plans (proposal_id, created_at desc);

create index if not exists idx_ai_diff_plan_fingerprint
  on public.ai_diff_approve_apply_plans (fingerprint);

alter table public.ai_diff_approve_apply_plans enable row level security;

drop policy if exists ai_diff_plan_deny_all on public.ai_diff_approve_apply_plans;
create policy ai_diff_plan_deny_all
  on public.ai_diff_approve_apply_plans
  for all
  using (false)
  with check (false);

revoke all on table public.ai_diff_approve_apply_plans
  from public, anon, authenticated, service_role;
grant select, insert on table public.ai_diff_approve_apply_plans to service_role;

-- ---------------------------------------------------------------------------
-- B. RPC: create dry-run plan (no status mutation · no Apply)
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_create_apply_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_expected_version integer;
  v_idem_key text;
  v_payload_hash text;
  v_actor_id uuid;
  v_mode text;
  v_status text;
  v_fingerprint text;
  v_proposal_hash text;
  v_approval_hash text;
  v_capability text;
  v_budget text;
  v_warning_count integer;
  v_blocker_count integer;
  v_normalized jsonb;
  v_event_type text;
  v_event_hash text;
  v_prev_hash text;
  v_event_payload jsonb;
  v_seq integer;
  v_seq_in integer;
  v_last_seq integer;
  v_last_hash text;
  v_prop public.ai_diff_approve_proposals%rowtype;
  v_existing_idem public.ai_diff_approve_idempotency%rowtype;
  v_existing_plan public.ai_diff_approve_apply_plans%rowtype;
  v_plan_id uuid;
  v_event_id uuid;
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
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_uuid', 'code', 'invalid_uuid');
  end;

  v_expected_version := (p_input ->> 'expected_version')::integer;
  v_idem_key := nullif(trim(p_input ->> 'idempotency_key'), '');
  v_payload_hash := nullif(trim(p_input ->> 'payload_hash'), '');
  v_mode := coalesce(nullif(trim(p_input ->> 'mode'), ''), 'dry_run');
  v_status := nullif(trim(p_input ->> 'status'), '');
  v_fingerprint := nullif(trim(p_input ->> 'fingerprint'), '');
  v_proposal_hash := nullif(trim(p_input ->> 'proposal_hash'), '');
  v_approval_hash := nullif(trim(p_input ->> 'approval_hash'), '');
  v_capability := coalesce(nullif(trim(p_input ->> 'capability_snapshot'), ''), '');
  v_budget := coalesce(nullif(trim(p_input ->> 'budget_snapshot'), ''), 'diff_approve.budget.policy.v1');
  v_warning_count := coalesce((p_input ->> 'warning_count')::integer, 0);
  v_blocker_count := coalesce((p_input ->> 'blocker_count')::integer, 0);
  v_normalized := coalesce(p_input -> 'normalized_plan', '{}'::jsonb);
  v_event_type := nullif(trim(p_input ->> 'event_type'), '');
  v_event_hash := nullif(trim(p_input ->> 'event_hash'), '');
  v_prev_hash := nullif(trim(p_input ->> 'previous_event_hash'), '');
  v_event_payload := coalesce(p_input -> 'event_payload', '{}'::jsonb);
  v_seq_in := (p_input ->> 'sequence_number')::integer;

  begin
    v_actor_id := nullif(trim(p_input ->> 'actor_id'), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end;

  if v_proposal_id is null
     or v_expected_version is null or v_expected_version < 0
     or v_idem_key is null or char_length(v_idem_key) < 8 or char_length(v_idem_key) > 200
     or v_payload_hash is null or char_length(v_payload_hash) < 8
     or v_actor_id is null
     or v_mode <> 'dry_run'
     or v_status not in ('ready', 'blocked')
     or v_fingerprint is null
     or v_proposal_hash is null
     or v_approval_hash is null
     or jsonb_typeof(v_normalized) <> 'object'
     or v_event_type is null
     or v_event_hash is null
     or v_seq_in is null or v_seq_in < 1
     or jsonb_typeof(v_event_payload) <> 'object'
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  if v_event_type not in ('apply_plan_created', 'apply_plan_blocked') then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  -- Idempotency replay
  select * into v_existing_idem
  from public.ai_diff_approve_idempotency
  where idempotency_key = v_idem_key;
  if found then
    if v_existing_idem.token <> v_payload_hash then
      return jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'code', 'IDEMPOTENCY_CONFLICT'
      );
    end if;
    select * into v_existing_plan
    from public.ai_diff_approve_apply_plans
    where idempotency_key = v_idem_key;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
    end if;
    if v_existing_plan.source_version <> v_expected_version then
      return jsonb_build_object(
        'ok', false,
        'error', 'SOURCE_VERSION_CONFLICT',
        'code', 'SOURCE_VERSION_CONFLICT'
      );
    end if;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'plan_id', v_existing_plan.id,
      'proposal_id', v_existing_plan.proposal_id,
      'source_version', v_existing_plan.source_version,
      'status', v_existing_plan.status,
      'fingerprint', v_existing_plan.fingerprint,
      'warning_count', v_existing_plan.warning_count,
      'blocker_count', v_existing_plan.blocker_count,
      'normalized_plan', v_existing_plan.normalized_plan,
      'created_at', v_existing_plan.created_at,
      'audit_event_id', null,
      'apply_executed', false,
      'provider_executed', false,
      'request_status', (
        select status from public.ai_diff_approve_proposals where proposal_id = v_proposal_id
      )
    );
  end if;

  select * into v_prop
  from public.ai_diff_approve_proposals
  where proposal_id = v_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'code', 'not_found');
  end if;

  if v_prop.environment <> 'staging' then
    return jsonb_build_object('ok', false, 'error', 'staging_required', 'code', 'staging_required');
  end if;

  if v_prop.applied or v_prop.executed or v_prop.provider_called
     or v_prop.transmit or v_prop.network_called
     or v_prop.production_written or v_prop.rollback_executed
  then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_EXECUTED', 'code', 'ALREADY_EXECUTED');
  end if;

  if v_prop.status <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'error', 'INVALID_STATUS',
      'code', 'INVALID_STATUS',
      'current_status', v_prop.status
    );
  end if;

  if v_prop.record_version <> v_expected_version then
    return jsonb_build_object(
      'ok', false,
      'error', 'VERSION_CONFLICT',
      'code', 'VERSION_CONFLICT',
      'current_version', v_prop.record_version,
      'current_status', v_prop.status
    );
  end if;

  -- Insert plan (no proposal status mutation)
  insert into public.ai_diff_approve_apply_plans (
    environment, proposal_id, source_version, mode, status, plan_schema_version,
    normalized_plan, fingerprint, proposal_hash, approval_hash,
    capability_snapshot, budget_snapshot, warning_count, blocker_count,
    created_by, idempotency_key, payload_hash
  ) values (
    'staging', v_proposal_id, v_expected_version, 'dry_run', v_status,
    'diff_approve.ops.apply_plan.v1', v_normalized, v_fingerprint,
    v_proposal_hash, v_approval_hash, v_capability, v_budget,
    v_warning_count, v_blocker_count, null, v_idem_key, v_payload_hash
  )
  returning id into v_plan_id;

  begin
    insert into public.ai_diff_approve_idempotency (
      idempotency_key, token, proposal_id, execution_id, operation_type, owner_user_id
    ) values (
      v_idem_key, v_payload_hash, v_proposal_id, null, null, null
    );
  exception
    when unique_violation then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
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
      raise exception 'out_of_order' using errcode = 'P0001';
    end if;
  else
    v_seq := v_last_seq + 1;
    if coalesce(v_prev_hash, '') = '' then v_prev_hash := v_last_hash; end if;
    if v_seq_in <> v_seq or v_prev_hash <> v_last_hash then
      raise exception 'out_of_order' using errcode = 'P0001';
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

  -- Re-assert status unchanged
  if (select status from public.ai_diff_approve_proposals where proposal_id = v_proposal_id) <> 'approved' then
    raise exception 'status_mutated' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'plan_id', v_plan_id,
    'proposal_id', v_proposal_id,
    'source_version', v_expected_version,
    'status', v_status,
    'fingerprint', v_fingerprint,
    'warning_count', v_warning_count,
    'blocker_count', v_blocker_count,
    'normalized_plan', v_normalized,
    'created_at', v_now,
    'audit_event_id', v_event_id,
    'apply_executed', false,
    'provider_executed', false,
    'request_status', 'approved'
  );
exception
  when raise_exception then
    if SQLERRM = 'IDEMPOTENCY_CONFLICT' then
      return jsonb_build_object(
        'ok', false,
        'error', 'IDEMPOTENCY_CONFLICT',
        'code', 'IDEMPOTENCY_CONFLICT'
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'serialize_failed',
      'code', 'serialize_failed',
      'detail', SQLERRM
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'serialize_failed',
      'code', 'serialize_failed',
      'detail', SQLERRM
    );
end;
$$;

revoke all on function public.ai_diff_approve_create_apply_plan(jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_diff_approve_create_apply_plan(jsonb) to service_role;

comment on function public.ai_diff_approve_create_apply_plan(jsonb) is
  'Staging dry-run apply plan persist · no Apply · no status change · service_role only';

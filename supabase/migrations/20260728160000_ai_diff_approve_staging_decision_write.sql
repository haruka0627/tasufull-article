-- Diff & Approve — Staging Operator Decision Write Foundation
-- SSOT: A1/A2 statuses · Decision writes only · No Apply / Provider / Queue / Production
-- Adds: cancelled status vocabulary · ai_diff_approve_record_decision(jsonb) RPC
-- Ownership: service_role only (B2 deny-all RLS) · authenticated/anon EXECUTE revoked

-- ---------------------------------------------------------------------------
-- 1) Allow cancelled as a terminal decision status (no applying/applied)
-- ---------------------------------------------------------------------------
comment on column public.ai_diff_approve_proposals.status is
  'A1/A2 vocab + cancelled · Decision write may set draft|pending_approval|approved|rejected|cancelled · never applying/applied via this RPC';

-- ---------------------------------------------------------------------------
-- 2) Decision write RPC (atomic status + audit + idempotency · no Apply)
-- ---------------------------------------------------------------------------
create or replace function public.ai_diff_approve_record_decision(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_action text;
  v_expected_version integer;
  v_idem_key text;
  v_payload_hash text;
  v_actor_id uuid;
  v_actor_role text;
  v_reason text;
  v_environment text;
  v_event_type text;
  v_from_status text;
  v_to_status text;
  v_event_hash text;
  v_prev_hash text;
  v_event_payload jsonb;
  v_seq integer;
  v_seq_in integer;
  v_last_seq integer;
  v_last_hash text;
  v_prop public.ai_diff_approve_proposals%rowtype;
  v_existing_idem public.ai_diff_approve_idempotency%rowtype;
  v_event_id uuid;
  v_now timestamptz := now();
  v_approval_record_id text;
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

  v_action := lower(nullif(trim(p_input ->> 'action'), ''));
  v_expected_version := (p_input ->> 'expected_version')::integer;
  v_idem_key := nullif(trim(p_input ->> 'idempotency_key'), '');
  v_payload_hash := nullif(trim(p_input ->> 'payload_hash'), '');
  v_actor_role := coalesce(nullif(trim(p_input ->> 'actor_role'), ''), 'operator');
  v_reason := nullif(trim(p_input ->> 'reason'), '');
  v_environment := coalesce(nullif(trim(p_input ->> 'environment'), ''), 'staging');
  v_event_type := nullif(trim(p_input ->> 'event_type'), '');
  v_from_status := nullif(trim(p_input ->> 'from_status'), '');
  v_to_status := nullif(trim(p_input ->> 'to_status'), '');
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
     or v_action is null
     or v_expected_version is null or v_expected_version < 0
     or v_idem_key is null or char_length(v_idem_key) < 8 or char_length(v_idem_key) > 200
     or v_payload_hash is null or char_length(v_payload_hash) < 8
     or v_actor_id is null
     or v_event_type is null
     or v_from_status is null
     or v_to_status is null
     or v_event_hash is null
     or v_seq_in is null or v_seq_in < 1
     or jsonb_typeof(v_event_payload) <> 'object'
     or v_environment <> 'staging'
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_context', 'code', 'invalid_context');
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    return jsonb_build_object('ok', false, 'error', 'invalid_reason', 'code', 'invalid_reason');
  end if;

  -- Allowlist actions / transitions (never applying/applied)
  if not (
    (v_action = 'propose' and v_from_status = 'draft' and v_to_status = 'pending_approval'
      and v_event_type = 'proposal_submitted')
    or (v_action = 'approve' and v_from_status = 'pending_approval' and v_to_status = 'approved'
      and v_event_type = 'approval_granted')
    or (v_action = 'reject' and v_from_status = 'pending_approval' and v_to_status = 'rejected'
      and v_event_type = 'approval_rejected')
    or (v_action = 'cancel' and v_from_status = 'pending_approval' and v_to_status = 'cancelled'
      and v_event_type = 'approval_cancelled')
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'INVALID_STATE_TRANSITION',
      'code', 'INVALID_STATE_TRANSITION'
    );
  end if;

  if v_to_status in ('applying', 'applied', 'apply_failed') then
    return jsonb_build_object('ok', false, 'error', 'apply_forbidden', 'code', 'apply_forbidden');
  end if;

  -- Idempotency lookup (same key)
  select * into v_existing_idem
  from public.ai_diff_approve_idempotency
  where idempotency_key = v_idem_key;

  if found then
    if v_existing_idem.token = v_payload_hash then
      select * into v_prop
      from public.ai_diff_approve_proposals
      where proposal_id = v_proposal_id;
      if not found then
        return jsonb_build_object('ok', false, 'error', 'not_found', 'code', 'not_found');
      end if;
      return jsonb_build_object(
        'ok', true,
        'replayed', true,
        'proposal_id', v_proposal_id,
        'previous_status', v_from_status,
        'current_status', v_prop.status,
        'version', v_prop.record_version,
        'decision', v_action,
        'audit_event_id', null,
        'created_at', v_existing_idem.created_at,
        'applied', false,
        'provider_called', false,
        'executed', false
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'IDEMPOTENCY_CONFLICT',
      'code', 'IDEMPOTENCY_CONFLICT',
      'http_hint', 409
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

  -- Never flip Apply invariants
  if v_prop.applied or v_prop.executed or v_prop.provider_called
     or v_prop.transmit or v_prop.network_called
     or v_prop.production_written or v_prop.rollback_executed
  then
    return jsonb_build_object('ok', false, 'error', 'apply_forbidden', 'code', 'apply_forbidden');
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

  if v_prop.status <> v_from_status then
    if v_prop.status in (
      'approved', 'rejected', 'cancelled', 'revision_requested', 'expired',
      'applying', 'applied', 'apply_failed'
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'ALREADY_DECIDED',
        'code', 'ALREADY_DECIDED',
        'current_status', v_prop.status
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'INVALID_STATE_TRANSITION',
      'code', 'INVALID_STATE_TRANSITION',
      'current_status', v_prop.status
    );
  end if;

  -- Update aggregate first (still under FOR UPDATE lock)
  update public.ai_diff_approve_proposals
  set
    status = v_to_status,
    record_version = record_version + 1,
    payload = coalesce(payload, '{}'::jsonb)
      || jsonb_build_object(
        'status', v_to_status,
        'last_decision', v_action,
        'last_decision_at', to_jsonb(v_now::text),
        'last_decision_actor', to_jsonb(v_actor_id::text)
      ),
    updated_at = v_now
  where proposal_id = v_proposal_id
    and record_version = v_expected_version
    and status = v_from_status;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'VERSION_CONFLICT',
      'code', 'VERSION_CONFLICT'
    );
  end if;

  -- Claim idempotency after successful status update (same TX · operation_type null)
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

  -- Approval decision record (approve/reject/cancel only)
  if v_action in ('approve', 'reject', 'cancel') then
    v_approval_record_id := 'approval:' || v_proposal_id::text || ':' || v_action;
    insert into public.ai_diff_approve_records (
      record_type, record_id, proposal_id, owner_user_id,
      schema_version, record_version, payload, payload_hash
    ) values (
      'approval',
      v_approval_record_id,
      v_proposal_id,
      null,
      'diff_approve.ops.decision_write.v1',
      1,
      jsonb_build_object(
        'decision', v_to_status,
        'action', v_action,
        'actor_id', v_actor_id,
        'actor_role', v_actor_role,
        'from_status', v_from_status,
        'to_status', v_to_status,
        'reason', v_reason,
        'applied', false,
        'provider_called', false,
        'executed', false
      ),
      v_payload_hash
    )
    on conflict (record_type, record_id) do nothing;
  end if;

  -- Audit append (hash chain)
  select sequence_number, event_hash
    into v_last_seq, v_last_hash
  from public.ai_diff_approve_events
  where proposal_id = v_proposal_id
  order by sequence_number desc
  limit 1;

  if not found then
    v_seq := 1;
    if coalesce(v_prev_hash, '') = '' then
      v_prev_hash := 'genesis';
    end if;
    if v_seq_in <> 1 or v_prev_hash <> 'genesis' then
      raise exception 'out_of_order' using errcode = 'P0001';
    end if;
  else
    v_seq := v_last_seq + 1;
    if coalesce(v_prev_hash, '') = '' then
      v_prev_hash := v_last_hash;
    end if;
    if v_seq_in <> v_seq or v_prev_hash <> v_last_hash then
      raise exception 'out_of_order' using errcode = 'P0001';
    end if;
  end if;

  insert into public.ai_diff_approve_events (
    proposal_id, owner_user_id, sequence_number, event_type,
    event_payload, previous_event_hash, event_hash
  ) values (
    v_proposal_id,
    null,
    v_seq,
    v_event_type,
    v_event_payload,
    v_prev_hash,
    v_event_hash
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'replayed', false,
    'proposal_id', v_proposal_id,
    'previous_status', v_from_status,
    'current_status', v_to_status,
    'version', v_expected_version + 1,
    'decision', v_action,
    'audit_event_id', v_event_id,
    'created_at', v_now,
    'applied', false,
    'provider_called', false,
    'executed', false
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

revoke all on function public.ai_diff_approve_record_decision(jsonb)
  from public, anon, authenticated;
grant execute on function public.ai_diff_approve_record_decision(jsonb) to service_role;

comment on function public.ai_diff_approve_record_decision(jsonb) is
  'Staging operator decision write · propose/approve/reject/cancel only · no Apply · service_role only';

-- End Diff & Approve staging decision write foundation

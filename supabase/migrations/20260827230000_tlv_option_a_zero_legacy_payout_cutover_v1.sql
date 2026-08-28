-- TLV OPTION_A zero-legacy payout cutover v1
-- STEP 5D local candidate only. Production / Shared Staging apply requires a separate Human Gate.
-- Production STEP 5C observed payout_log=0. Recheck that invariant atomically;
-- this candidate deliberately contains no legacy payout compatibility path.

begin;

lock table tlv.payout_log in access exclusive mode;

do $$
begin
  if exists (select 1 from tlv.payout_log) then
    raise exception 'option_a_requires_zero_legacy_payout_log';
  end if;
end
$$;

alter table tlv.payout_log
  add column if not exists payout_creation_key text,
  add column if not exists provider_correlation_id text;

create unique index if not exists payout_log_creation_key_uniq
  on tlv.payout_log (payout_creation_key)
  where payout_creation_key is not null;
create unique index if not exists payout_log_provider_correlation_uniq
  on tlv.payout_log (provider_correlation_id)
  where provider_correlation_id is not null;

-- payout_log is the provider execution/correlation owner. The settlement columns
-- are derived state-machine references and must match at transaction commit.
comment on column tlv.payout_log.provider_transfer_id is
  'Canonical provider transfer identifier owner for TLV payout execution.';
comment on column tlv.payout_log.provider_correlation_id is
  'Canonical provider unknown-outcome correlation identifier owner for TLV payout execution.';
comment on column tlv.payout_log.provider_payout_id is
  'Canonical external payout identifier owner for TLV payout execution.';
comment on column tlv.monthly_settlements.provider_transfer_id is
  'Derived state-machine reference; canonical execution owner is tlv.payout_log.';
comment on column tlv.monthly_settlements.provider_correlation_id is
  'Derived state-machine reference; canonical execution owner is tlv.payout_log.';
comment on column tlv.monthly_settlements.provider_payout_id is
  'Derived state-machine reference; canonical execution owner is tlv.payout_log.';

create or replace function tlv.validate_option_a_payout_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_settlement tlv.monthly_settlements%rowtype;
  v_target_status text;
  v_expected_payout_status tlv.payout_status;
  v_trusted_writer boolean := coalesce(current_setting('tlv.canonical_payout_writer', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    raise exception 'canonical_payout_delete_forbidden';
  end if;

  if new.settlement_id is null then
    raise exception 'canonical_settlement_required_for_payout';
  end if;

  if tg_op = 'UPDATE' and (
    old.settlement_id is distinct from new.settlement_id
    or old.creator_id is distinct from new.creator_id
    or old.month_id is distinct from new.month_id
    or old.net_attributed_clean_jpy is distinct from new.net_attributed_clean_jpy
    or old.infra_allocated_jpy is distinct from new.infra_allocated_jpy
    or old.base_rate is distinct from new.base_rate
    or old.override_tier is distinct from new.override_tier
    or old.effective_rate is distinct from new.effective_rate
    or old.creator_payout_jpy is distinct from new.creator_payout_jpy
    or old.pool_bonus_jpy is distinct from new.pool_bonus_jpy
    or old.total_payout_jpy is distinct from new.total_payout_jpy
  ) then
    raise exception 'canonical_payout_financial_identity_immutable';
  end if;

  -- Existing Refund/Dispute RPCs predate settlement holds. Exclude canonical
  -- rows from their direct hold UPDATE; the payment_reversals
  -- bridge below appends canonical settlement hold evidence instead.
  if not v_trusted_writer and tg_op = 'UPDATE'
    and new.status = 'hold'
    and new.hold_reason in ('chargeback', 'dispute')
    and old.creator_id is not distinct from new.creator_id
    and old.month_id is not distinct from new.month_id
    and old.total_payout_jpy is not distinct from new.total_payout_jpy
    and old.settlement_id is not distinct from new.settlement_id
  then
    return old;
  end if;

  if not v_trusted_writer then
    raise exception 'canonical_payout_trusted_writer_required';
  end if;

  select * into v_settlement
  from tlv.monthly_settlements
  where id = new.settlement_id;
  if not found then raise exception 'canonical_settlement_not_found'; end if;

  v_target_status := coalesce(
    nullif(current_setting('tlv.canonical_settlement_target_status', true), ''),
    v_settlement.status::text
  );
  v_expected_payout_status := case v_target_status
    when 'FINALIZED' then 'approved'::tlv.payout_status
    when 'TRANSFER_PENDING' then 'processing'::tlv.payout_status
    when 'TRANSFERRED' then 'transferred'::tlv.payout_status
    when 'TRANSFER_UNKNOWN' then 'transfer_unknown'::tlv.payout_status
    when 'PAID' then 'paid'::tlv.payout_status
    when 'FAILED' then 'failed'::tlv.payout_status
    else null
  end;

  if v_expected_payout_status is null then
    raise exception 'canonical_payout_requires_finalized_settlement';
  end if;
  if new.creator_id <> v_settlement.creator_id then raise exception 'canonical_payout_creator_mismatch'; end if;
  if new.month_id <> v_settlement.settlement_period then raise exception 'canonical_payout_period_mismatch'; end if;
  if new.creator_payout_jpy <> v_settlement.payout_amount_jpy
    or new.total_payout_jpy <> v_settlement.payout_amount_jpy
    or new.pool_bonus_jpy <> 0
  then
    raise exception 'canonical_payout_amount_mismatch';
  end if;
  if new.net_attributed_clean_jpy <> 0 or new.infra_allocated_jpy <> 0 then
    raise exception 'canonical_payout_legacy_financial_inputs_forbidden';
  end if;
  if new.base_rate is not null or new.effective_rate is not null or new.override_tier is not null then
    raise exception 'canonical_payout_legacy_rate_forbidden';
  end if;
  if new.status <> v_expected_payout_status then raise exception 'canonical_payout_status_mismatch'; end if;
  if tg_op = 'INSERT' and (
    new.payout_creation_key is null
    or new.correlation_id is distinct from new.settlement_id
  ) then
    raise exception 'canonical_payout_creation_correlation_required';
  end if;
  return new;
end;
$$;

drop trigger if exists payout_log_option_a_guard on tlv.payout_log;
create trigger payout_log_option_a_guard
  before insert or update or delete on tlv.payout_log
  for each row execute function tlv.validate_option_a_payout_mutation();

-- payout_log was locked and proved empty before removing the obsolete score FK.
alter table tlv.payout_log
  drop constraint if exists payout_log_score_monthly_fk;

create or replace function tlv.create_canonical_settlement_payout(
  p_settlement_id uuid,
  p_creation_key text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, tlv
as $$
declare
  v_settlement tlv.monthly_settlements%rowtype;
  v_payout tlv.payout_log%rowtype;
begin
  if nullif(trim(p_creation_key), '') is null or p_created_at is null then
    raise exception 'payout_creation_audit_required';
  end if;

  select * into v_settlement
  from tlv.monthly_settlements
  where id = p_settlement_id
  for update;
  if not found then raise exception 'canonical_settlement_not_found'; end if;

  select * into v_payout
  from tlv.payout_log
  where settlement_id = p_settlement_id;
  if found then
    if v_payout.payout_creation_key = p_creation_key then
      return jsonb_build_object(
        'ok', true, 'idempotent', true, 'payout_log_id', v_payout.id,
        'settlement_id', p_settlement_id
      );
    end if;
    raise exception 'duplicate_settlement_payout_creation';
  end if;

  if v_settlement.status <> 'FINALIZED' then raise exception 'finalized_settlement_required_for_payout'; end if;
  if not v_settlement.minimum_payout_met or v_settlement.payout_amount_jpy < 1000 then
    raise exception 'settlement_not_payout_eligible';
  end if;
  if exists (
    select 1 from tlv.current_settlement_hold_v1 h
    where h.settlement_id = p_settlement_id and h.active
  ) then
    raise exception 'active_operational_hold_blocks_payout_creation';
  end if;

  perform set_config('tlv.canonical_payout_writer', 'on', true);
  perform set_config('tlv.canonical_settlement_target_status', 'FINALIZED', true);
  insert into tlv.payout_log (
    creator_id, month_id,
    net_attributed_clean_jpy, infra_allocated_jpy,
    base_rate, override_tier, effective_rate,
    creator_payout_jpy, pool_bonus_jpy, total_payout_jpy,
    status, settlement_id, correlation_id, payout_creation_key,
    transfer_evidence, created_at, updated_at
  ) values (
    v_settlement.creator_id, v_settlement.settlement_period,
    0, 0,
    null, null, null,
    v_settlement.payout_amount_jpy, 0, v_settlement.payout_amount_jpy,
    'approved', v_settlement.id, v_settlement.id, p_creation_key,
    jsonb_build_object(
      'source', 'tlv.monthly_settlements',
      'settlement_id', v_settlement.id,
      'financial_snapshot_hash', v_settlement.financial_snapshot_hash,
      'provider_correlation_owner', 'tlv.payout_log'
    ),
    p_created_at, p_created_at
  ) returning * into v_payout;
  perform set_config('tlv.canonical_payout_writer', 'off', true);
  perform set_config('tlv.canonical_settlement_target_status', '', true);

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'payout_log_id', v_payout.id,
    'settlement_id', p_settlement_id
  );
end;
$$;

create or replace function tlv.validate_payout_provider_reference_consistency()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_settlement tlv.monthly_settlements%rowtype;
  v_payout tlv.payout_log%rowtype;
  v_settlement_id uuid;
begin
  if tg_table_name = 'monthly_settlements' then
    v_settlement_id := new.id;
  else
    v_settlement_id := new.settlement_id;
  end if;
  if v_settlement_id is null then return null; end if;

  select * into v_settlement from tlv.monthly_settlements where id = v_settlement_id;
  select * into v_payout from tlv.payout_log where settlement_id = v_settlement_id;

  if v_settlement.status in ('TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED')
    and v_payout.id is null
  then
    raise exception 'canonical_payout_required_for_transfer_state';
  end if;
  if v_payout.id is null then return null; end if;

  if v_payout.creator_id <> v_settlement.creator_id
    or v_payout.month_id <> v_settlement.settlement_period
    or v_payout.total_payout_jpy <> v_settlement.payout_amount_jpy
  then
    raise exception 'settlement_payout_identity_or_amount_mismatch';
  end if;
  if v_payout.provider_transfer_id is distinct from v_settlement.provider_transfer_id
    or v_payout.provider_correlation_id is distinct from v_settlement.provider_correlation_id
    or v_payout.provider_payout_id is distinct from v_settlement.provider_payout_id
  then
    raise exception 'settlement_provider_reference_mismatch';
  end if;
  if v_settlement.status in ('TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED')
    and v_payout.transfer_idempotency_key is distinct from nullif(v_settlement.transfer_instruction->>'idempotency_key', '')
  then
    raise exception 'settlement_payout_transfer_idempotency_mismatch';
  end if;
  return null;
end;
$$;

drop trigger if exists monthly_settlements_payout_reference_consistency on tlv.monthly_settlements;
create constraint trigger monthly_settlements_payout_reference_consistency
  after insert or update on tlv.monthly_settlements
  deferrable initially deferred
  for each row execute function tlv.validate_payout_provider_reference_consistency();

drop trigger if exists payout_log_settlement_reference_consistency on tlv.payout_log;
create constraint trigger payout_log_settlement_reference_consistency
  after insert or update on tlv.payout_log
  deferrable initially deferred
  for each row execute function tlv.validate_payout_provider_reference_consistency();

create or replace function tlv.transition_canonical_settlement_payout(
  p_settlement_id uuid,
  p_expected_version integer,
  p_to_status tlv.settlement_status,
  p_transition_key text,
  p_actor_id text,
  p_occurred_at timestamptz,
  p_evidence jsonb,
  p_transition_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, tlv
as $$
declare
  v_payout tlv.payout_log%rowtype;
  v_payout_status tlv.payout_status;
  v_result jsonb;
begin
  if p_to_status in ('TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED') then
    select * into v_payout
    from tlv.payout_log
    where settlement_id = p_settlement_id
    for update;
    if not found then raise exception 'canonical_payout_required_for_transfer_state'; end if;

    v_payout_status := case p_to_status::text
      when 'TRANSFER_PENDING' then 'processing'::tlv.payout_status
      when 'TRANSFERRED' then 'transferred'::tlv.payout_status
      when 'TRANSFER_UNKNOWN' then 'transfer_unknown'::tlv.payout_status
      when 'PAID' then 'paid'::tlv.payout_status
      when 'FAILED' then 'failed'::tlv.payout_status
    end;

    perform set_config('tlv.canonical_payout_writer', 'on', true);
    perform set_config('tlv.canonical_settlement_target_status', p_to_status::text, true);
    update tlv.payout_log
    set
      status = v_payout_status,
      transfer_idempotency_key = coalesce(
        nullif(p_transition_data->'transfer_instruction'->>'idempotency_key', ''),
        transfer_idempotency_key
      ),
      provider_transfer_id = coalesce(nullif(p_transition_data->>'provider_transfer_id', ''), provider_transfer_id),
      provider_correlation_id = coalesce(nullif(p_transition_data->>'provider_correlation_id', ''), provider_correlation_id),
      provider_payout_id = coalesce(nullif(p_transition_data->>'provider_payout_id', ''), provider_payout_id),
      stripe_transfer_id = coalesce(nullif(p_transition_data->>'provider_transfer_id', ''), stripe_transfer_id),
      transfer_evidence = coalesce(transfer_evidence, '{}'::jsonb)
        || jsonb_build_object(
          'last_transition_key', p_transition_key,
          'last_transition_status', p_to_status,
          'provider_correlation_owner', 'tlv.payout_log'
        )
        || p_evidence
        || p_transition_data,
      paid_at = case when p_to_status = 'PAID' then p_occurred_at else paid_at end,
      failure_reason = case
        when p_to_status = 'FAILED' then coalesce(nullif(p_evidence->>'reason', ''), 'provider_confirmed_no_transfer')
        else failure_reason
      end,
      updated_at = p_occurred_at
    where id = v_payout.id;
  end if;

  v_result := tlv.transition_monthly_settlement(
    p_settlement_id, p_expected_version, p_to_status, p_transition_key,
    p_actor_id, p_occurred_at, p_evidence, p_transition_data
  );

  perform set_config('tlv.canonical_payout_writer', 'off', true);
  perform set_config('tlv.canonical_settlement_target_status', '', true);
  return v_result;
end;
$$;

-- Capture the provider event UUID inside the webhook transaction so the
-- pre-STEP-4 reversal RPC can satisfy the new append-only adjustment evidence.
create or replace function tlv.capture_processing_provider_event_context()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.status::text = 'processing' then
    perform set_config('tlv.current_payment_provider_event_id', new.id::text, true);
  end if;
  return new;
end;
$$;

drop trigger if exists payment_provider_events_processing_context on tlv.payment_provider_events;
create trigger payment_provider_events_processing_context
  after insert or update of status on tlv.payment_provider_events
  for each row execute function tlv.capture_processing_provider_event_context();

create or replace function tlv.enforce_revenue_ledger_jst_period()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_economic_period char(7);
  v_context_provider_event_id uuid;
begin
  new.occurred_at := coalesce(new.occurred_at, new.created_at, now());
  v_economic_period := to_char(new.occurred_at at time zone 'Asia/Tokyo', 'YYYY-MM');

  if new.event_kind in ('membership', 'ad_share') then
    raise exception 'settlement_feature_not_enabled:%', new.event_kind;
  end if;

  if new.event_kind = 'adjustment' then
    new.adjustment_kind := coalesce(
      new.adjustment_kind,
      case
        when new.notes like 'refund:%' then 'REFUND'
        when new.notes like 'chargeback:%' then 'CHARGEBACK'
        else 'OTHER'
      end
    );
    if new.adjustment_kind in ('REFUND', 'CHARGEBACK') and new.payment_provider_event_id is null then
      begin
        v_context_provider_event_id := nullif(
          current_setting('tlv.current_payment_provider_event_id', true), ''
        )::uuid;
      exception when invalid_text_representation then
        v_context_provider_event_id := null;
      end;
      if v_context_provider_event_id is null or not exists (
        select 1 from tlv.payment_provider_events ppe
        where ppe.id = v_context_provider_event_id and ppe.status = 'processing'
      ) then
        raise exception 'adjustment_provider_event_context_required';
      end if;
      new.payment_provider_event_id := v_context_provider_event_id;
    end if;
    if new.adjustment_of_settlement_id is null then
      new.ledger_month := v_economic_period;
    elsif new.ledger_month < v_economic_period then
      raise exception 'late_adjustment_recognition_period_must_not_precede_economic_period';
    end if;
  else
    new.adjustment_kind := null;
    new.adjustment_of_settlement_id := null;
    new.ledger_month := v_economic_period;
    if new.event_kind in ('gift', 'extension') then
      if new.tip_id is null then raise exception 'tip_id_required_for_tip_ledger'; end if;
      select
        sum(a.gross_allocated_jpy),
        sum(a.gross_allocated_jpy - a.net_allocated_jpy),
        sum(a.net_allocated_jpy)
      into new.gross_amount_jpy, new.fee_amount_jpy, new.net_amount_jpy
      from tlv.tip_coin_lot_allocations a
      where a.tip_id = new.tip_id;
      if new.gross_amount_jpy is null then raise exception 'tip_allocation_evidence_required'; end if;
      new.platform_revenue_jpy := new.net_amount_jpy - new.infra_cost_jpy - new.creator_payout_jpy;
    end if;
  end if;
  return new;
end;
$$;

-- One provider reversal can legitimately produce multiple immutable adjustment
-- rows (for multiple tips/creators). Event idempotency remains in
-- payment_provider_events/payment_reversals; each affected tip is single-use.
drop index if exists tlv.revenue_ledger_adjustment_provider_event_uniq;
create unique index if not exists revenue_ledger_adjustment_provider_tip_uniq
  on tlv.revenue_ledger (payment_provider_event_id, tip_id)
  where event_kind = 'adjustment'
    and payment_provider_event_id is not null
    and tip_id is not null;

create or replace function tlv.route_payment_reversal_to_settlement_hold()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_reason text;
  v_row record;
begin
  if new.reversal_kind not in ('refund', 'dispute_open', 'dispute_lost') then
    return new;
  end if;
  v_reason := case new.reversal_kind::text
    when 'refund' then 'REFUND'
    when 'dispute_open' then 'DISPUTE_OPEN'
    else 'CHARGEBACK'
  end;

  for v_row in
    select distinct pl.settlement_id
    from tlv.payout_log pl
    join tlv.tips t on t.creator_id = pl.creator_id
    join tlv.tip_coin_lot_allocations a on a.tip_id = t.id
    join tlv.coin_lots cl on cl.id = a.coin_lot_id
    where pl.settlement_id is not null
      and cl.payment_id = new.payment_id
      and not t.fraud_excluded
  loop
    insert into tlv.settlement_hold_events (
      settlement_id, action, reason_code, evidence, actor_id,
      idempotency_key, occurred_at
    ) values (
      v_row.settlement_id,
      'PLACED',
      v_reason,
      jsonb_build_object(
        'source', 'tlv.payment_reversals',
        'payment_reversal_id', new.id,
        'payment_id', new.payment_id,
        'provider_event_id', new.provider_event_id,
        'reversal_kind', new.reversal_kind,
        'amount_jpy', new.amount_jpy
      ),
      'payment-reversal-bridge',
      'payment-reversal:' || new.id::text || ':settlement:' || v_row.settlement_id::text,
      new.created_at
    ) on conflict (idempotency_key) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists payment_reversals_settlement_hold_bridge on tlv.payment_reversals;
create trigger payment_reversals_settlement_hold_bridge
  after insert on tlv.payment_reversals
  for each row execute function tlv.route_payment_reversal_to_settlement_hold();

revoke execute on function tlv.validate_option_a_payout_mutation() from public, anon, authenticated;
revoke execute on function tlv.validate_payout_provider_reference_consistency() from public, anon, authenticated;
revoke execute on function tlv.capture_processing_provider_event_context() from public, anon, authenticated;
revoke execute on function tlv.route_payment_reversal_to_settlement_hold() from public, anon, authenticated;
revoke execute on function tlv.create_canonical_settlement_payout(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function tlv.transition_canonical_settlement_payout(uuid, integer, tlv.settlement_status, text, text, timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function tlv.transition_monthly_settlement(uuid, integer, tlv.settlement_status, text, text, timestamptz, jsonb, jsonb) from service_role;

grant execute on function tlv.create_canonical_settlement_payout(uuid, text, timestamptz) to service_role;
grant execute on function tlv.transition_canonical_settlement_payout(uuid, integer, tlv.settlement_status, text, text, timestamptz, jsonb, jsonb) to service_role;

-- RLS remains FORCE-enabled from STEP 4. No cron, provider API, transfer,
-- payout, refund, tax calculation, Production, or Shared Staging action occurs.

commit;

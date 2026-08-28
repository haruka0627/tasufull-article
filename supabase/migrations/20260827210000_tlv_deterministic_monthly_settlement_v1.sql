-- TLV deterministic monthly settlement v2 (progressive revenue share candidate)
-- STEP 4 local repository implementation. PRODUCTION / SHARED STAGING APPLY IS A HUMAN GATE.
-- Canonical financial ledger remains tlv.revenue_ledger. This migration creates snapshots and links only.

do $$ begin
  create type tlv.settlement_status as enum (
    'OPEN', 'CALCULATED', 'REVIEWABLE', 'FINALIZED', 'TRANSFER_PENDING',
    'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED'
  );
exception when duplicate_object then null;
end $$;

alter type tlv.payout_status add value if not exists 'transferred';
alter type tlv.payout_status add value if not exists 'transfer_unknown';

create table if not exists tlv.monthly_settlements (
  id                                  uuid primary key default gen_random_uuid(),
  creator_id                          uuid not null references tlv.creators (id) on delete restrict,
  settlement_period                   char(7) not null,
  timezone                            text not null default 'Asia/Tokyo',
  calculation_version                 text not null,
  policy_version                      text not null,
  version                             integer not null,
  status                              tlv.settlement_status not null default 'OPEN',
  currency                            char(3) not null default 'JPY',
  source_ledger_ids                   jsonb not null default '[]'::jsonb,
  source_correlations                 jsonb not null default '[]'::jsonb,
  excluded_self_funding_ledger_ids    jsonb not null default '[]'::jsonb,
  gross_jpy                           bigint not null default 0,
  provider_payment_fee_jpy            bigint not null default 0,
  refund_jpy                          bigint not null default 0,
  chargeback_jpy                      bigint not null default 0,
  creator_attributed_net_jpy          bigint not null default 0,
  eligible_net_basis_jpy              bigint not null default 0,
  revenue_share_model                 text not null default 'TLV_PROGRESSIVE_V1',
  applied_marginal_bracket            text not null,
  creator_marginal_share_rate_pct     integer not null,
  tasful_marginal_retained_rate_pct   integer not null,
  creator_effective_share_rate_pct    numeric(9, 6),
  tasful_effective_share_rate_pct     numeric(9, 6),
  revenue_share_brackets              jsonb not null default '[]'::jsonb,
  creator_amount_before_rounding_jpy  numeric(24, 2) not null,
  rounding_residual_jpy               numeric(4, 2) not null,
  creator_payable_current_period_jpy  bigint not null default 0,
  carry_forward_in_jpy                bigint not null default 0,
  carry_forward_source_settlement_id  uuid references tlv.monthly_settlements (id) on delete restrict,
  carry_forward_out_jpy               bigint not null default 0,
  final_creator_payable_jpy           bigint not null default 0,
  payout_amount_jpy                   bigint not null default 0,
  minimum_payout_met                  boolean not null default false,
  hold_state                          jsonb not null default '{"active":false,"auto_release":false}'::jsonb,
  attributable_cost_status            text not null default 'UNAVAILABLE',
  verified_attributable_cost_jpy      bigint,
  verified_attributable_cost_evidence_ids jsonb not null default '[]'::jsonb,
  tasful_retained_revenue_jpy         bigint not null default 0,
  contribution_profit_jpy             bigint,
  tax_policy_status                   text not null default 'NOT_CONFIGURED',
  financial_snapshot_hash             char(64) not null,
  reviewed_at                         timestamptz,
  reviewed_by                         text,
  finalized_at                        timestamptz,
  finalized_by                        text,
  finalization_key                    text,
  finalized_snapshot_hash             char(64),
  transfer_instruction                jsonb,
  provider_transfer_id                text,
  provider_correlation_id             text,
  provider_payout_id                  text,
  last_transition_key                 text,
  last_transition_at                  timestamptz,
  last_transition_actor               text,
  last_transition_evidence            jsonb,
  created_at                          timestamptz not null,
  calculated_at                       timestamptz not null,
  updated_at                          timestamptz not null default now(),
  constraint monthly_settlements_period_chk check (settlement_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint monthly_settlements_timezone_chk check (timezone = 'Asia/Tokyo'),
  constraint monthly_settlements_currency_chk check (currency = 'JPY'),
  constraint monthly_settlements_version_chk check (version > 0),
  constraint monthly_settlements_source_arrays_chk check (
    jsonb_typeof(source_ledger_ids) = 'array'
    and jsonb_typeof(source_correlations) = 'array'
    and jsonb_typeof(excluded_self_funding_ledger_ids) = 'array'
    and jsonb_typeof(verified_attributable_cost_evidence_ids) = 'array'
    and jsonb_typeof(revenue_share_brackets) = 'array'
  ),
  constraint monthly_settlements_nonnegative_chk check (
    gross_jpy >= 0 and provider_payment_fee_jpy >= 0 and refund_jpy >= 0
    and chargeback_jpy >= 0 and creator_attributed_net_jpy >= 0
    and creator_payable_current_period_jpy >= 0 and carry_forward_in_jpy >= 0
    and carry_forward_out_jpy >= 0 and final_creator_payable_jpy >= 0
    and payout_amount_jpy >= 0 and tasful_retained_revenue_jpy >= 0
    and (verified_attributable_cost_jpy is null or verified_attributable_cost_jpy >= 0)
  ),
  constraint monthly_settlements_net_formula_chk check (
    creator_attributed_net_jpy = gross_jpy - provider_payment_fee_jpy - refund_jpy - chargeback_jpy
    and eligible_net_basis_jpy = creator_attributed_net_jpy
  ),
  constraint monthly_settlements_progressive_bracket_chk check (
    revenue_share_model = 'TLV_PROGRESSIVE_V1'
    and (
      (creator_attributed_net_jpy <= 5000000 and applied_marginal_bracket = 'JPY_0_TO_5M' and creator_marginal_share_rate_pct = 80 and tasful_marginal_retained_rate_pct = 20)
      or (creator_attributed_net_jpy > 5000000 and creator_attributed_net_jpy <= 10000000 and applied_marginal_bracket = 'JPY_5M_TO_10M' and creator_marginal_share_rate_pct = 90 and tasful_marginal_retained_rate_pct = 10)
      or (creator_attributed_net_jpy > 10000000 and creator_attributed_net_jpy <= 30000000 and applied_marginal_bracket = 'JPY_10M_TO_30M' and creator_marginal_share_rate_pct = 95 and tasful_marginal_retained_rate_pct = 5)
      or (creator_attributed_net_jpy > 30000000 and applied_marginal_bracket = 'JPY_ABOVE_30M' and creator_marginal_share_rate_pct = 99 and tasful_marginal_retained_rate_pct = 1)
    )
  ),
  constraint monthly_settlements_progressive_amount_chk check (
    creator_amount_before_rounding_jpy = case
      when creator_attributed_net_jpy <= 5000000 then creator_attributed_net_jpy::numeric * 0.80
      when creator_attributed_net_jpy <= 10000000 then 4000000::numeric + (creator_attributed_net_jpy - 5000000)::numeric * 0.90
      when creator_attributed_net_jpy <= 30000000 then 8500000::numeric + (creator_attributed_net_jpy - 10000000)::numeric * 0.95
      else 27500000::numeric + (creator_attributed_net_jpy - 30000000)::numeric * 0.99
    end
    and (
      (creator_attributed_net_jpy = 0 and creator_effective_share_rate_pct is null and tasful_effective_share_rate_pct is null)
      or
      (creator_attributed_net_jpy > 0
        and creator_effective_share_rate_pct = round(creator_amount_before_rounding_jpy / creator_attributed_net_jpy::numeric * 100, 6)
        and tasful_effective_share_rate_pct = round(100 - creator_effective_share_rate_pct, 6))
    )
  ),
  constraint monthly_settlements_rounding_chk check (
    creator_payable_current_period_jpy = floor(creator_amount_before_rounding_jpy)
    and rounding_residual_jpy = creator_amount_before_rounding_jpy - floor(creator_amount_before_rounding_jpy)
    and rounding_residual_jpy >= 0 and rounding_residual_jpy < 1
  ),
  constraint monthly_settlements_carry_chk check (
    final_creator_payable_jpy = creator_payable_current_period_jpy + carry_forward_in_jpy
    and (
      (minimum_payout_met and final_creator_payable_jpy >= 1000 and payout_amount_jpy = final_creator_payable_jpy and carry_forward_out_jpy = 0)
      or
      (not minimum_payout_met and final_creator_payable_jpy < 1000 and payout_amount_jpy = 0 and carry_forward_out_jpy = final_creator_payable_jpy)
    )
  ),
  constraint monthly_settlements_retained_chk check (
    tasful_retained_revenue_jpy = creator_attributed_net_jpy - creator_payable_current_period_jpy
  ),
  constraint monthly_settlements_cost_chk check (
    (attributable_cost_status = 'COMPLETE_ACTUAL'
      and verified_attributable_cost_jpy is not null
      and jsonb_array_length(verified_attributable_cost_evidence_ids) > 0
      and contribution_profit_jpy = tasful_retained_revenue_jpy - verified_attributable_cost_jpy)
    or
    (attributable_cost_status <> 'COMPLETE_ACTUAL'
      and verified_attributable_cost_jpy is null
      and jsonb_array_length(verified_attributable_cost_evidence_ids) = 0
      and contribution_profit_jpy is null)
  ),
  constraint monthly_settlements_tax_fail_closed_chk check (tax_policy_status = 'NOT_CONFIGURED'),
  constraint monthly_settlements_creator_period_version_uniq unique (creator_id, settlement_period, version),
  constraint monthly_settlements_finalization_key_uniq unique (finalization_key)
);

comment on table tlv.monthly_settlements is
  'Creator x JST month deterministic immutable settlement snapshots; NOT a second financial ledger';
comment on column tlv.monthly_settlements.tax_policy_status is
  'STEP 3B expert gate. NOT_CONFIGURED means Production transfer must fail closed; never infer zero tax.';
comment on column tlv.monthly_settlements.contribution_profit_jpy is
  'TASFUL retained revenue minus verified attributable actual costs; not corporate net income.';

create unique index if not exists monthly_settlements_one_locked_period_idx
  on tlv.monthly_settlements (creator_id, settlement_period)
  where status in ('FINALIZED', 'TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED');
create index if not exists monthly_settlements_creator_period_idx
  on tlv.monthly_settlements (creator_id, settlement_period desc, version desc);
create index if not exists monthly_settlements_status_idx
  on tlv.monthly_settlements (status, settlement_period);
create unique index if not exists monthly_settlements_carry_source_uniq
  on tlv.monthly_settlements (carry_forward_source_settlement_id)
  where carry_forward_source_settlement_id is not null;

create or replace function tlv.validate_monthly_settlement_carry_source()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_source tlv.monthly_settlements%rowtype;
begin
  if new.carry_forward_in_jpy = 0 then
    if new.carry_forward_source_settlement_id is not null then
      raise exception 'zero_carry_must_not_have_source';
    end if;
    return new;
  end if;
  if new.carry_forward_source_settlement_id is null then
    raise exception 'carry_source_settlement_required';
  end if;
  select * into v_source
  from tlv.monthly_settlements
  where id = new.carry_forward_source_settlement_id;
  if not found
    or v_source.creator_id <> new.creator_id
    or v_source.carry_forward_out_jpy <> new.carry_forward_in_jpy
    or v_source.status not in ('FINALIZED', 'TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED')
  then
    raise exception 'creator_specific_finalized_carry_source_required';
  end if;
  return new;
end;
$$;

drop trigger if exists monthly_settlements_carry_source_guard on tlv.monthly_settlements;
create trigger monthly_settlements_carry_source_guard
  before insert or update on tlv.monthly_settlements
  for each row execute function tlv.validate_monthly_settlement_carry_source();

-- Correct the legacy tip RPC UTC ledger_month at the canonical ledger boundary.
-- Existing rows use created_at as their best available occurrence evidence.
alter table tlv.revenue_ledger
  add column if not exists occurred_at timestamptz,
  add column if not exists payment_provider_event_id uuid references tlv.payment_provider_events (id) on delete set null,
  add column if not exists adjustment_kind text,
  add column if not exists adjustment_of_settlement_id uuid references tlv.monthly_settlements (id) on delete restrict;

update tlv.revenue_ledger
set occurred_at = created_at
where occurred_at is null;

alter table tlv.revenue_ledger alter column occurred_at set default now();
alter table tlv.revenue_ledger alter column occurred_at set not null;
alter table tlv.revenue_ledger drop constraint if exists revenue_ledger_adjustment_kind_chk;
alter table tlv.revenue_ledger add constraint revenue_ledger_adjustment_kind_chk check (
  (event_kind = 'adjustment'
    and adjustment_kind in ('REFUND', 'CHARGEBACK', 'OTHER')
    and (adjustment_kind = 'OTHER' or payment_provider_event_id is not null))
  or (event_kind <> 'adjustment' and adjustment_kind is null)
) not valid;

create or replace function tlv.enforce_revenue_ledger_jst_period()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_economic_period char(7);
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

drop trigger if exists revenue_ledger_jst_period_guard on tlv.revenue_ledger;
create trigger revenue_ledger_jst_period_guard
  before insert on tlv.revenue_ledger
  for each row execute function tlv.enforce_revenue_ledger_jst_period();

create index if not exists revenue_ledger_occurred_creator_idx
  on tlv.revenue_ledger (creator_id, occurred_at desc);
create index if not exists revenue_ledger_provider_event_idx
  on tlv.revenue_ledger (payment_provider_event_id)
  where payment_provider_event_id is not null;
create unique index if not exists revenue_ledger_adjustment_provider_event_uniq
  on tlv.revenue_ledger (payment_provider_event_id)
  where event_kind = 'adjustment' and payment_provider_event_id is not null;

-- Read-only reconciliation projection for historical rows created before the
-- INSERT trigger. It derives fee/Net from existing allocation evidence without
-- updating the append-only canonical ledger and carries the ledger row id.
create or replace view tlv.settlement_revenue_ledger_input_v1
with (security_invoker = true)
as
select
  rl.id,
  'tlv.revenue_ledger'::text as source_table,
  rl.creator_id,
  rl.event_kind,
  rl.ledger_month as recognition_period,
  rl.occurred_at,
  case when rl.event_kind in ('gift', 'extension') then alloc.gross_jpy else rl.gross_amount_jpy end as gross_amount_jpy,
  case when rl.event_kind in ('gift', 'extension') then alloc.fee_jpy else rl.fee_amount_jpy end as provider_payment_fee_jpy,
  case when rl.event_kind in ('gift', 'extension') then alloc.net_jpy else rl.net_amount_jpy end as net_amount_jpy,
  case
    when rl.adjustment_kind is not null then rl.adjustment_kind
    when rl.notes like 'refund:%' then 'REFUND'
    when rl.notes like 'chargeback:%' then 'CHARGEBACK'
    else null
  end as adjustment_kind,
  rl.adjustment_of_settlement_id,
  rl.notes,
  rl.payment_provider_event_id,
  provider_events.payment_provider_event_ids,
  rl.payment_id,
  rl.tip_id,
  rl.self_gift_excluded,
  alloc.coin_lot_ids,
  case
    when rl.event_kind in ('gift', 'extension') then alloc.allocation_count > 0
    when rl.event_kind = 'adjustment' then coalesce(
      rl.adjustment_kind,
      case when rl.notes like 'refund:%' then 'REFUND' when rl.notes like 'chargeback:%' then 'CHARGEBACK' end
    ) in ('REFUND', 'CHARGEBACK')
    else false
  end as settlement_input_reconciled
from tlv.revenue_ledger rl
left join lateral (
  select
    count(*)::integer as allocation_count,
    sum(a.gross_allocated_jpy)::bigint as gross_jpy,
    sum(a.gross_allocated_jpy - a.net_allocated_jpy)::bigint as fee_jpy,
    sum(a.net_allocated_jpy)::bigint as net_jpy,
    jsonb_agg(a.coin_lot_id order by a.created_at, a.coin_lot_id) as coin_lot_ids
  from tlv.tip_coin_lot_allocations a
  where a.tip_id = rl.tip_id
) alloc on true
left join lateral (
  select jsonb_agg(ppe.id order by ppe.received_at, ppe.id) as payment_provider_event_ids
  from tlv.payment_provider_events ppe
  where ppe.payment_id = rl.payment_id
) provider_events on true;

comment on view tlv.settlement_revenue_ledger_input_v1 is
  'Service-only reconciled projection of canonical ledger rows; not a financial ledger and no historical mutation.';

create table if not exists tlv.settlement_ledger_links (
  settlement_id       uuid not null references tlv.monthly_settlements (id) on delete restrict,
  revenue_ledger_id   uuid not null references tlv.revenue_ledger (id) on delete restrict,
  correlation         jsonb not null default '{}'::jsonb,
  economic_period     char(7) not null,
  recognition_period  char(7) not null,
  adjustment_of_settlement_id uuid references tlv.monthly_settlements (id) on delete restrict,
  created_at          timestamptz not null default now(),
  primary key (settlement_id, revenue_ledger_id),
  constraint settlement_links_period_chk check (
    economic_period ~ '^\d{4}-(0[1-9]|1[0-2])$'
    and recognition_period ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  constraint settlement_links_correlation_chk check (
    jsonb_typeof(correlation) = 'object' and correlation <> '{}'::jsonb
  )
);

comment on table tlv.settlement_ledger_links is
  'Trace links to canonical tlv.revenue_ledger; carries no independent financial amount.';

create table if not exists tlv.settlement_state_events (
  id                uuid primary key default gen_random_uuid(),
  settlement_id     uuid not null references tlv.monthly_settlements (id) on delete restrict,
  from_status       tlv.settlement_status,
  to_status         tlv.settlement_status not null,
  transition_key    text not null unique,
  evidence          jsonb not null,
  actor_id           text not null,
  occurred_at        timestamptz not null,
  created_at         timestamptz not null default now(),
  constraint settlement_state_events_evidence_chk check (
    jsonb_typeof(evidence) = 'object' and evidence <> '{}'::jsonb
  )
);

create table if not exists tlv.settlement_hold_events (
  id                uuid primary key default gen_random_uuid(),
  settlement_id     uuid not null references tlv.monthly_settlements (id) on delete restrict,
  action            text not null check (action in ('PLACED', 'RELEASED')),
  reason_code       text not null,
  evidence          jsonb not null,
  actor_id           text not null,
  approved_by        text,
  idempotency_key   text not null unique,
  occurred_at        timestamptz not null,
  created_at         timestamptz not null default now(),
  constraint settlement_hold_events_evidence_chk check (
    jsonb_typeof(evidence) = 'object' and evidence <> '{}'::jsonb
    and (action <> 'RELEASED' or approved_by is not null)
  )
);

comment on table tlv.settlement_hold_events is
  'Append-only current hold evidence. FINALIZED financial snapshot remains immutable; RELEASED requires explicit Human approval.';

create or replace view tlv.current_settlement_hold_v1
with (security_invoker = true)
as
select distinct on (h.settlement_id)
  h.settlement_id,
  (h.action = 'PLACED') as active,
  h.action,
  h.reason_code,
  h.evidence,
  h.actor_id,
  h.approved_by,
  h.occurred_at
from tlv.settlement_hold_events h
order by h.settlement_id, h.occurred_at desc, h.created_at desc, h.id desc;

create or replace function tlv.reject_append_only_financial_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'append_only_financial_object_mutation_forbidden:%', tg_table_schema || '.' || tg_table_name;
end;
$$;

drop trigger if exists revenue_ledger_append_only_guard on tlv.revenue_ledger;
create trigger revenue_ledger_append_only_guard
  before update or delete on tlv.revenue_ledger
  for each row execute function tlv.reject_append_only_financial_mutation();

drop trigger if exists settlement_ledger_links_append_only_guard on tlv.settlement_ledger_links;
create trigger settlement_ledger_links_append_only_guard
  before update or delete on tlv.settlement_ledger_links
  for each row execute function tlv.reject_append_only_financial_mutation();

drop trigger if exists settlement_state_events_append_only_guard on tlv.settlement_state_events;
create trigger settlement_state_events_append_only_guard
  before update or delete on tlv.settlement_state_events
  for each row execute function tlv.reject_append_only_financial_mutation();

drop trigger if exists settlement_hold_events_append_only_guard on tlv.settlement_hold_events;
create trigger settlement_hold_events_append_only_guard
  before update or delete on tlv.settlement_hold_events
  for each row execute function tlv.reject_append_only_financial_mutation();

alter table tlv.payout_log
  add column if not exists settlement_id uuid references tlv.monthly_settlements (id) on delete restrict,
  add column if not exists correlation_id uuid,
  add column if not exists transfer_idempotency_key text,
  add column if not exists provider_transfer_id text,
  add column if not exists provider_payout_id text,
  add column if not exists transfer_evidence jsonb;

alter table tlv.payout_log alter column base_rate drop not null;
alter table tlv.payout_log alter column effective_rate drop not null;
alter table tlv.payout_log alter column override_tier drop not null;
alter table tlv.payout_log alter column override_tier drop default;
alter table tlv.payout_log drop constraint if exists payout_log_settlement_no_legacy_rate_chk;
alter table tlv.payout_log add constraint payout_log_settlement_no_legacy_rate_chk check (
  settlement_id is null or (base_rate is null and effective_rate is null and override_tier is null)
);

create unique index if not exists payout_log_settlement_uniq
  on tlv.payout_log (settlement_id) where settlement_id is not null;
create unique index if not exists payout_log_transfer_idempotency_uniq
  on tlv.payout_log (transfer_idempotency_key) where transfer_idempotency_key is not null;
create unique index if not exists payout_log_correlation_uniq
  on tlv.payout_log (correlation_id) where correlation_id is not null;
create unique index if not exists payout_log_provider_transfer_uniq
  on tlv.payout_log (provider_transfer_id) where provider_transfer_id is not null;
create unique index if not exists payout_log_provider_payout_uniq
  on tlv.payout_log (provider_payout_id) where provider_payout_id is not null;

comment on column tlv.payout_log.settlement_id is
  'STEP 4 authoritative payout basis. Legacy base_rate/effective_rate/override_tier must not determine new payouts.';

create or replace function tlv.validate_monthly_settlement_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_valid boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('OPEN', 'CALCULATED') then
      raise exception 'settlement_must_start_open_or_calculated';
    end if;
    if new.last_transition_key is null
      or new.last_transition_at is null
      or new.last_transition_actor is null
      or new.last_transition_evidence is null
      or jsonb_typeof(new.last_transition_evidence) <> 'object'
      or new.last_transition_evidence = '{}'::jsonb
    then
      raise exception 'initial_settlement_audit_evidence_required';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('FINALIZED', 'TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED') then
      raise exception 'finalized_settlement_delete_forbidden';
    end if;
    return old;
  end if;

  if old.status = new.status then
    if old is not distinct from new then return new; end if;
    raise exception 'same_status_snapshot_update_forbidden_create_new_version';
  end if;

  v_valid := case old.status::text
    when 'OPEN' then new.status::text = 'CALCULATED'
    when 'CALCULATED' then new.status::text = 'REVIEWABLE'
    when 'REVIEWABLE' then new.status::text = 'FINALIZED'
    when 'FINALIZED' then new.status::text = 'TRANSFER_PENDING'
    when 'TRANSFER_PENDING' then new.status::text in ('TRANSFERRED', 'TRANSFER_UNKNOWN', 'FAILED')
    when 'TRANSFER_UNKNOWN' then new.status::text in ('TRANSFERRED', 'FAILED')
    when 'FAILED' then new.status::text = 'TRANSFER_PENDING'
    when 'TRANSFERRED' then new.status::text = 'PAID'
    else false
  end;
  if not v_valid then raise exception 'invalid_settlement_transition:%->%', old.status, new.status; end if;

  if new.last_transition_key is null
    or new.last_transition_key is not distinct from old.last_transition_key
    or new.last_transition_at is null
    or new.last_transition_actor is null
    or new.last_transition_evidence is null
    or jsonb_typeof(new.last_transition_evidence) <> 'object'
    or new.last_transition_evidence = '{}'::jsonb
  then
    raise exception 'transition_audit_evidence_required';
  end if;

  if old.status in ('FINALIZED', 'TRANSFER_PENDING', 'TRANSFERRED', 'TRANSFER_UNKNOWN', 'PAID', 'FAILED') and (
    old.creator_id is distinct from new.creator_id
    or old.settlement_period is distinct from new.settlement_period
    or old.timezone is distinct from new.timezone
    or old.calculation_version is distinct from new.calculation_version
    or old.policy_version is distinct from new.policy_version
    or old.version is distinct from new.version
    or old.source_ledger_ids is distinct from new.source_ledger_ids
    or old.source_correlations is distinct from new.source_correlations
    or old.gross_jpy is distinct from new.gross_jpy
    or old.provider_payment_fee_jpy is distinct from new.provider_payment_fee_jpy
    or old.refund_jpy is distinct from new.refund_jpy
    or old.chargeback_jpy is distinct from new.chargeback_jpy
    or old.creator_attributed_net_jpy is distinct from new.creator_attributed_net_jpy
    or old.eligible_net_basis_jpy is distinct from new.eligible_net_basis_jpy
    or old.revenue_share_model is distinct from new.revenue_share_model
    or old.applied_marginal_bracket is distinct from new.applied_marginal_bracket
    or old.creator_marginal_share_rate_pct is distinct from new.creator_marginal_share_rate_pct
    or old.tasful_marginal_retained_rate_pct is distinct from new.tasful_marginal_retained_rate_pct
    or old.creator_effective_share_rate_pct is distinct from new.creator_effective_share_rate_pct
    or old.tasful_effective_share_rate_pct is distinct from new.tasful_effective_share_rate_pct
    or old.revenue_share_brackets is distinct from new.revenue_share_brackets
    or old.creator_amount_before_rounding_jpy is distinct from new.creator_amount_before_rounding_jpy
    or old.rounding_residual_jpy is distinct from new.rounding_residual_jpy
    or old.creator_payable_current_period_jpy is distinct from new.creator_payable_current_period_jpy
    or old.carry_forward_in_jpy is distinct from new.carry_forward_in_jpy
    or old.carry_forward_source_settlement_id is distinct from new.carry_forward_source_settlement_id
    or old.carry_forward_out_jpy is distinct from new.carry_forward_out_jpy
    or old.final_creator_payable_jpy is distinct from new.final_creator_payable_jpy
    or old.payout_amount_jpy is distinct from new.payout_amount_jpy
    or old.hold_state is distinct from new.hold_state
    or old.verified_attributable_cost_jpy is distinct from new.verified_attributable_cost_jpy
    or old.verified_attributable_cost_evidence_ids is distinct from new.verified_attributable_cost_evidence_ids
    or old.contribution_profit_jpy is distinct from new.contribution_profit_jpy
    or old.financial_snapshot_hash is distinct from new.financial_snapshot_hash
  ) then
    raise exception 'immutable_finalized_snapshot_changed';
  end if;

  if new.status = 'FINALIZED' and (
    new.finalized_at is null or new.finalized_by is null or new.finalization_key is null
    or new.finalized_snapshot_hash is null
  ) then
    raise exception 'finalization_evidence_required';
  end if;
  if new.status = 'TRANSFER_PENDING' then
    if new.transfer_instruction is null
      or coalesce((new.hold_state->>'active')::boolean, false)
      or not new.minimum_payout_met
      or new.payout_amount_jpy < 1000
      or new.transfer_instruction->>'settlement_id' <> new.id::text
      or new.transfer_instruction->>'creator_id' <> new.creator_id::text
      or (new.transfer_instruction->>'amount_jpy')::bigint <> new.payout_amount_jpy
      or new.transfer_instruction->>'currency' <> new.currency::text
      or new.transfer_instruction->>'policy_version' <> new.policy_version
      or nullif(new.transfer_instruction->>'provider_account_binding', '') is null
      or nullif(new.transfer_instruction->>'idempotency_key', '') is null
      or new.transfer_instruction->>'environment' not in ('test', 'sandbox', 'production')
      or coalesce((new.transfer_instruction->>'provider_execution_performed')::boolean, true)
    then
      raise exception 'transfer_instruction_or_snapshot_gate_failed';
    end if;
    if new.transfer_instruction->>'environment' = 'production' and new.tax_policy_status <> 'EXPERT_APPROVED' then
      raise exception 'tax_policy_not_configured';
    end if;
    if exists (
      select 1 from tlv.current_settlement_hold_v1 h
      where h.settlement_id = new.id and h.active
    ) then
      raise exception 'active_operational_hold_blocks_transfer';
    end if;
    if old.status = 'FAILED' and (
      coalesce((new.last_transition_evidence->>'retry_safe')::boolean, false) is not true
      or old.transfer_instruction is distinct from new.transfer_instruction
    ) then
      raise exception 'retry_safety_or_idempotency_failed';
    end if;
  end if;
  if new.status = 'TRANSFERRED' and new.provider_transfer_id is null then
    raise exception 'provider_transfer_evidence_required';
  end if;
  if new.status = 'TRANSFER_UNKNOWN' and new.provider_correlation_id is null then
    raise exception 'provider_correlation_required';
  end if;
  if new.status = 'FAILED' and coalesce((new.last_transition_evidence->>'provider_confirmed_no_transfer')::boolean, false) is not true then
    raise exception 'provider_no_transfer_confirmation_required';
  end if;
  if new.status = 'PAID' and (
    new.provider_payout_id is null
    or coalesce((new.last_transition_evidence->>'external_payout_confirmed')::boolean, false) is not true
  ) then
    raise exception 'provider_payout_evidence_required';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists monthly_settlements_mutation_guard on tlv.monthly_settlements;
create trigger monthly_settlements_mutation_guard
  before insert or update or delete on tlv.monthly_settlements
  for each row execute function tlv.validate_monthly_settlement_mutation();

create or replace function tlv.audit_monthly_settlement_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into tlv.settlement_state_events (
      settlement_id, from_status, to_status, transition_key, evidence, actor_id, occurred_at
    ) values (
      new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, new.last_transition_key,
      new.last_transition_evidence, new.last_transition_actor, new.last_transition_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists monthly_settlements_transition_audit on tlv.monthly_settlements;
create trigger monthly_settlements_transition_audit
  after insert or update on tlv.monthly_settlements
  for each row execute function tlv.audit_monthly_settlement_transition();

create or replace function tlv.transition_monthly_settlement(
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
  v_settlement tlv.monthly_settlements%rowtype;
  v_event tlv.settlement_state_events%rowtype;
begin
  if nullif(trim(p_transition_key), '') is null
    or nullif(trim(p_actor_id), '') is null
    or p_occurred_at is null
    or p_evidence is null
    or jsonb_typeof(p_evidence) <> 'object'
    or p_evidence = '{}'::jsonb
  then
    raise exception 'transition_audit_evidence_required';
  end if;

  select * into v_settlement
  from tlv.monthly_settlements
  where id = p_settlement_id
  for update;
  if not found then raise exception 'settlement_not_found'; end if;

  select * into v_event
  from tlv.settlement_state_events
  where transition_key = p_transition_key;
  if found then
    if v_event.settlement_id = p_settlement_id and v_event.to_status = p_to_status then
      return jsonb_build_object('ok', true, 'idempotent', true, 'settlement_id', p_settlement_id, 'status', v_settlement.status);
    end if;
    raise exception 'transition_key_collision';
  end if;

  if v_settlement.version <> p_expected_version then raise exception 'settlement_version_conflict'; end if;

  update tlv.monthly_settlements
  set
    status = p_to_status,
    reviewed_at = case when p_to_status = 'REVIEWABLE' then p_occurred_at else reviewed_at end,
    reviewed_by = case when p_to_status = 'REVIEWABLE' then p_actor_id else reviewed_by end,
    finalized_at = case when p_to_status = 'FINALIZED' then p_occurred_at else finalized_at end,
    finalized_by = case when p_to_status = 'FINALIZED' then p_actor_id else finalized_by end,
    finalization_key = case when p_to_status = 'FINALIZED' then p_transition_key else finalization_key end,
    finalized_snapshot_hash = case when p_to_status = 'FINALIZED' then nullif(p_transition_data->>'finalized_snapshot_hash', '') else finalized_snapshot_hash end,
    transfer_instruction = coalesce(p_transition_data->'transfer_instruction', transfer_instruction),
    provider_transfer_id = coalesce(nullif(p_transition_data->>'provider_transfer_id', ''), provider_transfer_id),
    provider_correlation_id = coalesce(nullif(p_transition_data->>'provider_correlation_id', ''), provider_correlation_id),
    provider_payout_id = coalesce(nullif(p_transition_data->>'provider_payout_id', ''), provider_payout_id),
    last_transition_key = p_transition_key,
    last_transition_at = p_occurred_at,
    last_transition_actor = p_actor_id,
    last_transition_evidence = p_evidence
  where id = p_settlement_id;

  return jsonb_build_object('ok', true, 'idempotent', false, 'settlement_id', p_settlement_id, 'status', p_to_status);
end;
$$;

create or replace function tlv.is_settlement_job_run(p_run_at timestamptz)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select extract(day from p_run_at at time zone 'Asia/Tokyo') = 1
    and extract(hour from p_run_at at time zone 'Asia/Tokyo') = 6
    and extract(minute from p_run_at at time zone 'Asia/Tokyo') = 0;
$$;

comment on function tlv.is_settlement_job_run(timestamptz) is
  'External scheduler runs daily at 21:00 UTC; only JST day 1 06:00 passes, targeting the preceding JST month.';

alter table tlv.monthly_settlements enable row level security;
alter table tlv.monthly_settlements force row level security;
alter table tlv.settlement_ledger_links enable row level security;
alter table tlv.settlement_ledger_links force row level security;
alter table tlv.settlement_state_events enable row level security;
alter table tlv.settlement_state_events force row level security;
alter table tlv.settlement_hold_events enable row level security;
alter table tlv.settlement_hold_events force row level security;
alter table tlv.payout_log enable row level security;
alter table tlv.payout_log force row level security;

drop policy if exists monthly_settlements_creator_select on tlv.monthly_settlements;
drop policy if exists monthly_settlements_ops_select on tlv.monthly_settlements;
create policy monthly_settlements_creator_select on tlv.monthly_settlements
  for select to authenticated using (tlv.is_creator_of(creator_id));
create policy monthly_settlements_ops_select on tlv.monthly_settlements
  for select to authenticated using (tlv.is_tlv_ops_admin());

drop policy if exists settlement_ledger_links_ops_select on tlv.settlement_ledger_links;
create policy settlement_ledger_links_ops_select on tlv.settlement_ledger_links
  for select to authenticated using (tlv.is_tlv_ops_admin());

drop policy if exists settlement_state_events_ops_select on tlv.settlement_state_events;
create policy settlement_state_events_ops_select on tlv.settlement_state_events
  for select to authenticated using (tlv.is_tlv_ops_admin());

drop policy if exists settlement_hold_events_ops_select on tlv.settlement_hold_events;
create policy settlement_hold_events_ops_select on tlv.settlement_hold_events
  for select to authenticated using (tlv.is_tlv_ops_admin());

drop policy if exists payout_log_creator_select on tlv.payout_log;
drop policy if exists payout_log_ops_select on tlv.payout_log;
create policy payout_log_creator_select on tlv.payout_log
  for select to authenticated using (tlv.is_creator_of(creator_id));
create policy payout_log_ops_select on tlv.payout_log
  for select to authenticated using (tlv.is_tlv_ops_admin());

revoke all on table tlv.monthly_settlements from public, anon, authenticated;
revoke all on table tlv.settlement_ledger_links from public, anon, authenticated;
revoke all on table tlv.settlement_state_events from public, anon, authenticated;
revoke all on table tlv.settlement_hold_events from public, anon, authenticated;
revoke all on table tlv.current_settlement_hold_v1 from public, anon, authenticated;
revoke all on table tlv.payout_log from public, anon, authenticated;
revoke all on table tlv.settlement_revenue_ledger_input_v1 from public, anon, authenticated;
grant select on table tlv.monthly_settlements to authenticated;
grant select on table tlv.settlement_ledger_links to authenticated;
grant select on table tlv.settlement_state_events to authenticated;
grant select on table tlv.settlement_hold_events to authenticated;
grant select on table tlv.payout_log to authenticated;
grant all on table tlv.monthly_settlements to service_role;
grant all on table tlv.settlement_ledger_links to service_role;
grant all on table tlv.settlement_state_events to service_role;
grant all on table tlv.settlement_hold_events to service_role;
grant select on table tlv.current_settlement_hold_v1 to service_role;
grant all on table tlv.payout_log to service_role;
grant select on table tlv.settlement_revenue_ledger_input_v1 to service_role;

revoke execute on function tlv.validate_monthly_settlement_mutation() from public, anon, authenticated;
revoke execute on function tlv.audit_monthly_settlement_transition() from public, anon, authenticated;
revoke execute on function tlv.enforce_revenue_ledger_jst_period() from public, anon, authenticated;
revoke execute on function tlv.validate_monthly_settlement_carry_source() from public, anon, authenticated;
revoke execute on function tlv.reject_append_only_financial_mutation() from public, anon, authenticated;
revoke execute on function tlv.transition_monthly_settlement(uuid, integer, tlv.settlement_status, text, text, timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function tlv.is_settlement_job_run(timestamptz) from public, anon, authenticated;
grant execute on function tlv.is_settlement_job_run(timestamptz) to service_role;
grant execute on function tlv.transition_monthly_settlement(uuid, integer, tlv.settlement_status, text, text, timestamptz, jsonb, jsonb) to service_role;

-- No cron, provider transfer, payout, tax calculation, Membership, or Ads enablement is performed here.

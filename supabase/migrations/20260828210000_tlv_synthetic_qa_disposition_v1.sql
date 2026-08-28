-- TLV STEP 5K: exact-seven Synthetic QA disposition and accounting neutralization candidate.
-- Canonical money remains tlv.revenue_ledger. This registry stores no monetary amount.
begin;

alter table tlv.revenue_ledger
  add column if not exists adjustment_of_revenue_ledger_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'tlv.revenue_ledger'::regclass
      and conname = 'revenue_ledger_adjustment_source_fk'
  ) then
    alter table tlv.revenue_ledger
      add constraint revenue_ledger_adjustment_source_fk
      foreign key (adjustment_of_revenue_ledger_id)
      references tlv.revenue_ledger(id) on delete restrict
      deferrable initially deferred;
  end if;
end
$$;

alter table tlv.revenue_ledger drop constraint if exists revenue_ledger_adjustment_kind_chk;
alter table tlv.revenue_ledger add constraint revenue_ledger_adjustment_kind_chk check (
  (event_kind = 'adjustment'
    and adjustment_kind in ('REFUND', 'CHARGEBACK', 'OTHER', 'SYNTHETIC_QA_NEUTRALIZATION')
    and (
      adjustment_kind in ('OTHER', 'SYNTHETIC_QA_NEUTRALIZATION')
      or payment_provider_event_id is not null
    ))
  or (event_kind <> 'adjustment' and adjustment_kind is null)
) not valid;

create unique index if not exists revenue_ledger_synthetic_qa_neutralization_source_uniq
  on tlv.revenue_ledger(adjustment_of_revenue_ledger_id)
  where adjustment_kind = 'SYNTHETIC_QA_NEUTRALIZATION';

create table if not exists tlv.revenue_disposition_events (
  id                            uuid primary key default gen_random_uuid(),
  correlation_id                text not null unique,
  source_revenue_ledger_id      uuid not null unique references tlv.revenue_ledger(id) on delete restrict,
  correction_revenue_ledger_id  uuid not null unique,
  target_tip_id                 uuid not null references tlv.tips(id) on delete restrict,
  fixture_case_id               text not null,
  classification                text not null default 'SYNTHETIC_QA',
  settlement_disposition        text not null default 'EXCLUDE_SYNTHETIC_QA',
  historical_origin             text not null default 'OPS_ADJUSTMENT_FIXTURE',
  provider_fee_semantics        text not null default 'NOT_APPLICABLE',
  original_lot_status           text not null default 'ORIGINAL_DELETED_UUID_REUSED',
  current_lot_link_prohibited   boolean not null default true,
  real_money_moved              boolean not null default false,
  accounting_effect             text not null default 'NEUTRALIZED_BY_APPEND_ONLY_CORRECTION',
  human_decision_ref            text not null,
  reason_code                   text not null default 'PRODUCTION_SYNTHETIC_QA_FIXTURE_RESIDUE',
  step5h_report_sha256          text not null,
  step5h_query_sha256           text not null,
  step5i_report_sha256          text not null,
  step5i5_report_sha256         text not null,
  tax_policy_status             text not null default 'NOT_CONFIGURED',
  contract_version              integer not null default 1,
  created_by                    text not null,
  created_at                    timestamptz not null default now(),
  constraint revenue_disposition_correction_fk
    foreign key (correction_revenue_ledger_id)
    references tlv.revenue_ledger(id) on delete restrict
    deferrable initially deferred,
  constraint revenue_disposition_case_chk check (
    fixture_case_id in ('T-TIP-01','T-TIP-02','T-TIP-03-1','T-TIP-03-2','T-TIP-03-3','T-TIP-08A','T-TIP-08B')
  ),
  constraint revenue_disposition_case_version_uniq unique (fixture_case_id, contract_version),
  constraint revenue_disposition_semantics_chk check (
    classification = 'SYNTHETIC_QA'
    and settlement_disposition = 'EXCLUDE_SYNTHETIC_QA'
    and historical_origin = 'OPS_ADJUSTMENT_FIXTURE'
    and provider_fee_semantics = 'NOT_APPLICABLE'
    and original_lot_status = 'ORIGINAL_DELETED_UUID_REUSED'
    and current_lot_link_prohibited
    and not real_money_moved
    and accounting_effect = 'NEUTRALIZED_BY_APPEND_ONLY_CORRECTION'
    and human_decision_ref = 'STEP5J-HG-SYNQA-7-20260828-V1'
    and reason_code = 'PRODUCTION_SYNTHETIC_QA_FIXTURE_RESIDUE'
    and tax_policy_status = 'NOT_CONFIGURED'
    and contract_version = 1
  ),
  constraint revenue_disposition_hashes_chk check (
    step5h_report_sha256 = '2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD'
    and step5h_query_sha256 = '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A'
    and step5i_report_sha256 = 'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099'
    and step5i5_report_sha256 = '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059'
  ),
  constraint revenue_disposition_correlation_chk check (
    correlation_id = 'TLV-SYNQA-TTIP-202607-V1-' || fixture_case_id
  ),
  constraint revenue_disposition_created_by_chk check (length(btrim(created_by)) between 1 and 160)
);

comment on table tlv.revenue_disposition_events is
  'Append-only non-financial audit/exclusion registry. Contains no monetary amount; tlv.revenue_ledger remains the only financial SSOT.';

create or replace function tlv.enforce_synthetic_qa_neutralization_shape()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_source tlv.revenue_ledger%rowtype;
begin
  if new.adjustment_kind is distinct from 'SYNTHETIC_QA_NEUTRALIZATION' then
    return new;
  end if;

  if new.adjustment_of_revenue_ledger_id is null then
    raise exception 'synthetic_qa_neutralization_source_required';
  end if;
  select * into v_source
  from tlv.revenue_ledger
  where id = new.adjustment_of_revenue_ledger_id;
  if not found then raise exception 'synthetic_qa_neutralization_source_not_found'; end if;

  if v_source.event_kind not in ('gift','extension')
     or v_source.creator_id <> new.creator_id
     or new.event_kind <> 'adjustment'
     or new.gross_amount_jpy <> -v_source.gross_amount_jpy
     or new.fee_amount_jpy <> 0
     or new.net_amount_jpy <> -v_source.net_amount_jpy
     or new.infra_cost_jpy <> 0
     or new.creator_payout_jpy <> 0
     or new.platform_revenue_jpy <> -v_source.platform_revenue_jpy
     or new.stream_id is not null
     or new.payment_id is not null
     or new.tip_id is not null
     or new.payment_provider_event_id is not null
     or new.adjustment_of_settlement_id is not null
     or new.self_gift_excluded then
    raise exception 'invalid_synthetic_qa_neutralization_shape';
  end if;
  return new;
end
$$;

drop trigger if exists revenue_ledger_synthetic_qa_neutralization_guard on tlv.revenue_ledger;
create trigger revenue_ledger_synthetic_qa_neutralization_guard
  before insert on tlv.revenue_ledger
  for each row execute function tlv.enforce_synthetic_qa_neutralization_shape();

create or replace function tlv.assert_synthetic_qa_disposition_pair()
returns trigger
language plpgsql
set search_path = pg_catalog, tlv
as $$
declare
  v_event tlv.revenue_disposition_events%rowtype;
  v_source tlv.revenue_ledger%rowtype;
  v_correction tlv.revenue_ledger%rowtype;
begin
  if tg_table_name = 'revenue_ledger' then
    if new.adjustment_kind is distinct from 'SYNTHETIC_QA_NEUTRALIZATION' then
      return null;
    end if;
    select * into v_event from tlv.revenue_disposition_events
    where correction_revenue_ledger_id = new.id;
    if not found then raise exception 'synthetic_qa_neutralization_disposition_required'; end if;
  else
    v_event := new;
  end if;

  select * into v_source from tlv.revenue_ledger where id = v_event.source_revenue_ledger_id;
  select * into v_correction from tlv.revenue_ledger where id = v_event.correction_revenue_ledger_id;
  if not found
     or v_source.tip_id is distinct from v_event.target_tip_id
     or v_source.creator_id <> v_correction.creator_id
     or v_correction.adjustment_kind <> 'SYNTHETIC_QA_NEUTRALIZATION'
     or v_correction.adjustment_of_revenue_ledger_id is distinct from v_source.id
     or v_correction.gross_amount_jpy <> -v_source.gross_amount_jpy
     or v_correction.net_amount_jpy <> -v_source.net_amount_jpy
     or v_correction.platform_revenue_jpy <> -v_source.platform_revenue_jpy
     or v_correction.creator_payout_jpy <> 0 then
    raise exception 'incomplete_synthetic_qa_disposition_pair';
  end if;
  return null;
end
$$;

drop trigger if exists revenue_disposition_pair_guard on tlv.revenue_disposition_events;
create constraint trigger revenue_disposition_pair_guard
  after insert or update on tlv.revenue_disposition_events
  deferrable initially deferred
  for each row execute function tlv.assert_synthetic_qa_disposition_pair();

drop trigger if exists revenue_ledger_disposition_pair_guard on tlv.revenue_ledger;
create constraint trigger revenue_ledger_disposition_pair_guard
  after insert or update on tlv.revenue_ledger
  deferrable initially deferred
  for each row execute function tlv.assert_synthetic_qa_disposition_pair();

drop trigger if exists revenue_disposition_append_only_guard on tlv.revenue_disposition_events;
create trigger revenue_disposition_append_only_guard
  before update or delete on tlv.revenue_disposition_events
  for each row execute function tlv.reject_append_only_financial_mutation();

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
  end as settlement_input_reconciled,
  disposition.settlement_disposition,
  disposition.id as disposition_event_id,
  disposition.classification as disposition_classification,
  case
    when disposition.source_revenue_ledger_id = rl.id then 'ORIGINAL_SOURCE'
    when disposition.correction_revenue_ledger_id = rl.id then 'ACCOUNTING_NEUTRALIZATION'
    else null
  end as disposition_source_role,
  case when disposition.id is null then false else (
    disposition.classification = 'SYNTHETIC_QA'
    and disposition.settlement_disposition = 'EXCLUDE_SYNTHETIC_QA'
    and disposition.human_decision_ref = 'STEP5J-HG-SYNQA-7-20260828-V1'
    and disposition.provider_fee_semantics = 'NOT_APPLICABLE'
    and disposition.current_lot_link_prohibited
    and not disposition.real_money_moved
    and disposition.step5h_report_sha256 ~ '^[0-9A-F]{64}$'
    and disposition.step5h_query_sha256 ~ '^[0-9A-F]{64}$'
    and disposition.step5i_report_sha256 ~ '^[0-9A-F]{64}$'
    and disposition.step5i5_report_sha256 ~ '^[0-9A-F]{64}$'
  ) end as disposition_evidence_valid,
  case when disposition.id is null then false else (
    exists (select 1 from tlv.revenue_ledger source where source.id = disposition.source_revenue_ledger_id)
    and exists (
      select 1 from tlv.revenue_ledger correction
      where correction.id = disposition.correction_revenue_ledger_id
        and correction.adjustment_kind = 'SYNTHETIC_QA_NEUTRALIZATION'
        and correction.adjustment_of_revenue_ledger_id = disposition.source_revenue_ledger_id
    )
  ) end as disposition_complete
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
) provider_events on true
left join tlv.revenue_disposition_events disposition
  on disposition.source_revenue_ledger_id = rl.id
  or disposition.correction_revenue_ledger_id = rl.id;

comment on view tlv.settlement_revenue_ledger_input_v1 is
  'Service-only canonical projection with explicit immutable disposition evidence; rows are never silently filtered.';

create or replace view tlv.synthetic_qa_disposition_reconciliation_v1
with (security_invoker = true)
as
select
  disposition.id as disposition_event_id,
  disposition.correlation_id,
  disposition.fixture_case_id,
  disposition.source_revenue_ledger_id,
  disposition.correction_revenue_ledger_id,
  disposition.target_tip_id,
  disposition.classification as audit_disposition,
  disposition.settlement_disposition as settlement_eligibility,
  disposition.real_money_moved,
  disposition.historical_origin,
  disposition.provider_fee_semantics,
  disposition.accounting_effect,
  source.platform_revenue_jpy as source_platform_jpy,
  correction.platform_revenue_jpy as correction_platform_jpy,
  source.platform_revenue_jpy + correction.platform_revenue_jpy as net_real_tasful_jpy,
  source.creator_payout_jpy + correction.creator_payout_jpy as creator_payable_jpy,
  disposition.tax_policy_status,
  disposition.created_at
from tlv.revenue_disposition_events disposition
join tlv.revenue_ledger source on source.id = disposition.source_revenue_ledger_id
join tlv.revenue_ledger correction on correction.id = disposition.correction_revenue_ledger_id;

comment on view tlv.synthetic_qa_disposition_reconciliation_v1 is
  'Read-only derived reconciliation; stores no amount and is not a financial SSOT.';

create or replace function tlv.apply_synthetic_qa_disposition_v1(
  p_recognition_occurred_at timestamptz,
  p_step5h_report_sha256 text,
  p_step5h_query_sha256 text,
  p_step5i_report_sha256 text,
  p_step5i5_report_sha256 text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, tlv
as $$
declare
  v_target_count integer;
  v_expected_match_count integer;
  v_full_signature_count integer;
  v_unexpected_count integer;
  v_event_count integer;
  v_correction_count integer;
  v_valid_existing_count integer;
  v_source record;
  v_correction_id uuid;
  v_created integer := 0;
  v_neutralized bigint := 0;
begin
  if p_recognition_occurred_at is null then raise exception 'recognition_occurred_at_required'; end if;
  if length(btrim(coalesce(p_created_by,''))) = 0 then raise exception 'created_by_required'; end if;
  if upper(coalesce(p_step5h_report_sha256,'')) <> '2BFCBB7C481523C89EFA7EB7FA487CCD4409B2D2CD6F88435360B427747DE0FD'
     or upper(coalesce(p_step5h_query_sha256,'')) <> '7CB60D8ECAF674A5D35997BF8FC80EE8DD66C61A73EADF659070D752B23AF01A'
     or upper(coalesce(p_step5i_report_sha256,'')) <> 'DD3AD2D1F6248A219A4267601E29C9995F3F15D486BACAB2856D702CDCD96099'
     or upper(coalesce(p_step5i5_report_sha256,'')) <> '7B09721EC2AD8FE36AD51B028DF07B6197223AFE8DC15F61CA84C3587B564059' then
    raise exception 'complete_evidence_hashes_required';
  end if;

  with expected(case_code, idempotency_key, tip_kind, coins_amount, stream_id) as (
    values
      ('T-TIP-01',  'tlv-staging-tip-01',   'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000001'::uuid),
      ('T-TIP-02',  'tlv-staging-tip-02',   'gift'::tlv.tip_kind,        50, 'b0000000-0000-4000-8000-000000000002'::uuid),
      ('T-TIP-03-1','tlv-staging-tip-03-1', 'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000003'::uuid),
      ('T-TIP-03-2','tlv-staging-tip-03-2', 'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000003'::uuid),
      ('T-TIP-03-3','tlv-staging-tip-03-3', 'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000003'::uuid),
      ('T-TIP-08A', 'tlv-staging-tip-08a',  'extension'::tlv.tip_kind,  500, 'b0000000-0000-4000-8000-000000000008'::uuid),
      ('T-TIP-08B', 'tlv-staging-tip-08b',  'extension'::tlv.tip_kind,  500, 'b0000000-0000-4000-8000-000000000008'::uuid)
  ), candidate as (
    select rl.*, t.id as target_tip_id, t.creator_id as tip_creator_id,
      t.payer_user_id, t.payer_user_uuid, t.payment_id as tip_payment_id,
      t.stream_id as tip_stream_id, t.self_gift_flag, t.self_gift_confirmed,
      t.bot_suspect_flag, t.fraud_excluded,
      t.tip_kind, t.coins_amount, t.gross_amount_jpy as tip_gross_jpy,
      t.net_amount_jpy as tip_net_jpy, t.web_origin_coins, t.app_origin_coins,
      t.web_origin_net_jpy, t.app_origin_net_jpy, t.wr_at_tip,
      e.case_code, e.tip_kind as expected_tip_kind,
      e.coins_amount as expected_coins_amount, e.stream_id as expected_stream_id,
      (select count(*) from tlv.tip_coin_lot_allocations a where a.tip_id=t.id) as allocation_count,
      (select count(*) from tlv.wallet_ledger wl where wl.tip_id=t.id) as wallet_debit_count,
      (select count(*) from tlv.creator_score_events cse where cse.source_table='tips' and cse.source_id=t.id) as score_event_count
    from tlv.revenue_ledger rl
    join tlv.tips t on t.id=rl.tip_id
    left join expected e on e.idempotency_key=t.idempotency_key
    where rl.creator_id='a0000000-0000-4000-8000-000000000001'::uuid
      and t.creator_id=rl.creator_id
      and t.payer_user_uuid='a0000000-0000-4000-8000-000000000101'::uuid
      and t.payer_user_id='tlv-staging-tip-viewer'
      and rl.event_kind in ('gift','extension')
      and rl.ledger_month='2026-07'
      and not exists (select 1 from tlv.tip_coin_lot_allocations a where a.tip_id=t.id)
  )
  select
    count(*)::integer,
    count(*) filter (where case_code is not null)::integer,
    count(*) filter (where
      case_code is not null
      and tip_kind=expected_tip_kind and event_kind::text=expected_tip_kind::text
      and coins_amount=expected_coins_amount and tip_stream_id=expected_stream_id
      and tip_gross_jpy=expected_coins_amount::bigint*100 and tip_net_jpy=expected_coins_amount::bigint*100
      and gross_amount_jpy=expected_coins_amount::bigint*100 and fee_amount_jpy=0 and net_amount_jpy=expected_coins_amount::bigint*100
      and infra_cost_jpy=0 and creator_payout_jpy=0 and platform_revenue_jpy=expected_coins_amount::bigint*100
      and payment_id is null and tip_payment_id is null and tip_creator_id=creator_id
      and web_origin_coins=expected_coins_amount and app_origin_coins=0
      and web_origin_net_jpy=expected_coins_amount::bigint*100 and app_origin_net_jpy=0 and wr_at_tip=1
      and allocation_count=0 and wallet_debit_count=0 and score_event_count=1
      and not self_gift_excluded and not self_gift_flag and not self_gift_confirmed
      and not bot_suspect_flag and not fraud_excluded
      and not exists (select 1 from tlv.settlement_ledger_links sl where sl.revenue_ledger_id=candidate.id)
    )::integer,
    count(*) filter (where case_code is null)::integer
  into v_target_count, v_expected_match_count, v_full_signature_count, v_unexpected_count
  from candidate;

  if v_target_count <> 7 or v_expected_match_count <> 7
     or v_full_signature_count <> 7 or v_unexpected_count <> 0 then
    raise exception 'synthetic_qa_exact_seven_signature_required:target=% expected=% full=% unexpected=%',
      v_target_count, v_expected_match_count, v_full_signature_count, v_unexpected_count;
  end if;

  with target as (
    select rl.id from tlv.revenue_ledger rl join tlv.tips t on t.id=rl.tip_id
    where t.idempotency_key in ('tlv-staging-tip-01','tlv-staging-tip-02','tlv-staging-tip-03-1','tlv-staging-tip-03-2','tlv-staging-tip-03-3','tlv-staging-tip-08a','tlv-staging-tip-08b')
  )
  select
    (select count(*) from tlv.revenue_disposition_events d join target on target.id=d.source_revenue_ledger_id),
    (select count(*) from tlv.revenue_ledger correction join target on target.id=correction.adjustment_of_revenue_ledger_id where correction.adjustment_kind='SYNTHETIC_QA_NEUTRALIZATION')
  into v_event_count, v_correction_count;

  if v_event_count = 7 and v_correction_count = 7 then
    with target as (
      select rl.id from tlv.revenue_ledger rl join tlv.tips t on t.id=rl.tip_id
      where t.idempotency_key in ('tlv-staging-tip-01','tlv-staging-tip-02','tlv-staging-tip-03-1','tlv-staging-tip-03-2','tlv-staging-tip-03-3','tlv-staging-tip-08a','tlv-staging-tip-08b')
    )
    select count(*)::integer into v_valid_existing_count
    from tlv.revenue_disposition_events d
    join target on target.id=d.source_revenue_ledger_id
    join tlv.revenue_ledger source on source.id=d.source_revenue_ledger_id
    join tlv.revenue_ledger correction on correction.id=d.correction_revenue_ledger_id
    where d.step5h_report_sha256=upper(p_step5h_report_sha256)
      and d.step5h_query_sha256=upper(p_step5h_query_sha256)
      and d.step5i_report_sha256=upper(p_step5i_report_sha256)
      and d.step5i5_report_sha256=upper(p_step5i5_report_sha256)
      and correction.adjustment_kind='SYNTHETIC_QA_NEUTRALIZATION'
      and correction.adjustment_of_revenue_ledger_id=source.id
      and correction.gross_amount_jpy=-source.gross_amount_jpy
      and correction.net_amount_jpy=-source.net_amount_jpy
      and correction.platform_revenue_jpy=-source.platform_revenue_jpy
      and correction.creator_payout_jpy=0;
    if v_valid_existing_count <> 7 then raise exception 'synthetic_qa_idempotency_conflict'; end if;
    return jsonb_build_object('ok',true,'idempotent',true,'target_count',7,'events',7,'corrections',7,'neutralized_tasful_jpy',-145000,'financial_transaction_executed',false);
  elsif v_event_count <> 0 or v_correction_count <> 0 then
    raise exception 'partial_synthetic_qa_disposition_state:events=% corrections=%', v_event_count, v_correction_count;
  end if;

  for v_source in
    with expected(case_code, idempotency_key) as (values
      ('T-TIP-01','tlv-staging-tip-01'),('T-TIP-02','tlv-staging-tip-02'),
      ('T-TIP-03-1','tlv-staging-tip-03-1'),('T-TIP-03-2','tlv-staging-tip-03-2'),('T-TIP-03-3','tlv-staging-tip-03-3'),
      ('T-TIP-08A','tlv-staging-tip-08a'),('T-TIP-08B','tlv-staging-tip-08b')
    )
    select e.case_code, rl.*, t.id as target_tip_id
    from expected e join tlv.tips t on t.idempotency_key=e.idempotency_key
    join tlv.revenue_ledger rl on rl.tip_id=t.id
    order by e.case_code
    for update of rl
  loop
    v_correction_id := gen_random_uuid();
    insert into tlv.revenue_ledger(
      id, creator_id, event_kind, ledger_month,
      gross_amount_jpy, fee_amount_jpy, net_amount_jpy,
      infra_cost_jpy, creator_payout_jpy, platform_revenue_jpy,
      self_gift_excluded, created_at, occurred_at, adjustment_kind,
      adjustment_of_revenue_ledger_id
    ) values (
      v_correction_id, v_source.creator_id, 'adjustment',
      to_char(p_recognition_occurred_at at time zone 'Asia/Tokyo','YYYY-MM'),
      -v_source.gross_amount_jpy, 0, -v_source.net_amount_jpy,
      0, 0, -v_source.platform_revenue_jpy,
      false, p_recognition_occurred_at, p_recognition_occurred_at,
      'SYNTHETIC_QA_NEUTRALIZATION', v_source.id
    );

    insert into tlv.revenue_disposition_events(
      correlation_id, source_revenue_ledger_id, correction_revenue_ledger_id,
      target_tip_id, fixture_case_id, human_decision_ref,
      step5h_report_sha256, step5h_query_sha256,
      step5i_report_sha256, step5i5_report_sha256, created_by, created_at
    ) values (
      'TLV-SYNQA-TTIP-202607-V1-' || v_source.case_code,
      v_source.id, v_correction_id, v_source.target_tip_id, v_source.case_code,
      'STEP5J-HG-SYNQA-7-20260828-V1',
      upper(p_step5h_report_sha256), upper(p_step5h_query_sha256),
      upper(p_step5i_report_sha256), upper(p_step5i5_report_sha256),
      btrim(p_created_by), p_recognition_occurred_at
    );
    v_created := v_created + 1;
    v_neutralized := v_neutralized - v_source.platform_revenue_jpy;
  end loop;

  if v_created <> 7 or v_neutralized <> -145000 then
    raise exception 'synthetic_qa_neutralization_total_mismatch:created=% total=%', v_created, v_neutralized;
  end if;
  set constraints revenue_disposition_pair_guard, revenue_ledger_disposition_pair_guard immediate;

  return jsonb_build_object('ok',true,'idempotent',false,'target_count',7,'events',7,'corrections',7,'neutralized_tasful_jpy',v_neutralized,'financial_transaction_executed',false);
end
$$;

alter table tlv.revenue_disposition_events enable row level security;
alter table tlv.revenue_disposition_events force row level security;

drop policy if exists revenue_disposition_ops_select on tlv.revenue_disposition_events;
create policy revenue_disposition_ops_select on tlv.revenue_disposition_events
  for select to authenticated using (tlv.is_tlv_ops_admin());

revoke all on table tlv.revenue_disposition_events from public, anon, authenticated, service_role;
grant select on table tlv.revenue_disposition_events to authenticated, service_role;

revoke all on table tlv.synthetic_qa_disposition_reconciliation_v1 from public, anon, authenticated;
grant select on table tlv.synthetic_qa_disposition_reconciliation_v1 to service_role;
revoke all on table tlv.settlement_revenue_ledger_input_v1 from public, anon, authenticated;
grant select on table tlv.settlement_revenue_ledger_input_v1 to service_role;

revoke all on function tlv.apply_synthetic_qa_disposition_v1(timestamptz,text,text,text,text,text) from public, anon, authenticated;
grant execute on function tlv.apply_synthetic_qa_disposition_v1(timestamptz,text,text,text,text,text) to service_role;
revoke execute on function tlv.enforce_synthetic_qa_neutralization_shape() from public, anon, authenticated;
revoke execute on function tlv.assert_synthetic_qa_disposition_pair() from public, anon, authenticated;

commit;

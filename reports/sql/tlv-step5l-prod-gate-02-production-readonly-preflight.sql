-- TLV-STEP5L-PROD-GATE-02 Production preflight candidate.
-- READ ONLY. No backup, migration, disposition, correction, settlement, or provider action.
begin;
set transaction read only;
set local search_path = pg_catalog, tlv, public, extensions;

select
  current_setting('transaction_read_only') as transaction_read_only,
  current_database() as database_name,
  current_user as operator_role,
  current_setting('server_version') as server_version,
  now() as captured_at,
  (select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto') as pgcrypto_schema;

select version
from supabase_migrations.schema_migrations
where version in ('20260813090000','20260827210000','20260827230000','20260828210000')
order by version;

with
expected(case_code, idempotency_key, tip_kind, coins_amount, stream_id) as (
  values
    ('T-TIP-01',  'tlv-staging-tip-01',   'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000001'::uuid),
    ('T-TIP-02',  'tlv-staging-tip-02',   'gift'::tlv.tip_kind,        50, 'b0000000-0000-4000-8000-000000000002'::uuid),
    ('T-TIP-03-1','tlv-staging-tip-03-1', 'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000003'::uuid),
    ('T-TIP-03-2','tlv-staging-tip-03-2', 'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000003'::uuid),
    ('T-TIP-03-3','tlv-staging-tip-03-3', 'gift'::tlv.tip_kind,       100, 'b0000000-0000-4000-8000-000000000003'::uuid),
    ('T-TIP-08A', 'tlv-staging-tip-08a',  'extension'::tlv.tip_kind,  500, 'b0000000-0000-4000-8000-000000000008'::uuid),
    ('T-TIP-08B', 'tlv-staging-tip-08b',  'extension'::tlv.tip_kind,  500, 'b0000000-0000-4000-8000-000000000008'::uuid)
),
allocation_counts as (
  select tip_id, count(*)::integer as allocation_count
  from tlv.tip_coin_lot_allocations group by tip_id
),
target as (
  select
    rl.id as ledger_id,
    rl.tip_id,
    rl.creator_id,
    rl.event_kind,
    rl.ledger_month,
    rl.gross_amount_jpy,
    rl.fee_amount_jpy,
    rl.net_amount_jpy,
    rl.creator_payout_jpy,
    rl.platform_revenue_jpy,
    rl.payment_id as ledger_payment_id,
    t.stream_id,
    t.creator_id as tip_creator_id,
    t.payer_user_id,
    t.payer_user_uuid,
    t.payment_id as tip_payment_id,
    t.tip_kind,
    t.coins_amount,
    t.gross_amount_jpy as tip_gross_jpy,
    t.net_amount_jpy as tip_net_jpy,
    t.web_origin_coins,
    t.app_origin_coins,
    t.web_origin_net_jpy,
    t.app_origin_net_jpy,
    t.wr_at_tip,
    t.idempotency_key,
    coalesce(a.allocation_count, 0) as allocation_count,
    e.case_code,
    e.tip_kind as expected_tip_kind,
    e.coins_amount as expected_coins_amount,
    e.stream_id as expected_stream_id
  from expected e
  left join tlv.tips t on t.idempotency_key=e.idempotency_key
  left join tlv.revenue_ledger rl on rl.tip_id=t.id
  left join allocation_counts a on a.tip_id=t.id
),
measured as (
  select t.*,
    (select count(*) from tlv.wallet_ledger wl where wl.tip_id=t.tip_id) as wallet_debit_count,
    (select count(*) from tlv.creator_score_events cse where cse.source_table='tips' and cse.source_id=t.tip_id) as score_event_count,
    (select count(*) from tlv.payment_provider_events ppe where ppe.payment_id=coalesce(t.tip_payment_id,t.ledger_payment_id)) as provider_event_count
  from target t
)
select
  count(*) filter (where ledger_id is not null) as target_count,
  count(distinct case_code) filter (where ledger_id is not null) as case_count,
  count(*) filter (where ledger_id is not null
    and creator_id='a0000000-0000-4000-8000-000000000001'::uuid
    and tip_creator_id='a0000000-0000-4000-8000-000000000001'::uuid
    and payer_user_uuid='a0000000-0000-4000-8000-000000000101'::uuid
    and payer_user_id='tlv-staging-tip-viewer'
    and tip_kind=expected_tip_kind and event_kind::text=expected_tip_kind::text
    and coins_amount=expected_coins_amount and stream_id=expected_stream_id
    and tip_gross_jpy=expected_coins_amount::bigint*100
    and tip_net_jpy=expected_coins_amount::bigint*100
    and gross_amount_jpy=expected_coins_amount::bigint*100
    and fee_amount_jpy=0 and net_amount_jpy=expected_coins_amount::bigint*100
    and creator_payout_jpy=0 and platform_revenue_jpy=expected_coins_amount::bigint*100
    and web_origin_coins=expected_coins_amount and app_origin_coins=0
    and web_origin_net_jpy=expected_coins_amount::bigint*100 and app_origin_net_jpy=0
    and wr_at_tip=1 and allocation_count=0 and wallet_debit_count=0 and score_event_count=1
    and tip_payment_id is null and ledger_payment_id is null and provider_event_count=0
  ) as full_signature_count,
  sum(gross_amount_jpy) as gross_jpy,
  sum(fee_amount_jpy) as fee_jpy,
  sum(net_amount_jpy) as net_jpy,
  sum(creator_payout_jpy) as creator_payout_jpy,
  sum(platform_revenue_jpy) as platform_revenue_jpy,
  sum(allocation_count) as allocation_count,
  sum(wallet_debit_count) as wallet_debit_count,
  sum(provider_event_count) as provider_event_count,
  encode(digest(string_agg(
    ledger_id::text||':'||tip_id::text||':'||gross_amount_jpy::text||':'||fee_amount_jpy::text||':'||
    net_amount_jpy::text||':'||creator_payout_jpy::text||':'||platform_revenue_jpy::text||':'||ledger_month,
    ',' order by ledger_id
  ),'sha256'),'hex') as exact_source_seven_sha256
from measured;

select
  (select count(*) from tlv.payout_log) as payout_rows,
  (select count(*) from tlv.creator_score_monthly) as creator_score_monthly_rows,
  exists (
    select 1 from pg_constraint
    where conrelid='tlv.payout_log'::regclass and conname='payout_log_score_monthly_fk'
  ) as legacy_score_fk_present,
  to_regclass('tlv.monthly_settlements') is not null as monthly_settlements_present,
  to_regclass('tlv.settlement_ledger_links') is not null as settlement_links_present,
  to_regclass('tlv.revenue_disposition_events') is not null as disposition_registry_present;

select
  c.relkind,
  n.nspname as schema_name,
  c.relname as object_name,
  encode(digest(
    case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) else c.relname end,
    'sha256'
  ),'hex') as definition_sha256
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='tlv'
  and c.relname in (
    'revenue_ledger','revenue_disposition_events','settlement_revenue_ledger_input_v1',
    'synthetic_qa_disposition_reconciliation_v1','monthly_settlements','settlement_ledger_links',
    'payout_log','creator_score_monthly'
  )
order by c.relname;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  encode(digest(pg_get_functiondef(p.oid),'sha256'),'hex') as definition_sha256
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='tlv'
  and p.proname in (
    'apply_synthetic_qa_disposition_v1','enforce_synthetic_qa_neutralization_shape',
    'assert_synthetic_qa_disposition_pair','create_canonical_settlement_payout',
    'transition_canonical_settlement_payout','enforce_revenue_ledger_jst_period',
    'reject_append_only_financial_mutation'
  )
order by p.proname, identity_arguments;

select schemaname, tablename, policyname, roles, cmd,
  encode(digest(coalesce(qual,'')||'|'||coalesce(with_check,''),'sha256'),'hex') as policy_sha256
from pg_policies
where schemaname='tlv'
  and tablename in ('revenue_ledger','revenue_disposition_events','monthly_settlements','settlement_ledger_links','payout_log')
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema='tlv'
  and table_name in (
    'revenue_ledger','revenue_disposition_events','settlement_revenue_ledger_input_v1',
    'synthetic_qa_disposition_reconciliation_v1','monthly_settlements','settlement_ledger_links','payout_log'
  )
order by table_name, grantee, privilege_type;

rollback;

-- TLV STEP5L PROD Gate 04 Production checkpoint preflight.
-- READ ONLY: inventory only; no backup, DDL, DML, RPC, settlement, or provider action.
-- The invoking wrapper must prove project ref ddojquacsyqesrjhcvmn and must deny
-- Shared Staging ref ahlxuyvhzqdqaojiywmu before opening a connection.
begin;
set transaction read only;
set local search_path = pg_catalog, tlv, public, extensions;

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
  from tlv.tip_coin_lot_allocations
  group by tip_id
),
target as (
  select
    e.case_code,
    e.tip_kind as expected_tip_kind,
    e.coins_amount as expected_coins_amount,
    e.stream_id as expected_stream_id,
    t.id as tip_id,
    t.idempotency_key,
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
    rl.id as ledger_id,
    rl.creator_id,
    rl.event_kind,
    rl.ledger_month,
    rl.gross_amount_jpy,
    rl.fee_amount_jpy,
    rl.net_amount_jpy,
    rl.creator_payout_jpy,
    rl.platform_revenue_jpy,
    rl.payment_id as ledger_payment_id,
    coalesce(a.allocation_count, 0) as allocation_count
  from expected e
  left join tlv.tips t on t.idempotency_key = e.idempotency_key
  left join tlv.revenue_ledger rl on rl.tip_id = t.id
  left join allocation_counts a on a.tip_id = t.id
),
measured as (
  select
    t.*,
    (select count(*) from tlv.wallet_ledger wl where wl.tip_id = t.tip_id) as wallet_debit_count,
    (select count(*) from tlv.creator_score_events cse where cse.source_table = 'tips' and cse.source_id = t.tip_id) as score_event_count,
    (select count(*) from tlv.payment_provider_events ppe where ppe.payment_id = coalesce(t.tip_payment_id, t.ledger_payment_id)) as provider_event_count
  from target t
),
signature as (
  select
    count(*) filter (where ledger_id is not null) as target_count,
    count(distinct case_code) filter (where ledger_id is not null) as case_count,
    count(*) filter (
      where ledger_id is not null
        and creator_id = 'a0000000-0000-4000-8000-000000000001'::uuid
        and tip_creator_id = 'a0000000-0000-4000-8000-000000000001'::uuid
        and payer_user_uuid = 'a0000000-0000-4000-8000-000000000101'::uuid
        and payer_user_id = 'tlv-staging-tip-viewer'
        and tip_kind = expected_tip_kind
        and event_kind::text = expected_tip_kind::text
        and coins_amount = expected_coins_amount
        and stream_id = expected_stream_id
        and tip_gross_jpy = expected_coins_amount::bigint * 100
        and tip_net_jpy = expected_coins_amount::bigint * 100
        and gross_amount_jpy = expected_coins_amount::bigint * 100
        and fee_amount_jpy = 0
        and net_amount_jpy = expected_coins_amount::bigint * 100
        and creator_payout_jpy = 0
        and platform_revenue_jpy = expected_coins_amount::bigint * 100
        and web_origin_coins = expected_coins_amount
        and app_origin_coins = 0
        and web_origin_net_jpy = expected_coins_amount::bigint * 100
        and app_origin_net_jpy = 0
        and wr_at_tip = 1
        and allocation_count = 0
        and wallet_debit_count = 0
        and score_event_count = 1
        and tip_payment_id is null
        and ledger_payment_id is null
        and provider_event_count = 0
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
      ledger_id::text || ':' || tip_id::text || ':' || gross_amount_jpy::text || ':' || fee_amount_jpy::text || ':' ||
      net_amount_jpy::text || ':' || creator_payout_jpy::text || ':' || platform_revenue_jpy::text || ':' || ledger_month,
      ',' order by ledger_id
    ), 'sha256'), 'hex') as exact_source_seven_sha256
  from measured
),
object_state as (
  select jsonb_agg(jsonb_build_object(
    'name', c.relname,
    'kind', c.relkind,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity
  ) order by c.relname) as objects
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'tlv'
    and c.relname in (
      'revenue_ledger', 'revenue_disposition_events', 'monthly_settlements',
      'settlement_ledger_links', 'settlement_state_events', 'settlement_hold_events',
      'payout_log', 'creator_score_monthly'
    )
),
target_versions as (
  select coalesce(jsonb_agg(version order by version), '[]'::jsonb) as versions
  from supabase_migrations.schema_migrations
  where version in ('20260813090000', '20260827210000', '20260827230000', '20260828210000')
)
select jsonb_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'database_name', current_database(),
  'operator_role', current_user,
  'server_version', current_setting('server_version'),
  'captured_at', clock_timestamp(),
  'target_migrations', target_versions.versions,
  'target_count', signature.target_count,
  'case_count', signature.case_count,
  'full_signature_count', signature.full_signature_count,
  'gross_jpy', signature.gross_jpy,
  'fee_jpy', signature.fee_jpy,
  'net_jpy', signature.net_jpy,
  'creator_payout_jpy', signature.creator_payout_jpy,
  'platform_revenue_jpy', signature.platform_revenue_jpy,
  'allocation_count', signature.allocation_count,
  'wallet_debit_count', signature.wallet_debit_count,
  'provider_event_count', signature.provider_event_count,
  'exact_source_seven_sha256', signature.exact_source_seven_sha256,
  'payout_rows', (select count(*) from tlv.payout_log),
  'creator_score_monthly_rows', (select count(*) from tlv.creator_score_monthly),
  'legacy_score_fk_present', exists (
    select 1 from pg_constraint
    where conrelid = 'tlv.payout_log'::regclass
      and conname = 'payout_log_score_monthly_fk'
  ),
  'disposition_registry_present', to_regclass('tlv.revenue_disposition_events') is not null,
  'monthly_settlements_present', to_regclass('tlv.monthly_settlements') is not null,
  'synthetic_correction_count', (
    select count(*) from tlv.revenue_ledger
    where adjustment_kind::text = 'SYNTHETIC_QA_NEUTRALIZATION'
  ),
  'objects', coalesce(object_state.objects, '[]'::jsonb),
  'policy_count', (
    select count(*) from pg_policies
    where schemaname = 'tlv'
      and tablename in (
        'revenue_ledger', 'revenue_disposition_events', 'monthly_settlements',
        'settlement_ledger_links', 'settlement_state_events', 'settlement_hold_events',
        'payout_log'
      )
  )
) as gate04_production_preflight
from signature, object_state, target_versions;

rollback;

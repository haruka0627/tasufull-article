-- TLV STEP5L PROD GATE 03 — Shared Staging read-only preflight.
-- Candidate only. It must be run against project ref ahlxuyvhzqdqaojiywmu.
-- Production project ref ddojquacsyqesrjhcvmn is prohibited.

begin;
set transaction read only;
set local statement_timeout = '30s';

select
  current_setting('transaction_read_only') as transaction_read_only,
  current_database() as database_name,
  current_user as operator_role,
  current_setting('server_version') as server_version,
  clock_timestamp() as captured_at;

select version
from supabase_migrations.schema_migrations
where version in (
  '20260813090000',
  '20260827210000',
  '20260827230000',
  '20260828210000'
)
order by version;

select
  (select count(*) from tlv.payout_log) as payout_rows,
  (select count(*) from tlv.creator_score_monthly) as creator_score_monthly_rows,
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'tlv'
      and t.relname = 'payout_log'
      and c.conname = 'payout_log_score_monthly_fk'
  ) as legacy_score_fk_present;

select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'tlv'
  and c.relname in (
    'revenue_ledger',
    'monthly_settlements',
    'settlement_ledger_links',
    'settlement_state_events',
    'settlement_hold_events',
    'payout_log',
    'revenue_disposition_events'
  )
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  md5(coalesce(qual, '') || '|' || coalesce(with_check, '')) as policy_fingerprint
from pg_policies
where schemaname = 'tlv'
  and tablename in (
    'revenue_ledger',
    'monthly_settlements',
    'settlement_ledger_links',
    'settlement_state_events',
    'settlement_hold_events',
    'payout_log',
    'revenue_disposition_events'
  )
order by tablename, policyname;

select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'tlv'
  and routine_name in (
    'insert_monthly_settlement',
    'transition_monthly_settlement',
    'create_canonical_settlement_payout',
    'transition_canonical_settlement_payout',
    'apply_synthetic_qa_disposition_v1'
  )
order by routine_name, grantee, privilege_type;

rollback;

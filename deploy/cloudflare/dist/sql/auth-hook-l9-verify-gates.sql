-- TASFUL Auth Hook L9 combined gates (single result set)
-- Run: node scripts/verify-auth-hook-l9-remote-edge-smoke.mjs

with hook_count as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'custom_access_token_hook'
),
match_count as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name like 'match_%'
),
legacy_count as (
  select count(*)::int as n
  from auth.users
  where email ilike '%@tasful-dev.test'
),
allowlist_ok as (
  select count(*)::int as n
  from auth.users
  where email in (
    't1@tasful.invalid', 't2@tasful.invalid', 't3@tasful.invalid',
    't4@tasful.invalid', 't5@tasful.invalid'
  )
    and raw_app_meta_data->>'talk_user_id' = split_part(email, '@', 1)
    and raw_app_meta_data->>'member_id' = split_part(email, '@', 1)
)
select
  hook_count.n as hook_func_count,
  match_count.n as match_table_count,
  legacy_count.n as legacy_user_count,
  allowlist_ok.n as allowlist_backfill_count
from hook_count, match_count, legacy_count, allowlist_ok;

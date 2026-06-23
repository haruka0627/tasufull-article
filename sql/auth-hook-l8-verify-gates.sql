-- TASFUL Auth Hook L8 combined gates (single result set)
-- Run: node scripts/verify-auth-hook-l8-edge-prep.mjs

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
t1_meta as (
  select raw_app_meta_data->>'talk_user_id' as talk_user_id
  from auth.users where email = 't1@tasful.invalid'
),
t5_meta as (
  select raw_app_meta_data->>'talk_user_id' as talk_user_id
  from auth.users where email = 't5@tasful.invalid'
),
provider_drift as (
  select count(*)::int as n
  from auth.users
  where email in (
    't1@tasful.invalid', 't2@tasful.invalid', 't3@tasful.invalid',
    't4@tasful.invalid', 't5@tasful.invalid'
  )
    and raw_app_meta_data->>'provider' is distinct from 'email'
)
select
  hook_count.n as hook_func_count,
  match_count.n as match_table_count,
  legacy_count.n as legacy_user_count,
  t1_meta.talk_user_id as t1_talk,
  t5_meta.talk_user_id as t5_talk,
  provider_drift.n as allowlist_provider_drift
from hook_count, match_count, legacy_count, t1_meta, t5_meta, provider_drift;

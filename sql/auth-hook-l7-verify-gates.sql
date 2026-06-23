-- TASFUL Auth Hook L7 combined gates (single result set for supabase db query CLI)
-- Run: node scripts/verify-auth-hook-l7-backfill-expand.mjs

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
  select
    raw_app_meta_data->>'talk_user_id' as talk_user_id,
    raw_app_meta_data->>'member_id' as member_id
  from auth.users
  where email = 't1@tasful.invalid'
),
t2_meta as (
  select
    raw_app_meta_data->>'talk_user_id' as talk_user_id,
    raw_app_meta_data->>'member_id' as member_id,
    raw_user_meta_data as user_metadata
  from auth.users
  where email = 't2@tasful.invalid'
),
t3_meta as (
  select
    raw_app_meta_data->>'talk_user_id' as talk_user_id,
    raw_app_meta_data->>'member_id' as member_id,
    raw_user_meta_data as user_metadata
  from auth.users
  where email = 't3@tasful.invalid'
),
t4_meta as (
  select
    raw_app_meta_data->>'talk_user_id' as talk_user_id,
    raw_app_meta_data->>'member_id' as member_id,
    raw_user_meta_data as user_metadata
  from auth.users
  where email = 't4@tasful.invalid'
),
t5_meta as (
  select
    raw_app_meta_data->>'talk_user_id' as talk_user_id,
    raw_app_meta_data->>'member_id' as member_id,
    raw_user_meta_data as user_metadata
  from auth.users
  where email = 't5@tasful.invalid'
),
user_meta_drift as (
  select count(*)::int as n
  from auth.users
  where email in (
    't2@tasful.invalid', 't3@tasful.invalid', 't4@tasful.invalid', 't5@tasful.invalid'
  )
    and raw_user_meta_data ? 'talk_user_id'
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
  t1_meta.member_id as t1_member,
  t2_meta.talk_user_id as t2_talk,
  t2_meta.member_id as t2_member,
  t3_meta.talk_user_id as t3_talk,
  t3_meta.member_id as t3_member,
  t4_meta.talk_user_id as t4_talk,
  t4_meta.member_id as t4_member,
  t5_meta.talk_user_id as t5_talk,
  t5_meta.member_id as t5_member,
  user_meta_drift.n as allowlist_user_meta_talk_keys,
  provider_drift.n as allowlist_provider_drift
from hook_count, match_count, legacy_count, t1_meta, t2_meta, t3_meta, t4_meta, t5_meta, user_meta_drift, provider_drift;

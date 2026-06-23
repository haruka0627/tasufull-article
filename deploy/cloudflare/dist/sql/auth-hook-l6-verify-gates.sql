-- TASFUL Auth Hook L6 combined gates (single result set for supabase db query CLI)
-- Run: node scripts/verify-auth-hook-l6-hook-on-warn.mjs

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
t1_meta as (
  select
    raw_app_meta_data->>'talk_user_id' as talk_user_id,
    raw_app_meta_data->>'member_id' as member_id
  from auth.users
  where id = '2d537fc9-ee67-4da8-97d3-bafe824ba466'::uuid
),
t2_meta as (
  select count(*)::int as n
  from auth.users
  where email in (
    't2@tasful.invalid', 't3@tasful.invalid', 't4@tasful.invalid', 't5@tasful.invalid'
  )
    and (
      raw_app_meta_data->>'talk_user_id' is not null
      or raw_app_meta_data->>'member_id' is not null
    )
),
legacy_count as (
  select count(*)::int as n
  from auth.users
  where email ilike '%@tasful-dev.test'
)
select
  hook_count.n as hook_func_count,
  match_count.n as match_table_count,
  t1_meta.talk_user_id as t1_db_talk_user_id,
  t1_meta.member_id as t1_db_member_id,
  t2_meta.n as t2_t5_with_talk_member,
  legacy_count.n as legacy_user_count
from hook_count, match_count, t1_meta, t2_meta, legacy_count;

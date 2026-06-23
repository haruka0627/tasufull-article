-- TASFUL Auth Hook L11 combined gates (single result set)
-- Run: node scripts/verify-auth-hook-l11-rls-d2.mjs

with core_tables as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'match_profiles',
      'match_profile_photos',
      'match_swipes',
      'match_pairs',
      'match_blocks',
      'match_reports',
      'match_verifications',
      'match_moderation_logs'
    )
),
rls_on as (
  select count(*)::int as n
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'match_profiles',
      'match_profile_photos',
      'match_swipes',
      'match_pairs',
      'match_blocks',
      'match_reports',
      'match_verifications',
      'match_moderation_logs'
    )
    and rowsecurity = true
),
policy_count as (
  select count(*)::int as n
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'match_profiles',
      'match_profile_photos',
      'match_swipes',
      'match_pairs',
      'match_blocks',
      'match_reports',
      'match_verifications',
      'match_moderation_logs'
    )
),
helper_funcs as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in ('match_current_user_id', 'match_is_admin', 'match_users_are_blocked')
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
),
hook_count as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'custom_access_token_hook'
)
select
  core_tables.n as core_table_count,
  rls_on.n as rls_enabled_count,
  policy_count.n as policy_count,
  helper_funcs.n as helper_func_count,
  legacy_count.n as legacy_user_count,
  allowlist_ok.n as allowlist_backfill_count,
  hook_count.n as hook_func_count
from core_tables, rls_on, policy_count, helper_funcs, legacy_count, allowlist_ok, hook_count;

-- TASFUL Auth Hook L12 combined gates (single result set)
-- Run: node scripts/verify-auth-hook-l12-exception.mjs

with hook_exception as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname = 'custom_access_token_hook'
    and pg_get_functiondef(p.oid) ilike '%raise exception%'
),
hook_count as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'custom_access_token_hook'
),
rls_on as (
  select count(*)::int as n
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
      'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
    )
    and rowsecurity = true
),
policy_count as (
  select count(*)::int as n
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
      'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
    )
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
t6_absent as (
  select count(*)::int as n
  from auth.users
  where email = 't6@tasful.invalid'
)
select
  hook_count.n as hook_func_count,
  hook_exception.n as hook_exception_mode,
  rls_on.n as rls_enabled_count,
  policy_count.n as policy_count,
  legacy_count.n as legacy_user_count,
  allowlist_ok.n as allowlist_backfill_count,
  t6_absent.n as t6_user_count
from hook_count, hook_exception, rls_on, policy_count, legacy_count, allowlist_ok, t6_absent;

-- TASFUL MATCH post-auth final smoke — READ-ONLY gates
-- Run: node scripts/verify-match-post-auth-final-smoke.mjs

-- Allowlist metadata (T1–T5 unchanged)
select email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
where email in (
  't1@tasful.invalid', 't2@tasful.invalid', 't3@tasful.invalid',
  't4@tasful.invalid', 't5@tasful.invalid'
)
order by email;

-- Legacy 7 L1 baseline (metadata only)
select count(*)::int as legacy_user_count
from auth.users
where email ilike '%@tasful-dev.test';

-- Hook EXCEPTION mode
select
  count(*)::int as hook_func_count,
  count(*) filter (
    where pg_get_functiondef(p.oid) ilike '%raise exception%'
  )::int as hook_exception_mode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- MATCH schema + RLS
select
  (
    select count(*)::int
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
  ) as core_table_count,
  (
    select count(*)::int
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
      and rowsecurity = true
  ) as rls_enabled_count,
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
  ) as policy_count;

-- t6 temp user must be absent
select count(*)::int as t6_user_count
from auth.users
where email = 't6@tasful.invalid';

-- Combined gate row (single result for automation)
with allowlist_ok as (
  select count(*)::int as n
  from auth.users
  where email in (
    't1@tasful.invalid', 't2@tasful.invalid', 't3@tasful.invalid',
    't4@tasful.invalid', 't5@tasful.invalid'
  )
    and raw_app_meta_data->>'talk_user_id' = split_part(email, '@', 1)
    and raw_app_meta_data->>'member_id' = split_part(email, '@', 1)
),
legacy_count as (
  select count(*)::int as n from auth.users where email ilike '%@tasful-dev.test'
),
hook as (
  select
    count(*)::int as func_count,
    count(*) filter (where pg_get_functiondef(p.oid) ilike '%raise exception%')::int as exception_mode
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'custom_access_token_hook'
),
schema_rls as (
  select
    count(*) filter (where t.table_name in (
      'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
      'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
    ))::int as tables,
    count(*) filter (where pt.tablename in (
      'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
      'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
    ) and pt.rowsecurity)::int as rls_on,
    (
      select count(*)::int from pg_policies
      where schemaname = 'public'
        and tablename in (
          'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
          'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
        )
    ) as policies
  from information_schema.tables t
  full join pg_tables pt on pt.schemaname = 'public' and pt.tablename = t.table_name
  where t.table_schema = 'public' or pt.schemaname = 'public'
),
t6 as (
  select count(*)::int as n from auth.users where email = 't6@tasful.invalid'
)
select
  allowlist_ok.n as allowlist_backfill_count,
  legacy_count.n as legacy_user_count,
  hook.func_count as hook_func_count,
  hook.exception_mode as hook_exception_mode,
  8 as expected_tables,
  (
    select count(*)::int from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
  ) as core_table_count,
  (
    select count(*)::int from pg_tables
    where schemaname = 'public'
      and tablename in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
      and rowsecurity = true
  ) as rls_enabled_count,
  (
    select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
  ) as policy_count,
  t6.n as t6_user_count
from allowlist_ok, legacy_count, hook, t6;

-- TASFUL MATCH P15-L1 pre-apply gates (READ-ONLY)
-- Run BEFORE applying:
--   supabase/migrations/20260622190000_match_p15_l1_schema.sql
--   supabase/migrations/20260622191000_match_p15_l1_rls.sql
--
--   npx supabase db query --linked --yes -f sql/match-post-auth-final-smoke-readonly.sql
--   npx supabase db query --linked --yes -f sql/match-p15-l1-pre-gates.sql
--
-- STOP if any gate fails (see expected column comments below).

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
core_rls_on as (
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
core_policy_count as (
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
hook as (
  select
    count(*)::int as func_count,
    count(*) filter (
      where pg_get_functiondef(p.oid) ilike '%raise exception%'
    )::int as exception_mode
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'custom_access_token_hook'
),
p15_tables as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'match_favorites',
      'match_profile_views',
      'match_saved_searches',
      'match_user_settings',
      'match_hobby_tags',
      'match_profile_hobby_tags'
    )
),
p15_view as (
  select count(*)::int as n
  from information_schema.views
  where table_schema = 'public'
    and table_name = 'match_profiles_public'
),
p15_funcs as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in (
      'match_activity_label',
      'match_footprint_label',
      'match_profile_completeness',
      'match_compatibility_score',
      'match_prefecture_compat_score'
    )
),
last_active_col as (
  select count(*)::int as n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'match_profiles'
    and column_name = 'last_active_at'
),
t6 as (
  select count(*)::int as n
  from auth.users
  where email = 't6@tasful.invalid'
)
select
  legacy_count.n as legacy_user_count,              -- expected: 7
  allowlist_ok.n as allowlist_backfill_count,       -- expected: 5
  hook.func_count as hook_func_count,               -- expected: 1
  hook.exception_mode as hook_exception_mode,       -- expected: 1
  core_tables.n as core_table_count,                -- expected: 8
  core_rls_on.n as core_rls_enabled_count,          -- expected: 8
  core_policy_count.n as core_policy_count,         -- expected: 20
  p15_tables.n as p15_table_count,                  -- expected: 0
  p15_view.n as p15_public_view_count,              -- expected: 0
  p15_funcs.n as p15_function_count,                -- expected: 0
  last_active_col.n as last_active_at_exists,       -- expected: 1
  t6.n as t6_user_count                             -- expected: 0
from legacy_count,
  allowlist_ok,
  hook,
  core_tables,
  core_rls_on,
  core_policy_count,
  p15_tables,
  p15_view,
  p15_funcs,
  last_active_col,
  t6;

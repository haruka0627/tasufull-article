-- TASFUL MATCH P15-L1 post-apply gates (READ-ONLY)
-- Run AFTER:
--   supabase/migrations/20260622190000_match_p15_l1_schema.sql
--   supabase/migrations/20260622191000_match_p15_l1_rls.sql
--
--   npx supabase db query --linked --yes -f sql/match-p15-l1-post-gates.sql

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
p15_core_tables as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'match_favorites',
      'match_profile_views',
      'match_saved_searches',
      'match_user_settings'
    )
),
p15_hobby_tables as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('match_hobby_tags', 'match_profile_hobby_tags')
),
p15_all_tables as (
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
profile_add_cols as (
  select count(*)::int as n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'match_profiles'
    and column_name in (
      'purpose',
      'relationship_view',
      'weekend_style',
      'completeness_cached'
    )
),
last_active_col as (
  select count(*)::int as n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'match_profiles'
    and column_name = 'last_active_at'
),
p15_rls_on as (
  select count(*)::int as n
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'match_favorites',
      'match_profile_views',
      'match_saved_searches',
      'match_user_settings',
      'match_hobby_tags',
      'match_profile_hobby_tags'
    )
    and rowsecurity = true
),
p15_policy_count as (
  select count(*)::int as n
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'match_favorites',
      'match_profile_views',
      'match_saved_searches',
      'match_user_settings',
      'match_hobby_tags',
      'match_profile_hobby_tags'
    )
),
p15_funcs as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public'
    and p.proname in (
      'match_has_active_match_ban',
      'match_activity_label',
      'match_footprint_label',
      'match_prefecture_compat_score',
      'match_profile_completeness',
      'match_compatibility_score'
    )
),
public_view_exists as (
  select count(*)::int as n
  from information_schema.views
  where table_schema = 'public'
    and table_name = 'match_profiles_public'
),
public_view_raw_ts as (
  select count(*)::int as n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'match_profiles_public'
    and column_name = 'last_active_at'
),
public_view_activity_label as (
  select count(*)::int as n
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'match_profiles_public'
    and column_name = 'activity_label'
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
activity_smoke as (
  select public.match_activity_label(now()) as label
),
completeness_smoke as (
  select (public.match_profile_completeness('t1')->>'percent')::int as percent
),
compat_smoke as (
  select public.match_compatibility_score('t1', 't2')->>'code' as code
)
select
  legacy_count.n as legacy_user_count,              -- expected: 7
  allowlist_ok.n as allowlist_backfill_count,       -- expected: 5
  hook.func_count as hook_func_count,               -- expected: 1
  hook.exception_mode as hook_exception_mode,       -- expected: 1
  core_tables.n as core_table_count,                -- expected: 8
  core_rls_on.n as core_rls_enabled_count,          -- expected: 8
  core_policy_count.n as core_policy_count,         -- expected: 20
  p15_core_tables.n as p15_core_table_count,        -- expected: 4
  p15_hobby_tables.n as p15_hobby_table_count,      -- expected: 2
  p15_all_tables.n as p15_table_count,              -- expected: 6
  profile_add_cols.n as profile_add_column_count,   -- expected: 4
  last_active_col.n as last_active_at_exists,       -- expected: 1
  p15_rls_on.n as p15_rls_enabled_count,            -- expected: 6
  p15_policy_count.n as p15_policy_count,           -- expected: 14
  p15_funcs.n as p15_function_count,                -- expected: 6
  public_view_exists.n as public_view_exists,       -- expected: 1
  public_view_raw_ts.n as public_view_has_raw_ts,   -- expected: 0
  public_view_activity_label.n as public_view_has_activity_label, -- expected: 1
  activity_smoke.label as activity_label_smoke,     -- expected: 24時間以内に活動
  completeness_smoke.percent as completeness_t1_percent,
  compat_smoke.code as compatibility_t1_t2_code
from legacy_count,
  allowlist_ok,
  hook,
  core_tables,
  core_rls_on,
  core_policy_count,
  p15_core_tables,
  p15_hobby_tables,
  p15_all_tables,
  profile_add_cols,
  last_active_col,
  p15_rls_on,
  p15_policy_count,
  p15_funcs,
  public_view_exists,
  public_view_raw_ts,
  public_view_activity_label,
  activity_smoke,
  completeness_smoke,
  compat_smoke;

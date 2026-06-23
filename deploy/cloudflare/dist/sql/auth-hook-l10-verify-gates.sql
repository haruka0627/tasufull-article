-- TASFUL Auth Hook L10 combined gates (single result set)
-- Run: node scripts/verify-auth-hook-l10-match-schema.mjs

with pre_tables as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name like 'match_%'
),
core_tables as (
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
fk_count as (
  select count(*)::int as n
  from information_schema.table_constraints
  where table_schema = 'public'
    and constraint_type = 'FOREIGN KEY'
    and table_name in (
      'match_profiles', 'match_profile_photos', 'match_blocks'
    )
),
pk_count as (
  select count(*)::int as n
  from information_schema.table_constraints
  where table_schema = 'public'
    and constraint_type = 'PRIMARY KEY'
    and table_name in (
      'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
      'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
    )
),
unique_count as (
  select count(*)::int as n
  from information_schema.table_constraints
  where table_schema = 'public'
    and constraint_type = 'UNIQUE'
    and table_name in (
      'match_profiles', 'match_swipes', 'match_pairs', 'match_blocks'
    )
),
index_count as (
  select count(*)::int as n
  from pg_indexes
  where schemaname = 'public'
    and tablename in (
      'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
      'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
    )
),
status_cols as (
  select count(*)::int as n
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'match_profiles' and column_name in ('profile_status', 'verification_status', 'created_at', 'updated_at'))
      or (table_name = 'match_pairs' and column_name in ('status', 'created_at', 'updated_at'))
      or (table_name = 'match_blocks' and column_name in ('block_status', 'created_at', 'updated_at'))
      or (table_name = 'match_reports' and column_name in ('status', 'created_at', 'updated_at'))
      or (table_name = 'match_verifications' and column_name in ('status', 'created_at', 'updated_at'))
    )
)
select
  core_tables.n as core_table_count,
  legacy_count.n as legacy_user_count,
  allowlist_ok.n as allowlist_backfill_count,
  hook_count.n as hook_func_count,
  rls_on.n as rls_enabled_count,
  fk_count.n as fk_constraint_count,
  pk_count.n as pk_constraint_count,
  unique_count.n as unique_constraint_count,
  index_count.n as index_count,
  status_cols.n as status_timestamp_col_count
from core_tables, legacy_count, allowlist_ok, hook_count, rls_on,
     fk_count, pk_count, unique_count, index_count, status_cols;

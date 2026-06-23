-- TASFUL Auth Hook L12 pre-apply gate (WARN mode · L11 state intact)
select
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'custom_access_token_hook'
  ) as hook_func_count,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'custom_access_token_hook'
      and pg_get_functiondef(p.oid) ilike '%raise exception%'
  ) as hook_exception_mode,
  (
    select count(*)::int
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
        'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
      )
      and rowsecurity = true
  ) as rls_enabled_count;

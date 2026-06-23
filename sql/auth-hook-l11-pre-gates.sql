-- TASFUL Auth Hook L11 pre-apply gate (RLS must be OFF on 8 MATCH tables)
select count(*)::int as rls_enabled_count
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
  and rowsecurity = true;

-- TASFUL Auth Hook L12 verify — READ-ONLY (manual)
-- Run: node scripts/verify-auth-hook-l12-exception.mjs

-- Allowlist metadata unchanged
select email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
where email in (
  't1@tasful.invalid', 't2@tasful.invalid', 't3@tasful.invalid',
  't4@tasful.invalid', 't5@tasful.invalid'
)
order by email;

-- Legacy 7 L1 baseline (metadata only · no login test)
select id, email, raw_app_meta_data as app_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- Hook EXCEPTION mode
select
  p.proname,
  pg_get_functiondef(p.oid) ilike '%raise exception%' as is_exception_mode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- MATCH RLS unchanged
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'match_profiles', 'match_profile_photos', 'match_swipes', 'match_pairs',
    'match_blocks', 'match_reports', 'match_verifications', 'match_moderation_logs'
  )
order by tablename;

-- t6 temp user must be absent after verify
select count(*) as t6_user_count
from auth.users
where email = 't6@tasful.invalid';

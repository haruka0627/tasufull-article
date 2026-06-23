-- TASFUL Auth Hook L10 verify — READ-ONLY (manual)
-- Run: node scripts/verify-auth-hook-l10-match-schema.mjs

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

-- Legacy 7 L1 baseline
select id, email, raw_app_meta_data as app_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- Hook unchanged
select count(*) as hook_func_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- RLS still off on MATCH tables
select tablename, rowsecurity
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
order by tablename;

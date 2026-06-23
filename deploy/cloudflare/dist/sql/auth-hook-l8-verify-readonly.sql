-- TASFUL Auth Hook L8 verify — READ-ONLY
-- Run: node scripts/verify-auth-hook-l8-edge-prep.mjs

-- 1) Allowlist T1–T5 metadata (unchanged since L7)
select
  email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id,
  raw_app_meta_data->>'provider' as provider,
  raw_user_meta_data as user_metadata
from auth.users
where email in (
  't1@tasful.invalid', 't2@tasful.invalid', 't3@tasful.invalid',
  't4@tasful.invalid', 't5@tasful.invalid'
)
order by email;

-- 2) L1 baseline legacy 7
select id, email, raw_app_meta_data as app_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 3) Hook function unchanged
select count(*) as hook_func_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- 4) MATCH migration not applied
select count(*) as match_tables
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

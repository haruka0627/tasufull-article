-- TASFUL Auth Hook L7 verify — READ-ONLY (manual / psql)
-- Automated: sql/auth-hook-l7-verify-gates.sql + scripts/verify-auth-hook-l7-backfill-expand.mjs

-- 1) Allowlist T1–T5 app_metadata
select
  email,
  id,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id,
  raw_app_meta_data->>'provider' as provider,
  raw_app_meta_data->'providers' as providers,
  raw_user_meta_data as user_metadata
from auth.users
where email in (
  't1@tasful.invalid',
  't2@tasful.invalid',
  't3@tasful.invalid',
  't4@tasful.invalid',
  't5@tasful.invalid'
)
order by email;

-- 2) L1 baseline 7 users unchanged
select id, email, raw_app_meta_data as app_metadata, raw_user_meta_data as user_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 3) Hook function unchanged (L5 CREATE)
select count(*) as hook_func_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- 4) MATCH not applied
select count(*) as match_tables
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

-- TASFUL Auth Hook L6 verify — READ-ONLY (manual / psql multi-statement)
-- Automated gates: sql/auth-hook-l6-verify-gates.sql + scripts/verify-auth-hook-l6-hook-on-warn.mjs
-- Note: supabase db query -f returns only the last SELECT; use gates SQL for CLI automation.

-- 1) Hook function still exists (L5 CREATE unchanged)
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner,
  count(*) over () as hook_func_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- 2) T1 app_metadata unchanged (L3 backfill)
select
  id,
  email,
  raw_app_meta_data->>'talk_user_id' as app_talk_user_id,
  raw_app_meta_data->>'member_id' as app_member_id,
  raw_app_meta_data->>'provider' as app_provider,
  raw_app_meta_data->'providers' as app_providers
from auth.users
where id = '2d537fc9-ee67-4da8-97d3-bafe824ba466'::uuid;

-- 3) T2–T5 still without talk/member
select email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
where email in (
  't2@tasful.invalid', 't3@tasful.invalid', 't4@tasful.invalid', 't5@tasful.invalid'
)
order by email;

-- 4) L1 baseline 7 users unchanged
select id, email, raw_app_meta_data as app_metadata, raw_user_meta_data as user_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 5) MATCH migrations still not applied
select count(*) as match_tables
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

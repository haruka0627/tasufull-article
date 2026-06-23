-- TASFUL Auth Hook L4 verify — READ-ONLY
-- Run: node scripts/verify-auth-hook-l4-jwt-refresh.mjs
--        npx supabase db query --linked --yes -f sql/auth-hook-l4-jwt-readonly.sql

-- 1) T1 app_metadata baseline (unchanged from L3)
select
  id,
  email,
  raw_app_meta_data->>'talk_user_id' as app_talk_user_id,
  raw_app_meta_data->>'member_id' as app_member_id,
  raw_app_meta_data->>'provider' as app_provider,
  raw_app_meta_data->'providers' as app_providers,
  raw_user_meta_data as user_metadata
from auth.users
where id = '2d537fc9-ee67-4da8-97d3-bafe824ba466'::uuid;

-- 2) T2–T5 still without talk/member
select email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
where email in (
  't2@tasful.invalid', 't3@tasful.invalid', 't4@tasful.invalid', 't5@tasful.invalid'
)
order by email;

-- 3) L1 baseline 7 users unchanged
select id, email, raw_app_meta_data as app_metadata, raw_user_meta_data as user_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 4) talk_current_user_id() definition (auth.jwt() coalesce reference · READ)
select pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'talk_current_user_id';

-- NOTE: auth.jwt() requires PostgREST user JWT context.
-- L4 script calls: POST /rest/v1/rpc/talk_current_user_id  Authorization: Bearer <T1 access_token>
-- Equivalent to:
--   auth.jwt() -> 'app_metadata' ->> 'talk_user_id'  (= 't1' for T1)
--   auth.jwt() -> 'app_metadata' ->> 'member_id'      (= 't1' when talk_user_id set)

-- 5) Hook / MATCH unchanged
select count(*) filter (where proname ilike '%access_token_hook%') as hook_funcs
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

select count(*) as match_tables
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

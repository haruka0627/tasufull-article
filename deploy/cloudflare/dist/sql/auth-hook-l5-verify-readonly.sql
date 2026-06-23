-- TASFUL Auth Hook L5 verify — READ-ONLY (manual / psql; multi-statement)
-- Automated gates: sql/auth-hook-l5-verify-gates.sql + scripts/verify-auth-hook-l5-create-off.mjs
-- Note: `supabase db query -f` returns only the last SELECT; use gates SQL for CLI automation.

-- 1) Hook function exists exactly once
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner,
  count(*) over () as hook_func_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'custom_access_token_hook';

-- 2) EXECUTE grant for supabase_auth_admin
select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'custom_access_token_hook'
  and grantee = 'supabase_auth_admin';

-- 3) T1 app_metadata baseline (unchanged from L3/L4)
select
  id,
  email,
  raw_app_meta_data->>'talk_user_id' as app_talk_user_id,
  raw_app_meta_data->>'member_id' as app_member_id,
  raw_app_meta_data->>'provider' as app_provider,
  raw_app_meta_data->'providers' as app_providers
from auth.users
where id = '2d537fc9-ee67-4da8-97d3-bafe824ba466'::uuid;

-- 4) T2–T5 still without talk/member
select email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
where email in (
  't2@tasful.invalid', 't3@tasful.invalid', 't4@tasful.invalid', 't5@tasful.invalid'
)
order by email;

-- 5) L1 baseline 7 users unchanged
select id, email, raw_app_meta_data as app_metadata, raw_user_meta_data as user_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 6) MATCH migrations still not applied
select count(*) as match_tables
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

-- 7) Direct hook call — T1 payload (talk_user_id / member_id merged)
with input as (
  select jsonb_build_object(
    'user_id', '2d537fc9-ee67-4da8-97d3-bafe824ba466',
    'claims', jsonb_build_object(
      'aud', 'authenticated',
      'role', 'authenticated',
      'email', 't1@tasful.invalid',
      'iss', 'https://ddojquacsyqesrjhcvmn.supabase.co/auth/v1',
      'app_metadata', jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email')
      )
    )
  ) as event
),
result as (
  select public.custom_access_token_hook(input.event) as out
  from input
)
select
  'T1_hook' as test_case,
  out->'claims'->'app_metadata'->>'talk_user_id' as talk_user_id,
  out->'claims'->'app_metadata'->>'member_id' as member_id,
  out->'claims'->'app_metadata'->>'provider' as provider,
  out->'claims'->'app_metadata'->'providers' as providers,
  out->'claims'->>'iss' as iss,
  out->'claims'->>'email' as email
from result;

-- 8) Direct hook call — T2 payload (missing talk_user_id · claims unchanged)
with input as (
  select jsonb_build_object(
    'user_id', 'd9f57cfa-61f9-4426-ad6a-78ebbd1b7723',
    'claims', jsonb_build_object(
      'aud', 'authenticated',
      'role', 'authenticated',
      'email', 't2@tasful.invalid',
      'iss', 'https://ddojquacsyqesrjhcvmn.supabase.co/auth/v1',
      'app_metadata', jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email')
      )
    )
  ) as event
),
result as (
  select
    input.event as event_in,
    public.custom_access_token_hook(input.event) as event_out
  from input
)
select
  'T2_hook' as test_case,
  (result.event_in->'claims') = (result.event_out->'claims') as claims_unchanged,
  result.event_out->'claims'->'app_metadata'->>'provider' as provider,
  result.event_out->'claims'->'app_metadata'->'providers' as providers,
  result.event_out->'claims'->>'iss' as iss
from result;

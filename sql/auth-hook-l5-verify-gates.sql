-- TASFUL Auth Hook L5 combined gates (single result set for supabase db query CLI)
-- Run: node scripts/verify-auth-hook-l5-create-off.mjs

with hook_count as (
  select count(*)::int as n
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'custom_access_token_hook'
),
match_count as (
  select count(*)::int as n
  from information_schema.tables
  where table_schema = 'public'
    and table_name like 'match_%'
),
t1_hook as (
  select public.custom_access_token_hook(
    jsonb_build_object(
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
    )
  ) as out
),
t2_input as (
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
t2_hook as (
  select
    t2_input.event as event_in,
    public.custom_access_token_hook(t2_input.event) as event_out
  from t2_input
)
select
  hook_count.n as hook_func_count,
  match_count.n as match_table_count,
  t1_hook.out->'claims'->'app_metadata'->>'talk_user_id' as t1_talk_user_id,
  t1_hook.out->'claims'->'app_metadata'->>'member_id' as t1_member_id,
  t1_hook.out->'claims'->'app_metadata'->>'provider' as t1_provider,
  t1_hook.out->'claims'->'app_metadata'->'providers' as t1_providers,
  t1_hook.out->'claims'->>'iss' as t1_iss,
  (t2_hook.event_in->'claims') = (t2_hook.event_out->'claims') as t2_claims_unchanged,
  t2_hook.event_out->'claims'->'app_metadata'->>'provider' as t2_provider,
  t2_hook.event_out->'claims'->'app_metadata'->'providers' as t2_providers
from hook_count, match_count, t1_hook, t2_hook;

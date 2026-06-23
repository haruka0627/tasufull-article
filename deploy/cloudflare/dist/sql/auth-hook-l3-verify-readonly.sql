-- TASFUL Auth Hook L3 verify — READ-ONLY
-- After: node scripts/backfill-auth-hook-l3-t1.mjs

-- 1) T1 app_metadata
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

-- 2) T2–T5 must remain without talk_user_id / member_id
select id, email,
  raw_app_meta_data->>'talk_user_id' as app_talk_user_id,
  raw_app_meta_data->>'member_id' as app_member_id
from auth.users
where email in (
  't2@tasful.invalid',
  't3@tasful.invalid',
  't4@tasful.invalid',
  't5@tasful.invalid'
)
order by email;

-- 3) Any @tasful.invalid with unexpected talk/member (should be T1 only)
select id, email,
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  raw_app_meta_data->>'member_id' as member_id
from auth.users
where email ilike '%@tasful.invalid'
  and (
    nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
    or nullif(trim(raw_app_meta_data->>'member_id'), '') is not null
  )
order by email;

-- 4) Duplicate talk_user_id across all auth.users
select
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  count(*) as cnt,
  array_agg(email order by email) as emails
from auth.users
where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
group by 1
having count(*) > 1;

-- 5) L1 baseline 7 users (metadata snapshot)
select id, email, raw_app_meta_data as app_metadata, raw_user_meta_data as user_metadata
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 6) Hook not created
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname ilike '%access_token_hook%'
   or p.proname ilike '%custom_access_token%';

-- 7) MATCH not applied
select count(*) as match_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

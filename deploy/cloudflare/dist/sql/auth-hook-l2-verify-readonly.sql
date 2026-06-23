-- TASFUL Auth Hook L2 verify — READ-ONLY
-- Run after: node scripts/seed-auth-hook-l2-allowlist.mjs

-- 1) Total users and @tasful.invalid count
select
  count(*) as total_users,
  count(*) filter (where email ilike '%@tasful.invalid') as tasful_invalid_count,
  count(*) filter (where email ilike '%@tasful-dev.test') as tasful_dev_test_count
from auth.users;

-- 2) Allowlist T1–T5 rows
select
  id,
  email,
  email_confirmed_at is not null as email_confirmed,
  created_at,
  raw_app_meta_data as app_metadata,
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

-- 3) T1–T5 must NOT have talk_user_id yet
select id, email, raw_app_meta_data->>'talk_user_id' as app_talk_user_id
from auth.users
where email ilike '%@tasful.invalid'
  and nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null;

-- 4) L1 baseline 7 users — metadata keys snapshot (compare to L1 report)
select
  id,
  email,
  raw_app_meta_data as app_metadata,
  raw_user_meta_data as user_metadata,
  updated_at
from auth.users
where email ilike '%@tasful-dev.test'
order by created_at asc;

-- 5) Hook not created
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname ilike '%custom_access_token%'
   or p.proname ilike '%access_token_hook%';

-- 6) MATCH not applied
select count(*) as match_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%';

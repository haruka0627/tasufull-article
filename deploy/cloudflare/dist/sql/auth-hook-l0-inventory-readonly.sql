-- TASFUL Auth Hook L0 inventory — READ-ONLY only
-- Target: linked ref ddojquacsyqesrjhcvmn

-- 0) Connection / ref hint (from JWT in anon key pattern — verify separately)
select 'auth_hook_l0_inventory' as report_section, now() as queried_at;

-- 1) auth.users summary
select
  count(*) as total_users,
  count(*) filter (where email ilike '%@tasful.invalid%') as tasful_invalid_email_count,
  count(*) filter (where email ilike '%test%' or email ilike '%demo%') as test_demo_email_count,
  count(*) filter (
    where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
  ) as with_app_meta_talk_user_id,
  count(*) filter (
    where nullif(trim(raw_app_meta_data->>'member_id'), '') is not null
  ) as with_app_meta_member_id,
  count(*) filter (
    where nullif(trim(raw_user_meta_data->>'talk_user_id'), '') is not null
  ) as with_user_meta_talk_user_id
from auth.users;

-- 2) auth.users detail (no secrets — metadata keys only)
select
  id,
  email,
  created_at,
  last_sign_in_at,
  raw_app_meta_data->>'talk_user_id' as app_talk_user_id,
  raw_app_meta_data->>'member_id' as app_member_id,
  raw_app_meta_data->>'role' as app_role,
  raw_app_meta_data->>'is_ops' as app_is_ops,
  raw_user_meta_data->>'talk_user_id' as user_meta_talk_user_id,
  (select array_agg(k order by k)
   from jsonb_object_keys(coalesce(raw_app_meta_data, '{}'::jsonb)) as k) as app_meta_keys,
  (select array_agg(k order by k)
   from jsonb_object_keys(coalesce(raw_user_meta_data, '{}'::jsonb)) as k) as user_meta_keys
from auth.users
order by created_at desc;

-- 3) duplicate talk_user_id in app_metadata
select
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  count(*) as cnt,
  array_agg(id::text order by created_at) as auth_user_ids
from auth.users
where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
group by 1
having count(*) > 1;

-- 4) demo-like talk_user_id in app_metadata
select id, email, raw_app_meta_data->>'talk_user_id' as talk_user_id
from auth.users
where lower(coalesce(raw_app_meta_data->>'talk_user_id', '')) in ('u_me', 'stub-user-current', 'stub-user-id')
   or email ilike '%+demo%';

-- 5) Custom Access Token Hook function exists?
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname ilike '%custom_access_token%'
   or p.proname ilike '%access_token_hook%';

-- 6) supabase_migrations.schema_migrations (applied migrations)
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 30;

-- 7) match_* tables exist?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%'
order by 1;

-- 8) TALK / Marketplace / Builder related tables row counts
select 'transaction_rooms' as tbl, count(*) as cnt from public.transaction_rooms
union all
select 'transaction_reads', count(*) from public.transaction_reads
union all
select 'listings', count(*) from public.listings
union all
select 'business_listings', count(*) from public.business_listings
union all
select 'profiles', count(*) from public.profiles
union all
select 'members', count(*) from public.members
union all
select 'talk_user_profiles', count(*) from public.talk_user_profiles;

-- 9) TALK buyer_id / seller_id distinct (text IDs)
select 'buyer_id' as role, buyer_id as text_user_id, count(*) as room_count
from public.transaction_rooms
where buyer_id is not null
group by buyer_id
union all
select 'seller_id', seller_id, count(*)
from public.transaction_rooms
where seller_id is not null
group by seller_id
order by 1, 2;

-- 10) Marketplace owner_id / user_id distinct
select 'listings.owner_id' as source, owner_id as text_user_id, count(*) as cnt
from public.listings
where owner_id is not null and owner_id <> ''
group by owner_id
union all
select 'listings.user_id', user_id::text, count(*)
from public.listings
where user_id is not null and user_id::text <> ''
group by user_id
order by 1, 2;

-- 11) profiles / members user id columns (sample structure)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'members', 'listings', 'transaction_rooms')
  and column_name ilike any (array['%user%id%', 'buyer_id', 'seller_id', 'owner_id', 'member_id'])
order by table_name, ordinal_position;

-- 12) UUID vs text pattern in transaction_rooms buyer_id
select
  count(*) filter (where buyer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-') as buyer_uuid_like,
  count(*) filter (where buyer_id is not null and buyer_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-') as buyer_text_like,
  count(*) filter (where seller_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-') as seller_uuid_like,
  count(*) filter (where seller_id is not null and seller_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-') as seller_text_like
from public.transaction_rooms;

-- 13) Builder applications user_id if table exists
select table_name
from information_schema.tables
where table_schema = 'public'
  and (table_name ilike '%application%' or table_name ilike '%builder%')
order by 1;

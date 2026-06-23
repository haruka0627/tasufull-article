-- TASFUL Auth Hook L1 backup baseline — READ-ONLY only
-- Target: linked ref ddojquacsyqesrjhcvmn
-- DO NOT APPLY writes · run via: npx supabase db query --linked --yes -f sql/auth-hook-l1-backup-readonly.sql

-- =============================================================================
-- 1) auth.users metadata snapshot (full cohort · 7 rows expected)
-- =============================================================================
select
  id,
  email,
  created_at,
  updated_at,
  raw_app_meta_data as app_metadata,
  raw_user_meta_data as user_metadata
from auth.users
order by created_at asc;

-- =============================================================================
-- 2) auth.users summary counts
-- =============================================================================
select
  count(*) as total_users,
  count(*) filter (where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null) as with_app_talk_user_id,
  count(*) filter (where nullif(trim(raw_app_meta_data->>'member_id'), '') is not null) as with_app_member_id,
  count(*) filter (where nullif(trim(raw_user_meta_data->>'talk_user_id'), '') is not null) as with_user_talk_user_id
from auth.users;

-- =============================================================================
-- 3) talk_user_id duplicate check (rollback reference)
-- =============================================================================
select
  raw_app_meta_data->>'talk_user_id' as talk_user_id,
  count(*) as cnt,
  array_agg(id::text order by created_at) as auth_user_ids
from auth.users
where nullif(trim(raw_app_meta_data->>'talk_user_id'), '') is not null
group by 1
having count(*) > 1;

-- =============================================================================
-- 4) TALK text IDs — transaction_rooms
-- =============================================================================
select 'buyer_id' as role, buyer_id as text_user_id, count(*) as row_count
from public.transaction_rooms
where buyer_id is not null
group by buyer_id
union all
select 'seller_id', seller_id, count(*)
from public.transaction_rooms
where seller_id is not null
group by seller_id
order by 1, 2;

select distinct user_id as text_user_id
from public.transaction_reads
where user_id is not null
order by 1;

-- =============================================================================
-- 5) Marketplace text IDs
-- =============================================================================
select user_id as text_user_id, count(*) as listing_count
from public.listings
where user_id is not null and user_id <> ''
group by user_id
order by listing_count desc;

select user_id as text_user_id, count(*) as row_count
from public.business_listings
where user_id is not null and user_id <> ''
group by user_id
order by row_count desc;

-- =============================================================================
-- 6) profiles / members text IDs
-- =============================================================================
select user_id, display_name, updated_at
from public.profiles
order by user_id;

select user_id, rank, is_premium, identity_verified, updated_at
from public.members
order by user_id;

-- =============================================================================
-- 7) MATCH migration not applied — table + function checks
-- =============================================================================
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'match_%'
order by 1;

select proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('match_current_user_id', 'custom_access_token_hook');

-- =============================================================================
-- 8) Auth Hook function check (broader pattern)
-- =============================================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname ilike '%custom_access_token%'
   or p.proname ilike '%access_token_hook%';

-- =============================================================================
-- 9) RLS baseline (key tables · read-only)
-- =============================================================================
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'transaction_rooms', 'transaction_reads', 'listings',
    'business_listings', 'profiles', 'members'
  )
order by 1;

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('transaction_rooms', 'listings', 'profiles', 'members')
order by tablename, policyname;

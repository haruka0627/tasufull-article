-- =============================================================================
-- TASFUL Marketplace — dev RLS ポリシー削除（P1-S1〜S4）
-- 前提: sql/marketplace-rls-production.sql 適用済み
--
-- *_dev は using(true) / with check(true) のため prod と OR 結合され RLS が無効化されます。
-- =============================================================================

-- listings
drop policy if exists "listings_select_dev" on public.listings;
drop policy if exists "listings_insert_dev" on public.listings;
drop policy if exists "listings_update_dev" on public.listings;
drop policy if exists "listings_delete_dev" on public.listings;

-- business_listings
drop policy if exists "business_listings_select_dev" on public.business_listings;
drop policy if exists "business_listings_insert_dev" on public.business_listings;
drop policy if exists "business_listings_update_dev" on public.business_listings;
drop policy if exists "business_listings_delete_dev" on public.business_listings;

-- profiles / members
drop policy if exists "profiles_select_dev" on public.profiles;
drop policy if exists "members_select_dev" on public.members;

-- 残存 dev ポリシー（0 行が期待）
select
  tablename,
  policyname,
  'DEV_POLICY_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename in ('listings', 'business_listings', 'profiles', 'members')
  and policyname like '%_dev'
order by tablename, policyname;

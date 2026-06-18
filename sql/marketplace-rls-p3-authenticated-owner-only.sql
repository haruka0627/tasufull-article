-- =============================================================================
-- TASFUL Marketplace RLS P3 — authenticated 非 owner の base SELECT 禁止
-- 前提:
--   sql/marketplace-rls-production.sql
--   sql/marketplace-public-safe-layer.sql
--
-- 公開閲覧（anon / authenticated 非 owner）→ safe view のみ
-- owner 管理（draft / payment_url 等）→ base table + *_select_owner policy
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. base table 公開 SELECT ポリシー削除（P1 の *_select_public）
--    authenticated 非 owner が base から他人の公開行を読む経路を遮断
-- ---------------------------------------------------------------------------
drop policy if exists "listings_select_public" on public.listings;
drop policy if exists "business_listings_select_public" on public.business_listings;
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "members_select_public" on public.members;

-- ---------------------------------------------------------------------------
-- 2. owner SELECT ポリシー再確認（idempotent · user_id = talk_current_user_id()）
-- ---------------------------------------------------------------------------
drop policy if exists "listings_select_owner" on public.listings;
create policy "listings_select_owner"
  on public.listings
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

drop policy if exists "business_listings_select_owner" on public.business_listings;
create policy "business_listings_select_owner"
  on public.business_listings
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

drop policy if exists "profiles_select_owner" on public.profiles;
create policy "profiles_select_owner"
  on public.profiles
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

drop policy if exists "members_select_owner" on public.members;
create policy "members_select_owner"
  on public.members
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

-- ---------------------------------------------------------------------------
-- 3. safe view grants（anon / authenticated 公開閲覧）
-- ---------------------------------------------------------------------------
grant select on public.public_marketplace_listings to anon, authenticated;
grant select on public.public_business_listings to anon, authenticated;
grant select on public.public_marketplace_profiles to anon, authenticated;
grant select on public.public_marketplace_members to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. base table: anon SELECT 不可を維持（P2 再適用 · idempotent）
--    authenticated は GRANT + RLS owner policy のみ（非 owner は 0 行）
-- ---------------------------------------------------------------------------
revoke select on table public.listings from anon;
revoke select on table public.business_listings from anon;
revoke select on table public.profiles from anon;
revoke select on table public.members from anon;

-- ---------------------------------------------------------------------------
-- 5. 残存ポリシー確認（*_select_public = 0 行期待）
-- ---------------------------------------------------------------------------
select
  tablename,
  policyname,
  cmd,
  roles,
  'SELECT_PUBLIC_STILL_PRESENT' as warning
from pg_policies
where schemaname = 'public'
  and tablename in ('listings', 'business_listings', 'profiles', 'members')
  and policyname like '%_select_public%'
order by tablename, policyname;

select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('listings', 'business_listings', 'profiles', 'members')
  and cmd = 'SELECT'
order by tablename, policyname;

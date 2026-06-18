-- =============================================================================
-- TASFUL Marketplace — 本番 RLS（P1-S1〜S4）
-- 対象: listings · business_listings · profiles · members
--
-- 適用順:
--   1) sql/talk-rls-production.sql（talk_current_user_id 未適用なら）
--   2) 本ファイル
--   3) sql/marketplace-rls-drop-dev-policies.sql（必須）
--
-- anon: 公開掲載 / 公開出品者プロフィールのみ SELECT
-- authenticated: 本人 CRUD + 他人の公開行 SELECT
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ヘルパー（talk-rls-production.sql と同一 — 未適用環境向け idempotent）
-- ---------------------------------------------------------------------------
create or replace function public.talk_current_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    trim(
      coalesce(
        auth.jwt() ->> 'talk_user_id',
        auth.jwt() -> 'app_metadata' ->> 'talk_user_id',
        auth.jwt() -> 'user_metadata' ->> 'talk_user_id',
        auth.jwt() ->> 'member_id',
        auth.jwt() -> 'app_metadata' ->> 'member_id',
        auth.jwt() -> 'user_metadata' ->> 'member_id',
        auth.jwt() ->> 'sub',
        auth.uid()::text
      )
    ),
    ''
  );
$$;

create or replace function public.talk_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') in ('tasu_admin', 'service_role', 'supabase_admin')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('tasu_admin', 'admin')
    or coalesce(auth.jwt() ->> 'tasu_admin', '') = 'true'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'tasu_admin', '') = 'true';
$$;

-- ---------------------------------------------------------------------------
-- Marketplace ヘルパー
-- ---------------------------------------------------------------------------

-- business_listings に publish_at が無い DB 向け（再実行安全）
alter table public.business_listings
  add column if not exists publish_at timestamptz;

/** 公開掲載か（draft / 未来 scheduled / private 相当は false） */
create or replace function public.marketplace_listing_is_public(
  p_publish_status text,
  p_publish_at timestamptz default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(btrim(p_publish_status), '') = 'public' then true
    when coalesce(btrim(p_publish_status), '') = 'scheduled'
      and p_publish_at is not null
      and p_publish_at <= now() then true
    else false
  end;
$$;

comment on function public.marketplace_listing_is_public(text, timestamptz) is
  'Marketplace RLS: publish_status=public または公開時刻到達済み scheduled のみ anon 可';

/** JWT オーナー / admin 判定（listings.user_id 等 text PK と突合） */
create or replace function public.marketplace_is_owner(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.talk_is_admin()
    or (
      p_user_id is not null
      and btrim(p_user_id) <> ''
      and btrim(p_user_id) = coalesce(public.talk_current_user_id(), '')
    );
$$;

comment on function public.marketplace_is_owner(text) is
  'Marketplace RLS: talk_current_user_id() / admin と user_id 整合';

/** 公開出品者プロフィール（公開掲載を1件以上持つ user_id のみ anon 可） */
create or replace function public.marketplace_profile_is_public(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.user_id = p_user_id
      and public.marketplace_listing_is_public(l.publish_status, l.publish_at)
  )
  or exists (
    select 1
    from public.business_listings b
    where b.user_id = p_user_id
      and public.marketplace_listing_is_public(b.publish_status, b.publish_at)
  );
$$;

comment on function public.marketplace_profile_is_public(text) is
  'Marketplace RLS: 公開 listings / business_listings を持つ出品者のみ profiles/members を anon 可';

-- ---------------------------------------------------------------------------
-- RLS 有効化
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.business_listings enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
drop policy if exists "listings_select_public" on public.listings;
drop policy if exists "listings_select_owner" on public.listings;
drop policy if exists "listings_insert_owner" on public.listings;
drop policy if exists "listings_update_owner" on public.listings;
drop policy if exists "listings_delete_owner" on public.listings;

create policy "listings_select_public"
  on public.listings
  for select
  to anon, authenticated
  using (public.marketplace_listing_is_public(publish_status, publish_at));

create policy "listings_select_owner"
  on public.listings
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

create policy "listings_insert_owner"
  on public.listings
  for insert
  to authenticated
  with check (public.marketplace_is_owner(user_id));

create policy "listings_update_owner"
  on public.listings
  for update
  to authenticated
  using (public.marketplace_is_owner(user_id))
  with check (public.marketplace_is_owner(user_id));

create policy "listings_delete_owner"
  on public.listings
  for delete
  to authenticated
  using (public.marketplace_is_owner(user_id));

-- ---------------------------------------------------------------------------
-- business_listings
-- ---------------------------------------------------------------------------
drop policy if exists "business_listings_select_public" on public.business_listings;
drop policy if exists "business_listings_select_owner" on public.business_listings;
drop policy if exists "business_listings_insert_owner" on public.business_listings;
drop policy if exists "business_listings_update_owner" on public.business_listings;
drop policy if exists "business_listings_delete_owner" on public.business_listings;

create policy "business_listings_select_public"
  on public.business_listings
  for select
  to anon, authenticated
  using (public.marketplace_listing_is_public(publish_status, publish_at));

create policy "business_listings_select_owner"
  on public.business_listings
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

create policy "business_listings_insert_owner"
  on public.business_listings
  for insert
  to authenticated
  with check (public.marketplace_is_owner(user_id));

create policy "business_listings_update_owner"
  on public.business_listings
  for update
  to authenticated
  using (public.marketplace_is_owner(user_id))
  with check (public.marketplace_is_owner(user_id));

create policy "business_listings_delete_owner"
  on public.business_listings
  for delete
  to authenticated
  using (public.marketplace_is_owner(user_id));

-- ---------------------------------------------------------------------------
-- profiles — 公開出品者のみ anon SELECT / 本人 upsert
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_owner" on public.profiles;
drop policy if exists "profiles_insert_owner" on public.profiles;
drop policy if exists "profiles_update_owner" on public.profiles;

create policy "profiles_select_public"
  on public.profiles
  for select
  to anon, authenticated
  using (public.marketplace_profile_is_public(user_id));

create policy "profiles_select_owner"
  on public.profiles
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

create policy "profiles_insert_owner"
  on public.profiles
  for insert
  to authenticated
  with check (public.marketplace_is_owner(user_id));

create policy "profiles_update_owner"
  on public.profiles
  for update
  to authenticated
  using (public.marketplace_is_owner(user_id))
  with check (public.marketplace_is_owner(user_id));

-- ---------------------------------------------------------------------------
-- members — profiles と同型
-- ---------------------------------------------------------------------------
drop policy if exists "members_select_public" on public.members;
drop policy if exists "members_select_owner" on public.members;
drop policy if exists "members_insert_owner" on public.members;
drop policy if exists "members_update_owner" on public.members;

create policy "members_select_public"
  on public.members
  for select
  to anon, authenticated
  using (public.marketplace_profile_is_public(user_id));

create policy "members_select_owner"
  on public.members
  for select
  to authenticated
  using (public.marketplace_is_owner(user_id));

create policy "members_insert_owner"
  on public.members
  for insert
  to authenticated
  with check (public.marketplace_is_owner(user_id));

create policy "members_update_owner"
  on public.members
  for update
  to authenticated
  using (public.marketplace_is_owner(user_id))
  with check (public.marketplace_is_owner(user_id));

-- 残存 prod ポリシー確認
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('listings', 'business_listings', 'profiles', 'members')
  and policyname not like '%_dev'
order by tablename, policyname;

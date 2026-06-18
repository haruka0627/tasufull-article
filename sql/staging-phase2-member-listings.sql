-- TASFUL Supabase Phase 2 — 会員 / 掲載 / お気に入り（Staging 統合 DDL）
-- 既存 public.listings がある場合は列追加のみ（owner_id インデックスは列があるときのみ）

create table if not exists public.member_favorites (
  id text primary key,
  user_id text not null,
  listing_id text not null,
  listing_type text not null default 'general',
  title text,
  target_url text,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id, listing_type)
);

create index if not exists member_favorites_user_idx
  on public.member_favorites (user_id, created_at desc);

create table if not exists public.listings (
  id text primary key,
  owner_id text,
  listing_type text not null default 'general',
  title text,
  status text not null default 'draft',
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listings add column if not exists owner_id text;
alter table public.listings add column if not exists listing_type text;
alter table public.listings add column if not exists title text;
alter table public.listings add column if not exists status text;
alter table public.listings add column if not exists payload jsonb;
alter table public.listings add column if not exists created_at timestamptz;
alter table public.listings add column if not exists updated_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'owner_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'updated_at'
  ) then
    execute 'create index if not exists listings_owner_updated_idx on public.listings (owner_id, updated_at desc)';
  end if;
end $$;

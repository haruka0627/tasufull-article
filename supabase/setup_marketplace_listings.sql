-- =============================================================================
-- TasuFull 掲載テーブル一式（Supabase SQL Editor でこのファイルを順に実行）
-- 一般: listings / 法人・業者: business_listings
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. listings（一般: スキル / 商品 / 求人 / ワーカー）
-- -----------------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  listing_type text not null check (
    listing_type in ('skill', 'product', 'job', 'worker')
  ),
  title text not null,
  description text not null default '',
  tags text default '',
  publish_status text not null default 'public' check (
    publish_status in ('draft', 'public', 'scheduled')
  ),
  publish_at timestamptz,
  price_amount numeric,
  payment_url text,
  bank_transfer_info text,
  onsite_payment boolean not null default false,
  invoice_support text not null default 'no' check (
    invoice_support in ('yes', 'no', 'negotiable')
  ),
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_user_id_idx on public.listings (user_id);
create index if not exists listings_listing_type_idx on public.listings (listing_type);
create index if not exists listings_publish_status_idx on public.listings (publish_status);
create index if not exists listings_created_at_idx on public.listings (created_at desc);

-- -----------------------------------------------------------------------------
-- 2. business_listings（法人・業者）
-- -----------------------------------------------------------------------------
create table if not exists public.business_listings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  business_category text not null check (
    business_category in (
      'transport',
      'construction_work',
      'repair_maintenance',
      'cleaning',
      'shop_store',
      'field_service',
      'store_field_service',
      'local_support'
    )
  ),
  business_subcategory text,
  company_name text not null,
  title text not null,
  description text not null,
  hp_url text,
  google_map_url text,
  phone text not null,
  business_hours text,
  service_area text not null,
  achievements text,
  status text not null default 'available' check (
    status in ('available', 'busy', 'closed')
  ),
  license_info text,
  pr_plan text not null default 'none' check (
    pr_plan in ('none', 'considering', 'apply')
  ),
  featured_plan text not null default 'none' check (
    featured_plan in ('none', 'considering', 'apply')
  ),
  payment_url text,
  bank_transfer_info text,
  invoice_support text not null default 'negotiable' check (
    invoice_support in ('yes', 'no', 'negotiable')
  ),
  rating numeric not null default 0,
  review_count int not null default 0,
  reply_rate numeric not null default 0,
  publish_status text not null default 'public' check (
    publish_status in ('draft', 'public', 'scheduled')
  ),
  tags text default '',
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_listings_user_id_idx
  on public.business_listings (user_id);
create index if not exists business_listings_category_idx
  on public.business_listings (business_category);
create index if not exists business_listings_status_idx
  on public.business_listings (status);
create index if not exists business_listings_service_area_idx
  on public.business_listings (service_area);
create index if not exists business_listings_created_at_idx
  on public.business_listings (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. 既存テーブルへ不足カラムを追加（再実行しても安全）
-- -----------------------------------------------------------------------------
alter table public.listings
  add column if not exists tags text default '',
  add column if not exists publish_status text not null default 'public',
  add column if not exists publish_at timestamptz,
  add column if not exists price_amount numeric,
  add column if not exists form_data jsonb not null default '{}'::jsonb,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists product_description text,
  add column if not exists condition text,
  add column if not exists delivery_method text,
  add column if not exists stock_count text,
  add column if not exists delivery_days text,
  add column if not exists spec text,
  -- lead_time: 非推奨（新規利用禁止）
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists available_tags jsonb not null default '[]'::jsonb,
  add column if not exists options jsonb not null default '[]'::jsonb;

alter table public.business_listings
  add column if not exists payment_url text,
  add column if not exists bank_transfer_info text,
  add column if not exists invoice_support text not null default 'negotiable',
  add column if not exists publish_status text not null default 'public',
  add column if not exists tags text default '',
  add column if not exists form_data jsonb not null default '{}'::jsonb,
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists main_image_url text,
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 4. updated_at 自動更新
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

drop trigger if exists business_listings_set_updated_at on public.business_listings;
create trigger business_listings_set_updated_at
  before update on public.business_listings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. RLS（開発用: anon / authenticated で読み書き可）
--    本番では user_id ベースのポリシーに差し替えてください。
-- -----------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.business_listings enable row level security;

drop policy if exists "listings_select_dev" on public.listings;
drop policy if exists "listings_insert_dev" on public.listings;
drop policy if exists "listings_update_dev" on public.listings;
drop policy if exists "listings_delete_dev" on public.listings;

create policy "listings_select_dev"
  on public.listings for select to anon, authenticated using (true);
create policy "listings_insert_dev"
  on public.listings for insert to anon, authenticated with check (true);
create policy "listings_update_dev"
  on public.listings for update to anon, authenticated using (true) with check (true);
create policy "listings_delete_dev"
  on public.listings for delete to anon, authenticated using (true);

drop policy if exists "business_listings_select_dev" on public.business_listings;
drop policy if exists "business_listings_insert_dev" on public.business_listings;
drop policy if exists "business_listings_update_dev" on public.business_listings;
drop policy if exists "business_listings_delete_dev" on public.business_listings;

create policy "business_listings_select_dev"
  on public.business_listings for select to anon, authenticated using (true);
create policy "business_listings_insert_dev"
  on public.business_listings for insert to anon, authenticated with check (true);
create policy "business_listings_update_dev"
  on public.business_listings for update to anon, authenticated using (true) with check (true);
create policy "business_listings_delete_dev"
  on public.business_listings for delete to anon, authenticated using (true);

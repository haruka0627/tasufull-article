-- 法人・業者掲載（business_listings）
-- ※ 初回セットアップは setup_marketplace_listings.sql を SQL Editor で実行してください（RLS 含む）

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
  pr_payment_url text,
  pr_bank_info text,
  featured_payment_url text,
  featured_bank_info text,
  payment_url text,
  bank_transfer_info text,
  invoice_support text not null default 'negotiable' check (
    invoice_support in ('yes', 'no', 'negotiable')
  ),
  publish_status text not null default 'public' check (
    publish_status in ('draft', 'public', 'scheduled')
  ),
  tags text default '',
  form_data jsonb not null default '{}'::jsonb,
  rating numeric not null default 0,
  review_count int not null default 0,
  reply_rate numeric not null default 0,
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

-- 開発用: RLS を有効にする場合はポリシーを別途追加
-- alter table public.business_listings enable row level security;

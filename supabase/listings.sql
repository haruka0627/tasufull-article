-- 一般掲載（listings）
-- 初回は setup_marketplace_listings.sql を実行してください（RLS・トリガー込み）

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
create index if not exists listings_created_at_idx on public.listings (created_at desc);

-- 店舗商品の注文（Stripe Connect: 店舗売上 + TASFUL 手数料）
create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  shop_listing_id text not null,
  product_id text not null,
  product_name text,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  unit_price_jpy integer not null check (unit_price_jpy >= 0),
  amount_total integer not null check (amount_total >= 0),
  total_amount_jpy integer not null check (total_amount_jpy >= 0),
  platform_fee_amount integer not null default 0 check (platform_fee_amount >= 0),
  seller_amount integer not null check (seller_amount >= 0),
  currency text not null default 'jpy',
  buyer_user_id uuid references auth.users (id) on delete set null,
  buyer_email text,
  seller_user_id uuid references auth.users (id) on delete set null,
  seller_stripe_account_id text,
  payment_status text not null default 'pending',
  payout_status text not null default 'pending',
  stripe_checkout_session_id text unique,
  stripe_session_id text,
  stripe_payment_intent_id text,
  shop_notified boolean not null default false,
  notify_shop_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_orders_shop_id_idx
  on public.shop_orders (shop_id, created_at desc);

create index if not exists shop_orders_seller_user_id_idx
  on public.shop_orders (seller_user_id, created_at desc);

create index if not exists shop_orders_payout_status_idx
  on public.shop_orders (payout_status, shop_notified)
  where payout_status in ('pending', 'paid');

comment on table public.shop_orders is '店舗・販売の商品注文。決済は Stripe Connect で店舗口座へ入金、TASFUL は platform_fee_amount のみ。';

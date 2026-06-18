-- shop_orders: Stripe Connect 前提の店舗売上・手数料・振込ステータス
-- 既存テーブルがある場合は ALTER のみ実行

alter table public.shop_orders
  add column if not exists shop_id text,
  add column if not exists seller_user_id uuid references auth.users (id) on delete set null,
  add column if not exists seller_stripe_account_id text,
  add column if not exists amount_total integer,
  add column if not exists platform_fee_amount integer default 0,
  add column if not exists seller_amount integer,
  add column if not exists payout_status text default 'pending',
  add column if not exists stripe_session_id text;

-- buyer_id は buyer_user_id のエイリアス用途（参照用ビューでも可）
comment on column public.shop_orders.shop_id is '店舗掲載 ID（business_listings.id または demo_id）';
comment on column public.shop_orders.seller_stripe_account_id is '入金先 Stripe Connect Account';
comment on column public.shop_orders.platform_fee_amount is 'TASFUL プラットフォーム手数料（円）';
comment on column public.shop_orders.seller_amount is '店舗売上（円）= amount_total - platform_fee_amount';
comment on column public.shop_orders.payout_status is 'pending | paid | transferred | failed';

-- 既存行のバックフィル
update public.shop_orders
set
  shop_id = coalesce(shop_id, shop_listing_id),
  amount_total = coalesce(amount_total, total_amount_jpy),
  seller_amount = coalesce(seller_amount, total_amount_jpy - coalesce(platform_fee_amount, 0)),
  stripe_session_id = coalesce(stripe_session_id, stripe_checkout_session_id)
where shop_id is null or amount_total is null;

create index if not exists shop_orders_seller_user_id_idx
  on public.shop_orders (seller_user_id, created_at desc);

create index if not exists shop_orders_payout_status_idx
  on public.shop_orders (payout_status, shop_notified)
  where payout_status in ('pending', 'paid');

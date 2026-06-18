-- 店舗・販売: Stripe Connect 振込先（商品代金は店舗売上、TASFUL は手数料のみ）
alter table public.business_listings
  add column if not exists stripe_account_id text,
  add column if not exists payout_account_status text default 'not_connected',
  add column if not exists payout_enabled boolean default false,
  add column if not exists platform_fee_rate numeric(5, 4) default 0.1000;

comment on column public.business_listings.stripe_account_id is 'Stripe Connect Account ID（acct_...）。商品代金の入金先。';
comment on column public.business_listings.payout_account_status is 'Connect 状態: not_connected | pending | active | restricted';
comment on column public.business_listings.payout_enabled is 'オンライン決済（Connect 入金）が有効か';
comment on column public.business_listings.platform_fee_rate is 'TASFUL プラットフォーム手数料率（0.1 = 10%）';

create index if not exists business_listings_stripe_account_id_idx
  on public.business_listings (stripe_account_id)
  where stripe_account_id is not null;

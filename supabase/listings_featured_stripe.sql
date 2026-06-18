-- =============================================================================
-- listings: Stripe Checkout 冪等用
-- 同一 checkout.session の二重適用を防ぐ（Webhook + success_url 確認の両方）
-- Supabase SQL Editor で listings_featured_columns.sql の後に実行
-- =============================================================================

alter table public.listings
  add column if not exists featured_stripe_session_id text;

comment on column public.listings.featured_stripe_session_id is
  '最後に適用した Stripe Checkout Session ID（cs_...）。同一 ID の再適用をスキップ';

create unique index if not exists listings_featured_stripe_session_uidx
  on public.listings (featured_stripe_session_id)
  where featured_stripe_session_id is not null;

-- 参照・デバッグ用（unique と併用可）
create index if not exists listings_featured_stripe_session_idx
  on public.listings (featured_stripe_session_id)
  where featured_stripe_session_id is not null;

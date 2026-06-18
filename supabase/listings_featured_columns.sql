-- =============================================================================
-- listings: 上位掲載（featured）カラム
-- Supabase SQL Editor で実行（再実行しても安全）
-- =============================================================================

-- 上位掲載フラグ（Stripe 決済完了後 true）
alter table public.listings
  add column if not exists is_featured boolean not null default false;

-- 有効期限（過ぎたら一覧では通常掲載扱い — cron 不要）
alter table public.listings
  add column if not exists featured_until timestamptz;

-- 購入プラン（Stripe metadata と同一）
--   featured_7days   … 7日 ¥980
--   featured_30days  … 30日 ¥2,980
--   pr_30days        … PR 30日 ¥4,980
-- 旧データ互換: 7days / 30days が残る場合あり
alter table public.listings
  add column if not exists featured_plan text;

-- 表示優先度（将来の並び替え用。featured_7days=1, featured_30days=2, pr_30days=3）
alter table public.listings
  add column if not exists featured_priority integer not null default 0;

comment on column public.listings.is_featured is
  '上位掲載フラグ。is_featured=true かつ featured_until>now() で有効';
comment on column public.listings.featured_until is
  '上位掲載・PR の有効期限（timestamptz）';
comment on column public.listings.featured_plan is
  'プラン ID: featured_7days | featured_30days | pr_30days';
comment on column public.listings.featured_priority is
  '注目掲載欄の優先度（数値が大きいほど優先）';

-- 有効な上位掲載の検索用
create index if not exists listings_featured_active_idx
  on public.listings (featured_until desc)
  where is_featured = true and featured_until is not null;

create index if not exists listings_featured_plan_idx
  on public.listings (featured_plan)
  where featured_plan is not null;

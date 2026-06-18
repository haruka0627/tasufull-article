-- =============================================================================
-- public.business_listings — 法人・業者「案件条件」カラム追加（現行アプリ用）
-- post.html 法人フォーム → business-listings-db.js が INSERT するテーブルです。
-- listings 用 SQL とセットで実行することを推奨します。
-- =============================================================================

alter table public.business_listings
  add column if not exists budget_amount text,
  add column if not exists payment_type text,
  add column if not exists start_date text,
  add column if not exists contract_period text,
  add column if not exists recruit_count text,
  add column if not exists recruit_status text default '受付中',
  add column if not exists application_conditions jsonb default '[]'::jsonb,
  add column if not exists contact_method text default 'サイト内チャット',
  add column if not exists category_extra jsonb default '{}'::jsonb;

comment on column public.business_listings.budget_amount is
  '予算・単価（表示用テキスト）。案件ボードの予算/単価列。';

comment on column public.business_listings.payment_type is
  '支払い条件（時給・日給・月額など）。';

comment on column public.business_listings.start_date is
  '開始希望日。';

comment on column public.business_listings.contract_period is
  '契約期間。案件ボードの期間列。';

comment on column public.business_listings.recruit_count is
  '募集人数。';

comment on column public.business_listings.recruit_status is
  '受付状況（受付中・一時停止・対応不可）。バッジ表示用。';

comment on column public.business_listings.application_conditions is
  '応募条件配列（jsonb）。';

comment on column public.business_listings.contact_method is
  '応募後の連絡方法。';

comment on column public.business_listings.category_extra is
  'カテゴリ別追加項目（jsonb）。建設パートナー登録など。';

create index if not exists business_listings_recruit_status_idx
  on public.business_listings (recruit_status)
  where recruit_status is not null;

create index if not exists business_listings_application_conditions_gin_idx
  on public.business_listings using gin (application_conditions);

create index if not exists business_listings_category_extra_gin_idx
  on public.business_listings using gin (category_extra);

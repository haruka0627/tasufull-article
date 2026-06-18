-- =============================================================================
-- public.listings — 法人・業者向け「案件条件」カラム追加
-- Supabase SQL Editor にそのまま貼って実行できます。
--
-- ・既存行は壊れません（NULL / デフォルト値のまま）
-- ・一般掲載（skill / product / job / worker）は未入力のまま利用可能
-- ・IF NOT EXISTS のため再実行してもエラーになりません
--
-- 注意:
--   現行フロントは法人掲載を public.business_listings に保存しています。
--   本番で案件条件を列として保存する場合は
--   business_listings_business_job_conditions_columns.sql も実行してください。
-- =============================================================================

alter table public.listings
  add column if not exists budget_amount text,
  add column if not exists payment_type text,
  add column if not exists start_date text,
  add column if not exists contract_period text,
  add column if not exists recruit_count text,
  add column if not exists recruit_status text default '受付中',
  add column if not exists application_conditions jsonb default '[]'::jsonb,
  add column if not exists contact_method text default 'サイト内チャット',
  add column if not exists category_extra jsonb default '{}'::jsonb;

comment on column public.listings.budget_amount is
  '予算・単価（表示用テキスト）。案件ボードの予算/単価列。法人・業者向け。';

comment on column public.listings.payment_type is
  '支払い条件（時給・日給・月額・件単価・成果報酬・要相談など）。法人・業者向け。';

comment on column public.listings.start_date is
  '開始希望日（日付または「即日」「相談可」などのテキスト）。法人・業者向け。';

comment on column public.listings.contract_period is
  '契約期間（単発・1ヶ月〜・長期・要相談など）。案件ボードの期間列。法人・業者向け。';

comment on column public.listings.recruit_count is
  '募集人数（1名・複数名・チーム可など）。法人・業者向け。';

comment on column public.listings.recruit_status is
  '受付状況（受付中・一時停止・対応不可）。依頼先一覧のバッジ用。法人・業者向け。';

comment on column public.listings.application_conditions is
  '応募条件の配列（jsonb）。例: ["急募","資格必須"]。フィルター・バッジ用。法人・業者向け。';

comment on column public.listings.contact_method is
  '応募後の連絡方法（サイト内チャット・電話・メールなど）。法人・業者向け。';

comment on column public.listings.category_extra is
  'カテゴリ別追加項目（jsonb）。例: {"construction":{"partner_registration":"..."}}。法人・業者向け。';

-- 任意: 募集状況・応募条件での検索を想定する場合
create index if not exists listings_recruit_status_idx
  on public.listings (recruit_status)
  where recruit_status is not null;

create index if not exists listings_application_conditions_gin_idx
  on public.listings using gin (application_conditions);

create index if not exists listings_category_extra_gin_idx
  on public.listings using gin (category_extra);

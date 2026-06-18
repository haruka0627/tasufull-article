-- public.listings — ワーカー（worker）用カラム追加
-- Supabase SQL Editor で実行してください。

alter table public.listings
  add column if not exists worker_profile text,
  add column if not exists worker_services text,
  add column if not exists worker_area text,
  add column if not exists worker_availability text,
  add column if not exists worker_experience text,
  add column if not exists worker_certifications text,
  add column if not exists worker_display_name text,
  add column if not exists worker_age_group text,
  add column if not exists worker_notes text,
  add column if not exists worker_price_type text,
  add column if not exists worker_price_amount numeric,
  add column if not exists worker_support_tags text,
  add column if not exists worker_invoice_support text,
  add column if not exists worker_payment_url text,
  add column if not exists worker_bank_info text;

comment on column public.listings.worker_profile is 'ワーカー自己紹介・プロフィール';
comment on column public.listings.worker_services is '対応業務・対応内容';
comment on column public.listings.worker_area is '対応エリア';
comment on column public.listings.worker_availability is '稼働時間';
comment on column public.listings.worker_experience is '経験年数';
comment on column public.listings.worker_certifications is '資格・認証';
comment on column public.listings.worker_display_name is '表示名';
comment on column public.listings.worker_age_group is '年齢層';
comment on column public.listings.worker_notes is '注意事項';
comment on column public.listings.worker_price_type is '料金体系（時給・日給等）';
comment on column public.listings.worker_price_amount is '料金金額（数値）';
comment on column public.listings.worker_support_tags is '対応タグ（カンマ区切り）';
comment on column public.listings.worker_invoice_support is '請求書対応';
comment on column public.listings.worker_payment_url is '決済URL';
comment on column public.listings.worker_bank_info is '振込先情報';

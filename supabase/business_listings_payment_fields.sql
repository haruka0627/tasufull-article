-- business_listings に決済・請求フィールドを追加（既存テーブル向け）
-- business_listings.sql 適用済みの環境では本ファイルを SQL Editor で実行してください。

alter table public.business_listings
  add column if not exists payment_url text,
  add column if not exists bank_transfer_info text,
  add column if not exists invoice_support text not null default 'negotiable';

alter table public.business_listings
  drop constraint if exists business_listings_invoice_support_check;

alter table public.business_listings
  add constraint business_listings_invoice_support_check
  check (invoice_support in ('yes', 'no', 'negotiable'));

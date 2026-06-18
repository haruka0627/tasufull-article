-- product 掲載の主要フィールド（listings 直下）
-- Supabase SQL Editor で listings 作成後に実行

alter table public.listings
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists product_description text,
  add column if not exists condition text,
  add column if not exists delivery_method text,
  add column if not exists stock_count text,
  add column if not exists delivery_days text,
  add column if not exists spec text,
  -- lead_time: 非推奨（新規利用禁止）。既存DBに残っていてもアプリからは参照しない。
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists available_tags jsonb not null default '[]'::jsonb,
  add column if not exists options jsonb not null default '[]'::jsonb;

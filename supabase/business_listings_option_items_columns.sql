-- public.business_listings — 対応オプション（修理・建設・清掃 詳細用）
alter table public.business_listings
  add column if not exists option_items jsonb not null default '[]'::jsonb;

comment on column public.business_listings.option_items is
  '対応オプションカード配列 [{ "title": "...", "description": "..." }]';

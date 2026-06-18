-- public.business_listings — 対応サービス（サービス名・料金・説明）
alter table public.business_listings
  add column if not exists service_menu_items jsonb default '[]'::jsonb;

comment on column public.business_listings.service_menu_items is
  '対応サービス（jsonb 配列。title, price, description, duration, location, image_url）';

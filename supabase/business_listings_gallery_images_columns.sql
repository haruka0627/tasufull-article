-- public.business_listings — 実績・事例用サブ画像（メイン image_url とは別配列）
-- SQL Editor で実行してください

alter table public.business_listings
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;

comment on column public.business_listings.gallery_images is
  '実績・事例用サブ画像 URL 配列（ヒーロー下サムネ・事例カード。メイン image_url は含めない）';

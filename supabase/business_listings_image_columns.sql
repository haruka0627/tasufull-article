-- public.business_listings — 掲載画像カラム（法人投稿・一覧表示用）
-- SQL Editor で実行してください（listings と同様の画像列）

alter table public.business_listings
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists main_image_url text,
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb,
  add column if not exists images jsonb not null default '[]'::jsonb;

comment on column public.business_listings.image_url is
  '一覧・詳細のメイン画像（Storage 公開 URL または data URL）';
comment on column public.business_listings.thumbnail_url is
  '一覧サムネイル（未設定時は image_url と同値）';
comment on column public.business_listings.images is
  'ギャラリー画像 URL 配列（form_data.images と同期）';

-- 法人・業者カテゴリ v2（業務ジャンル統一）
-- 既存 DB では business_category の CHECK を更新し、旧値を新値へ移行します。

-- 1) 制約を緩めてデータ移行
alter table public.business_listings
  drop constraint if exists business_listings_business_category_check;

update public.business_listings set business_category = 'transport' where business_category = 'taxi';
update public.business_listings set business_category = 'construction_work' where business_category = 'construction';
update public.business_listings set business_category = 'repair_maintenance' where business_category = 'repair';
update public.business_listings set business_category = 'local_support' where business_category = 'local_service';
update public.business_listings set business_category = 'store_field_service' where business_category = 'store';

-- 2) 新しい業務ジャンル制約
alter table public.business_listings
  add constraint business_listings_business_category_check check (
    business_category in (
      'transport',
      'construction_work',
      'repair_maintenance',
      'cleaning',
      'store_field_service',
      'local_support'
    )
  );

-- 3) サブカテゴリ（任意・将来拡張）
alter table public.business_listings
  add column if not exists business_subcategory text;

comment on column public.business_listings.business_category is '業務ジャンル（大カテゴリ）';
comment on column public.business_listings.business_subcategory is 'サブカテゴリ（例: airport_shuttle）';
comment on column public.business_listings.title is 'サービス名（掲載タイトル）';

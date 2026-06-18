-- 店舗・出張統合カテゴリを「店舗・販売」「業者サービス」に分離（表示名変更。内部カテゴリIDは field_service）
-- business_type: shop_store | field_service（form_data にも保存推奨）

alter table public.business_listings
  drop constraint if exists business_listings_business_category_check;

-- 掲載商品あり → 店舗・販売
update public.business_listings
set
  business_category = 'shop_store',
  form_data = coalesce(form_data, '{}'::jsonb) || jsonb_build_object('business_type', 'shop_store')
where business_category = 'store_field_service'
  and (
    jsonb_array_length(coalesce(form_data->'products', '[]'::jsonb)) > 0
    or jsonb_array_length(coalesce(products, '[]'::jsonb)) > 0
  );

-- 残り → 業者サービス（表示名変更。内部カテゴリIDは field_service）
update public.business_listings
set
  business_category = 'field_service',
  form_data = coalesce(form_data, '{}'::jsonb) || jsonb_build_object('business_type', 'field_service')
where business_category = 'store_field_service';

alter table public.business_listings
  add constraint business_listings_business_category_check check (
    business_category in (
      'transport',
      'construction_work',
      'repair_maintenance',
      'cleaning',
      'shop_store',
      'field_service',
      'local_support',
      'store_field_service'
    )
  );

comment on column public.business_listings.business_category is '業務ジャンル（大カテゴリ）。shop_store=店舗・販売, field_service=業者サービス';

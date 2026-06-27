-- Business Directory Phase 1 — seed (plan_features + categories)
-- Idempotent upserts · safe to re-run on staging

-- ---------------------------------------------------------------------------
-- plan_features (AD-013)
-- ---------------------------------------------------------------------------

insert into public.business_directory_plan_features (
  plan_code,
  display_name,
  max_photos,
  max_tlv_videos,
  max_social_links,
  allow_business_hours,
  allow_sns,
  allow_tlv,
  allow_contact_form,
  allow_analytics,
  allow_ai_recommend,
  search_boost_weight,
  allow_multi_listing,
  allow_connect_checkout
) values
  (
    'free', 'Free', 1, 0, 0,
    false, false, false, false, false, false, 0, false, false
  ),
  (
    'standard', 'Standard', 10, 0, 5,
    true, true, false, false, false, false, 0, false, false
  ),
  (
    'pro', 'Pro', 20, 3, 10,
    true, true, true, true, true, true, 10, false, false
  ),
  (
    'premium', 'Premium', 50, 10, 20,
    true, true, true, true, true, true, 20, true, true
  )
on conflict (plan_code) do update set
  display_name = excluded.display_name,
  max_photos = excluded.max_photos,
  max_tlv_videos = excluded.max_tlv_videos,
  max_social_links = excluded.max_social_links,
  allow_business_hours = excluded.allow_business_hours,
  allow_sns = excluded.allow_sns,
  allow_tlv = excluded.allow_tlv,
  allow_contact_form = excluded.allow_contact_form,
  allow_analytics = excluded.allow_analytics,
  allow_ai_recommend = excluded.allow_ai_recommend,
  search_boost_weight = excluded.search_boost_weight,
  allow_multi_listing = excluded.allow_multi_listing,
  allow_connect_checkout = excluded.allow_connect_checkout,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- categories (MVP starter set)
-- ---------------------------------------------------------------------------

insert into public.business_directory_categories (id, listing_type, code, name, sort_order, is_active)
values
  ('a1000001-0001-4000-8000-000000000001', 'shop_retail', 'shop_food', '飲食・食品', 10, true),
  ('a1000001-0001-4000-8000-000000000002', 'shop_retail', 'shop_retail_general', '小売・雑貨', 20, true),
  ('a1000001-0001-4000-8000-000000000003', 'shop_retail', 'shop_beauty', '美容・健康', 30, true),
  ('a1000001-0001-4000-8000-000000000004', 'shop_retail', 'shop_other', 'その他店舗', 90, true),
  ('b2000002-0002-4000-8000-000000000001', 'business_service', 'biz_construction', '建設・リフォーム', 10, true),
  ('b2000002-0002-4000-8000-000000000002', 'business_service', 'biz_cleaning', '清掃・メンテナンス', 20, true),
  ('b2000002-0002-4000-8000-000000000003', 'business_service', 'biz_it', 'IT・Web', 30, true),
  ('b2000002-0002-4000-8000-000000000004', 'business_service', 'biz_other', 'その他業務サービス', 90, true)
on conflict (code) do update set
  listing_type = excluded.listing_type,
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

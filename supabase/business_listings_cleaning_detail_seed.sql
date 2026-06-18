-- =============================================================================
-- 清掃・片付け詳細 — demo-biz-cleaning-1 シード
-- 対象URL: detail-business.html?id=demo-biz-cleaning-1
-- （修理詳細用カラムは business_listings_repair_detail_seed.sql を先に実行）
-- =============================================================================

do $$
declare
  v_demo_id text := 'demo-biz-cleaning-1';
  v_demo_user_id text := '00000000-0000-4000-b000-000000000001';
  v_company_id uuid;
  v_listing_id uuid;
  v_service_features jsonb := '[
    "即日相談可能",
    "見積無料",
    "女性スタッフ相談可",
    "法人清掃OK",
    "定期契約OK",
    "損害保険加入"
  ]'::jsonb;
  v_cleaning_services jsonb := '[
    {
      "title": "ハウスクリーニング",
      "icon": "✨",
      "items": ["キッチン", "浴室", "トイレ", "洗面所", "窓・サッシ"]
    },
    {
      "title": "片付け・回収",
      "icon": "📦",
      "items": ["不用品回収", "ゴミ片付け", "遺品整理", "引越し前後", "倉庫整理"]
    },
    {
      "title": "法人・店舗清掃",
      "icon": "🏢",
      "items": ["オフィス清掃", "店舗清掃", "空室清掃", "定期清掃", "床清掃"]
    }
  ]'::jsonb;
  v_service_menu_items jsonb := '[
    {"title": "エアコンクリーニング", "price": "9,800円〜", "description": "家庭用・店舗用対応"},
    {"title": "水回り清掃", "price": "15,000円〜", "description": "キッチン・浴室・トイレ対応"},
    {"title": "不用品回収", "price": "8,000円〜", "description": "少量回収・大型品対応"}
  ]'::jsonb;
  v_work_cases jsonb := '[
    {
      "title": "マンション水回り清掃（世田谷区）",
      "content": "キッチン・浴室・トイレのハウスクリーニング",
      "region": "世田谷区",
      "period": "2026年4月",
      "cost": "約18,000円",
      "note": "作業前後の説明が丁寧でした"
    },
    {
      "title": "オフィス定期清掃（渋谷区）",
      "content": "週1回の床清掃・ゴミ回収",
      "region": "渋谷区",
      "period": "2026年3月",
      "cost": "月額契約",
      "note": "法人向けプラン"
    }
  ]'::jsonb;
  v_category_extra jsonb := '{
    "cleaning": {
      "cleaning_types": "ハウスクリーニング、不用品回収、定期清掃",
      "spot_support": "yes",
      "regular_contract": "yes",
      "corporate_contract": "yes",
      "estimate_support": "yes",
      "insurance": "yes"
    }
  }'::jsonb;
  v_form_data jsonb;
begin
  select id into v_company_id
  from public.companies
  where name ilike '%TASFUL%' or name ilike '%ハウスケア%'
  order by created_at desc nulls last
  limit 1;

  v_form_data := jsonb_build_object(
    'demo_id', v_demo_id,
    'business_category', 'cleaning',
    'category_extra', v_category_extra,
    'cleaning_services', v_cleaning_services,
    'service_menu_items', v_service_menu_items,
    'work_cases', v_work_cases
  );

  select id into v_listing_id
  from public.business_listings
  where coalesce(form_data->>'demo_id', '') = v_demo_id
  limit 1;

  if v_listing_id is null then
    insert into public.business_listings (
      user_id,
      company_id,
      company_name,
      business_category,
      business_subcategory,
      title,
      description,
      phone,
      business_hours,
      service_area,
      status,
      status_label,
      license_info,
      service_tags,
      service_features,
      repair_services,
      work_cases,
      service_menu_items,
      option_items,
      price_guides,
      form_data,
      image_url,
      gallery_urls
    ) values (
      v_demo_user_id::uuid,
      v_company_id,
      'TASFULハウスケア',
      'cleaning',
      'cleaning',
      'ハウスクリーニング・片付け',
      'ご家庭のハウスクリーニング、不用品回収・ゴミ片付け、オフィス・店舗の定期清掃まで。丁寧な作業とわかりやすい料金案内で安心してご依頼いただけます。',
      '03-5555-0288',
      '9:00〜19:00（即日相談可）',
      '東京都、神奈川県',
      'available',
      '即日相談可能',
      '清掃作業・廃棄物処理（許可内容はお問い合わせください）',
      array['ハウスクリーニング','不用品回収','ゴミ片付け','定期清掃','法人対応','見積無料'],
      v_service_features,
      v_cleaning_services,
      v_work_cases,
      v_service_menu_items,
      '[]'::jsonb,
      '[]'::jsonb,
      v_form_data,
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=960&q=80',
      '["https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=640&q=80","https://images.unsplash.com/photo-1628177142898-93e36e4de11e?auto=format&fit=crop&w=640&q=80"]'::jsonb
    )
    returning id into v_listing_id;
    raise notice 'Inserted demo-biz-cleaning-1 id=%', v_listing_id;
  else
    update public.business_listings set
      business_category = 'cleaning',
      company_name = 'TASFULハウスケア',
      title = 'ハウスクリーニング・片付け',
      description = 'ご家庭のハウスクリーニング、不用品回収・ゴミ片付け、オフィス・店舗の定期清掃まで。丁寧な作業とわかりやすい料金案内で安心してご依頼いただけます。',
      status_label = '即日相談可能',
      service_tags = array['ハウスクリーニング','不用品回収','ゴミ片付け','定期清掃','法人対応','見積無料'],
      service_features = v_service_features,
      repair_services = v_cleaning_services,
      work_cases = v_work_cases,
      service_menu_items = v_service_menu_items,
      option_items = '[]'::jsonb,
      price_guides = '[]'::jsonb,
      form_data = v_form_data,
      updated_at = now()
    where id = v_listing_id;
    raise notice 'Updated demo-biz-cleaning-1 id=%', v_listing_id;
  end if;
end $$;

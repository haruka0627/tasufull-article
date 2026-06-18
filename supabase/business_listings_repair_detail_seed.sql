-- =============================================================================
-- 修理・メンテナンス詳細 — business_listings 列追加 + demo-biz-repair-1 シード
-- Supabase SQL Editor で一発実行（再実行しても安全）
--
-- 対象URL: detail-business.html?id=demo-biz-repair-1
-- form_data->>'demo_id' = 'demo-biz-repair-1' で掲載を特定します
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 修理詳細用カラム（既存列は add column if not exists のみ・上書きしない）
-- -----------------------------------------------------------------------------
alter table public.business_listings
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists service_tags text[],
  add column if not exists service_features jsonb not null default '[]'::jsonb,
  add column if not exists repair_services jsonb not null default '[]'::jsonb,
  add column if not exists repair_cases jsonb not null default '[]'::jsonb,
  add column if not exists work_cases jsonb not null default '[]'::jsonb,
  add column if not exists price_guides jsonb not null default '[]'::jsonb,
  add column if not exists option_items jsonb not null default '[]'::jsonb,
  add column if not exists service_menu_items jsonb not null default '[]'::jsonb,
  add column if not exists support_conditions text[],
  add column if not exists license_items jsonb not null default '[]'::jsonb,
  add column if not exists faq_items jsonb not null default '[]'::jsonb,
  add column if not exists main_price_label text,
  add column if not exists main_price_text text,
  add column if not exists emergency_label text,
  add column if not exists response_time text,
  add column if not exists target_users text,
  add column if not exists status_label text;

comment on column public.business_listings.service_tags is 'サービスタグ（表示用 pill）';
comment on column public.business_listings.service_features is 'この事業者の強み（jsonb 配列）';
comment on column public.business_listings.repair_services is '対応内容（水道/電気/エアコン等 jsonb）';
comment on column public.business_listings.repair_cases is '修理実績（jsonb 配列）';
comment on column public.business_listings.work_cases is '施工・修理実績（jsonb 配列。建設・修理共通）';
comment on column public.business_listings.price_guides is '料金目安カード（jsonb 配列・非推奨）';
comment on column public.business_listings.option_items is '対応オプションカード（title / description）';
comment on column public.business_listings.service_menu_items is '対応サービス（title / price / description）';
comment on column public.business_listings.support_conditions is 'サポート体制タグ';
comment on column public.business_listings.license_items is '許可・資格（jsonb 配列）';
comment on column public.business_listings.faq_items is 'FAQ（jsonb 配列）';
comment on column public.business_listings.main_price_label is '右CTA・料金ブロックのラベル';
comment on column public.business_listings.main_price_text is '料金目安テキスト';
comment on column public.business_listings.emergency_label is '緊急相談CTAラベル';
comment on column public.business_listings.response_time is '最短対応時間';
comment on column public.business_listings.target_users is '対応対象';
comment on column public.business_listings.status_label is '対応状況表示（ヒーロー受付）';

create index if not exists business_listings_form_data_demo_id_idx
  on public.business_listings ((form_data->>'demo_id'))
  where coalesce(form_data->>'demo_id', '') <> '';

-- -----------------------------------------------------------------------------
-- 2. 定数（シード用）
-- -----------------------------------------------------------------------------
do $$
declare
  v_demo_id text := 'demo-biz-repair-1';
  v_demo_user_id text := '00000000-0000-4000-b000-000000000001';
  v_company_id uuid;
  v_listing_id uuid;
  v_service_features jsonb := '[
    "最短30分対応",
    "出張修理対応",
    "法人契約OK",
    "深夜対応",
    "見積無料",
    "24時間受付"
  ]'::jsonb;
  v_repair_services jsonb := '[
    {
      "title": "水道のトラブル",
      "icon": "💧",
      "items": [
        "水漏れ",
        "蛇口の不具合",
        "トイレの詰まり",
        "排水管の詰まり",
        "給湯器・配管のトラブル",
        "蛇口交換・修理"
      ]
    },
    {
      "title": "電気のトラブル",
      "icon": "⚡",
      "items": [
        "ブレーカーが落ちる",
        "コンセント・スイッチ不良",
        "照明の不具合・交換",
        "漏電調査・修理",
        "配線の修理・交換"
      ]
    },
    {
      "title": "エアコンのトラブル",
      "icon": "❄️",
      "items": [
        "冷えない・効きが悪い",
        "水漏れ・異音",
        "エアコンクリーニング",
        "ガス補充",
        "エアコン交換"
      ]
    }
  ]'::jsonb;
  v_repair_cases jsonb := '[
    {
      "title": "オフィス水漏れ緊急対応（港区）",
      "period": "即日",
      "region": "港区",
      "cost": "約28,000円"
    },
    {
      "title": "店舗ブレーカー復旧（渋谷区）",
      "period": "当日",
      "region": "渋谷区",
      "cost": "約15,000円"
    },
    {
      "title": "エアコン異音点検（横浜市）",
      "period": "翌日",
      "region": "横浜市",
      "cost": "約12,000円"
    }
  ]'::jsonb;
  v_price_guides jsonb := '[]'::jsonb;
  v_option_items jsonb := '[
    {"title": "水漏れ修理", "description": "キッチン・洗面・トイレ対応"},
    {"title": "ブレーカー修理", "description": "漏電・停電・交換対応"},
    {"title": "エアコン洗浄", "description": "家庭用・店舗用対応"},
    {"title": "夜間対応", "description": "深夜・早朝も受付可能"},
    {"title": "法人定期点検", "description": "店舗・事務所対応"},
    {"title": "配管交換", "description": "老朽化設備対応"}
  ]'::jsonb;
  v_license_items jsonb := '[
    {"name": "第二種電気工事士"},
    {"name": "給水装置工事主任技術者"}
  ]'::jsonb;
  v_faq_items jsonb := '[
    {
      "q": "深夜対応できますか？",
      "a": "24時間受付しており、深夜・早朝の緊急出張にも対応しています。まずはお電話ください。"
    },
    {
      "q": "出張費はいくらですか？",
      "a": "出張費は3,000円〜が目安です。エリア・時間帯・作業内容により異なります。"
    },
    {
      "q": "見積だけでも可能ですか？",
      "a": "見積のみのご相談も可能です。作業前に料金のご説明を行います。"
    },
    {
      "q": "法人契約できますか？",
      "a": "法人・店舗向けの定期メンテナンス契約・緊急対応窓口のご相談に対応しています。"
    },
    {
      "q": "即日対応できますか？",
      "a": "最短30分〜即日の出張対応が可能なエリアがあります。お急ぎの場合は緊急相談をご利用ください。"
    }
  ]'::jsonb;
  v_category_extra jsonb := '{
    "repair": {
      "repair_types": "水道、電気、エアコン、設備",
      "visit_support": "yes",
      "same_day_support": "yes",
      "estimate_support": "yes",
      "warranty_support": "consult",
      "corporate_contract": "yes",
      "night_support": "yes",
      "support_24h": "yes"
    }
  }'::jsonb;
  v_form_data jsonb;
  v_gallery jsonb := '[
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1631545806609-49ef01e4e690?auto=format&fit=crop&w=640&q=80"
  ]'::jsonb;
  v_main_image text := 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=960&q=80';
begin
  -- companies: TASFUL設備メンテナンス
  select c.id
  into v_company_id
  from public.companies c
  where c.name = 'TASFUL設備メンテナンス'
  order by c.created_at
  limit 1;

  if v_company_id is null then
    insert into public.companies (name, owner_user_id)
    values ('TASFUL設備メンテナンス', v_demo_user_id::uuid)
    returning id into v_company_id;
    raise notice 'Created company: TASFUL設備メンテナンス (%)', v_company_id;
  end if;

  v_form_data := jsonb_build_object(
    'demo_id', v_demo_id,
    'budget', '出張費 3,000円〜 / 作業料 要見積',
    'unit_price', '出張費 3,000円〜 / 作業料 要見積',
    'period', '即日〜予約可',
    'category_label', '修理・メンテナンス',
    'business_subcategory', '水道・電気修理サービス',
    'category_extra', v_category_extra,
    'image_url', v_main_image,
    'thumbnail_url', v_main_image,
    'main_image_url', v_main_image,
    'gallery_urls', v_gallery,
    'images', v_gallery,
    'gallery_images', v_gallery
  );

  -- 既存掲載（demo_id 優先 → 会社名+カテゴリ）
  select bl.id
  into v_listing_id
  from public.business_listings bl
  where coalesce(bl.form_data->>'demo_id', '') = v_demo_id
  order by bl.updated_at desc nulls last
  limit 1;

  if v_listing_id is null then
    select bl.id
    into v_listing_id
    from public.business_listings bl
    where bl.company_name = 'TASFUL設備メンテナンス'
      and bl.business_category = 'repair_maintenance'
    order by bl.updated_at desc nulls last
    limit 1;
  end if;

  if v_listing_id is null then
    insert into public.business_listings (
      user_id,
      business_category,
      business_subcategory,
      company_name,
      company_id,
      title,
      description,
      phone,
      business_hours,
      service_area,
      achievements,
      status,
      license_info,
      pr_plan,
      featured_plan,
      invoice_support,
      publish_status,
      tags,
      budget_amount,
      contract_period,
      recruit_status,
      application_conditions,
      contact_method,
      category_extra,
      form_data,
      image_url,
      thumbnail_url,
      main_image_url,
      gallery_urls,
      images,
      gallery_images,
      service_tags,
      service_features,
      repair_services,
      repair_cases,
      work_cases,
      price_guides,
      option_items,
      service_menu_items,
      support_conditions,
      license_items,
      faq_items,
      main_price_label,
      main_price_text,
      emergency_label,
      response_time,
      target_users,
      status_label
    )
    values (
      v_demo_user_id,
      'repair_maintenance',
      '水道・電気修理サービス',
      'TASFUL設備メンテナンス',
      v_company_id,
      '水道・電気修理サービス 24時間対応 緊急修理・出張メンテナンス',
      '水漏れ・詰まり・ブレーカー・エアコン不調など、出張で即日対応。法人店舗の定期点検・緊急修理にも対応します。24時間受付。法人のお客様は出張費無料のプランあり（要相談）。',
      '03-5555-0199',
      '24時間受付',
      '東京都、神奈川県、埼玉県',
      'オフィス水漏れ緊急対応（港区） — 即日 — 約28,000円 — 港区' || E'\n' ||
      '店舗ブレーカー復旧（渋谷区） — 当日 — 約15,000円 — 渋谷区' || E'\n' ||
      'エアコン異音点検（横浜市） — 翌日 — 約12,000円 — 横浜市',
      'available',
      '第二種電気工事士・給水装置工事主任技術者',
      'apply',
      'none',
      'yes',
      'public',
      '24時間対応,出張修理,見積無料,法人対応,緊急対応,即日対応',
      '出張費 3,000円〜 / 作業料 要見積',
      '即日〜予約可',
      '即日対応可能',
      '["24時間対応","出張修理","見積無料","法人対応","緊急対応","即日対応"]'::jsonb,
      'サイト内チャット',
      v_category_extra,
      v_form_data,
      v_main_image,
      v_main_image,
      v_main_image,
      v_gallery,
      v_gallery,
      v_gallery,
      array['24時間対応','出張修理','見積無料','法人対応','緊急対応','即日対応']::text[],
      v_service_features,
      v_repair_services,
      v_repair_cases,
      v_repair_cases,
      v_price_guides,
      v_option_items,
      v_service_menu_items,
      array['24時間受付','法人向け定期メンテナンス','折返し連絡']::text[],
      v_license_items,
      v_faq_items,
      'お問い合わせ',
      '出張費 3,000円〜 / 作業料 要見積',
      '緊急相談（24時間受付）',
      '30分〜（エリアにより異なります）',
      '法人・個人',
      '即日対応可能'
    )
    returning id into v_listing_id;

    raise notice 'Inserted business_listings demo-biz-repair-1 id=%', v_listing_id;
  else
    update public.business_listings bl
    set
      user_id = v_demo_user_id,
      business_category = 'repair_maintenance',
      business_subcategory = '水道・電気修理サービス',
      company_name = 'TASFUL設備メンテナンス',
      company_id = v_company_id,
      title = '水道・電気修理サービス 24時間対応 緊急修理・出張メンテナンス',
      description = '水漏れ・詰まり・ブレーカー・エアコン不調など、出張で即日対応。法人店舗の定期点検・緊急修理にも対応します。24時間受付。法人のお客様は出張費無料のプランあり（要相談）。',
      phone = '03-5555-0199',
      business_hours = '24時間受付',
      service_area = '東京都、神奈川県、埼玉県',
      achievements =
        'オフィス水漏れ緊急対応（港区） — 即日 — 約28,000円 — 港区' || E'\n' ||
        '店舗ブレーカー復旧（渋谷区） — 当日 — 約15,000円 — 渋谷区' || E'\n' ||
        'エアコン異音点検（横浜市） — 翌日 — 約12,000円 — 横浜市',
      status = 'available',
      license_info = '第二種電気工事士・給水装置工事主任技術者',
      pr_plan = coalesce(bl.pr_plan, 'apply'),
      invoice_support = coalesce(bl.invoice_support, 'yes'),
      publish_status = 'public',
      tags = '24時間対応,出張修理,見積無料,法人対応,緊急対応,即日対応',
      budget_amount = '出張費 3,000円〜 / 作業料 要見積',
      contract_period = '即日〜予約可',
      recruit_status = '即日対応可能',
      application_conditions = '["24時間対応","出張修理","見積無料","法人対応","緊急対応","即日対応"]'::jsonb,
      contact_method = coalesce(bl.contact_method, 'サイト内チャット'),
      category_extra = v_category_extra,
      form_data = coalesce(bl.form_data, '{}'::jsonb) || v_form_data,
      image_url = v_main_image,
      thumbnail_url = v_main_image,
      main_image_url = v_main_image,
      gallery_urls = v_gallery,
      images = v_gallery,
      gallery_images = v_gallery,
      service_tags = array['24時間対応','出張修理','見積無料','法人対応','緊急対応','即日対応']::text[],
      service_features = v_service_features,
      repair_services = v_repair_services,
      repair_cases = v_repair_cases,
      work_cases = v_repair_cases,
      price_guides = v_price_guides,
      option_items = v_option_items,
      service_menu_items = v_service_menu_items,
      support_conditions = array['24時間受付','法人向け定期メンテナンス','折返し連絡']::text[],
      license_items = v_license_items,
      faq_items = v_faq_items,
      main_price_label = 'お問い合わせ',
      main_price_text = '出張費 3,000円〜 / 作業料 要見積',
      emergency_label = '緊急相談（24時間受付）',
      response_time = '30分〜（エリアにより異なります）',
      target_users = '法人・個人',
      status_label = '即日対応可能',
      updated_at = now()
    where bl.id = v_listing_id;

    raise notice 'Updated business_listings demo-biz-repair-1 id=%', v_listing_id;
  end if;

  -- form_data に demo_id を必ず付与
  update public.business_listings
  set
    form_data = coalesce(form_data, '{}'::jsonb) || jsonb_build_object('demo_id', v_demo_id),
    company_id = v_company_id
  where id = v_listing_id;

  -- -----------------------------------------------------------------------------
  -- 3. company_reviews（TASFUL設備メンテナンス）
  -- -----------------------------------------------------------------------------
  if exists (
    select 1
    from public.company_reviews cr
    where cr.company_id = v_company_id
      and cr.comment like '深夜の水漏れで即日対応いただきました%'
    limit 1
  ) then
    raise notice 'company_reviews seed skipped: repair demo reviews already exist';
  else
    insert into public.company_reviews (
      company_id,
      user_id,
      reviewer_name,
      rating,
      title,
      comment,
      service_type,
      listing_id,
      is_verified,
      is_visible,
      created_at
    )
    values
      (
        v_company_id,
        v_demo_user_id::uuid,
        '利用者A',
        5,
        '水漏れ / 深夜対応',
        '深夜の水漏れで即日対応いただきました。説明も丁寧で安心できました。',
        '水漏れ,深夜対応',
        v_listing_id,
        false,
        true,
        '2026-04-10 10:00:00+09'::timestamptz
      ),
      (
        v_company_id,
        v_demo_user_id::uuid,
        '利用者B',
        5,
        'ブレーカー / 法人',
        'オフィスのブレーカー不具合を短時間で復旧。法人向けの対応もスムーズでした。',
        '出張修理,法人対応',
        v_listing_id,
        true,
        true,
        '2026-03-28 10:00:00+09'::timestamptz
      ),
      (
        v_company_id,
        v_demo_user_id::uuid,
        '利用者C',
        4,
        'エアコン / 点検',
        'エアコンの異音対応。見積の説明が明確で、作業も丁寧でした。',
        'エアコン,見積無料',
        v_listing_id,
        false,
        true,
        '2026-03-05 10:00:00+09'::timestamptz
      ),
      (
        v_company_id,
        v_demo_user_id::uuid,
        '利用者D',
        5,
        '見積相談 / 即日',
        '見積だけの相談でも快く対応。急ぎの修理も翌日に入れてもらえ助かりました。',
        '見積無料,即日対応',
        v_listing_id,
        false,
        true,
        '2026-02-18 10:00:00+09'::timestamptz
      );

    raise notice 'Inserted 4 company_reviews for company_id=%', v_company_id;
  end if;

  perform public.refresh_company_review_stats(v_company_id);

  raise notice 'Repair detail seed complete. listing_id=% company_id=% demo_id=%',
    v_listing_id, v_company_id, v_demo_id;
exception
  when undefined_function then
    raise notice 'refresh_company_review_stats not found — run company_reviews.sql first, then re-run this file.';
  when others then
    raise notice 'Repair seed partial/failed: %', sqlerrm;
    raise;
end;
$$;

-- 確認用（任意）
-- select id, company_name, business_category, business_subcategory, title, status_label, main_price_text
-- from public.business_listings
-- where coalesce(form_data->>'demo_id', '') = 'demo-biz-repair-1';

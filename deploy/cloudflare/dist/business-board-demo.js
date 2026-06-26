/**
 * 法人・業者ボード UI確認用デモ掲載（business.html のみ）
 * 本番DB・一般ページには影響しません。
 */
(function () {
  "use strict";

  const DEMO_ENABLED = true;

  function shouldUseDemo(realCount) {
    const search = window.location?.search || "";
    if (/(?:^|[?&])demo=1(?:&|$)/.test(search)) return true;
    return Number(realCount) === 0;
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  function logoUrl(companyName) {
    const name = encodeURIComponent(String(companyName || "企").slice(0, 12));
    return `https://ui-avatars.com/api/?name=${name}&background=fff9eb&color=967622&size=96&bold=true&format=svg`;
  }

  function rawRow(spec) {
    const imageUrl = spec.image_url || logoUrl(spec.company_name);
    const galleryUrls = Array.isArray(spec.gallery_urls) ? spec.gallery_urls : [];
    return {
      id: spec.id,
      user_id: "demo_user",
      business_category: spec.business_category,
      business_subcategory: spec.business_subcategory || null,
      company_name: spec.company_name,
      title: spec.title,
      description: spec.description || `${spec.title}（UI確認用デモデータ）`,
      phone: spec.phone || "03-0000-0000",
      phone_public: spec.phone_public,
      contact_phone_public: spec.contact_phone_public,
      phone_option_active: spec.phone_option_active,
      phone_option_enabled: spec.phone_option_enabled,
      business_hours: spec.business_hours || null,
      service_area: spec.service_area,
      status: spec.status || "available",
      license_info: spec.license_info || null,
      pr_plan: spec.pr_plan || "none",
      featured_plan: spec.featured_plan || "none",
      publish_status: "public",
      tags: (spec.tags || []).join(","),
      image_url: imageUrl,
      thumbnail_url: spec.thumbnail_url || imageUrl,
      gallery_urls: galleryUrls,
      created_at: spec.created_at || daysAgo(spec.daysAgo ?? 3),
      updated_at: spec.updated_at || daysAgo(spec.daysAgo ?? 1),
      achievements: spec.achievements || "",
      category_extra: spec.category_extra || null,
      form_data: {
        demo_id: spec.demo_id || spec.id,
        budget: spec.budget,
        unit_price: spec.budget,
        period: spec.period,
        headcount: spec.headcount,
        image_url: imageUrl,
        gallery_urls: galleryUrls,
        business_hours: spec.business_hours || "",
        phone: spec.phone || "03-0000-0000",
        phone_public: spec.phone_public,
        contact_phone_public: spec.contact_phone_public,
        phone_option_active: spec.phone_option_active,
        category_label: spec.category_label || "",
        business_subcategory: spec.business_subcategory || "",
        same_day: spec.same_day,
        hours_24: spec.hours_24,
        insurance: spec.insurance,
        invoice: spec.invoice,
        achievements: spec.achievements || "",
        category_extra: spec.category_extra || null,
        service_menu_items: spec.service_menu_items || null,
        work_cases: spec.work_cases || null,
        products: spec.products || null,
        shop_news: spec.shop_news || null,
        cleaning_services: spec.cleaning_services || spec.repair_services || null,
        repair_services: spec.repair_services || spec.cleaning_services || null,
      },
      service_menu_items: spec.service_menu_items || null,
      products: spec.products || null,
      shop_news: spec.shop_news || null,
      work_cases: spec.work_cases || null,
      service_tags: spec.service_tags || null,
      status_label: spec.status_label || null,
      cleaning_services: spec.cleaning_services || spec.repair_services || null,
      repair_services: spec.repair_services || spec.cleaning_services || null,
      _source: "demo",
    };
  }

  /** 庭・草刈り系デモ — 詳細ページ「サービスメニュー」用 */
  const GARDEN_SERVICE_MENU = [
    {
      title: "草刈り",
      description: "一戸建て・空き家・アパート共用部・店舗まわり",
      scope: "一般家庭・空き地対応",
      price: "8,000円〜",
    },
    {
      title: "除草",
      description: "一戸建て・空き家・アパート共用部・店舗まわり",
      scope: "除草剤不使用プランあり",
      price: "10,000円〜",
    },
    {
      title: "庭木剪定",
      description: "一戸建て・空き家・アパート共用部",
      scope: "低木・高木対応",
      price: "15,000円〜",
    },
    {
      title: "低木伐採相談",
      description: "一戸建て・空き家・店舗まわり",
      scope: "安全作業・処分込み相談可",
      price: "見積相談",
    },
    {
      title: "空き家の庭管理",
      description: "空き家・相続物件・定期管理",
      scope: "月次・季節プランあり",
      price: "月額相談",
    },
  ];

  const DEMO_RAW = [
    {
      id: "demo-biz-pr-1",
      demo_id: "demo-business-construction",
      company_name: "TASFUL建設パートナー",
      title: "大型商業施設 内装施工・改修",
      description:
        "店舗・オフィスの内装一式。下地から仕上げまで対応。協力会社との連携施工も可能です。",
      business_category: "construction_work",
      business_type: "field_service",
      service_area: "東京都、神奈川県、埼玉県",
      budget: "¥1,200,000〜",
      period: "長期契約可",
      license_info: "建設業許可・施工管理技士在籍",
      headcount: "複数チーム対応可",
      status: "available",
      pr_plan: "apply",
      featured_plan: "apply",
      tags: ["受付中", "即日対応", "協力会社対応", "常用対応"],
      achievements:
        "オフィス内装工事（渋谷区）— 工期：2週間 — 費用：約380万円\nカフェ改装工事（横浜市）— 工期：3週間 — 費用：約520万円\n店舗原状回復（港区）— 工期：5日 — 費用：約95万円",
      daysAgo: 1,
      category_extra: {
        construction: {
          work_types: "内装工事、原状回復、解体、電気、設備",
          construction_license: "取得済み",
          insurance: "workers_comp_and_liability",
          night_support: "yes",
          emergency_support: "yes",
          team_capacity: "35名体制",
          partner_registration: "登録済み",
        },
      },
    },
    {
      id: "demo-biz-pr-2",
      demo_id: "demo-business-delivery",
      company_name: "TASFUL空港送迎サービス",
      title: "空港送迎・法人送迎・予約配車",
      description:
        "成田・羽田空港から都内・近郊まで。法人定期送迎・イベント送迎にも対応。事前予約でスムーズに手配します。",
      business_category: "transport",
      business_type: "field_service",
      business_subcategory: "airport_shuttle",
      category_label: "送迎・運搬 / 空港送迎",
      service_area: "東京都、千葉県、埼玉県",
      budget: "成田空港片道 22,000円〜",
      period: "即日〜予約可",
      license_info: "旅客運送許可・保険加入済",
      headcount: "1〜7名（車両により相談可）",
      status: "available",
      pr_plan: "apply",
      tags: ["空港送迎", "24時間対応", "法人契約"],
      image_url:
        "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=960&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b8?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1556388156-38ed1903742b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=640&q=80",
      ],
      business_hours: "24時間対応",
      phone: "090-1234-5678",
      achievements:
        "成田空港→都内23区 — 料金：22,000円〜\n羽田空港→千葉 — 料金：18,000円〜\n都内ホテル送迎 — 料金：要相談",
      taxi_service_type: "空港送迎、法人送迎、予約送迎、イベント送迎",
      taxi_vehicle_type: "普通車、ワゴン、ハイヤー",
      taxi_area_type: "成田空港、羽田空港、東京23区、千葉県",
      taxi_airport_transfer: "yes",
      taxi_24h_available: "yes",
      taxi_reservation_available: "yes",
      taxi_corporate_contract: "yes",
      taxi_invoice_available: "yes",
      taxi_payment_methods: ["現金", "クレジットカード", "請求書"],
      taxi_base_fare: "成田空港片道 22,000円〜 / 初乗り500円〜",
      taxi_night_fare: "深夜割増あり / 夜間送迎 25,000円〜",
      taxi_route_price:
        "成田空港→都内 22,000円〜\n羽田→千葉 18,000円〜\n都内ホテル送迎 要相談",
      taxi_capacity: "1〜4名 / 5〜7名（ワゴン）",
      taxi_language_support: "日本語 / 英語相談可",
      taxi_child_seat: "consult",
      taxi_booking_types: ["即時配車", "空港送迎", "法人定期契約"],
      category_extra: {
        taxi: {
          booking_types: ["即時配車", "空港送迎", "法人定期契約"],
          taxi_services: "空港送迎、法人送迎、予約送迎、イベント送迎",
          vehicle_types: "普通車、ワゴン、ハイヤー",
          taxi_area_type: "成田空港、羽田空港、東京23区、千葉県",
          airport_transfer: "yes",
          support_24h: "yes",
          reservation_support: "yes",
          corporate_contract: "yes",
          invoice_support_extra: "yes",
          taxi_base_fare: "成田空港片道 22,000円〜 / 初乗り500円〜",
          taxi_night_fare: "深夜割増あり / 夜間送迎 25,000円〜",
          taxi_route_price:
            "成田空港→都内 22,000円〜\n羽田→千葉 18,000円〜",
          taxi_capacity: "1〜4名 / 5〜7名（ワゴン）",
          taxi_language_support: "日本語 / 英語相談可",
          child_seat: "consult",
          taxi_payment_methods: ["現金", "クレジットカード", "請求書"],
        },
      },
      daysAgo: 2,
    },
    {
      id: "demo-biz-01",
      demo_id: "demo-business-cleaning",
      company_name: "クリーンサポート東京",
      title: "夜間清掃・定期メンテナンス",
      description:
        "オフィス・店舗の夜間清掃。床・ガラス・トイレまで一括。定期契約・スポット対応。",
      business_category: "cleaning",
      business_type: "field_service",
      service_area: "東京都23区",
      budget: "月額 ¥80,000〜",
      period: "6ヶ月〜",
      license_info: "—",
      headcount: "複数名手配可",
      tags: ["受付中", "即日対応"],
      daysAgo: 4,
    },
    {
      id: "demo-biz-02",
      company_name: "ムービークリエイト合同会社",
      title: "動画編集・プロモーション制作",
      description:
        "企業PR・商品紹介動画の企画〜編集。SNS向けショート動画にも対応。",
      business_category: "local_support",
      category_label: "クリエイティブ",
      service_area: "全国対応",
      budget: "1本 ¥30,000〜",
      period: "都度・継続可",
      tags: ["受付中", "インボイス対応"],
      invoice: true,
      daysAgo: 5,
    },
    {
      id: "demo-biz-03",
      company_name: "ソーシャルブースト",
      title: "SNS運用代行",
      description:
        "Instagram・X の投稿代行・分析レポート。店舗集客向けプランあり。",
      business_category: "local_support",
      service_area: "大阪府",
      budget: "月額 ¥80,000〜",
      period: "3ヶ月契約",
      tags: ["受付中", "即日対応"],
      same_day: true,
      status: "available",
      daysAgo: 3,
    },
    {
      id: "demo-biz-04",
      company_name: "イベントワークス",
      title: "イベント設営・撤去",
      description:
        "会場設営・音響・照明の手配。展示会・セミナー向けの一式対応。",
      business_category: "local_support",
      service_area: "神奈川県",
      budget: "¥120,000〜/回",
      period: "都度",
      headcount: "現場人数は要相談",
      tags: ["受付中"],
      daysAgo: 6,
    },
    {
      id: "demo-biz-repair-1",
      demo_id: "demo-business-repair",
      company_name: "TASFUL設備メンテナンス",
      title: "水道・電気・エアコン出張修理",
      description:
        "水漏れ・詰まり・ブレーカー・エアコン不調など、出張で即日対応。法人店舗の定期点検・緊急修理にも対応します。",
      business_category: "repair_maintenance",
      business_type: "field_service",
      business_subcategory: "plumbing",
      service_area: "東京都、神奈川県、埼玉県",
      budget: "出張費 3,000円〜 / 作業料 要見積",
      period: "即日〜予約可",
      license_info: "第二種電気工事士・給水装置工事業",
      business_hours: "24時間受付",
      phone: "03-5555-0199",
      phone_public: true,
      contact_phone_public: true,
      phone_option_active: true,
      status: "available",
      pr_plan: "apply",
      tags: ["24時間対応", "出張修理", "見積無料", "即日対応"],
      image_url:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=960&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1631545806609-49ef01e4e690?auto=format&fit=crop&w=640&q=80",
      ],
      achievements:
        "オフィス水漏れ緊急対応（港区）— 即日 — 約28,000円\n店舗ブレーカー復旧（渋谷区）— 当日 — 約15,000円\nエアコン異音点検（横浜市）— 翌日 — 約12,000円",
      category_extra: {
        repair: {
          repair_types: "水道、電気、エアコン、設備",
          visit_support: "yes",
          same_day_support: "yes",
          estimate_support: "yes",
          warranty_support: "consult",
          corporate_contract: "yes",
          night_support: "yes",
        },
      },
      daysAgo: 3,
    },
    {
      id: "demo-biz-cleaning-1",
      company_name: "TASFULハウスケア",
      pr_plan: "apply",
      title: "ハウスクリーニング・片付け",
      description:
        "ご家庭のハウスクリーニング、不用品回収・ゴミ片付け、オフィス・店舗の定期清掃まで。丁寧な作業とわかりやすい料金案内で安心してご依頼いただけます。",
      business_category: "cleaning",
      business_subcategory: "cleaning",
      service_area: "東京都、神奈川県",
      budget: "",
      period: "即日〜予約可",
      license_info: "清掃作業・廃棄物処理（許可内容はお問い合わせください）",
      business_hours: "9:00〜19:00（即日相談可）",
      phone: "03-5555-0288",
      status: "available",
      status_label: "即日相談可能",
      tags: [
        "ハウスクリーニング",
        "不用品回収",
        "ゴミ片付け",
        "定期清掃",
        "法人対応",
        "見積無料",
      ],
      service_tags: [
        "ハウスクリーニング",
        "不用品回収",
        "ゴミ片付け",
        "定期清掃",
        "法人対応",
        "見積無料",
      ],
      service_menu_items: [
        {
          title: "エアコンクリーニング",
          price: "9,800円〜",
          description: "家庭用・店舗用対応",
        },
        {
          title: "水回り清掃",
          price: "15,000円〜",
          description: "キッチン・浴室・トイレ対応",
        },
        {
          title: "不用品回収",
          price: "8,000円〜",
          description: "少量回収・大型品対応",
        },
      ],
      work_cases: [
        {
          title: "マンション水回り清掃（世田谷区）",
          content: "キッチン・浴室・トイレのハウスクリーニング",
          region: "世田谷区",
          period: "2026年4月",
          cost: "約18,000円",
          note: "作業前後の説明が丁寧でした",
        },
        {
          title: "オフィス定期清掃（渋谷区）",
          content: "週1回の床清掃・ゴミ回収",
          region: "渋谷区",
          period: "2026年3月",
          cost: "月額契約",
          note: "法人向けプラン",
        },
      ],
      image_url:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=960&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1628177142898-93e36e4de11e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=640&q=80",
      ],
      category_extra: {
        cleaning: {
          cleaning_types: "ハウスクリーニング、不用品回収、定期清掃",
          spot_support: "yes",
          regular_contract: "yes",
          corporate_contract: "yes",
          estimate_support: "yes",
          insurance: "yes",
        },
      },
      daysAgo: 2,
    },
    {
      id: "demo-biz-roof-saitama",
      demo_id: "demo-biz-roof-saitama",
      company_name: "埼玉屋根工房",
      title: "屋根修理・防水・雨漏り対応",
      description:
        "戸建・マンションの屋根点検、瓦・スレート補修、防水シート施工、雨漏り応急処置まで対応。埼玉県内は出張見積無料。",
      business_category: "repair_maintenance",
      business_subcategory: "roof",
      business_type: "field_service",
      category_label: "修繕・メンテナンス / 屋根",
      service_area: "埼玉県全域",
      budget: "¥120,000〜",
      period: "即日〜予約可",
      license_info: "屋根工事・防水施工（詳細はお問い合わせください）",
      business_hours: "8:00〜19:00",
      phone: "048-555-0101",
      phone_public: true,
      contact_phone_public: true,
      phone_option_active: true,
      status: "available",
      status_label: "受付中",
      rating_average: 4.7,
      boardTrustShort: "★4.7 / 実績86件",
      tags: ["屋根修理", "防水", "雨漏り", "見積無料", "埼玉対応"],
      service_tags: ["屋根修理", "防水", "雨漏り", "見積無料", "埼玉対応"],
      category_extra: {
        repair: {
          repair_types: "屋根、防水、雨漏り、瓦補修",
          visit_support: "yes",
          same_day_support: "yes",
          estimate_support: "yes",
        },
      },
      daysAgo: 0,
    },
    {
      id: "demo-biz-tasful-garden-1",
      demo_id: "demo-biz-tasful-garden",
      company_name: "TASFUL庭まわりサポート",
      pr_plan: "apply",
      featured_plan: "apply",
      title: "草刈り・庭木剪定・除草・庭管理",
      description:
        "草刈り、除草、庭木剪定、伐採相談、空き家の庭管理まで対応。造園・外構のご相談も承ります。東京都・埼玉県・千葉県・神奈川県エリア。料金は見積相談。",
      business_category: "cleaning",
      business_subcategory: "lawn_care",
      business_type: "field_service",
      category_label: "清掃・片付け / 草刈り",
      service_area: "東京都、埼玉県、千葉県、神奈川県",
      budget: "見積相談",
      period: "即日〜予約可",
      license_info: "造園・外構・草刈作業（詳細はお問い合わせください）",
      business_hours: "8:00〜18:00",
      phone: "03-5555-0501",
      status: "available",
      status_label: "受付中",
      rating_average: 4.8,
      boardTrustShort: "★4.8 / 実績120件",
      tags: [
        "草刈り",
        "除草",
        "庭木",
        "剪定",
        "伐採",
        "庭管理",
        "外構",
        "造園",
        "空き家",
        "見積無料",
      ],
      service_tags: [
        "草刈り",
        "除草",
        "庭木",
        "剪定",
        "伐採",
        "庭管理",
        "外構",
        "造園",
        "空き家",
        "見積無料",
      ],
      service_menu_items: GARDEN_SERVICE_MENU,
      category_extra: {
        cleaning: {
          cleaning_types: "草刈り、除草、庭木剪定、伐採、庭管理、外構、造園",
          spot_support: "yes",
          regular_contract: "yes",
          estimate_support: "yes",
        },
      },
      daysAgo: 0,
    },
    {
      id: "demo-biz-lawn-1",
      company_name: "グリーンケア庭園",
      pr_plan: "apply",
      title: "草刈り・除草・芝生メンテナンス",
      description:
        "一般家庭の草刈り・除草、芝生の刈り込み、空き地の整備まで対応。剪定や庭木手入れもご相談ください。見積無料で即日対応エリアあり。",
      business_category: "cleaning",
      business_subcategory: "lawn_care",
      service_area: "東京都、神奈川県、埼玉県南部",
      budget: "8,000円〜",
      period: "即日〜予約可",
      license_info: "造園・外構作業（詳細はお問い合わせください）",
      business_hours: "8:00〜18:00",
      phone: "03-5555-0412",
      status: "available",
      status_label: "受付中",
      rating_average: 4.6,
      boardTrustShort: "★4.6 / 実績54件",
      tags: ["草刈り", "除草", "芝生", "庭管理", "即日対応", "見積無料"],
      service_tags: ["草刈り", "除草", "芝生", "庭管理", "即日対応", "見積無料"],
      service_menu_items: GARDEN_SERVICE_MENU,
      category_extra: {
        cleaning: {
          cleaning_types: "草刈り、除草、芝生メンテナンス、庭管理",
          spot_support: "yes",
          regular_contract: "yes",
          estimate_support: "yes",
        },
      },
      daysAgo: 1,
    },
    {
      id: "demo-biz-lawn-2",
      company_name: "みどり剪定工房",
      pr_plan: "standard",
      title: "庭木剪定・伐採・植栽",
      description:
        "庭木の剪定、枝切り、伐採、植栽・植え替えを専門に対応。高所作業や隣家配慮が必要な案件もご相談ください。",
      business_category: "cleaning",
      business_subcategory: "lawn_care",
      service_area: "東京都、千葉県西北部",
      budget: "12,000円〜",
      period: "予約制（急ぎ相談可）",
      business_hours: "9:00〜17:30",
      phone: "03-5555-0418",
      status: "available",
      status_label: "受付中",
      tags: ["剪定", "庭木", "伐採", "植栽", "枝切り", "造園"],
      service_tags: ["剪定", "庭木", "伐採", "植栽", "枝切り", "造園"],
      service_menu_items: GARDEN_SERVICE_MENU,
      category_extra: {
        cleaning: {
          cleaning_types: "庭木剪定、伐採、植栽、枝切り",
          estimate_support: "yes",
        },
      },
      daysAgo: 4,
    },
    {
      id: "demo-biz-lawn-3",
      company_name: "おうち庭サポート",
      pr_plan: "apply",
      title: "庭の手入れ・草刈り・剪定まるごと",
      description:
        "草刈り、除草、剪定、落ち葉片付けまで庭まるごとの手入れをサポート。シニア世帯の定期管理プランもご用意しています。",
      business_category: "cleaning",
      business_subcategory: "lawn_care",
      service_area: "神奈川県、東京都多摩地域",
      budget: "7,500円〜",
      period: "週次・月次プランあり",
      business_hours: "9:00〜18:00",
      phone: "044-555-0192",
      status: "available",
      status_label: "受付中",
      tags: ["草刈り", "除草", "剪定", "庭管理", "定期契約", "落ち葉"],
      service_tags: ["草刈り", "除草", "剪定", "庭管理", "定期契約", "落ち葉"],
      service_menu_items: GARDEN_SERVICE_MENU,
      category_extra: {
        cleaning: {
          cleaning_types: "草刈り、除草、剪定、庭管理、落ち葉片付け",
          regular_contract: "yes",
          estimate_support: "yes",
        },
      },
      daysAgo: 2,
    },
    {
      id: "business-demo-other-001",
      demo_id: "business-demo-other-001",
      company_name: "地域サポート・相談デスク",
      title: "地域サポート・各種相談サービス",
      description:
        "地域活動支援、各種手続きサポート、イベント運営補助など幅広い相談に対応するサンプル掲載です。",
      business_category: "other_business",
      business_type: "field_service",
      category_label: "その他",
      service_area: "千葉県成田市周辺",
      budget: "要相談",
      period: "ご相談ください",
      status: "available",
      status_label: "相談受付中",
      tags: ["その他", "地域サポート", "相談サービス", "TASFUL"],
      service_tags: ["チャット相談", "電話相談", "オンライン相談"],
      image_url:
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=960&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=640&q=80",
      ],
      category_extra: {
        field_service: {
          work_content: "地域活動支援、手続きサポート、イベント運営補助",
          service_description:
            "地域活動支援、各種手続きサポート、イベント運営補助など幅広い相談に対応するサンプル掲載です。",
          price_guide: "要相談",
          visit_area: "千葉県成田市周辺",
          consultation_methods: "チャット相談、電話相談、オンライン相談",
          show_ai_consult: "yes",
          show_inquiry: "yes",
          show_estimate: "yes",
          show_phone: "yes",
        },
      },
      daysAgo: 2,
    },
    {
      id: "demo-biz-05",
      company_name: "電設工業",
      title: "電気工事・メンテナンス",
      description:
        "店舗・事務所の電気設備工事。分電盤更新・コンセント増設など。",
      business_category: "repair_maintenance",
      service_area: "千葉県",
      budget: "¥450,000〜",
      period: "2ヶ月",
      license_info: "第二種電気工事士",
      tags: ["許可確認済み", "保険加入"],
      insurance: true,
      daysAgo: 7,
    },
    {
      id: "demo-biz-06",
      demo_id: "demo-business-life-support",
      company_name: "ラインサポート",
      title: "軽作業・倉庫内サポート",
      description:
        "ピッキング・梱包・検品の代行。繁忙期の増員にも対応。",
      business_category: "local_support",
      business_type: "field_service",
      service_area: "埼玉県",
      budget: "見積無料",
      period: "1ヶ月〜",
      headcount: "15名規模まで",
      tags: ["受付中", "ご依頼対応"],
      daysAgo: 8,
    },
    {
      id: "demo-biz-07",
      company_name: "内装解体サービス",
      title: "内装解体・原状回復",
      description:
        "テナント内装解体から廃棄物処理まで。飲食店・小売店の実績多数。",
      business_category: "construction_work",
      service_area: "東京都",
      budget: "¥600,000〜",
      period: "2週間〜",
      license_info: "解体関連許可",
      tags: ["受付中", "協力会社対応"],
      daysAgo: 9,
    },
    {
      id: "demo-biz-08",
      demo_id: "demo-field-service",
      company_name: "セールスパートナーズ",
      title: "営業代行・テレアポ",
      description:
        "BtoBの新規開拓・リスト架電。成果報酬プランあり。",
      business_category: "field_service",
      business_type: "field_service",
      business_subcategory: "mobile_therapy",
      service_area: "全国",
      payment_method_type: "mixed",
      payment_url: "https://example.com/pay/sales-partners",
      bank_name: "三菱UFJ銀行",
      bank_branch: "渋谷支店",
      bank_account_type: "普通",
      bank_account_number: "1234567",
      bank_account_holder: "カ）セールスパートナーズ",
      payment_note: "PayPay（@sales-partners）・請求書払い（法人のみ）",
      platform_fee_rate: 0.05,
      budget: "成果報酬・月額",
      period: "継続",
      category_extra: {
        field_service: {
          work_content: "営業代行・テレアポ・リスト架電",
          service_description:
            "BtoBの新規開拓・リスト架電を出張・リモートで支援。成果報酬プランあり。",
          price_guide: "成果報酬・月額",
          visit_area: "全国（オンライン可）",
          service_hours: "平日 9:00〜18:00",
          estimate_support: "free",
          same_day_support: "yes",
          show_ai_consult: "yes",
          show_estimate: "yes",
          show_inquiry: "yes",
          show_phone: "yes",
        },
      },
      service_menu_items: [
        {
          title: "テレアポ代行（半日）",
          price: "¥50,000〜",
          description: "リスト架電・ヒアリング・報告",
          duration: "4時間",
          location: "リモート / 出張",
        },
        {
          title: "新規開拓営業（1日）",
          price: "¥80,000〜",
          description: "訪問・商談同席・フォロー",
          duration: "8時間",
          location: "首都圏出張",
        },
      ],
      work_cases: [
        {
          title: "SaaS新規開拓（IT業）",
          content: "リスト500件から商談化",
          period: "2週間",
          price: "成果報酬",
          region: "東京都",
        },
        {
          title: "製造業テレアポ",
          content: "アポ獲得・日程調整",
          period: "1週間",
          price: "¥120,000",
          region: "大阪府",
        },
      ],
      tags: ["受付中", "許可確認済み"],
      daysAgo: 10,
    },
    {
      id: "demo-biz-09",
      company_name: "WebCraft合同会社",
      title: "Web制作・保守運用",
      description:
        "コーポレートサイト・LP制作。更新・保守の月額プランも提供。",
      business_category: "local_support",
      category_label: "Web制作",
      service_area: "リモート",
      budget: "¥200,000〜/件",
      period: "都度",
      tags: ["受付中", "インボイス対応"],
      invoice: true,
      daysAgo: 11,
    },
    {
      id: "demo-biz-10",
      company_name: "ロジスティクスONE",
      title: "倉庫仕分け・梱包代行",
      description:
        "EC向け出荷作業・梱包ラインの代行。24時間稼働ラインあり。",
      business_category: "local_support",
      service_area: "茨城県",
      budget: "見積無料",
      period: "3ヶ月",
      headcount: "8名体制",
      tags: ["受付中", "24時間対応"],
      hours_24: true,
      daysAgo: 12,
    },
  ];

  function normalizeDemoRows() {
    const store = window.TasuBusinessListings;
    return DEMO_RAW.map((spec) => {
      const row = rawRow(spec);
      if (store?.rowToListing) {
        return store.rowToListing(row);
      }
      if (window.TasuListingRenderer?.normalizeBusinessRow) {
        return window.TasuListingRenderer.normalizeBusinessRow(row);
      }
      return row;
    }).filter(Boolean);
  }

  let cached = null;

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function orderDemoList(items) {
    const spotlight = items.filter((item) => item.isPr || item.isFeatured || item.isFeaturedSlot);
    const regular = items.filter((item) => !item.isPr && !item.isFeatured && !item.isFeaturedSlot);
    shuffleInPlace(regular);
    return [...spotlight, ...regular];
  }

  function getListings(businessCategory) {
    if (!DEMO_ENABLED) return [];
    if (!cached) cached = normalizeDemoRows();
    const cat = String(businessCategory || "").trim();
    const cats = window.TasuBusinessCategories;

    let list = cached.filter((item) => !cats?.isShopStoreListing?.(item));
    if (cat === "field_service" || cat === "shop_store") {
      list = cats?.filterListingsForBoard
        ? cats.filterListingsForBoard(list, cat)
        : cat === "shop_store"
          ? list.filter((item) => cats?.isShopStoreListing?.(item))
          : list.filter((item) => !cats?.isShopStoreListing?.(item));
    } else if (cats?.categoryMatches) {
      list = list.filter((item) => cats.categoryMatches(item.business_category, cat));
    } else if (cat) {
      list = list.filter((item) => item.business_category === cat);
    }
    return orderDemoList(list);
  }

  window.TasuBusinessBoardDemo = {
    DEMO_ENABLED,
    shouldUseDemo,
    getListings,
    resetCache() {
      cached = null;
    },
  };
})();

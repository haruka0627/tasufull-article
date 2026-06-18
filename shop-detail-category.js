/**
 * 店舗詳細（detail-shop.html）— カテゴリ別表示設定
 * HTMLは1枚のまま、ラベル・セクション・CTAのみ切り替え
 */
(function () {
  "use strict";

  const BASE_VISIBLE = {
    overview: false,
    handling: false,
    products: true,
    cases: false,
    highlights: true,
    info: true,
    reviews: true,
    faq: true,
  };

  const SHOP_OTHER_DEMO_IDS = new Set([
    "shop-store-demo-other-001",
    "shop-store-demo-other-002",
    "shop-store-demo-other-003",
  ]);

  /** タブ＋CTA一体型追従バー（detail-shop.html） */
  /** 標準店舗詳細（ヒーロー＋タブ追従バー） */
  const SHOP_STORE_STICKY_NAV_CATEGORY_KEYS = new Set([
    "restaurant",
    "retail",
    "vintage_brand",
    "goods_interior",
    "food_retail",
    "hobby_anime",
    "pet",
    "tools_equipment",
    "other",
  ]);

  const SHOP_STORE_BUYBACK_CTA_CATEGORY_KEYS = new Set([
    "vintage_brand",
    "hobby_anime",
    "tools_equipment",
  ]);

  /** スマホで買取系ブロック（買取対応 / 出張 / 法人 / 査定）を出すカテゴリ */
  const SHOP_BUYBACK_MOBILE_CATEGORY_KEYS = SHOP_STORE_BUYBACK_CTA_CATEGORY_KEYS;

  /** スマホ共通：ヒーロー＋アクセス＋口コミ中心（PC用hero右カラム・FAQは出さない） */
  const SHOP_MOBILE_COMMON_VISIBLE = {
    products: true,
    cases: false,
    highlights: false,
    info: true,
    reviews: true,
    faq: false,
  };

  const SHOP_MOBILE_BUYBACK_VISIBLE = {
    products: true,
    cases: true,
    highlights: true,
    info: true,
    reviews: true,
    faq: false,
  };

  /** PC追従バー：表示中セクションをタブ化（スマホ mobileVisibleSections とは別） */
  const SHOP_PC_NAV_SECTIONS_RETAIL = {
    overview: false,
    handling: false,
    products: true,
    cases: true,
    highlights: true,
    info: true,
    reviews: true,
    faq: false,
  };

  function buildNavSectionsFromVisible(visible = {}) {
    return {
      overview: visible.overview === true,
      handling: visible.handling === true,
      products: visible.products !== false,
      cases: visible.cases !== false,
      highlights: visible.highlights !== false,
      info: visible.info !== false,
      reviews: visible.reviews !== false,
      faq: visible.faq !== false,
    };
  }

  /** 雑貨・インテリア（retail-top-fv）と同一レイアウト土台にする店舗・販売カテゴリ */
  const SHOP_GOODS_INTERIOR_LAYOUT_KEYS = SHOP_STORE_STICKY_NAV_CATEGORY_KEYS;

  /** @type {Record<string, object>} */
  const SHOP_CATEGORY_CONFIG = {
    default: {
      profileKey: "default",
      categoryLabel: "その他",
      mainSectionTitle: "掲載商品・サービス",
      itemLabel: "商品",
      caseLabel: "事例・ギャラリー",
      highlightsTitle: "店舗の特徴",
      galleryLabel: "写真",
      priceLabel: "料金目安",
      infoTitle: "店舗情報",
      reviewsTitle: "口コミ・評価",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "問い合わせる",
      ctaSecondaryText: "見積もり相談",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入りに追加",
      visibleSections: { ...BASE_VISIBLE },
      stickyNav: {
        products: "商品",
        highlights: "特徴",
        bottom: "店舗情報",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    restaurant: {
      profileKey: "restaurant",
      categoryLabel: "飲食・カフェ",
      mainSectionTitle: "おすすめメニュー",
      itemLabel: "メニュー",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "料金目安",
      infoTitle: "店舗情報",
      reviewsTitle: "口コミ・評価",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "メニューを見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      points: [
        "自家焙煎のこだわりコーヒー",
        "手作りスイーツが人気",
        "落ち着いたおしゃれな空間",
        "おひとり様でも入りやすい",
      ],
      highlightRows: ["hours", "seats", "access", "parking"],
      stickyNav: {
        products: "メニュー",
        cases: "店内・雰囲気",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    beauty_salon: {
      profileKey: "beauty_salon",
      mainSectionTitle: "施術メニュー",
      itemLabel: "メニュー",
      caseLabel: "スタイル",
      highlightsTitle: "スタイリスト",
      galleryLabel: "写真",
      priceLabel: "料金目安",
      infoTitle: "店舗情報",
      reviewsTitle: "口コミ・評価",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "予約する",
      ctaSecondaryText: "相談する",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "chat.html",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      highlightRows: ["hours", "access"],
      stickyNav: {
        products: "メニュー",
        highlights: "スタイリスト",
        cases: "スタイル",
        bottom: "サロン情報",
        reviews: "口コミ",
      },
    },
    relaxation: {
      profileKey: "relaxation",
      categoryLabel: "リラクゼーション・マッサージ",
      mainSectionTitle: "おすすめメニュー",
      itemLabel: "メニュー",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "セラピスト",
      galleryLabel: "写真",
      priceLabel: "料金目安",
      infoTitle: "サロン情報・アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "予約する",
      ctaSecondaryText: "相談する",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "chat.html",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: false,
      },
      highlightRows: ["hours", "access"],
      stickyNav: {
        products: "メニュー",
        highlights: "セラピスト",
        cases: "店内・雰囲気",
        reviews: "口コミ",
        bottom: "サロン情報",
      },
    },
    repair_maintenance: {
      profileKey: "repair_maintenance",
      mainSectionTitle: "対応サービス",
      itemLabel: "サービス",
      caseLabel: "修理事例",
      highlightsTitle: "対応エリア・営業情報",
      galleryLabel: "作業写真",
      priceLabel: "料金目安",
      infoTitle: "店舗情報",
      reviewsTitle: "口コミ・評価",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "相談する",
      ctaSecondaryText: "見積もりする",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "chat.html",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      highlightRows: ["area", "hours", "access"],
      stickyNav: {
        products: "サービス",
        cases: "事例",
        highlights: "対応エリア",
        bottom: "店舗情報",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    retail: {
      profileKey: "retail",
      categoryLabel: "小売・物販",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      points: [
        "国内外から厳選した雑貨をセレクト",
        "ギフトラッピング対応",
        "季節商品が定期的に入荷",
        "スタッフ提案あり",
        "オンラインショップ対応",
      ],
      stickyNav: {
        products: "商品",
        cases: "店内・雰囲気",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    vintage_brand: {
      profileKey: "vintage_brand",
      categoryLabel: "古着・ブランド",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "ブランド・古着",
      highlightsTitle: "買取案内",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "査定・商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      stickyNav: {
        products: "商品",
        cases: "ブランド・古着",
        highlights: "買取案内",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    goods_interior: {
      profileKey: "goods_interior",
      categoryLabel: "雑貨・インテリア",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      points: [
        "暮らしに馴染むセレクト雑貨",
        "ギフトラッピング対応",
        "季節に合わせた新商品入荷",
        "スタッフが丁寧にご提案",
        "オンラインショップ対応",
      ],
      facilityTags: [
        "ギフト対応",
        "電子マネーOK",
        "クレカOK",
        "駐車場あり",
        "オンラインショップあり",
        "ラッピング対応",
      ],
      stickyNav: {
        products: "商品",
        cases: "店内・雰囲気",
        highlights: "ギフト対応",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    food_retail: {
      profileKey: "retail",
      categoryLabel: "食品販売",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      stickyNav: {
        products: "商品",
        cases: "店内・雰囲気",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    hobby_anime: {
      profileKey: "retail",
      categoryLabel: "ホビー・アニメ・トレカ",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "買取・査定",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "査定・商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      stickyNav: {
        products: "商品",
        cases: "買取・査定",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    tools_equipment: {
      profileKey: "retail",
      categoryLabel: "工具・機材・買取",
      mainSectionTitle: "商品一覧",
      itemLabel: "商品",
      caseLabel: "買取対応",
      highlightsTitle: "買取サービス",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "査定・商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      mobileBuybackBlocks: true,
      mobileVisibleSections: { ...SHOP_MOBILE_BUYBACK_VISIBLE },
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      stickyNav: {
        products: "商品",
        cases: "買取・査定",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
      mobileStickyNav: {
        products: "商品一覧",
        cases: "買取対応",
        buyback_visit: "出張買取",
        buyback_corp: "法人対応",
        buyback_appraisal: "査定案内",
        bottom: "アクセス",
        reviews: "口コミ",
      },
      mobileStickyAnchors: {
        buyback_visit: "#shop-sp-buyback-visit",
        buyback_corp: "#shop-sp-buyback-corp",
        buyback_appraisal: "#shop-sp-buyback-appraisal",
      },
    },
    other: {
      profileKey: "goods_interior",
      categoryLabel: "その他",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        overview: false,
        handling: false,
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      points: [
        "地域のセレクト商品を紹介",
        "ハンドメイド・限定品に対応",
        "在庫・取扱はお問い合わせください",
        "ギフト相談も歓迎",
        "スタッフが丁寧にご案内",
      ],
      facilityTags: [
        "ハンドメイド",
        "地域商品",
        "限定品",
        "問い合わせ販売",
        "TASFUL",
      ],
      stickyNav: {
        products: "商品",
        cases: "店内・雰囲気",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
      navSections: { ...SHOP_PC_NAV_SECTIONS_RETAIL },
    },
    pet: {
      profileKey: "retail",
      categoryLabel: "ペット用品",
      mainSectionTitle: "おすすめ商品",
      itemLabel: "商品",
      caseLabel: "店内・雰囲気",
      highlightsTitle: "お知らせ",
      galleryLabel: "写真",
      priceLabel: "価格帯",
      infoTitle: "アクセス",
      reviewsTitle: "口コミ",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "お問い合わせ",
      ctaSecondaryText: "商品を見る",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "#section-products",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      stickyNav: {
        products: "商品",
        cases: "店内・雰囲気",
        highlights: "お知らせ",
        bottom: "アクセス",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
    construction: {
      profileKey: "construction",
      mainSectionTitle: "対応工事",
      itemLabel: "工事内容",
      caseLabel: "施工事例",
      highlightsTitle: "見積・対応エリア",
      galleryLabel: "現場写真",
      priceLabel: "工事費目安",
      infoTitle: "店舗情報",
      reviewsTitle: "口コミ・評価",
      faqTitle: "よくある質問",
      ctaAiText: "AIに相談する",
      ctaPrimaryText: "見積もり相談する",
      ctaSecondaryText: "相談する",
      ctaPrimaryHref: "chat.html",
      ctaSecondaryHref: "chat.html",
      favoriteLabel: "お気に入り",
      visibleSections: {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: true,
      },
      highlightRows: ["area", "estimate", "hours"],
      stickyNav: {
        products: "対応工事",
        cases: "施工事例",
        highlights: "見積・エリア",
        bottom: "店舗情報",
        reviews: "口コミ",
        faq: "FAQ",
      },
    },
  };

  const CATEGORY_ALIASES = {
    restaurant: [
      "restaurant",
      "food",
      "cafe",
      "飲食",
      "カフェ",
      "レストラン",
      "飲食店",
    ],
    beauty_salon: ["beauty_salon", "beauty", "salon", "美容", "サロン", "エステ", "理美容"],
    relaxation: [
      "relaxation",
      "relax",
      "massage",
      "spa",
      "aroma",
      "リラク",
      "リラクゼーション",
      "マッサージ",
      "整体",
      "スパ",
      "アロマ",
      "もみほぐし",
    ],
    repair_maintenance: [
      "repair_maintenance",
      "repair",
      "maintenance",
      "修理",
      "メンテ",
      "設備",
      "repair_maintenance",
      "repair_maintenance",
    ],
    retail: [
      "retail",
      "store",
      "小売",
      "物販",
      "recycle",
      "showroom",
      "フラワー",
      "花屋",
    ],
    tools_equipment: [
      "tools_equipment",
      "tool_shop",
      "tools",
      "equipment",
      "工具",
      "機材",
      "電動工具",
      "diy",
      "buyback_shop",
    ],
    vintage_brand: [
      "vintage_brand",
      "vintage",
      "used_fashion",
      "fashion",
      "apparel",
      "古着",
      "ブランド",
      "セレクト",
      "アパレル",
      "洋服",
      "服",
    ],
    goods_interior: [
      "goods_interior",
      "interior",
      "雑貨",
      "インテリア",
      "ライフスタイル",
      "北欧",
      "花",
      "フラワー",
      "観葉",
      "ブーケ",
    ],
    other: ["other", "other_shop", "entertainment", "default"],
    food_retail: ["food_retail", "food_shop", "食品", "食料", "グルメ", "お取り寄せ", "スイーツ"],
    hobby_anime: ["hobby_anime", "hobby", "アニメ", "トレカ", "tcg", "フィギュア", "カードショップ"],
    pet: ["pet", "pet_shop", "ペット", "ペット用品", "ドッグ", "キャット"],
    construction: [
      "construction",
      "construction_work",
      "renovation",
      "reform",
      "建築",
      "リフォーム",
      "工事",
      "内装",
    ],
  };

  function normalizeToken(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function pickExtra(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const ce = fd.category_extra && typeof fd.category_extra === "object" ? fd.category_extra : {};
    return listing?.category_extra?.shop_store || ce.shop_store || ce || {};
  }

  const SHOP_STORE_CATEGORY_KEY_ALIASES = {
    used_fashion: "vintage_brand",
    fashion: "vintage_brand",
    vintage: "vintage_brand",
    apparel: "vintage_brand",
  };

  const STORE_CATEGORY_LABEL_TO_KEY = {
    "飲食": "restaurant",
    "飲食・カフェ": "restaurant",
    "小売・物販": "retail",
    "古着・ブランド": "vintage_brand",
    "雑貨・インテリア": "goods_interior",
    "食品販売": "food_retail",
    "ホビー・アニメ・トレカ": "hobby_anime",
    "ペット用品": "pet",
    "工具・機材・買取": "tools_equipment",
    "美容・サロン": "beauty_salon",
    "リラクゼーション・マッサージ": "relaxation",
    "その他": "other",
  };

  const PROFILE_KEY_TO_CATEGORY_LABEL = {
    restaurant: "飲食・カフェ",
    retail: "小売・物販",
    vintage_brand: "古着・ブランド",
    goods_interior: "雑貨・インテリア",
    food_retail: "食品販売",
    hobby_anime: "ホビー・アニメ・トレカ",
    pet: "ペット用品",
    tools_equipment: "工具・機材・買取",
    beauty_salon: "美容・サロン",
    relaxation: "リラクゼーション・マッサージ",
    repair_maintenance: "修理・メンテナンス",
    construction: "建設・工事",
    other: "その他",
  };

  function resolveExplicitCategoryLabel(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    return String(
      listing?.category || listing?.categoryLabel || fd.category || ""
    ).trim();
  }

  function isShopOtherDemoId(id) {
    return SHOP_OTHER_DEMO_IDS.has(String(id || "").trim());
  }

  /**
   * 「その他」専用 UI を出す条件（これ以外は既存カテゴリ表示のみ）
   * @param {object} listing
   * @param {{ demoOther?: boolean, id?: string }} [options]
   */
  function isShopOtherListing(listing, options = {}) {
    if (options?.demoOther === true || readShopDetailDemoOtherFlag()) return true;
    if (!listing || typeof listing !== "object") return false;
    const id = String(listing.id || listing.demo_id || options?.id || "").trim();
    if (isShopOtherDemoId(id)) return true;
    if (resolveExplicitCategoryLabel(listing) === "その他") return true;
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const shopStoreCat = normalizeToken(listing.shop_store_category || fd.shop_store_category || "");
    return shopStoreCat === "other";
  }

  function ensureListingCategoryField(listing) {
    if (!listing || typeof listing !== "object") return listing;
    if (resolveExplicitCategoryLabel(listing)) return listing;
    const extra = pickExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const profileKeys = [
      listing?.shop_store_category,
      listing?.shop_category,
      fd.shop_store_category,
      fd.shop_category,
      listing?.categoryProfile,
      fd.categoryProfile,
      extra.shop_category,
      listing?.store_category_key,
    ]
      .map(normalizeToken)
      .filter(Boolean);
    for (const profile of profileKeys) {
      const resolved = SHOP_STORE_CATEGORY_KEY_ALIASES[profile] || profile;
      const label = PROFILE_KEY_TO_CATEGORY_LABEL[resolved];
      if (label) {
        listing.category = label;
        listing.store_category_key = resolved;
        break;
      }
    }
    return listing;
  }

  /** 店舗・販売一覧のカテゴリ判定用テキスト（名称・説明・タグ含む） */
  function buildStoreCategoryText(listing) {
    const extra = pickExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const productText = (Array.isArray(listing?.products) ? listing.products : [])
      .map((p) => [p?.title, p?.category, p?.tag, p?.condition].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(" ");
    return [
      fd.shop_store_category,
      fd.shop_category,
      fd.categoryProfile,
      listing?.categoryProfile,
      extra.shop_category,
      extra.store_category,
      listing?.shop_category,
      listing?.shop_store_category,
      listing?.store_category,
      listing?.category,
      listing?.category_name,
      listing?.categoryLabel,
      listing?.business_subcategory,
      listing?.title,
      listing?.name,
      listing?.company_name,
      extra.shop_name,
      listing?.description,
      extra.store_type,
      extra.shop_description,
      ...(Array.isArray(listing?.tags) ? listing.tags : []),
      ...(Array.isArray(listing?.service_tags) ? listing.service_tags : []),
      productText,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function listingHaystack(listing) {
    return buildStoreCategoryText(listing);
  }

  function isVintageStoreText(text) {
    const s = String(text || "");
    if (!s) return false;
    if (/vintage_brand|used_fashion|古着・ブランド/i.test(s)) return true;
    if (/古着|ヴィンテージ|ビンテージ|used.?fashion|アパレル|洋服|ファッション|服屋|古着屋|ブランド古着|セレクト古着/i.test(s)) return true;
    if (/ブランド古着|ブランド品|ブランドセレクト|used\s*brand/i.test(s)) return true;
    if (/(?:^|[\s　、])ブランド(?:古着|品|セレクト|[\s　、]|$)/i.test(s)) return true;
    if (/(?:^|[\s　、])服(?:装|飾)?(?:[\s　、]|$)/i.test(s)) return true;
    return /(^|[\s　、])ブランド($|[\s　、])/i.test(s);
  }

  function isToolsStoreText(text) {
    const s = String(text || "");
    if (!s) return false;
    if (/工具|機材|中古工具|電動工具|建材|資材|インパクト|ノギス|reworks/i.test(s)) return true;
    if (/買取/.test(s) && !isVintageStoreText(s)) return true;
    return false;
  }

  function categoryKeyFromLabel(label) {
    const key = STORE_CATEGORY_LABEL_TO_KEY[String(label || "").trim()];
    return key || "retail";
  }

  function categoryLabelFromProfileKey(profileKey) {
    const token = normalizeToken(profileKey);
    const resolved = SHOP_STORE_CATEGORY_KEY_ALIASES[token] || token;
    return PROFILE_KEY_TO_CATEGORY_LABEL[resolved] || "";
  }

  function tokenMatchesAlias(token, alias) {
    const t = normalizeToken(token);
    const a = normalizeToken(alias);
    if (!t || !a) return false;
    if (t === a) return true;
    if (a.length < 4) return false;
    return t.includes(a);
  }

  function buildStoreCategoryMetaText(listing) {
    const extra = pickExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    return [
      fd.shop_store_category,
      fd.shop_category,
      fd.categoryProfile,
      listing?.categoryProfile,
      extra.shop_category,
      extra.store_category,
      listing?.shop_category,
      listing?.shop_store_category,
      listing?.store_category_key,
      listing?.business_subcategory,
      extra.store_type,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function resolveShopCategoryKey(listing) {
    if (!listing || typeof listing !== "object") return "retail";
    if (isShopOtherListing(listing)) return "other";
    ensureListingCategoryField(listing);
    const explicitCategory = resolveExplicitCategoryLabel(listing);
    if (explicitCategory) {
      const fromLabel = STORE_CATEGORY_LABEL_TO_KEY[explicitCategory];
      if (fromLabel) return fromLabel;
    }
    const extra = pickExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const explicitKeys = [
      fd.shop_store_category,
      fd.shop_category,
      fd.categoryProfile,
      listing?.categoryProfile,
      listing?.shop_store_category,
      listing?.store_category_key,
      extra.shop_category,
      listing?.shop_category,
    ]
      .map(normalizeToken)
      .filter(Boolean);
    for (const key of explicitKeys) {
      const resolved = SHOP_STORE_CATEGORY_KEY_ALIASES[key] || key;
      if (resolved === "other" && isShopOtherListing(listing)) return "other";
      if (SHOP_CATEGORY_CONFIG[resolved]?.categoryLabel) return resolved;
    }
    const metaText = buildStoreCategoryMetaText(listing);
    if (metaText) {
      const label = normalizeStoreCategory(metaText);
      return categoryKeyFromLabel(label);
    }
    return "retail";
  }

  /** 店舗・販売一覧用の表示ラベル（生テキストから推定） */
  function normalizeStoreCategory(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return "その他";
    if (/vintage_brand|used_fashion|古着・ブランド/i.test(s)) return "古着・ブランド";
    if (isVintageStoreText(s)) return "古着・ブランド";
    if (/food_retail|食品販売/i.test(s)) return "食品販売";
    if (/hobby_anime|ホビー・アニメ|トレカ|TCG|フィギュア|カードショップ/i.test(s)) return "ホビー・アニメ・トレカ";
    if (/pet|ペット用品|ペットショップ|ペットフード|犬猫|わんちゃん|にゃんこ/i.test(s)) return "ペット用品";
    if (/tools_equipment|工具・機材/i.test(s)) return "工具・機材・買取";
    if (/goods_interior|雑貨・インテリア/i.test(s)) return "雑貨・インテリア";
    if (/restaurant|飲食・カフェ/i.test(s)) return "飲食・カフェ";
    if (/飲食|カフェ|レストラン|喫茶/i.test(s)) return "飲食・カフェ";
    if (/ペット/i.test(s)) return "ペット用品";
    if (/雑貨|インテリア|ライフスタイル|北欧/i.test(s) && !/ペット/i.test(s)) return "雑貨・インテリア";
    if (/食品|食料|グルメ|お取り寄せ|スイーツ|菓子|惣菜|食材店|オーガニック食品/i.test(s)) return "食品販売";
    if (/ベーカリー|パン屋|焼き菓子|boulangerie/i.test(s)) return "食品販売";
    if (/ホビー|アニメ|トレカ|TCG|フィギュア|カードショップ|ゲームソフト/i.test(s)) return "ホビー・アニメ・トレカ";
    if (isToolsStoreText(s)) return "工具・機材・買取";
    if (/花|フラワー|観葉|ブーケ|植物|花屋/i.test(s)) return "雑貨・インテリア";
    if (/小売|物販|専門店/i.test(s)) return "小売・物販";
    return "小売・物販";
  }

  function getNormalizedStoreCategoryLabel(listing) {
    return normalizeStoreCategory(buildStoreCategoryText(listing));
  }

  function applyStoreCategoryToListing(listing) {
    if (!listing || typeof listing !== "object") return listing;
    ensureListingCategoryField(listing);
    const key = resolveShopCategoryKey(listing);
    const cfg = SHOP_CATEGORY_CONFIG[key];
    listing.store_category_key = key;
    listing.normalized_store_category =
      resolveExplicitCategoryLabel(listing) || cfg?.categoryLabel || key;
    return listing;
  }

  function getConfigForListing(listing, options = {}) {
    const isOther = isShopOtherListing(listing, options);
    const key = isOther ? "other" : resolveShopCategoryKey(listing);
    const base = SHOP_CATEGORY_CONFIG.default;
    const specific = SHOP_CATEGORY_CONFIG[key] || {};
    const stickyNav = { ...base.stickyNav, ...(specific.stickyNav || {}) };
    if (key === "relaxation") delete stickyNav.faq;
    const visibleSections = { ...base.visibleSections, ...(specific.visibleSections || {}) };
    let cfg = {
      categoryKey: key,
      ...base,
      ...specific,
      visibleSections,
      stickyNav,
      navSections: {
        ...buildNavSectionsFromVisible(visibleSections),
        ...(specific.navSections || {}),
      },
    };
    if (usesGoodsInteriorShopLayout(key) && !specific.navSections) {
      cfg.navSections = { ...SHOP_PC_NAV_SECTIONS_RETAIL, ...cfg.navSections };
    }
    if (
      isOther &&
      window.TasuDetailTypeConfig?.mergeShopCategoryDetailIntoConfig
    ) {
      cfg = window.TasuDetailTypeConfig.mergeShopCategoryDetailIntoConfig(cfg, listing);
    }

    if (isShopBuybackMobileCategory(key)) {
      cfg.mobileBuybackBlocks = cfg.mobileBuybackBlocks !== false;
      cfg.mobileVisibleSections = {
        ...SHOP_MOBILE_BUYBACK_VISIBLE,
        ...(cfg.mobileVisibleSections || {}),
      };
      if (!cfg.mobileStickyNav) {
        cfg.mobileStickyNav = {
          products: "商品一覧",
          cases: "買取対応",
          buyback_visit: "出張買取",
          buyback_corp: "法人対応",
          buyback_appraisal: "査定案内",
          bottom: cfg.infoTitle || "アクセス",
          reviews: "口コミ",
        };
        cfg.mobileStickyAnchors = {
          buyback_visit: "#shop-sp-buyback-visit",
          buyback_corp: "#shop-sp-buyback-corp",
          buyback_appraisal: "#shop-sp-buyback-appraisal",
        };
      }
    } else if (usesGoodsInteriorShopLayout(key)) {
      cfg.mobileVisibleSections = {
        ...SHOP_MOBILE_COMMON_VISIBLE,
        ...(cfg.mobileVisibleSections || {}),
      };
    } else {
      cfg.mobileVisibleSections = {
        products: true,
        cases: true,
        highlights: true,
        info: true,
        reviews: true,
        faq: false,
        ...(cfg.mobileVisibleSections || {}),
      };
    }

    return cfg;
  }

  function isShopBuybackMobileCategory(categoryKey) {
    return SHOP_BUYBACK_MOBILE_CATEGORY_KEYS.has(String(categoryKey || "").trim());
  }

  function usesNativeShopDetailMobile(categoryKey) {
    return Boolean(String(categoryKey || "").trim());
  }

  function getShopMobileVisibleSections(cfg) {
    const c = cfg || {};
    const key = String(c.categoryKey || "").trim();
    const base = isShopBuybackMobileCategory(key)
      ? SHOP_MOBILE_BUYBACK_VISIBLE
      : SHOP_MOBILE_COMMON_VISIBLE;
    return { ...base, ...(c.mobileVisibleSections || {}) };
  }

  /** PC追従バー用：DOMに実際に出ているセクションのみタブ化する際の許可リスト */
  function getShopPcNavSections(cfg) {
    const c = cfg || {};
    if (c.navSections && typeof c.navSections === "object") {
      return { ...c.navSections };
    }
    return buildNavSectionsFromVisible(c.visibleSections || {});
  }

  function getShopMobileStickyNav(cfg) {
    const c = cfg || {};
    const base = c.stickyNav || {};
    return { ...base, ...(c.mobileStickyNav || {}) };
  }

  function getShopMobileStickyAnchors(cfg) {
    return (cfg && cfg.mobileStickyAnchors) || {};
  }

  function setText(sel, text) {
    const el = document.querySelector(sel);
    if (!el || text == null || text === "") return;
    el.textContent = String(text);
  }

  function applySectionVisibility(cfg, listing) {
    const visible = cfg?.visibleSections || {};
    document.querySelectorAll("[data-shop-section]").forEach((el) => {
      const name = el.getAttribute("data-shop-section");
      if (!name) return;
      if ((name === "overview" || name === "handling") && visible[name] !== true) {
        el.hidden = true;
        el.setAttribute("hidden", "");
        el.classList.add("is-hidden", "shop-section--empty");
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = "";
      }
    });
  }

  function applyBindLabels(cfg) {
    document.querySelectorAll("[data-shop-bind]").forEach((el) => {
      const key = el.getAttribute("data-shop-bind");
      if (!key || cfg[key] == null) return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = String(cfg[key]);
      } else {
        el.textContent = String(cfg[key]);
      }
    });
  }

  function applyStickyNav(cfg) {
    const nav = cfg.stickyNav || {};
    document.querySelectorAll("[data-shop-sticky-nav]").forEach((a) => {
      const key = a.getAttribute("data-shop-sticky-nav");
      if (key && nav[key]) a.textContent = nav[key];
    });
  }

  function isShopStoreStickyNavCategory(categoryKey) {
    return SHOP_STORE_STICKY_NAV_CATEGORY_KEYS.has(String(categoryKey || "").trim());
  }

  function usesGoodsInteriorShopLayout(categoryKey) {
    return SHOP_GOODS_INTERIOR_LAYOUT_KEYS.has(String(categoryKey || "").trim());
  }

  function resolveShopDetailCssProfile(categoryKey, profileKey) {
    const key = String(categoryKey || "").trim();
    const pk = String(profileKey || "").trim();
    if (usesGoodsInteriorShopLayout(key)) return "goods_interior";
    if (key === "beauty_salon" || pk === "beauty_salon") return "beauty_salon";
    if (key === "relaxation" || pk === "relaxation") return "relaxation";
    return pk || key || "default";
  }

  /**
   * @param {string} categoryKey
   * @returns {{ tabs: Record<string, string>, cta: { ai: string, primary: string, secondary: string, primaryHref: string, secondaryHref: string } }}
   */
  function buildStickyActionNavConfig(categoryKey) {
    const key = String(categoryKey || "").trim() || "other";
    const base = SHOP_CATEGORY_CONFIG.default;
    const specific = SHOP_CATEGORY_CONFIG[key] || {};
    const cfg = {
      categoryKey: key,
      ...base,
      ...specific,
      stickyNav: { ...base.stickyNav, ...(specific.stickyNav || {}) },
    };
    const secondary =
      key === "restaurant"
        ? cfg.ctaSecondaryText || "メニューを見る"
        : SHOP_STORE_BUYBACK_CTA_CATEGORY_KEYS.has(key)
          ? cfg.ctaSecondaryText || "査定・商品を見る"
          : cfg.ctaSecondaryText || "商品を見る";
    return {
      tabs: { ...(cfg.stickyNav || {}) },
      cta: {
        ai: cfg.ctaAiText || "AIに相談する",
        primary: cfg.ctaPrimaryText || "お問い合わせ",
        secondary,
        primaryHref: cfg.ctaPrimaryHref || "chat.html",
        secondaryHref: cfg.ctaSecondaryHref || "#section-products",
      },
    };
  }

  /**
   * @param {object} listing
   * @returns {object} category config
   */
  function isShopOtherCategoryKey(categoryKey) {
    return String(categoryKey || "").trim() === "other";
  }

  function readShopDetailDemoOtherFlag() {
    try {
      return new URLSearchParams(window.location.search).get("demo") === "other";
    } catch {
      return false;
    }
  }

  function applyShopCategoryUi(listing, options = {}) {
    ensureListingCategoryField(listing);
    const uiOptions = {
      demoOther: options.demoOther === true || readShopDetailDemoOtherFlag(),
      id: options.id,
    };
    const cfg = getConfigForListing(listing, uiOptions);
    const categoryKey = String(cfg.categoryKey || "").trim();
    const profileKey = String(cfg.profileKey || "").trim();
    const cssProfile = resolveShopDetailCssProfile(categoryKey, profileKey);
    document.body.dataset.shopCategoryProfile = cssProfile;
    document.body.dataset.shopCategoryKey = categoryKey;
    document.body.dataset.shopLayout =
      usesGoodsInteriorShopLayout(categoryKey) ? "goods_interior" : "";

    applyBindLabels(cfg);
    if (!window.__TASU_SHOP_APPLY_SECTION_VISIBILITY__) {
      applySectionVisibility(cfg, listing);
      window.__TASU_SHOP_APPLY_SECTION_VISIBILITY__ = true;
    }
    applyStickyNav(cfg);

    setText("[data-shop-bind='priceLabel']", cfg.priceLabel);
    if (document.querySelector("[data-biz-detail-sidebar-price-label]")) {
      document.querySelector("[data-biz-detail-sidebar-price-label]").textContent = cfg.priceLabel;
    }

    return cfg;
  }

  window.TasuShopDetailCategory = {
    SHOP_CATEGORY_CONFIG,
    SHOP_STORE_STICKY_NAV_CATEGORY_KEYS,
    STORE_CATEGORY_LABEL_TO_KEY,
    resolveShopCategoryKey,
    getConfigForListing,
    applyShopCategoryUi,
    buildStoreCategoryText,
    normalizeStoreCategory,
    getNormalizedStoreCategoryLabel,
    applyStoreCategoryToListing,
    categoryKeyFromLabel,
    categoryLabelFromProfileKey,
    resolveExplicitCategoryLabel,
    ensureListingCategoryField,
    isShopOtherCategoryKey,
    isShopOtherListing,
    isShopOtherDemoId,
    readShopDetailDemoOtherFlag,
    SHOP_OTHER_DEMO_IDS,
    PROFILE_KEY_TO_CATEGORY_LABEL,
    isShopStoreStickyNavCategory,
    usesGoodsInteriorShopLayout,
    resolveShopDetailCssProfile,
    SHOP_GOODS_INTERIOR_LAYOUT_KEYS,
    buildStickyActionNavConfig,
    SHOP_BUYBACK_MOBILE_CATEGORY_KEYS,
    SHOP_MOBILE_COMMON_VISIBLE,
    SHOP_MOBILE_BUYBACK_VISIBLE,
    SHOP_PC_NAV_SECTIONS_RETAIL,
    isShopBuybackMobileCategory,
    usesNativeShopDetailMobile,
    getShopPcNavSections,
    getShopMobileVisibleSections,
    getShopMobileStickyNav,
    getShopMobileStickyAnchors,
  };
})();

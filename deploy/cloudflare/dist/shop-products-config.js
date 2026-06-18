/**
 * 店舗商品一覧（shop-products.html）— カテゴリ別フィルター・デモ商品・サービス案内
 */
(function () {
  "use strict";

  const U = (path, w) =>
    `https://images.unsplash.com/${path}?auto=format&fit=crop&w=${w || 640}&q=80`;

  const CATEGORY_FALLBACK_IMAGES = {
    restaurant: U("photo-1495474472287-4d71bcdd2085"),
    retail: U("photo-1523275335684-37898b6baf30"),
    vintage_brand: U("photo-1489987707025-afc232f7ea0f"),
    goods_interior: U("photo-1586023492125-27b2c045efd7"),
    food_retail: U("photo-1509440159596-0249088772ff"),
    hobby_anime: U("photo-1608889825103-eb5ed706fc64"),
    tools_equipment: U("photo-1504328345606-18bbc8c9d7d1"),
    pet: U("photo-1450778869180-41d0601e046e"),
    other: U("photo-1445205170230-053b83016050"),
  };

  const BRAND_PLACEHOLDER_SVG = (() => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">' +
      '<defs><linearGradient id="tg" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#f5e6a8"/><stop offset="100%" stop-color="#d4af37"/></linearGradient></defs>' +
      '<rect fill="#f8fafc" width="480" height="480"/>' +
      '<rect x="48" y="48" width="384" height="384" rx="28" fill="url(#tg)" opacity="0.22"/>' +
      '<text x="240" y="252" text-anchor="middle" font-family="system-ui,sans-serif" font-size="52" font-weight="900" fill="#9a7209">TASFUL</text>' +
      "</svg>";
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  })();

  const FILTER_CATEGORIES = {
    restaurant: ["すべて", "コーヒー", "ドリンク", "フード", "スイーツ", "焼き菓子", "ギフトセット"],
    retail: ["すべて", "新着", "人気", "セール", "ギフト", "雑貨", "生活雑貨"],
    vintage_brand: ["すべて", "アウター", "トップス", "パンツ", "バッグ", "スニーカー", "アクセサリー"],
    goods_interior: ["すべて", "アロマ", "マグカップ", "木製雑貨", "ドライフラワー", "キャンドル", "ギフト"],
    food_retail: ["すべて", "パン", "焼き菓子", "惣菜", "コーヒー", "ギフト"],
    hobby_anime: ["すべて", "トレカ", "フィギュア", "アニメグッズ", "ゲーム", "コレクション"],
    tools_equipment: ["すべて", "電動工具", "手工具", "建材", "資材", "中古工具", "買取対象"],
    pet: ["すべて", "フード", "おやつ", "おもちゃ", "ケア用品", "ペット服"],
    other: ["すべて", "新着", "人気", "ギフト", "雑貨"],
  };

  const COMMITMENT_OPTIONS = [
    { id: "recommended", label: "おすすめ" },
    { id: "new", label: "NEW" },
    { id: "sale", label: "SALE" },
    { id: "popular", label: "人気" },
    { id: "instock", label: "在庫あり" },
  ];

  const SCENE_OPTIONS = {
    restaurant: [
      { id: "breakfast", label: "朝食" },
      { id: "lunch", label: "ランチ" },
      { id: "cafe", label: "カフェタイム" },
      { id: "dinner", label: "ディナー" },
      { id: "gift", label: "ギフト" },
    ],
    default: [
      { id: "gift", label: "ギフト" },
      { id: "daily", label: "日常使い" },
      { id: "online", label: "オンライン" },
    ],
  };

  const PAGE_COPY = {
    restaurant: {
      title: "商品一覧",
      leadSuffix: "のメニューをご覧ください。",
    },
    default: {
      title: "商品一覧",
      leadSuffix: "の商品をご覧ください。",
    },
  };

  const SERVICE_PERKS = {
    restaurant: [
      { icon: "🥡", title: "テイクアウト対応", text: "事前予約でスムーズにお渡し" },
      { icon: "📅", title: "予約可能", text: "席のご予約・貸切のご相談も承ります" },
      { icon: "🎁", title: "ギフト対応", text: "焼き菓子の詰め合わせラッピング" },
      { icon: "💬", title: "お問い合わせ", text: "メニュー・食材についてお気軽に", ctaHref: "chat.html" },
    ],
    tools_equipment: [
      { icon: "🏪", title: "店頭受取対応", text: "大型商品も店頭でお渡し" },
      { icon: "💰", title: "買取相談可能", text: "中古工具・機材の査定受付" },
      { icon: "🏢", title: "法人対応", text: "現場納品・請求書払いのご相談" },
      { icon: "💬", title: "お問い合わせ", text: "在庫・仕様の確認はこちら", ctaHref: "chat.html" },
    ],
    vintage_brand: [
      { icon: "♻", title: "買取・下取り", text: "ブランド古着の査定受付中" },
      { icon: "✨", title: "状態グレード表示", text: "コンディションを明記して販売" },
      { icon: "🎁", title: "ギフト対応", text: "大切な方への贈り物にも" },
      { icon: "💬", title: "お問い合わせ", text: "サイズ・在庫の確認はこちら", ctaHref: "chat.html" },
    ],
    default: [
      { icon: "🚚", title: "全国配送対応", text: "¥5,000以上で送料無料（一部地域除く）" },
      { icon: "⚡", title: "最短当日発送", text: "14時までのご注文で当日発送" },
      { icon: "🎁", title: "ギフトラッピング", text: "メッセージカード・ラッピング対応" },
      { icon: "💬", title: "お問い合わせ", text: "商品・在庫についてお気軽に", ctaHref: "chat.html" },
    ],
  };

  const DEMO_REVIEWS = {
    restaurant: [
      {
        name: "ゆかりさん",
        rating: 5,
        date: "2024/09/12",
        text: "コーヒーが本当に美味しい！店内の雰囲気も落ち着いていて、つい長居してしまいます。",
      },
      {
        name: "S.K.",
        rating: 4,
        date: "2024/08/03",
        text: "ラテが安定して美味しいです。スタッフさんも丁寧でした。",
      },
    ],
    default: [
      {
        name: "T.K.",
        rating: 5,
        date: "2024/10/01",
        text: "商品の品質が良く、対応もスムーズでした。また利用したいです。",
      },
      {
        name: "M.Y.",
        rating: 4,
        date: "2024/09/15",
        text: "欲しかった商品が見つかり、安心して購入できました。",
      },
    ],
  };

  /** カテゴリ別デモ商品（店舗データが少ないときの補完） */
  const DEMO_PRODUCTS = {
    restaurant: [
      { title: "カフェラテ", description: "深煎りエスプレッソとスチームミルクの定番。", price: "¥580", category: "コーヒー", tag: "人気", img: U("photo-1461023058943-07fcbeecadfb") },
      { title: "ベイクドチーズケーキ", description: "濃厚でなめらかな自家製チーズケーキ。", price: "¥680", category: "スイーツ", tag: "NEW", img: U("photo-1567620905732-2d1ec7ab7440") },
      { title: "BLTサンドイッチ", description: "厚切りベーコンと新鮮野菜のサンド。", price: "¥850", category: "フード", tag: "SALE", priceWas: "¥950", img: U("photo-1528735602780-9032a96c5c46") },
      { title: "季節のパンケーキ", description: "旬のフルーツをのせたふわふわパンケーキ。", price: "¥1,280", category: "スイーツ", tag: "人気", img: U("photo-1565958011703-14f058adc6e0") },
      { title: "アイスカフェオレ", description: "暑い日にぴったりの冷たいカフェオレ。", price: "¥620", category: "ドリンク", img: U("photo-1514434755161-6e0f9d0e2f9e") },
      { title: "焼きたてスコーンセット", description: "ジャムとクロテッドクリーム付き。", price: "¥880", category: "焼き菓子", tag: "NEW", img: U("photo-1558961363-fa8a0d3800ce") },
      { title: "スペシャルティコーヒー", description: "シングルオリジンのハンドドリップ。", price: "¥650", category: "コーヒー", img: U("photo-1495474472287-4d71bcdd2085") },
      { title: "ギフトスイーツBOX", description: "焼き菓子詰め合わせ。贈り物に人気。", price: "¥3,200", category: "ギフトセット", tag: "人気", img: U("photo-1558961363-fa8fdf82db35") },
    ],
    goods_interior: [
      { title: "アロマキャンドル", description: "リネンの香り。約40時間燃焼。", price: "¥2,200", category: "アロマ", tag: "人気", img: U("photo-1519682337058-a94d519337bc") },
      { title: "北欧デザインマグカップ", description: "電子レンジ・食洗機対応。", price: "¥1,430", category: "マグカップ", img: U("photo-1511920170033-f8396924c348") },
      { title: "ウッドトレー", description: "天然木のトレー。S / Mサイズ。", price: "¥2,750", category: "木製雑貨", img: U("photo-1519710164239-da123dc03ef4") },
      { title: "ドライフラワーブーケ", description: "インテリアに映えるナチュラルブーケ。", price: "¥3,300", category: "ドライフラワー", tag: "NEW", img: U("photo-1526045478516-99145907023c") },
      { title: "リネンルームスプレー", description: "やさしい香りのルームフレグランス。", price: "¥1,980", category: "アロマ", img: U("photo-1586023492125-27b2c045efd7") },
      { title: "ギフトラッピングセット", description: "箱・リボン・メッセージカード付き。", price: "¥550", category: "ギフト", img: U("photo-1504328345606-18bbc8c9d7d1") },
    ],
    vintage_brand: [
      { title: "デニムジャケット", description: "90s リーバイス風。コンディション B。", price: "¥8,800", category: "アウター", tag: "人気", img: U("photo-1490481651871-ab68de25d43d") },
      { title: "レザーバッグ", description: "本革ショルダー。ブランドタグ付き。", price: "¥12,000", category: "バッグ", img: U("photo-1489987707024-afc025104726") },
      { title: "ヴィンテージTシャツ", description: "バンドT。ユニセックス。", price: "¥3,800", category: "トップス", tag: "NEW", img: U("photo-1556821840-3a63f95609a7") },
      { title: "スニーカー", description: "ナイキ エア系。サイズ27cm。", price: "¥9,800", category: "スニーカー", img: U("photo-1542291026-7eec264c27ff") },
      { title: "ウールコート", description: "冬物アウター。グレー Mサイズ。", price: "¥15,800", category: "アウター", tag: "SALE", priceWas: "¥18,800", img: U("photo-1469334031218-e155a4493b1c") },
      { title: "シルバーネックレス", description: "ヴィンテージアクセ。一点物。", price: "¥4,500", category: "アクセサリー", img: U("photo-1611591438847-7b2c2c0c0e0a") },
    ],
    hobby_anime: [
      { title: "トレカBOX（未開封）", description: "人気タイトル最新弾。", price: "¥5,500", category: "トレカ", tag: "NEW", img: U("photo-1612036782180-6f0b6cd3e2e4") },
      { title: "フィギュア A賞", description: "プライズフィギュア未開封。", price: "¥2,800", category: "フィギュア", tag: "人気", img: U("photo-1608889825103-eb5ed706fc64") },
      { title: "アニメグッズセット", description: "缶バッジ・ステッカーセット。", price: "¥1,200", category: "アニメグッズ", img: U("photo-1614680376573-df3480f0b6d4") },
      { title: "レトロゲームソフト", description: "動作確認済み。", price: "¥3,400", category: "ゲーム", img: U("photo-1550745165-9bc0b4eba2bc") },
      { title: "買取査定チケット", description: "持込査定のご予約券。", price: "¥0", category: "買取・査定", img: U("photo-1504328345606-18bbc8c9d7d1") },
    ],
    tools_equipment: [
      { title: "コードレスドリル", description: "18V 充電器・ケース付き。", price: "¥12,800", category: "電動工具", tag: "人気", img: U("photo-1504148455325-0df94f562ca1") },
      { title: "インパクトレンチ", description: "中古Aランク。動作確認済み。", price: "¥8,500", category: "電動工具", img: U("photo-1504328345606-18bbc8c9d7d1") },
      { title: "ノギス 150mm", description: "ステンレス製。", price: "¥2,400", category: "手工具", img: U("photo-1581092160562-40aa08e78837") },
      { title: "中古工具まとめ売り", description: "職人向けセット。", price: "¥15,000", category: "中古工具", tag: "SALE", priceWas: "¥18,000", img: U("photo-1504148455325-0df94f562ca1") },
    ],
    pet: [
      { title: "オーガニックキャットフード", description: "グレインフリー 2kg。", price: "¥4,200", category: "フード", tag: "人気", img: U("photo-1583511655857-d189b9a8b0e0") },
      { title: "デンタルおやつ", description: "犬用。20本入り。", price: "¥650", category: "おやつ", img: U("photo-1601758228041-f3b2795255f1") },
      { title: "ペット用おもちゃセット", description: "猫・小型犬向け。", price: "¥1,480", category: "おもちゃ", tag: "NEW", img: U("photo-1450778869180-41d0601e046e") },
    ],
    food_retail: [
      { title: "天然酵母カンパーニュ", description: "当日焼き。テイクアウト可。", price: "¥680", category: "パン", tag: "人気", img: U("photo-1586444246061-3e533e93be71") },
      { title: "クロワッサン", description: "バター香る定番。", price: "¥320", category: "焼き菓子", img: U("photo-1555507036-ab1f4038808a") },
      { title: "季節のタルト", description: "フルーツたっぷり。", price: "¥480", category: "焼き菓子", tag: "NEW", img: U("photo-1558961363-fa8fdf82db35") },
    ],
    retail: [
      { title: "セレクト雑貨セット", description: "暮らしを彩る小物セット。", price: "¥2,400", category: "雑貨", tag: "人気", img: U("photo-1445205170230-053b83016050") },
      { title: "ステンレスタンブラー", description: "保温・保冷対応。", price: "¥1,980", category: "生活雑貨", img: U("photo-1528697203043-733bfd65a4ec") },
    ],
    other: [
      { title: "おすすめ商品A", description: "店舗イチオシのアイテム。", price: "¥1,500", category: "雑貨", img: U("photo-1504328345606-18bbc8c9d7d1") },
    ],
  };

  function resolveCategoryKey(shop) {
    if (window.TasuShopDetailCategory?.resolveShopCategoryKey) {
      return window.TasuShopDetailCategory.resolveShopCategoryKey(shop);
    }
    return String(shop?.shop_store_category || shop?.shop_category || "other").trim() || "other";
  }

  function getFilterCategories(categoryKey) {
    return FILTER_CATEGORIES[categoryKey] || FILTER_CATEGORIES.retail || FILTER_CATEGORIES.other;
  }

  function getSceneOptions(categoryKey) {
    if (categoryKey === "restaurant") return SCENE_OPTIONS.restaurant;
    return SCENE_OPTIONS.default;
  }

  function getPageCopy(categoryKey) {
    if (categoryKey === "restaurant") return PAGE_COPY.restaurant;
    return PAGE_COPY.default;
  }

  function getServicePerks(categoryKey) {
    if (SERVICE_PERKS[categoryKey]) return SERVICE_PERKS[categoryKey];
    if (categoryKey === "vintage_brand" || categoryKey === "hobby_anime") {
      return SERVICE_PERKS.vintage_brand;
    }
    return SERVICE_PERKS.default;
  }

  function getDemoReviews(categoryKey) {
    if (DEMO_REVIEWS[categoryKey]) return DEMO_REVIEWS[categoryKey];
    return DEMO_REVIEWS.default;
  }

  /** 和食・居酒屋系デモ（喜一ダイニングなど） */
  const KICHI_DINING_PRODUCTS = [
    { title: "おまかせコース", description: "旬の魚介と京都野菜を使った8品の創作和食コース。", price: "¥4,800", category: "コース", tag: "人気", sceneTags: ["dinner", "lunch"], img: U("photo-1553621042-f6e147245684") },
    { title: "季節の刺身盛り", description: "その日仕入れた鮮魚を贅沢に盛り合わせ。", price: "¥2,200", category: "フード", tag: "人気", sceneTags: ["dinner", "lunch"], img: U("photo-1579584425555-c3ce17fd4351") },
    { title: "京都野菜の天ぷら", description: "サクサク衣の天ぷら盛り合わせ。お酒のお供に。", price: "¥1,400", category: "フード", sceneTags: ["dinner", "lunch"], img: U("photo-1563379926898-05f4575a4d88") },
    { title: "黒毛和牛の陶板焼き", description: "旨味たっぷりの陶板焼き。2人前から。", price: "¥3,600", category: "フード", tag: "NEW", sceneTags: ["dinner"], img: U("photo-1544025162-d76694265947") },
    { title: "お造り五種盛り", description: "職人がその日の旬で仕立てるお造り。", price: "¥2,800", category: "フード", tag: "人気", sceneTags: ["dinner"], img: U("photo-1579584425555-c3ce17fd4351") },
    { title: "地酒飲み比べセット", description: "京都の地酒3種を飲み比べ。", price: "¥1,800", category: "ドリンク", sceneTags: ["dinner", "cafe"], img: U("photo-1517248135467-4c7edcad34c4") },
    { title: "柚子シャーベット", description: "食後のさっぱりデザート。", price: "¥480", category: "スイーツ", sceneTags: ["dinner", "lunch"], img: U("photo-1558961363-fa8fdf82db35") },
    { title: "宴会コース（飲み放題付）", description: "法人宴会・歓送迎会に。要予約。", price: "¥6,500", category: "コース", tag: "SALE", priceWas: "¥7,200", sceneTags: ["dinner", "gift"], img: U("photo-1414235077428-338989a2e8c0") },
    { title: "お弁当・テイクアウト弁当", description: "事前予約でお持ち帰り可能。", price: "¥1,200", category: "フード", sceneTags: ["lunch", "gift"], img: U("photo-1528735602780-9032a96c5c46") },
    { title: "日本酒ボトル（ギフト）", description: "京都銘柄をギフト箱でお届け。", price: "¥4,500", category: "ギフトセット", tag: "人気", sceneTags: ["gift"], img: U("photo-1559339352-11d035aa65de") },
  ];

  const DEMO_BY_SHOP_ID = {
    "demo-shop-kiichi-dining": KICHI_DINING_PRODUCTS,
    "demo-shop-kichi-dining": KICHI_DINING_PRODUCTS,
  };

  function getDemoProducts(categoryKey, shopId) {
    const demoDelivery = window.TasuShopStoreDeliveryInfo?.DEFAULT_DEMO_DELIVERY || {};
    const withDelivery = (p) => ({ ...demoDelivery, ...p });
    const key = String(shopId || "").trim();
    if (DEMO_BY_SHOP_ID[key]) {
      return DEMO_BY_SHOP_ID[key].map((p, i) => withDelivery({ ...p, id: `demo-${key}-${i}` }));
    }
    return (DEMO_PRODUCTS[categoryKey] || DEMO_PRODUCTS.retail || []).map((p, i) =>
      withDelivery({ ...p, id: `demo-${categoryKey}-${i}` })
    );
  }

  function getCommitmentOptions() {
    return COMMITMENT_OPTIONS.slice();
  }

  function getCategoryFallbackImage(categoryKey) {
    return CATEGORY_FALLBACK_IMAGES[categoryKey] || CATEGORY_FALLBACK_IMAGES.other;
  }

  function getBrandPlaceholderUri() {
    return BRAND_PLACEHOLDER_SVG;
  }

  /** プリセット＋実商品カテゴリをマージ */
  function buildFilterCategories(categoryKey, productCategories) {
    const preset = getFilterCategories(categoryKey);
    const merged = ["すべて"];
    preset.slice(1).forEach((label) => {
      if (!merged.includes(label)) merged.push(label);
    });
    (productCategories || []).forEach((label) => {
      const t = String(label || "").trim();
      if (t && t !== "すべて" && !merged.includes(t)) merged.push(t);
    });
    return merged;
  }

  window.TasuShopProductsConfig = {
    COMMITMENT_OPTIONS,
    resolveCategoryKey,
    getFilterCategories,
    buildFilterCategories,
    getCommitmentOptions,
    getSceneOptions,
    getPageCopy,
    getServicePerks,
    getDemoReviews,
    getDemoProducts,
    getCategoryFallbackImage,
    getBrandPlaceholderUri,
  };
})();

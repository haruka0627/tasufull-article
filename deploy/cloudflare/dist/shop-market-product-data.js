/**
 * TASFUL市場 — 商品カタログ（検索・詳細で共用）
 */
(function () {
  "use strict";

  const CART_KEY = "tasu_market_cart_count";
  const CART_ITEMS_KEY = "tasu_market_cart_items";
  const LAST_ORDER_KEY = "tasu_market_last_order";
  const ORDER_HISTORY_KEY = "tasu_market_order_history";

  const PAYMENT_LABELS = {
    card: "クレジットカード",
    cvs: "コンビニ払い",
    bank: "銀行振込",
  };
  const FAVORITES_KEY = "tasu_market_favorites";
  const RECENT_KEY = "tasu_market_recent_products";
  const RECENT_ITEMS_KEY = "tasu_market_recent_items";
  const FAVORITE_ITEMS_KEY = "tasu_market_favorite_items";
  const FOLLOW_SHOPS_KEY = "tasu_market_followed_sellers";
  const SELLER_PRODUCTS_KEY = "tasu_market_seller_products";
  const SELLER_PROFILE_KEY = "tasu_market_seller_profile";
  const DEFAULT_SELLER_SHOP_ID = "tasu-market-seller-me";

  const LISTING_CATEGORIES = [
    { id: "food", label: "食品・スイーツ" },
    { id: "daily", label: "日用品" },
    { id: "goods", label: "雑貨・インテリア" },
    { id: "appliance", label: "家電・工具" },
    { id: "handmade", label: "ハンドメイド" },
    { id: "local", label: "地域限定" },
  ];

  const SHIP_DAYS_OPTIONS = [
    { id: "same-day", label: "当日発送" },
    { id: "1-2", label: "1〜2日以内発送" },
    { id: "3-5", label: "3〜5日以内発送" },
  ];

  const ORDER_STATUSES = ["注文受付", "発送準備中", "発送済み", "配達完了", "キャンセル"];

  const CONDITION_TYPES = {
    new: "新品",
    used: "中古",
    likeNew: "未使用に近い",
    handmade: "ハンドメイド",
    local: "地域限定",
  };

  const CATEGORY_FILTERS = {
    food: /食品|食料|グルメ|スイーツ|food|gourmet|菓子|惣菜|お取り寄せ/i,
    daily: /日用品|生活用品|洗剤|ティッシュ|掃除|daily|life/i,
    goods: /雑貨|インテリア|goods|interior|ライフスタイル|北欧/i,
    appliance: /家電|電化|appliance|electronics|電動|工具/i,
    handmade: /ハンドメイド|手作り|handmade|craft|限定品/i,
    local: /地域限定|local|産地|ご当地|地元|地域商品/i,
  };

  const SERVICE_SHOP_PROFILE_KEYS = new Set([
    "beauty_salon",
    "relaxation",
    "repair_maintenance",
    "construction",
    "school",
    "life",
    "local_service",
  ]);

  const DUMMY_REVIEW_COUNTS = [18, 42, 89, 128, 214];

  const DEFAULT_PRODUCT_IMAGE =
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80";

  const BREAD_PRODUCT_IMAGE =
    "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80";

  /** Unsplash ID → 404 または誤表示になりやすい画像 */
  const BROKEN_IMAGE_IDS = new Set([
    "photo-1617097899475-3306bbfbff93",
    "photo-1598869904288-9c0e1c8b2c6b",
  ]);

  /** Unsplash ID → 誤表示になりやすい画像（書籍カバー等） */
  const MISMATCH_IMAGE_IDS = new Set(["photo-1486427948969-8fbf64d4a37b"]);

  /** shopId::productId → 正規商品画像 */
  const PRODUCT_CANONICAL_IMAGES = {
    "demo-shop-tasful-bakery::p-0":
      "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80",
  };

  const CATEGORY_FAMILY_RULES = {
    books: {
      match: /洋書|書籍|漫画|コミック|ブック|book|milk and honey/i,
      related: /洋書|書籍|和書|文庫|文具|しおり|ブックカバー|ノート|本革/i,
      bundle: /しおり|ブックカバー|ノート|文具|ペン|ステーショナリー|本革/i,
      exclude: /食品|パン|コーヒー|スイーツ|焼き|惣菜|スウェット|スニーカー|ペット|フード|服|料理|刺身|ドライバー|キャンドル|マグ|フラワー|アロマ|トレー|インテリア|家具|キッチン|暮らし|ティー|北欧|雑貨|ギフト|ホビー|家電|工具|ワイン|ドリンク|ビール|日本酒|アルコール|飲食|レストラン|カフェ/i,
    },
    food: {
      match: /食品|スイーツ|グルメ|パン|コーヒー|焼き|惣菜|ドリンク|オーガニック|ジャム|刺身|グラノーラ/i,
      related: /食品|スイーツ|グルメ|コーヒー|ギフト|ドリンク|パン|焼き|惣菜/i,
      bundle: /コーヒー|ドリンク|焼き菓子|ジャム|ギフト|スイーツ|グラノーラ/i,
      exclude: /洋書|書籍|文具|しおり|ブックカバー|服|スニーカー|ペット|工具|家電/i,
    },
    fashion: {
      match: /服|スウェット|スニーカー|ファッション|ウェア|apparel/i,
      related: /服|ファッション|雑貨|ギフト/i,
      bundle: /ソックス|バッグ|雑貨|ギフト/i,
      exclude: /食品|パン|洋書|ペット|家電/i,
    },
    pets: {
      match: /ペット|pet|ドッグ|キャット|犬|猫/i,
      related: /ペット|pet|ドッグ|キャット/i,
      bundle: /ペット|おやつ|トイ/i,
      exclude: /洋書|食品|服|家電|工具/i,
    },
    hobby: {
      match: /ホビー|アニメ|トレカ|フィギュア|トレーディング|カードゲーム/i,
      related: /ホビー|アニメ|トレカ|フィギュア|雑貨/i,
      bundle: /トレカ|フィギュア|カード|収納/i,
      exclude: /食品|洋書|ペット|服/i,
    },
    handmade: {
      match: /ハンドメイド|手作り|craft/i,
      related: /ハンドメイド|雑貨|ギフト|手作り/i,
      bundle: /ハンドメイド|雑貨|ギフト/i,
      exclude: /食品|洋書|ペット|家電|工具/i,
    },
    home: {
      match: /雑貨|インテリア|暮らし|ギフト|家電|工具|フラワー/i,
      related: /雑貨|インテリア|ギフト|家電|暮らし/i,
      bundle: /雑貨|ギフト|マグ|インテリア/i,
      exclude: /食品|洋書|ペット|服/i,
    },
  };

  window.__tasfulMarketImgError = function (img) {
    if (!img || img.dataset.tasfulFallbackApplied === "1") return;
    img.dataset.tasfulFallbackApplied = "1";
    img.src = getFallbackImageUrl();
  };

  const DEMO_CATALOG = [
    {
      shopId: "demo-shop-haru-cafe",
      shopName: "ハルカフェ",
      productId: "p-0",
      title: "季節のパンケーキ",
      price: "¥1,280",
      image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7440?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 128,
      connectVerified: true,
      isSale: true,
      categoryBlob: "スイーツ 食品",
    },
    {
      shopId: "demo-shop-sushi",
      shopName: "鮨 さくら",
      productId: "p-0",
      title: "季節の刺身盛り",
      price: "¥2,200",
      image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 89,
      connectVerified: true,
      categoryBlob: "食品 グルメ",
    },
    {
      shopId: "demo-shop-bakery",
      shopName: "麦の香",
      productId: "p-0",
      title: "クロワッサン",
      price: "¥320",
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 214,
      connectVerified: false,
      categoryBlob: "食品 スイーツ",
    },
    {
      shopId: "demo-shop-cafe",
      shopName: "豆と焙煎",
      productId: "p-1",
      title: "スペシャルティコーヒー",
      price: "¥580",
      image: "https://images.unsplash.com/photo-1461023058943-07fcbeecadfb?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.9,
      reviewCount: 312,
      connectVerified: true,
      isSale: true,
      categoryBlob: "食品 ドリンク コーヒー",
    },
    {
      shopId: "demo-shop-sweets",
      shopName: "菓子工房リーフ",
      productId: "p-0",
      title: "焼き菓子ギフト",
      price: "¥1,680",
      image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.5,
      reviewCount: 42,
      connectVerified: false,
      categoryBlob: "食品 スイーツ",
    },
    {
      shopId: "demo-shop-craft",
      shopName: "クラフトルーム",
      productId: "p-0",
      title: "ハンドメイドトート",
      price: "¥3,980",
      image: "https://images.unsplash.com/photo-1590874103328-eacfd0ef4358?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 18,
      connectVerified: true,
      categoryBlob: "ハンドメイド 雑貨",
    },
    {
      shopId: "demo-shop-local",
      shopName: "地域マルシェ",
      productId: "p-0",
      title: "地域限定お土産ボックス",
      price: "¥2,480",
      image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.4,
      reviewCount: 56,
      connectVerified: false,
      categoryBlob: "食品 お取り寄せ",
    },
    {
      shopId: "demo-shop-home",
      shopName: "北欧ライフ",
      productId: "p-0",
      title: "北欧風マグカップ",
      price: "¥1,980",
      image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.3,
      reviewCount: 73,
      connectVerified: true,
      categoryBlob: "雑貨 インテリア",
    },
    {
      shopId: "demo-shop-tool",
      shopName: "工具堂",
      productId: "p-0",
      title: "電動ドライバーセット",
      price: "¥4,980",
      image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 95,
      connectVerified: true,
      isSale: true,
      categoryBlob: "家電 工具",
    },
    {
      shopId: "demo-shop-season",
      shopName: "フラワーギフト",
      productId: "p-0",
      title: "春のフラワーギフト",
      price: "¥2,680",
      image: "https://images.unsplash.com/photo-1490750967868-88d448d64e7e?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 64,
      connectVerified: false,
      categoryBlob: "雑貨 ギフト",
    },
    {
      shopId: "demo-shop-paper-house",
      shopName: "ペーパーハウス",
      productId: "p-0",
      title: "本革しおり 2枚セット",
      price: "¥680",
      image: "https://images.unsplash.com/photo-1512820790801-4159f01e187e?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.6,
      reviewCount: 48,
      connectVerified: true,
      categoryBlob: "文具 しおり 本",
    },
    {
      shopId: "demo-shop-paper-house",
      shopName: "ペーパーハウス",
      productId: "p-1",
      title: "ブックカバー 文庫サイズ",
      price: "¥880",
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.5,
      reviewCount: 36,
      connectVerified: false,
      categoryBlob: "文具 ブックカバー 本",
    },
    {
      shopId: "demo-shop-paper-house",
      shopName: "ペーパーハウス",
      productId: "p-2",
      title: "読書ノート A5",
      price: "¥580",
      image: "https://images.unsplash.com/photo-1531346680769-a1d6b371218b?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.7,
      reviewCount: 62,
      connectVerified: true,
      categoryBlob: "文具 ノート 本",
    },
    {
      shopId: "demo-shop-paper-house",
      shopName: "ペーパーハウス",
      productId: "p-3",
      title: "洋書 The Great Gatsby",
      price: "¥1,280",
      image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
      ratingScore: 4.8,
      reviewCount: 91,
      connectVerified: true,
      categoryBlob: "洋書 書籍",
    },
  ];

  let cachedPool = null;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }

  function normalizeBusinessType(listing) {
    return String(
      listing?.business_type || listing?.business_category || listing?.listing_type || listing?.type || ""
    ).trim();
  }

  function getListingCategoryKey(listing) {
    return String(
      listing?.business_subcategory ||
        listing?.shop_category ||
        listing?.shop_store_category ||
        listing?.form_data?.shop_store_category ||
        listing?.categoryProfile ||
        ""
    ).trim();
  }

  function isRetailShopListing(listing) {
    const key = getListingCategoryKey(listing);
    if (SERVICE_SHOP_PROFILE_KEYS.has(key)) return false;
    if (key === "construction") return false;
    return true;
  }

  function applyStoreCategoryFields(listing) {
    const copy = { ...listing };
    const key = getListingCategoryKey(copy);
    copy.business_subcategory = key || copy.business_subcategory;
    return copy;
  }

  async function fetchShopListings() {
    const store = window.TasuBusinessListings;
    let items = [];
    if (store?.fetchPublishedBusinessListings) {
      items = await store.fetchPublishedBusinessListings({
        limit: 200,
        business_category: "",
        public_only: false,
        localFallback: true,
      });
    }
    const shopDemo = window.TasuShopStoreDemo?.getListings?.() || [];
    const otherDemos = window.TasuListingLocalStore?.getShopStoreOtherDemosForListPage?.() || [];
    const shopDemoIds = new Set([
      ...shopDemo.map((d) => String(d.id)),
      ...otherDemos.map((d) => String(d.id)),
    ]);
    const boardDemo = (window.TasuBusinessBoardDemo?.getListings?.("") || []).filter((it) => {
      if (normalizeBusinessType(it) !== "shop_store") return false;
      const id = String(it?.id || "").trim();
      if (!id || shopDemoIds.has(id)) return false;
      return true;
    });
    const merged = [...otherDemos, ...shopDemo, ...boardDemo, ...items];
    const seen = new Set();
    return merged
      .filter((it) => {
        const id = String(it?.id || "").trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        if (normalizeBusinessType(it) !== "shop_store") return false;
        return isRetailShopListing(it);
      })
      .map((it) => applyStoreCategoryFields(it));
  }

  function resolveShopId(listing) {
    const primary = String(listing?.id || "").trim();
    const demoRef = String(listing?.demo_id || listing?.form_data?.demo_id || "").trim();
    const loader = window.TasuDetailShopStoreLoader;
    const resolvedPrimary = loader?.resolveShopListingId?.(primary) || primary;
    if (window.TasuShopStoreDemo?.getById?.(resolvedPrimary)) return resolvedPrimary;
    const resolvedDemo = loader?.resolveShopListingId?.(demoRef) || demoRef;
    if (resolvedDemo && window.TasuShopStoreDemo?.getById?.(resolvedDemo)) return resolvedDemo;
    return resolvedPrimary || resolvedDemo;
  }

  function normalizePriceBase(priceStr) {
    let base = String(priceStr || "").trim();
    if (!base || base === "¥—") return base;
    let prev = "";
    while (prev !== base) {
      prev = base;
      base = base
        .replace(/\s*[（(]\s*税込\s*[）)]\s*/gi, "")
        .replace(/\s*税込\s*/gi, "")
        .trim();
    }
    return base;
  }

  function parsePriceYen(priceStr) {
    const digits = String(priceStr || "").replace(/[^\d]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function formatPriceDisplay(priceStr) {
    const base = normalizePriceBase(priceStr);
    if (!base || base === "¥—") return "¥—";
    return `${base} <span class="tasful-market-search-card__price-tax">(税込)</span>`;
  }

  function formatMiniPrice(priceStr) {
    const base = normalizePriceBase(priceStr);
    return base || "¥—";
  }

  function formatRating(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return "★4.5";
    return `★${n.toFixed(1)}`;
  }

  function shipDaysLabel(product, index) {
    const blob = `${product?.stock || ""} ${product?.tag || ""} ${product?.ship_days || product?.shipping || ""}`;
    if (/即日|当日|same.?day|today/i.test(blob)) return "当日発送";
    if (/1.?2|翌日|fast|quick|1日|2日/i.test(blob)) return "1〜2日以内発送";
    if (/3.?5|3日|4日|5日/i.test(blob)) return "3〜5日以内発送";
    const defaults = ["当日発送", "1〜2日以内発送", "3〜5日以内発送"];
    return defaults[(Number(index) || 0) % defaults.length];
  }

  function resolveConditionType(product, rawProduct, index) {
    const blob = [
      product?.title,
      product?.categoryBlob,
      rawProduct?.condition,
      rawProduct?.product_condition,
      rawProduct?.tag,
      rawProduct?.description,
    ]
      .filter(Boolean)
      .join(" ");
    if (/中古|used|リユース|再生品/i.test(blob)) return "used";
    if (/未使用に近い|like.?new|美品|未使用/i.test(blob)) return "likeNew";
    if (/ハンドメイド|handmade|手作り|craft|一点/i.test(blob)) return "handmade";
    if (/地域限定|local|産地直送|ご当地|地元/i.test(blob)) return "local";
    if (product?.isNew) return "new";
    const cycle = ["new", "handmade", "local", "likeNew", "new"];
    return cycle[(Number(index) || 0) % cycle.length];
  }

  function resolveConditionLabel(type) {
    return CONDITION_TYPES[type] || CONDITION_TYPES.new;
  }

  function resolveReviewCount(product, shop, shopId, index) {
    const count = Number(
      product?.review_count || product?.reviews || shop?.review_count || shop?.reviews || 0
    );
    if (Number.isFinite(count) && count > 0) return count;
    const seed = String(`${shopId}::p-${index}`)
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return DUMMY_REVIEW_COUNTS[seed % DUMMY_REVIEW_COUNTS.length];
  }

  function resolveProductImageFields(product) {
    const image = String(product?.image || product?.image_url || product?.img || "").trim();
    const thumbnail = String(product?.thumbnail || product?.thumb || product?.thumbnail_url || "").trim();
    const mainImage = String(
      product?.mainImage || product?.main_image || product?.product_image_url || product?.productImage || ""
    ).trim();
    const galleryRaw = Array.isArray(product?.gallery) ? product.gallery[0] : null;
    const gallery0 = String(
      typeof galleryRaw === "string" ? galleryRaw : galleryRaw?.src || galleryRaw?.url || galleryRaw?.image || ""
    ).trim();
    const url = image || thumbnail || mainImage || gallery0;
    return { image: url, thumbnail, mainImage, gallery0, hasImage: Boolean(url) };
  }

  function productLookupKey(product) {
    const shopId = String(product?.shopId || "").trim();
    const productId = String(product?.productId || "").trim();
    if (shopId && productId) return `${shopId}::${productId}`;
    return String(product?.id || "").split("::dup-")[0].trim();
  }

  function extractUnsplashPhotoId(url) {
    const match = String(url || "").match(/photo-[\w-]+/);
    return match ? match[0] : "";
  }

  function isBrokenImageUrl(url) {
    const photoId = extractUnsplashPhotoId(url);
    return Boolean(photoId && BROKEN_IMAGE_IDS.has(photoId));
  }

  function isMismatchImageUrl(url, product) {
    const photoId = extractUnsplashPhotoId(url);
    if (!photoId || !MISMATCH_IMAGE_IDS.has(photoId)) return false;
    const blob = `${product?.title || ""} ${product?.categoryBlob || ""} ${product?.productName || ""}`;
    return /食パン|パン|bread/i.test(blob);
  }

  function resolvePrimaryImage(product) {
    const key = productLookupKey(product);
    if (PRODUCT_CANONICAL_IMAGES[key]) {
      return PRODUCT_CANONICAL_IMAGES[key];
    }

    const fields = resolveProductImageFields(product);
    const candidates = [fields.image, fields.thumbnail, fields.mainImage, fields.gallery0]
      .map(normalizeImageUrl)
      .filter(isUsableImageUrl);

    for (const url of candidates) {
      if (isBrokenImageUrl(url)) continue;
      if (!isMismatchImageUrl(url, product)) return url;
    }

    const blob = `${product?.title || ""} ${product?.categoryBlob || ""}`;
    if (/食パン|パン/i.test(blob)) return BREAD_PRODUCT_IMAGE;

    return getFallbackImageUrl();
  }

  function productImageOnErrorAttr() {
    return ' onerror="window.__tasfulMarketImgError?.(this)"';
  }

  function normalizeImageUrl(raw) {
    const url = String(raw || "").trim();
    if (!url || url === "#" || url === "about:blank") return "";
    if (/^data:image\//i.test(url)) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) return url;
    return url;
  }

  function isUsableImageUrl(url) {
    const normalized = normalizeImageUrl(url);
    if (!normalized) return false;
    if (/^(javascript:|blob:)/i.test(normalized)) return false;
    return true;
  }

  function getFallbackImageUrl() {
    return DEFAULT_PRODUCT_IMAGE;
  }

  function enrichProductImage(product) {
    if (!product) return null;
    const image = resolvePrimaryImage(product);
    return {
      ...product,
      image,
      hasImage: isUsableImageUrl(image),
    };
  }

  function productHasDisplayImage(product) {
    if (!product) return false;
    const { image, hasImage } = resolveProductImageFields(product);
    return Boolean(hasImage && isUsableImageUrl(normalizeImageUrl(image)));
  }

  function isSameDayShipping(product) {
    if (!product) return false;
    if (String(product.shipDaysKey || "").trim() === "same-day") return true;
    return /当日発送|即日|same.?day/i.test(String(product.shipDays || ""));
  }

  function pickRecommendFillProduct(pool, excludeIds) {
    const exclude = new Set(Array.isArray(excludeIds) ? excludeIds : []);
    const candidates = (pool || []).filter(
      (p) =>
        p &&
        !exclude.has(p.id) &&
        !String(p.id).includes("::dup-") &&
        productHasDisplayImage(p)
    );
    if (!candidates.length) return null;
    const sorted = [...candidates].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    return enrichProductImage(sorted[0]);
  }

  function getCartCrossSellProducts(pool, excludeIds, max = 6) {
    const exclude = new Set(Array.isArray(excludeIds) ? excludeIds : []);
    return (pool || [])
      .filter(
        (p) =>
          p &&
          !exclude.has(p.id) &&
          !String(p.id).includes("::dup-") &&
          productHasDisplayImage(p)
      )
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, Math.max(0, Number(max) || 6))
      .map(enrichProductImage);
  }

  function productCategoryBlob(product, shop, title) {
    const catLabel =
      window.TasuShopDetailCategory?.resolveCategoryLabel?.(shop) ||
      window.TasuShopDetailCategory?.getCategoryLabel?.(shop) ||
      "";
    return [
      product?.product_category,
      product?.category,
      getListingCategoryKey(shop),
      catLabel,
      shop?.title,
      shop?.shop_name,
      title,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function resolveShopName(shop) {
    return String(shop?.shop_name || shop?.company_name || shop?.title || "").trim() || "出品者";
  }

  function resolveConnectVerified(shop) {
    return Boolean(
      shop?.stripe_connect_account_id ||
        shop?.connect_verified ||
        shop?.pr_plan === "apply" ||
        shop?.featured
    );
  }

  function isNewProduct(createdAt) {
    const t = new Date(createdAt || 0).getTime();
    if (!t) return false;
    return Date.now() - t < 14 * 86400000;
  }

  function isSaleProduct(product, shop, index) {
    const tag = String(product?.tag || "").trim();
    if (/sale|セール|off|タイム/i.test(tag)) return true;
    return Boolean(index % 4 === 0);
  }

  function flattenProducts(listings) {
    const out = [];
    listings.forEach((shop) => {
      const shopId = resolveShopId(shop);
      const products = shop?.products || shop?.form_data?.products || [];
      const createdAt = shop?.created_at || shop?.updated_at || "";
      const shopName = resolveShopName(shop);
      const connectVerified = resolveConnectVerified(shop);
      products.forEach((p, index) => {
        const title = String(p?.title || p?.product_name || "").trim();
        if (!title) return;
        const { image, hasImage } = resolveProductImageFields(p);
        if (!hasImage) return;
        const ratingScore = Number(shop?.rating || shop?.review_score || 4.5);
        const reviewCount = resolveReviewCount(p, shop, shopId, index);
        const priceYen = parsePriceYen(p?.price);
        const created = p?.created_at || createdAt;
        const categoryBlob = productCategoryBlob(p, shop, title);
        const conditionType = resolveConditionType({ title, categoryBlob, isNew: isNewProduct(created) }, p, index);
        const galleryRaw = Array.isArray(p?.gallery)
          ? p.gallery
          : Array.isArray(p?.gallery_urls)
            ? p.gallery_urls
            : Array.isArray(p?.gallery_images)
              ? p.gallery_images
              : [];
        const gallery = galleryRaw
          .map((g) => normalizeImageUrl(typeof g === "string" ? g : g?.src || g?.url || g?.image))
          .filter(isUsableImageUrl);
        out.push({
          id: `${shopId}::p-${index}`,
          shopId,
          productId: `p-${index}`,
          title,
          price: String(p?.price || "").trim() || "¥—",
          priceYen,
          image,
          hasImage,
          shopName,
          connectVerified,
          freeShipping: true,
          isNew: isNewProduct(created),
          isSale: isSaleProduct(p, shop, index),
          shipDays: shipDaysLabel(p, index),
          conditionType,
          conditionLabel: resolveConditionLabel(conditionType),
          category: String(p?.category || "").trim(),
          categoryBlob,
          gallery,
          descriptionSections: normalizeDescriptionSections(p?.descriptionSections || p?.description_sections),
          ratingScore,
          reviewCount,
          createdAt: created,
          featured: Boolean(shop?.featured),
          inStock: !/売切|sold\s*out|在庫なし/i.test(String(p?.stock || "")),
        });
      });
    });
    return out;
  }

  function countShopListingProducts(shop) {
    const buckets = [
      shop?.products,
      shop?.items,
      shop?.product_list,
      shop?.form_data?.products,
      shop?.category_extra?.shop_store?.products,
    ];
    let count = 0;
    buckets.forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((p) => {
        if (String(p?.title || p?.product_name || p?.name || "").trim()) count += 1;
      });
    });
    return count;
  }

  function fillerDemoToProduct(raw, shop, index) {
    const shopId = resolveShopId(shop);
    const productId = String(raw?.id || `demo-filler-${index}`).trim();
    const title = String(raw?.title || "").trim();
    if (!shopId || !productId || !title) return null;
    const { image, hasImage } = resolveProductImageFields(raw);
    if (!hasImage) return null;
    const shopName = resolveShopName(shop);
    const connectVerified = resolveConnectVerified(shop);
    const ratingScore = Number(shop?.rating || shop?.review_score || 4.5);
    const reviewCount = resolveReviewCount(raw, shop, shopId, index);
    const priceYen = parsePriceYen(raw?.price);
    const categoryBlob = productCategoryBlob(raw, shop, title);
    const tag = String(raw?.tag || "").trim();
    const isSale = /sale|セール/i.test(tag) || Boolean(raw?.priceWas || raw?.price_was);
    const conditionType = resolveConditionType({ title, categoryBlob, isNew: /new|新着/i.test(tag) }, raw, index);
    return {
      id: `${shopId}::${productId}`,
      shopId,
      productId,
      title,
      price: String(raw?.price || "").trim() || "¥—",
      priceYen,
      image,
      hasImage,
      shopName,
      connectVerified,
      freeShipping: true,
      isNew: /new|新着|限定/i.test(tag),
      isSale,
      shipDays: shipDaysLabel(raw, index),
      conditionType,
      conditionLabel: resolveConditionLabel(conditionType),
      category: String(raw?.category || "").trim(),
      categoryBlob,
      gallery: [],
      descriptionSections: normalizeDescriptionSections(raw?.descriptionSections || raw?.description_sections),
      ratingScore,
      reviewCount,
      createdAt: shop?.created_at || shop?.updated_at || "",
      featured: index < 3,
      inStock: true,
    };
  }

  function flattenShopProductsFiller(listings) {
    const cfg = window.TasuShopProductsConfig;
    if (!cfg?.getDemoProducts || !cfg?.resolveCategoryKey) return [];
    const out = [];
    const seen = new Set();
    const addDemoBatch = (shop, categoryKey, shopId, batch) => {
      batch.forEach((raw, i) => {
        const p = fillerDemoToProduct(raw, shop, i);
        if (!p) return;
        const key = `${p.shopId}::${p.productId}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(p);
      });
    };
    (listings || []).forEach((shop) => {
      const shopId = resolveShopId(shop);
      const categoryKey = cfg.resolveCategoryKey(shop);
      addDemoBatch(shop, categoryKey, shopId, cfg.getDemoProducts(categoryKey, shopId));
      const skipExtraDemo = /kiichi-dining|kichi-dining/.test(shopId);
      if (countShopListingProducts(shop) < 8 && !skipExtraDemo) {
        addDemoBatch(shop, categoryKey, shopId, cfg.getDemoProducts(categoryKey));
      }
    });
    return out;
  }

  function demoToProduct(item, index) {
    const createdAt = new Date(Date.now() - index * 86400000).toISOString();
    const categoryBlob = item.categoryBlob || item.title;
    const category =
      String(item.category || "").trim() ||
      String(categoryBlob || "")
        .split(/\s+/)
        .find((w) => w.length > 1) ||
      "";
    const conditionType = resolveConditionType(
      { title: item.title, categoryBlob, isNew: index < 4 },
      item,
      index
    );
    const galleryRaw = Array.isArray(item.gallery) ? item.gallery : [];
    const gallery = galleryRaw
      .map((g) => normalizeImageUrl(typeof g === "string" ? g : g?.src || g?.url || g?.image))
      .filter(isUsableImageUrl);
    return {
      id: `${item.shopId}::${item.productId}`,
      shopId: item.shopId,
      productId: item.productId,
      title: item.title,
      price: item.price,
      priceYen: parsePriceYen(item.price),
      image: item.image,
      hasImage: true,
      shopName: item.shopName,
      connectVerified: Boolean(item.connectVerified),
      freeShipping: true,
      isNew: index < 4,
      isSale: Boolean(item.isSale),
      shipDays: shipDaysLabel(item, index),
      conditionType,
      conditionLabel: resolveConditionLabel(conditionType),
      category,
      categoryBlob,
      gallery,
      ratingScore: Number(item.ratingScore) || 4.5,
      reviewCount: Number(item.reviewCount) || DUMMY_REVIEW_COUNTS[index % DUMMY_REVIEW_COUNTS.length],
      createdAt,
      featured: index < 3,
      inStock: true,
    };
  }

  function buildProductPool(baseProducts) {
    const pool = baseProducts.filter((p) => p.hasImage && String(p.image || "").trim());
    const seen = new Set(pool.map((p) => `${p.shopId}::${p.productId}`));
    DEMO_CATALOG.forEach((item, i) => {
      const key = `${item.shopId}::${item.productId}`;
      if (!seen.has(key)) {
        pool.push(demoToProduct(item, i));
        seen.add(key);
      }
    });
    if (!pool.length) {
      DEMO_CATALOG.forEach((item, i) => pool.push(demoToProduct(item, i)));
    }
    let i = 0;
    while (pool.length < 36) {
      const src = pool[i % pool.length];
      pool.push({ ...src, id: `${src.id || src.shopId}::dup-${pool.length}` });
      i += 1;
    }
    return pool.map(enrichProductImage);
  }

  async function loadProductPool(forceRefresh) {
    if (cachedPool && !forceRefresh) return cachedPool;
    const listings = await fetchShopListings();
    let base = flattenProducts(listings);
    const sellerFlat = getSellerProducts()
      .filter((entry) => entry.moderation_status === "approved" && entry.publish_status === "public")
      .map(sellerListingToProduct)
      .filter(Boolean);
    const seen = new Set(base.map((p) => p.id));
    sellerFlat.forEach((p) => {
      if (!seen.has(p.id)) {
        base.unshift(p);
        seen.add(p.id);
      }
    });
    flattenShopProductsFiller(listings).forEach((p) => {
      if (!seen.has(p.id)) {
        base.push(p);
        seen.add(p.id);
      }
    });
    cachedPool = buildProductPool(base);
    return cachedPool;
  }

  function invalidateProductPoolCache() {
    cachedPool = null;
  }

  function findProduct(pool, shopId, productId) {
    const sid = String(shopId || "").trim();
    const pid = String(productId || "").trim();
    if (!sid || !pid) return null;
    const direct = pool.find((p) => p.shopId === sid && p.productId === pid && !String(p.id).includes("::dup-"));
    if (direct) return direct;
    return pool.find((p) => p.shopId === sid && p.productId === pid) || null;
  }

  function findProductById(pool, id) {
    const key = String(id || "").trim();
    if (!key) return null;
    return pool.find((p) => p.id === key) || null;
  }

  function productHref(product) {
    return `detail-shop-product.html?shopId=${encodeURIComponent(product.shopId)}&productId=${encodeURIComponent(product.productId)}`;
  }

  function buildConditionHtml(product, prefix = "tasful-market-search-card") {
    const type = product.conditionType || "new";
    const label = product.conditionLabel || resolveConditionLabel(type);
    return `<span class="${prefix}__condition ${prefix}__condition--${escAttr(type)}">${esc(label)}</span>`;
  }

  function buildMiniCardHtml(product) {
    const src = resolvePrimaryImage(product);
    return `<a class="tasful-market-search-mini" href="${escAttr(productHref(product))}"><div class="tasful-market-search-mini__img"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="120" height="120"${productImageOnErrorAttr()}></div><div class="tasful-market-search-mini__body">${buildConditionHtml(product, "tasful-market-search-mini")}<p class="tasful-market-search-mini__title">${esc(product.title)}</p><p class="tasful-market-search-mini__rating">${esc(formatRating(product.ratingScore))} (${esc(product.reviewCount)})</p><p class="tasful-market-search-mini__price">${esc(formatMiniPrice(product.price))}</p></div></a>`;
  }

  function buildGridCardHtml(product) {
    const href = productHref(product);
    const src = resolvePrimaryImage(product);
    const rating = formatRating(product.ratingScore);
    const price = formatMiniPrice(product.price);
    return `<article class="tasful-market-grid-card" data-product-id="${escAttr(product.id)}"><a class="tasful-market-grid-card__link" href="${escAttr(href)}"><div class="tasful-market-grid-card__img"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="180" height="180"${productImageOnErrorAttr()}></div><div class="tasful-market-grid-card__body"><h3 class="tasful-market-grid-card__title">${esc(product.title)}</h3><p class="tasful-market-grid-card__rating">${esc(rating)} (${esc(product.reviewCount || 0)})</p><p class="tasful-market-grid-card__price">${esc(price)}</p>${product.connectVerified ? '<span class="tasful-market-grid-card__badge">Connect</span>' : ""}</div></a></article>`;
  }

  function buildMiniCardPlaceholder(index) {
    const src = getFallbackImageUrl();
    return `<div class="tasful-market-search-mini tasful-market-search-mini--placeholder"><div class="tasful-market-search-mini__img"><img src="${escAttr(src)}" alt="" loading="lazy" decoding="async" width="120" height="120"${productImageOnErrorAttr()}></div><div class="tasful-market-search-mini__body"><p class="tasful-market-search-mini__title">おすすめ商品 ${index + 1}</p><p class="tasful-market-search-mini__rating">★4.5</p><p class="tasful-market-search-mini__price">近日公開</p></div></div>`;
  }

  function pickShelfProducts(candidates, pool, options = {}) {
    const count = Number(options.count) || 8;
    const excludeId = String(options.excludeId || "").trim();
    const minItems = Number(options.minItems) || 3;
    const seen = new Set();
    const picked = [];

    const tryPush = (product) => {
      if (!product || seen.has(product.id)) return;
      if (excludeId && product.id === excludeId) return;
      if (!productHasDisplayImage(product)) return;
      seen.add(product.id);
      picked.push(enrichProductImage(product));
    };

    (candidates || []).forEach(tryPush);
    if (picked.length < count && !options.strictPool) {
      (pool || []).forEach((product) => {
        if (picked.length >= count) return;
        if (String(product.id).includes("::dup-")) return;
        tryPush(product);
      });
    }

    const html = picked.slice(0, count).map((p) => buildMiniCardHtml(p));
    let placeholderIndex = 0;
    while (html.length < minItems && html.length < count) {
      html.push(buildMiniCardPlaceholder(placeholderIndex));
      placeholderIndex += 1;
    }
    return { products: picked.slice(0, count), html: html.join("") };
  }

  function pushRecentProduct(productId) {
    const key = String(productId || "").trim();
    if (!key) return;
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const list = Array.isArray(raw) ? raw.map(String) : [];
      const next = [key, ...list.filter((id) => id !== key)].slice(0, 12);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function normalizeRecentItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || `${raw.shopId}::${raw.productId}`).trim();
    if (!id || id === "::") return null;
    return {
      id,
      shopId: String(raw.shopId || "").trim(),
      productId: String(raw.productId || "").trim(),
      title: String(raw.title || "商品").trim(),
      price: String(raw.price || "¥—"),
      image: String(raw.image || "").trim(),
      shopName: String(raw.shopName || "").trim(),
      ratingScore: Number(raw.ratingScore) || 0,
      reviewCount: Number(raw.reviewCount) || 0,
      connectVerified: Boolean(raw.connectVerified),
      viewedAt: String(raw.viewedAt || new Date().toISOString()),
    };
  }

  function pushRecentItem(product) {
    if (!product) return;
    pushRecentProduct(product.id);
    const snapshot = normalizeRecentItem({
      id: product.id,
      shopId: product.shopId,
      productId: product.productId,
      title: product.title,
      price: product.price,
      image: resolvePrimaryImage(product),
      shopName: product.shopName,
      ratingScore: product.ratingScore,
      reviewCount: product.reviewCount,
      connectVerified: product.connectVerified,
      viewedAt: new Date().toISOString(),
    });
    if (!snapshot) return;
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || "[]");
      const list = Array.isArray(raw) ? raw.map(normalizeRecentItem).filter(Boolean) : [];
      const next = [snapshot, ...list.filter((item) => item.id !== snapshot.id)].slice(0, 20);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function getRecentItems() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_ITEMS_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeRecentItem).filter(Boolean);
    } catch {
      return [];
    }
  }

  function getFavoriteItemSnapshots() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITE_ITEMS_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeRecentItem).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveFavoriteItemSnapshots(list) {
    try {
      localStorage.setItem(FAVORITE_ITEMS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  function pushFavoriteItemSnapshot(product) {
    if (!product) return;
    const snapshot = normalizeRecentItem({
      id: product.id,
      shopId: product.shopId,
      productId: product.productId,
      title: product.title,
      price: product.price,
      image: resolvePrimaryImage(product),
      shopName: product.shopName,
      ratingScore: product.ratingScore,
      reviewCount: product.reviewCount,
      connectVerified: product.connectVerified,
      viewedAt: new Date().toISOString(),
    });
    if (!snapshot) return;
    const next = [snapshot, ...getFavoriteItemSnapshots().filter((item) => item.id !== snapshot.id)];
    saveFavoriteItemSnapshots(next);
  }

  function removeFavoriteItemSnapshot(productId) {
    const key = String(productId || "").trim();
    if (!key) return;
    saveFavoriteItemSnapshots(getFavoriteItemSnapshots().filter((item) => item.id !== key));
  }

  function recentItemToProduct(item) {
    if (!item) return null;
    return enrichProductImage({
      id: item.id,
      shopId: item.shopId,
      productId: item.productId,
      title: item.title,
      price: item.price,
      image: item.image,
      shopName: item.shopName,
      ratingScore: item.ratingScore,
      reviewCount: item.reviewCount,
      connectVerified: item.connectVerified,
    });
  }

  function getRecentItemProducts(pool) {
    const items = getRecentItems();
    if (items.length) {
      return items.map((item) => recentItemToProduct(item) || findProduct(pool, item.shopId, item.productId)).filter(Boolean);
    }
    return getRecentProducts(pool);
  }

  function getRecentProducts(pool) {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.map((id) => findProductById(pool, id) || pool.find((p) => p.id.startsWith(String(id)))).filter(Boolean);
    } catch {
      return [];
    }
  }

  function productCategoryText(product) {
    return `${product?.category || ""} ${product?.categoryBlob || ""} ${product?.title || ""}`.trim();
  }

  function resolveCategoryFamily(product) {
    const blob = productCategoryText(product);
    for (const [family, rule] of Object.entries(CATEGORY_FAMILY_RULES)) {
      if (rule.match.test(blob)) return family;
    }
    return "home";
  }

  function resolveCategoryDisplay(product) {
    const direct = String(product?.category || "").trim();
    if (direct) return direct;
    const blob = product?.categoryBlob || "";
    const word = blob.split(/\s+/).find((w) => w.length > 1);
    return word || "その他";
  }

  function isCategoryExcluded(candidate, family) {
    const rule = CATEGORY_FAMILY_RULES[family] || CATEGORY_FAMILY_RULES.home;
    const blob = productCategoryText(candidate);
    return Boolean(rule.exclude?.test(blob));
  }

  function matchesCategoryPatterns(candidate, patterns) {
    const blob = productCategoryText(candidate);
    const list = Array.isArray(patterns) ? patterns : patterns ? [patterns] : [];
    return list.some((re) => re && re.test(blob));
  }

  function isRelatedProduct(source, candidate) {
    if (!candidate || candidate.id === source.id) return false;
    if (String(candidate.id).includes("::dup-")) return false;
    const family = resolveCategoryFamily(source);
    const rule = CATEGORY_FAMILY_RULES[family] || CATEGORY_FAMILY_RULES.home;
    if (isCategoryExcluded(candidate, family)) return false;
    return matchesCategoryPatterns(candidate, rule.related);
  }

  function isBundleProduct(source, candidate) {
    if (!candidate || candidate.id === source.id) return false;
    if (String(candidate.id).includes("::dup-")) return false;
    const family = resolveCategoryFamily(source);
    const rule = CATEGORY_FAMILY_RULES[family] || CATEGORY_FAMILY_RULES.home;
    if (isCategoryExcluded(candidate, family)) return false;
    return matchesCategoryPatterns(candidate, rule.bundle);
  }

  function getRelatedProducts(product, pool, count = 8) {
    const related = (pool || [])
      .filter((p) => isRelatedProduct(product, p))
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    return related.slice(0, count);
  }

  function getFrequentlyBoughtTogether(product, pool, count = 2) {
    const bundle = (pool || [])
      .filter((p) => isBundleProduct(product, p))
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    return bundle.slice(0, count);
  }

  function getBrowsedProducts(pool, count = 8) {
    const sorted = [...pool]
      .filter((p) => !String(p.id).includes("::dup-"))
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    return sorted.slice(0, count);
  }

  function seedFromProduct(product) {
    return String(product?.id || product?.title || "")
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  }

  function buildAboutBullets(product) {
    const seed = seedFromProduct(product);
    const pool = [
      "TASFUL市場で人気の商品です",
      "丁寧な梱包でお届けします",
      "品質チェック済みの出品です",
      "レビュー評価の高い商品です",
      "安心してお買い求めいただけます",
    ];
    if (/洋書|書籍|book/i.test(product.categoryBlob || product.title)) {
      pool.unshift("英語原著の人気タイトル");
      pool.unshift("コンパクトサイズで持ち運びやすい");
    }
    if (/食品|スイーツ|グルメ|コーヒー|パン/i.test(product.categoryBlob || product.title)) {
      pool.unshift("厳選素材を使用しています");
    }
    if (product.handmade || product.conditionType === "handmade") {
      pool.unshift("一点ずつ手作りで仕上げています");
    }
    if (product.connectVerified) {
      pool.unshift("Connect認証済み出品者の商品です");
    }
    const out = [];
    for (let i = 0; i < 5 && out.length < 5; i += 1) {
      const item = pool[(seed + i) % pool.length];
      if (!out.includes(item)) out.push(item);
    }
    return out.slice(0, 5);
  }

  function buildProductFeatureBullets(product) {
    const seed = seedFromProduct(product);
    const blob = productCategoryText(product);
    const title = String(product.title || "");
    const out = [];

    if (/洋書|書籍|本/i.test(blob)) {
      const salesMillions = [3, 5, 8, 12][seed % 4];
      out.push(`世界累計${salesMillions}万部突破のベストセラー`);
      out.push("英語版ペーパーバック");
      const authorMatch = title.match(/\(([^)]+)\)/);
      out.push(authorMatch ? `著者：${authorMatch[1]}` : "人気作家の代表作");
      out.push(["読みやすい文庫サイズ", "コンパクトで持ち運びやすい", "ページが見開きやすいサイズ"][seed % 3]);
      out.push(["短編で読み切りやすい構成", "現代詩とイラストの組み合わせ", "ギフトにも選ばれる定番タイトル"][seed % 3]);
    } else if (/食品|スイーツ|グルメ|コーヒー|パン|オーガニック|ジャム|ナチュラル/i.test(blob)) {
      const amounts = ["200g", "150g", "300ml", "12個入り"];
      out.push(`内容量：${amounts[seed % amounts.length]}`);
      out.push(["厳選素材使用", "国産原料中心", "無添加処方"][seed % 3]);
      out.push("保存方法：直射日光・高温多湿を避けて保管");
      out.push("賞味期限：製造日から6ヶ月（未開封）");
      if (/コーヒー|パン|焼き菓子/i.test(blob)) {
        out.push("アレルギー：小麦・乳（詳細は商品情報をご確認ください）");
      } else {
        out.push(["朝食やおやつに便利", "ギフトセットにも対応", "常温配送でお届け"][seed % 3]);
      }
    } else {
      const sizes = ["約W12×H18cm", "約15×20cm", "フリーサイズ"];
      const materials = ["本革", "コットン", "ステンレス", "再生紙"];
      out.push(`サイズ：${sizes[seed % sizes.length]}`);
      out.push(`素材：${materials[seed % materials.length]}`);
      out.push(["手仕上げの質感", "日常使いに便利な軽量設計", "シンプルで長く使えるデザイン"][seed % 3]);
      out.push(["ギフトにもおすすめ", "男女問わず使えるデザイン", "自宅用・オフィス用に最適"][seed % 3]);
      if (product.handmade || product.conditionType === "handmade") {
        out.push("一点ずつ手作りで仕上げています");
      } else {
        out.push(["梱包済みでお届け", "すぐに使える完成品", "替え・予備にも便利"][seed % 3]);
      }
    }

    return out.slice(0, 5);
  }

  function normalizeDescriptionSections(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        title: String(item?.title || "").trim(),
        description: String(item?.description || "").trim(),
        image: normalizeImageUrl(item?.image || item?.src || item?.url || item?.img || ""),
      }))
      .filter((item) => item.title && item.description && isUsableImageUrl(item.image) && !isBrokenImageUrl(item.image));
  }

  function descriptionImageUrl(photoPath, width = 640) {
    const path = String(photoPath || "").replace(/^\/+/, "");
    return `https://images.unsplash.com/${path}?auto=format&fit=crop&w=${width}&q=80`;
  }

  function descriptionSectionCategory(product) {
    const blob = productCategoryText(product);
    if (/洋書|書籍|本|文具|しおり|ブックカバー|ノート/i.test(blob)) return "book";
    if (/食品|スイーツ|パン|コーヒー|焼き|惣菜|グルメ|オーガニック|ジャム|ナチュラル/i.test(blob)) return "food";
    return "general";
  }

  const DESCRIPTION_SECTION_IMAGE_POOLS = {
    book: [
      "photo-1544947950-fa07a98d237f",
      "photo-1544716278-ca5e3f4abd8c",
      "photo-1543002588-bfa74002ed7e",
      "photo-1456513080510-7bf3a84b82f8",
      "photo-1586528116311-ad8dd3c8310d",
    ],
    food: [
      "photo-1549931319-a545dcf3bc73",
      "photo-1555507036-ab1f4038808a",
      "photo-1542838132-92c53300491e",
      "photo-1586528116311-ad8dd3c8310d",
      "photo-1504674900247-0877df9cc836",
    ],
    general: [
      "photo-1504148455328-c376907d081c",
      "photo-1514228742587-6b1558fcca3d",
      "photo-1543002588-bfa74002ed7e",
      "photo-1507003211169-0a1dd7228f2d",
      "photo-1586528116311-ad8dd3c8310d",
    ],
  };

  function descriptionSectionImagePool(product) {
    const category = descriptionSectionCategory(product);
    const pool = DESCRIPTION_SECTION_IMAGE_POOLS[category] || DESCRIPTION_SECTION_IMAGE_POOLS.general;
    return pool.map((photoPath) => descriptionImageUrl(photoPath));
  }

  function assignUniqueDescriptionImages(sections, product) {
    const pool = descriptionSectionImagePool(product);
    const used = new Set();
    return sections.map((section, index) => {
      let image = normalizeImageUrl(section.image);
      if (!isUsableImageUrl(image) || isBrokenImageUrl(image) || used.has(image)) {
        image =
          pool.find((candidate) => !used.has(candidate)) ||
          pool[index % pool.length] ||
          descriptionImageUrl(DESCRIPTION_SECTION_IMAGE_POOLS.general[index % 5]);
      }
      if (used.has(image)) {
        image = pool.find((candidate) => !used.has(candidate)) || image;
      }
      used.add(image);
      return { ...section, image };
    });
  }

  function descriptionSectionTemplates(product) {
    const blob = productCategoryText(product);
    if (/洋書|書籍|本|文具|しおり|ブックカバー|ノート/i.test(blob)) {
      return [
        {
          title: "特徴① 表紙・全体像",
          description: "英語原著の人気タイトル。表紙デザインと全体のボリューム感をご確認いただけます。",
        },
        {
          title: "特徴② 中身・ページの見え方",
          description: "開いた状態のページ配置を確認できます。読みやすいレイアウトかどうかの判断材料になります。",
        },
        {
          title: "特徴③ サイズ感",
          description: "手元での大きさや持ち運びやすさをイメージしやすいよう、実物に近いサイズ感で撮影しています。",
        },
        {
          title: "特徴④ 読書シーン",
          description: "通勤・休憩・自宅など、日常の読書シーンでの使い方をイメージしていただけます。",
        },
        {
          title: "特徴⑤ 梱包状態",
          description: "配送時の破損を防ぐ梱包方法を採用。届いたときの状態を安心して確認できます。",
        },
      ];
    }
    if (/食品|スイーツ|パン|コーヒー|焼き|惣菜|グルメ|オーガニック|ジャム|ナチュラル/i.test(blob)) {
      return [
        {
          title: "特徴① 商品全体",
          description: "商品の全体像と見た目の魅力を確認できます。ギフトや日常使いのイメージに役立ちます。",
        },
        {
          title: "特徴② 断面・食感",
          description: "断面や質感が伝わる写真で、味や食感のイメージを具体化できます。",
        },
        {
          title: "特徴③ 原材料",
          description: "使用素材や原料の雰囲気がわかるよう、内容の見える情報を掲載しています。",
        },
        {
          title: "特徴④ 梱包状態",
          description: "配送時の品質を守る梱包方法を採用。届いたときの状態を確認できます。",
        },
        {
          title: "特徴⑤ 利用シーン",
          description: "朝食、おやつ、ギフトなど、実際の利用シーンをイメージしやすくしています。",
        },
      ];
    }
    return [
      {
        title: "特徴① 商品全体",
        description: "商品の全体像とデザインの雰囲気を確認できます。購入前の第一印象を掴みやすくしています。",
      },
      {
        title: "特徴② ディテール",
        description: "素材感や仕上げの細部をアップで確認できます。品質の判断材料になります。",
      },
      {
        title: "特徴③ サイズ感",
        description: "手元での大きさや置き場所のイメージがつかめるよう、サイズ感がわかる写真を掲載しています。",
      },
      {
        title: "特徴④ 利用シーン",
        description: "日常使いやギフトなど、実際の使い方をイメージしやすいシーン写真を掲載しています。",
      },
      {
        title: "特徴⑤ 梱包状態",
        description: "配送時の破損を防ぐ梱包でお届けします。届いたときの状態を安心して確認できます。",
      },
    ];
  }

  function buildDescriptionSections(product) {
    const custom = normalizeDescriptionSections(product?.descriptionSections);
    if (custom.length) {
      return assignUniqueDescriptionImages(custom.slice(0, 5), product);
    }

    const templates = descriptionSectionTemplates(product);
    const sections = templates.map((section, index) => ({
      title: section.title,
      description: section.description,
      image: descriptionSectionImagePool(product)[index] || "",
    }));
    return assignUniqueDescriptionImages(sections, product).filter((section) => isUsableImageUrl(section.image));
  }

  function buildShippingDetail(product) {
    const ship = String(product?.shipDays || "1〜2日以内発送").trim();
    const free = product?.freeShipping !== false;
    const sameDay = isSameDayShipping?.(product);
    return [
      { label: "配送方法", value: "国内配送（追跡番号付き・一部地域除く）" },
      {
        label: "発送目安",
        value: sameDay ? `${ship}（14時までのご注文で当日発送）` : ship,
      },
      { label: "送料", value: free ? "送料無料" : "地域により送料が異なります" },
      { label: "梱包", value: "破損防止のため丁寧に梱包してお届けします" },
      { label: "返品・キャンセル", value: "未使用品に限り到着後7日以内（一部除外あり）" },
    ];
  }

  function buildSpecRows(product) {
    const seed = seedFromProduct(product);
    const blob = productCategoryText(product);
    const isBook = /洋書|書籍|本|文具|しおり|ブックカバー|ノート/i.test(blob);
    const sizeOptions = isBook
      ? ["文庫サイズ", "B6サイズ", "A5サイズ", "約12×18cm"]
      : ["約200g", "標準サイズ", "1個入り", "セット内容：1点"];
    const materialOptions = isBook
      ? ["紙・印刷", "本革", "コットン", "再生紙"]
      : ["天然素材", "国産素材使用", "食品グレード素材", "再生可能素材"];
    return [
      { id: "condition", label: "商品状態", value: product.conditionLabel || "新品", open: false },
      {
        id: "size",
        label: "内容量 / サイズ / 素材",
        value: `${sizeOptions[seed % sizeOptions.length]} / ${materialOptions[seed % materialOptions.length]}`,
        open: true,
      },
      {
        id: "shipping",
        label: "配送情報",
        value: product.freeShipping ? `送料無料 · ${product.shipDays}` : product.shipDays,
        open: false,
      },
      {
        id: "returns",
        label: "返品・キャンセル",
        value: "未使用品に限り到着後7日以内の返品可（一部除外あり）",
        open: false,
      },
      {
        id: "seller",
        label: "出品者情報",
        value: `${product.shopName}${product.connectVerified ? " · ✓ Connect認証済み" : ""}`,
        open: false,
      },
    ];
  }

  const REVIEW_SNIPPETS = [
    { title: "期待以上でした", body: "写真通りの品質で、梱包も丁寧でした。また利用したいです。" },
    { title: "使いやすい", body: "説明どおりの商品で、届くのも早かったです。満足しています。" },
    { title: "リピート決定", body: "コスパが良く、家族にも好評でした。次回もこちらで購入します。" },
    { title: "安心して購入できました", body: "出品者の対応が丁寧で、商品の状態も問題ありませんでした。" },
  ];

  function buildSampleReviews(product, count = 3) {
    const seed = seedFromProduct(product);
    const reviews = [];
    for (let i = 0; i < count; i += 1) {
      const tpl = REVIEW_SNIPPETS[(seed + i) % REVIEW_SNIPPETS.length];
      const stars = Math.max(4, Math.min(5, Math.round(product.ratingScore || 4.5)));
      reviews.push({
        stars,
        title: tpl.title,
        body: tpl.body,
        author: `購入者${((seed + i) % 900) + 100}`,
        date: `2025/${String(((seed + i) % 12) + 1).padStart(2, "0")}/15`,
        photoUrl: i === 0 ? resolvePrimaryImage(product) : "",
      });
    }
    return reviews;
  }

  function collectProductImageSources(product) {
    const sources = [];
    const pushSrc = (raw, label) => {
      const src = normalizeImageUrl(raw);
      if (!isUsableImageUrl(src)) return;
      if (isBrokenImageUrl(src)) return;
      if (sources.some((item) => item.src === src)) return;
      sources.push({ src, label: label || "商品画像" });
    };

    pushSrc(resolvePrimaryImage(product), "商品画像");

    const fields = resolveProductImageFields(product);
    [fields.thumbnail, fields.mainImage, fields.gallery0].forEach((url, index) => {
      pushSrc(url, index === 0 ? "サムネイル" : `商品画像${sources.length}`);
    });

    if (Array.isArray(product?.gallery)) {
      product.gallery.forEach((item, index) => {
        const raw = typeof item === "string" ? item : item?.src || item?.url || item?.image;
        pushSrc(raw, `商品画像${index + 1}`);
      });
    }

    return sources;
  }

  function getProductGallery(product) {
    const sources = collectProductImageSources(product);
    return sources.slice(0, 6).map((item, index) => ({
      id: `img-${index}`,
      src: item.src,
      label: item.label,
      kind: index === 0 ? "main" : "alt",
    }));
  }

  function getProductThumbnails(product) {
    return getProductGallery(product).map((item) => item.src);
  }

  function buildRecommendPoints(product) {
    const blob = `${product.categoryBlob || ""} ${product.title || ""}`;
    const points = [];

    if (/パン|ベーカ|bakery|焼き|朝|惣菜/i.test(blob)) {
      points.push("毎朝焼きたて発送");
    } else if (/当日|即日/i.test(product.shipDays || "")) {
      points.push("当日発送対応");
    } else if (product.shipDays) {
      points.push(`${product.shipDays}対応`);
    } else {
      points.push("スピード発送対応");
    }

    if (product.freeShipping) points.push("送料無料");
    if (product.connectVerified) points.push("Connect認証出品者");
    if ((Number(product.ratingScore) || 0) >= 4.3 || (product.reviewCount || 0) >= 30) {
      points.push("レビュー高評価");
    }
    points.push("安心決済対応");

    const unique = [];
    points.forEach((p) => {
      if (!unique.includes(p)) unique.push(p);
    });
    return unique.slice(0, 5);
  }

  function buildSellerProfile(product) {
    const seed = seedFromProduct(product);
    const rating = Number(product.ratingScore) || 4.5;
    const reviewCount = Number(product.reviewCount) || DUMMY_REVIEW_COUNTS[seed % DUMMY_REVIEW_COUNTS.length];
    return {
      name: product.shopName || "出品者",
      shopId: product.shopId,
      rating,
      reviewCount,
      salesCount: 80 + (seed % 920),
      identityVerified: true,
      connectVerified: Boolean(product.connectVerified),
      shopUrl: resolveSellerPageHref(product),
    };
  }

  function formatStarDisplay(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    const filled = Math.round(n);
    return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
  }

  function formatReviewScore(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return "4.5";
    return n.toFixed(1);
  }

  function syncCartCountFromItems() {
    const total = getCartItems().reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0);
    try {
      localStorage.setItem(CART_KEY, String(total));
    } catch {
      /* ignore */
    }
    window.TasfulMarketHeader?.updateCartBadge?.();
    window.dispatchEvent(new Event("tasful-market-cart-updated"));
  }

  function getCartItems() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_ITEMS_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .map((item) => ({
          shopId: String(item?.shopId || "").trim(),
          productId: String(item?.productId || "").trim(),
          qty: Math.max(1, Math.min(99, Number(item?.qty) || 1)),
          title: String(item?.title || "").trim(),
          price: String(item?.price || "").trim(),
          image: String(item?.image || "").trim(),
          shopName: String(item?.shopName || "").trim(),
          conditionLabel: String(item?.conditionLabel || "").trim(),
          connectVerified: Boolean(item?.connectVerified),
          freeShipping: item?.freeShipping !== false,
        }))
        .filter((item) => item.shopId && item.productId);
    } catch {
      return [];
    }
  }

  function productFromCartSnapshot(item) {
    return enrichProductImage({
      id: `${item.shopId}::${item.productId}`,
      shopId: item.shopId,
      productId: item.productId,
      title: item.title || "商品",
      price: item.price || "¥—",
      priceYen: parsePriceYen(item.price),
      image: item.image,
      shopName: item.shopName || "出品者",
      conditionLabel: item.conditionLabel || "新品",
      connectVerified: item.connectVerified,
      freeShipping: item.freeShipping !== false,
      delivery_method: item.delivery_method || "",
      shipping_estimate: item.shipping_estimate || "",
      shipping_fee: item.shipping_fee || "",
      handoff_method: item.handoff_method || "",
      return_policy: item.return_policy || "",
    });
  }

  function addCartLineItem(line) {
    const shopId = String(line?.shopId || "").trim();
    const productId = String(line?.productId || "").trim();
    const addQty = Math.max(1, Math.min(99, Number(line?.qty) || 1));
    if (!shopId || !productId) return;
    const items = getCartItems();
    const existing = items.find((item) => item.shopId === shopId && item.productId === productId);
    const snapshot = {
      title: String(line?.title || "").trim(),
      price: String(line?.price || "").trim(),
      image: resolvePrimaryImage({
        shopId,
        productId,
        title: line?.title,
        image: line?.image,
      }),
      shopName: String(line?.shopName || "").trim(),
      conditionLabel: String(line?.conditionLabel || "").trim(),
      connectVerified: Boolean(line?.connectVerified),
      freeShipping: line?.freeShipping !== false,
      delivery_method: String(line?.delivery_method || "").trim(),
      shipping_estimate: String(line?.shipping_estimate || "").trim(),
      shipping_fee: String(line?.shipping_fee || "").trim(),
      handoff_method: String(line?.handoff_method || "").trim(),
      return_policy: String(line?.return_policy || "").trim(),
    };
    if (existing) {
      existing.qty = Math.min(99, existing.qty + addQty);
      Object.assign(existing, Object.fromEntries(Object.entries(snapshot).filter(([, v]) => v !== "" && v !== false)));
    } else {
      items.push({ shopId, productId, qty: addQty, ...snapshot });
    }
    try {
      localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
    syncCartCountFromItems();
  }

  function clearCart() {
    try {
      localStorage.setItem(CART_ITEMS_KEY, "[]");
      localStorage.setItem(CART_KEY, "0");
    } catch {
      /* ignore */
    }
    window.TasfulMarketHeader?.updateCartBadge?.();
    window.dispatchEvent(new Event("tasful-market-cart-updated"));
  }

  function removeCartLineItem(shopId, productId) {
    const sid = String(shopId || "").trim();
    const pid = String(productId || "").trim();
    if (!sid || !pid) return false;
    const items = getCartItems();
    const next = items.filter((item) => !(item.shopId === sid && item.productId === pid));
    if (next.length === items.length) return false;
    try {
      localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
    syncCartCountFromItems();
    return true;
  }

  function materializeLegacyCartItems(pool) {
    if (getCartItems().length) return;
    const count = Math.max(0, Number(localStorage.getItem(CART_KEY)) || 0);
    if (!count || !Array.isArray(pool) || !pool.length) return;
    const picked = pool
      .filter((p) => !String(p.id).includes("::dup-") && productHasDisplayImage(p))
      .slice(0, Math.min(count, 5));
    if (!picked.length) return;
    const items = picked.map((product) => ({
      shopId: String(product.shopId || "").trim(),
      productId: String(product.productId || "").trim(),
      qty: 1,
      title: String(product.title || "").trim(),
      price: String(product.price || "").trim(),
      image: resolvePrimaryImage(product),
      shopName: String(product.shopName || "").trim(),
      conditionLabel: String(product.conditionLabel || "新品").trim(),
      connectVerified: Boolean(product.connectVerified),
      freeShipping: product.freeShipping !== false,
    }));
    const lineQty = items.reduce((sum, item) => sum + item.qty, 0);
    if (count > lineQty && items[0]) items[0].qty += count - lineQty;
    try {
      localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
    } catch {
      return;
    }
    syncCartCountFromItems();
  }

  function saveLastOrder(order) {
    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }

  function getLastOrder() {
    try {
      const raw = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null");
      return raw && typeof raw === "object" ? raw : null;
    } catch {
      return null;
    }
  }

  function normalizeHistoryEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const orderId = String(raw.orderId || raw.id || "").trim();
    if (!orderId) return null;
    const quantity = Math.max(1, Number(raw.quantity || raw.qty) || 1);
    const price = Math.max(0, Number(raw.price || raw.unitPrice) || 0);
    const subtotalRaw = Number(raw.subtotal);
    const subtotal = subtotalRaw > 0 ? subtotalRaw : price * quantity;
    const paymentRaw = String(raw.paymentMethod || raw.payment || PAYMENT_LABELS.card);
    const paymentMethod = PAYMENT_LABELS[paymentRaw] || paymentRaw;
    return {
      orderId,
      createdAt: String(raw.createdAt || new Date().toISOString()),
      shopId: String(raw.shopId || "").trim(),
      productId: String(raw.productId || "").trim(),
      productName: String(raw.productName || raw.title || "商品").trim(),
      productImage: resolvePrimaryImage({
        shopId: raw.shopId,
        productId: raw.productId,
        title: raw.productName || raw.title,
        productName: raw.productName || raw.title,
        image: raw.productImage || raw.image,
      }),
      quantity,
      price,
      subtotal,
      paymentMethod,
      sellerName: String(raw.sellerName || raw.shopName || "出品者").trim(),
      connectVerified: Boolean(raw.connectVerified),
      status: String(raw.status || "注文受付"),
      orderTotal: Math.max(0, Number(raw.orderTotal) || 0),
      address: raw.address || null,
      channel: String(raw.channel || "").trim(),
    };
  }

  function getOrderHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(ORDER_HISTORY_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .map(normalizeHistoryEntry)
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  function appendOrderHistory(order) {
    if (!order || !Array.isArray(order.lines) || !order.lines.length) return [];
    const orderId = String(order.id || order.orderId || "").trim();
    if (!orderId) return [];
    const createdAt = String(order.createdAt || new Date().toISOString());
    const paymentMethod = PAYMENT_LABELS[order.payment] || String(order.paymentMethod || PAYMENT_LABELS.card);
    const status = "注文受付";
    const orderTotal = Math.max(0, Number(order.totals?.total) || 0);
    const address = order.address || null;

    const entries = order.lines.map((line) => {
      const qty = Math.max(1, Number(line.qty || line.quantity) || 1);
      const price = Math.max(0, Number(line.unitPrice || line.price) || 0);
      return normalizeHistoryEntry({
        orderId,
        createdAt,
        shopId: line.shopId,
        productId: line.productId,
        productName: line.title || line.productName,
        productImage: resolvePrimaryImage({
          shopId: line.shopId,
          productId: line.productId,
          title: line.title || line.productName,
          image: line.image || line.productImage,
        }),
        quantity: qty,
        price,
        subtotal: price * qty,
        paymentMethod,
        sellerName: line.shopName || line.sellerName,
        connectVerified: line.connectVerified,
        status,
        orderTotal,
        address,
        channel: String(order.channel || "").trim(),
      });
    }).filter(Boolean);

    const history = getOrderHistory();
    try {
      localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([...entries, ...history]));
    } catch {
      /* ignore */
    }
    return entries;
  }

  function saveOrderHistoryRaw(entries) {
    try {
      localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(entries));
    } catch {
      /* ignore */
    }
  }

  function updateOrderStatus(orderId, productId, status) {
    const oid = String(orderId || "").trim();
    const pid = String(productId || "").trim();
    if (!oid || !ORDER_STATUSES.includes(status)) return false;
    try {
      const raw = JSON.parse(localStorage.getItem(ORDER_HISTORY_KEY) || "[]");
      if (!Array.isArray(raw)) return false;
      let updated = false;
      const next = raw.map((item) => {
        const itemOid = String(item.orderId || item.id || "").trim();
        const itemPid = String(item.productId || "").trim();
        if (itemOid === oid && (!pid || itemPid === pid)) {
          updated = true;
          return { ...item, status };
        }
        return item;
      });
      if (updated) saveOrderHistoryRaw(next);
      if (updated && status === "キャンセル") {
        const entry = next.find((item) => {
          const itemOid = String(item.orderId || item.id || "").trim();
          const itemPid = String(item.productId || "").trim();
          return itemOid === oid && (!pid || itemPid === pid);
        });
        try {
          window.TasuMarketEventStore?.recordOrderCancelled?.(entry);
        } catch {
          /* ignore */
        }
      }
      return updated;
    } catch {
      return false;
    }
  }

  function findOrderHistoryEntry(orderId, productId) {
    const oid = String(orderId || "").trim();
    const pid = String(productId || "").trim();
    if (!oid) return null;
    return (
      getOrderHistory().find((entry) => {
        if (entry.orderId !== oid) return false;
        if (pid && entry.productId !== pid) return false;
        return true;
      }) || null
    );
  }

  function resetOrderStatus(orderId, productId, status = "注文受付") {
    const target = ORDER_STATUSES.includes(status) ? status : "注文受付";
    return updateOrderStatus(orderId, productId, target);
  }

  function ensureSellerOrderEntry(seed) {
    const shopId = String(seed?.shopId || "").trim();
    const productId = String(seed?.productId || "").trim();
    const orderId = String(seed?.orderId || "").trim();
    if (!shopId || !productId || !orderId) return null;

    const existing = findOrderHistoryEntry(orderId, productId);
    if (existing) {
      resetOrderStatus(orderId, productId, seed?.status || "注文受付");
      return findOrderHistoryEntry(orderId, productId);
    }

    const entry = normalizeHistoryEntry({
      orderId,
      createdAt: seed?.createdAt || new Date().toISOString(),
      shopId,
      productId,
      productName: seed?.productName || seed?.title || "テスト商品",
      productImage: seed?.productImage || seed?.image || "",
      quantity: Math.max(1, Number(seed?.quantity) || 1),
      price: Math.max(0, Number(seed?.price) || 480),
      subtotal: Math.max(0, Number(seed?.subtotal) || Number(seed?.price) || 480),
      paymentMethod: seed?.paymentMethod || PAYMENT_LABELS.card,
      sellerName: seed?.sellerName || seed?.shopName || "TASFUL Bakery",
      connectVerified: Boolean(seed?.connectVerified),
      status: seed?.status || "注文受付",
      orderTotal: Math.max(0, Number(seed?.orderTotal) || Number(seed?.subtotal) || 480),
      address: seed?.address || {
        name: "山田 太郎",
        phone: "090-1234-5678",
        zip: "154-0024",
        address: "東京都世田谷区三軒茶屋1-2-3",
      },
    });
    if (!entry) return null;

    const history = getOrderHistory();
    saveOrderHistoryRaw([entry, ...history.filter((h) => !(h.orderId === orderId && h.productId === productId))]);
    return findOrderHistoryEntry(orderId, productId);
  }

  function getSellerOrders(shopId) {
    const sid = String(shopId || "").trim();
    if (!sid) return [];
    return getOrderHistory().filter((entry) => entry.shopId === sid);
  }

  function getProductsByShop(pool, shopId) {
    const sid = String(shopId || "").trim();
    const fromPool = (pool || []).filter((p) => p.shopId === sid && !String(p.id).includes("::dup-"));
    const sellerOnly = getSellerProductsByShop(sid)
      .filter((entry) => entry.moderation_status === "approved" && entry.publish_status === "public")
      .map(sellerListingToProduct)
      .filter(Boolean)
      .map(enrichProductImage);
    const seen = new Set(fromPool.map((p) => p.id));
    sellerOnly.forEach((p) => {
      if (!seen.has(p.id)) fromPool.unshift(p);
    });
    return fromPool;
  }

  function getSellerProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(SELLER_PROFILE_KEY) || "null");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function saveSellerProfile(profile) {
    try {
      localStorage.setItem(SELLER_PROFILE_KEY, JSON.stringify(profile || {}));
    } catch {
      /* ignore */
    }
  }

  function getDefaultSellerShopId() {
    return String(getSellerProfile().shopId || DEFAULT_SELLER_SHOP_ID).trim() || DEFAULT_SELLER_SHOP_ID;
  }

  function getSellerProducts() {
    try {
      const raw = JSON.parse(localStorage.getItem(SELLER_PRODUCTS_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveSellerProducts(list) {
    try {
      localStorage.setItem(SELLER_PRODUCTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch {
      /* ignore */
    }
  }

  function getSellerProductsByShop(shopId) {
    const sid = String(shopId || "").trim();
    if (!sid) return [];
    return getSellerProducts().filter((entry) => String(entry.shopId || "").trim() === sid);
  }

  function listingCategoryLabel(categoryId) {
    return LISTING_CATEGORIES.find((c) => c.id === categoryId)?.label || String(categoryId || "").trim();
  }

  function shipDaysFromKey(key) {
    return SHIP_DAYS_OPTIONS.find((o) => o.id === key)?.label || String(key || "").trim();
  }

  function sellerListingToProduct(entry) {
    if (!entry) return null;
    const imageUrl = normalizeImageUrl(entry.image || entry.imageUrl || "");
    if (!String(entry.image || entry.imageUrl || "").trim() || !isUsableImageUrl(imageUrl)) return null;

    const shopId = String(entry.shopId || "").trim();
    const productId = String(entry.productId || "").trim();
    if (!shopId || !productId || !String(entry.title || "").trim()) return null;

    const product = {
      id: entry.id || `${shopId}::${productId}`,
      shopId,
      productId,
      title: String(entry.title || "").trim(),
      price: entry.price || formatYenAmount(entry.priceYen),
      priceYen: Number(entry.priceYen) || parsePriceYen(entry.price) || 0,
      image: imageUrl,
      hasImage: true,
      shopName: entry.shopName || entry.sellerName || "出品者",
      connectVerified: Boolean(entry.connectVerified),
      freeShipping: Boolean(entry.freeShipping),
      shipDays: entry.shipDays || shipDaysFromKey(entry.shipDaysKey),
      conditionType: entry.conditionType || "new",
      conditionLabel: entry.conditionLabel || resolveConditionLabel(entry.conditionType),
      categoryBlob: entry.categoryBlob || listingCategoryLabel(entry.category),
      description: entry.description || "",
      stock: Math.max(0, Number(entry.stock) || 0),
      gallery: Array.isArray(entry.subImages) ? entry.subImages : entry.gallery || [],
      ratingScore: Number(entry.ratingScore) || 4.5,
      reviewCount: Number(entry.reviewCount) || 0,
      createdAt: entry.createdAt || entry.publishedAt || new Date().toISOString(),
      featured: false,
      inStock: Math.max(0, Number(entry.stock) || 0) > 0,
      isSellerListed: true,
      taxIncluded: entry.taxIncluded !== false,
    };
    return enrichProductImage(product);
  }

  function validateListingInput(input) {
    const errors = [];
    const title = String(input?.title || "").trim();
    if (!title) errors.push("商品名を入力してください");
    if (!String(input?.category || "").trim()) errors.push("商品カテゴリを選択してください");
    if (!String(input?.conditionType || "").trim()) errors.push("商品状態を選択してください");
    const priceYen = Number(input?.priceYen);
    if (!Number.isFinite(priceYen) || priceYen <= 0) errors.push("価格を正しく入力してください");
    const imageUrl = normalizeImageUrl(input?.imageUrl || "");
    if (!String(input?.imageUrl || "").trim()) errors.push("商品画像URLを入力してください");
    else if (!isUsableImageUrl(imageUrl)) errors.push("商品画像URLが不正です");
    else if (isBrokenImageUrl(imageUrl)) errors.push("商品画像URLが利用できません");
    if (!String(input?.sellerName || "").trim()) errors.push("出品者名を入力してください");
    if (!String(input?.shipDaysKey || "").trim()) errors.push("発送目安を選択してください");
    const stock = Number(input?.stock);
    if (!Number.isFinite(stock) || stock < 0) errors.push("在庫数を正しく入力してください");
    return errors;
  }

  function publishSellerProduct(input) {
    const errors = validateListingInput(input);
    if (errors.length) return { ok: false, errors };

    const Gate = window.TasuPlatformContentGate;
    if (Gate?.applyShopPublishGate) {
      const gate = Gate.applyShopPublishGate(input);
      if (!gate.ok) return { ok: false, errors: gate.errors || [gate.error || "審査で拒否されました"] };
      input = gate.entry;
    }

    const profile = getSellerProfile();
    const shopId = String(input.shopId || profile.shopId || DEFAULT_SELLER_SHOP_ID).trim();
    const shopName = String(input.sellerName || profile.shopName || "マイショップ").trim();
    const productId = String(input.productId || `sl-${Date.now().toString(36)}`).trim();
    const imageUrl = normalizeImageUrl(input.imageUrl);
    const subImages = (Array.isArray(input.subImages) ? input.subImages : [])
      .map((url) => normalizeImageUrl(url))
      .filter((url) => isUsableImageUrl(url) && !isBrokenImageUrl(url))
      .slice(0, 5);
    const priceYen = Number(input.priceYen);
    const taxIncluded = input.taxIncluded !== false;
    const price = taxIncluded ? `${formatYenAmount(priceYen)}（税込）` : formatYenAmount(priceYen);
    const shipDays = shipDaysFromKey(input.shipDaysKey);

    const entry = {
      id: `${shopId}::${productId}`,
      shopId,
      productId,
      title: String(input.title).trim(),
      category: input.category,
      categoryBlob: listingCategoryLabel(input.category),
      conditionType: input.conditionType,
      conditionLabel: resolveConditionLabel(input.conditionType),
      description: String(input.description || "").trim(),
      price,
      priceYen,
      taxIncluded,
      freeShipping: Boolean(input.freeShipping),
      shipDaysKey: input.shipDaysKey,
      shipDays,
      stock: Math.max(0, Number(input.stock) || 0),
      image: imageUrl,
      imageUrl,
      subImages,
      gallery: [imageUrl, ...subImages],
      sellerName: shopName,
      shopName,
      connectVerified: Boolean(input.connectVerified),
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      moderation_status: input.moderation_status || "pending_review",
      publish_status: input.publish_status || "pending_review",
      moderation_flags: input.moderation_flags || [],
      moderation_reason: input.moderation_reason || null,
      isProductionListed: false,
      _demoOnly: input._demoOnly === true,
    };

    const list = getSellerProducts();
    list.unshift(entry);
    saveSellerProducts(list);
    saveSellerProfile({ shopId, shopName, connectVerified: entry.connectVerified });
    invalidateProductPoolCache();
    window.TasuPlatformModerationQueue?.trackLocalListing?.(
      { ...entry, id: entry.id, title: entry.title, user_id: shopId, table: "shop_local" },
      "shop_local"
    );
    return { ok: true, entry, product: sellerListingToProduct(entry), pending: true };
  }

  function listingNewHref(shopId) {
    const sid = String(shopId || getDefaultSellerShopId()).trim();
    return `shop-market-listing-new.html?shopId=${encodeURIComponent(sid)}`;
  }

  function getFavoriteProducts(pool) {
    const snapshots = getFavoriteItemSnapshots();
    const ids = new Set(getFavorites());
    const out = [];
    const seen = new Set();

    snapshots.forEach((item) => {
      if (!ids.has(item.id) || seen.has(item.id)) return;
      seen.add(item.id);
      out.push(recentItemToProduct(item) || enrichProductImage(findProduct(pool, item.shopId, item.productId)));
    });

    ids.forEach((id) => {
      if (seen.has(id)) return;
      let product = findProductById(pool, id);
      if (!product && String(id).includes("::")) {
        const parts = String(id).split("::");
        const productId = parts[parts.length - 1];
        const shopId = parts.slice(0, -1).join("::");
        product = findProduct(pool, shopId, productId);
      }
      if (product) {
        seen.add(id);
        out.push(enrichProductImage(product));
      }
    });

    return out.filter(Boolean);
  }

  function getFollowedShopIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(FOLLOW_SHOPS_KEY) || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch {
      return [];
    }
  }

  function getFollowedShops(pool) {
    const ids = new Set(getFollowedShopIds());
    if (!ids.size) return [];
    const shops = new Map();
    (pool || []).forEach((product) => {
      if (!ids.has(String(product.shopId))) return;
      if (!shops.has(product.shopId)) {
        shops.set(product.shopId, {
          shopId: product.shopId,
          shopName: product.shopName,
          connectVerified: product.connectVerified,
          productCount: 0,
          sampleImage: resolvePrimaryImage(product),
        });
      }
      const shop = shops.get(product.shopId);
      shop.productCount += 1;
    });
    return [...shops.values()];
  }

  function sellerPageHref(shopId) {
    return `shop-market-seller.html?shopId=${encodeURIComponent(shopId || "")}`;
  }

  function shopStoreDetailHref(shopId) {
    return `detail-shop-store.html?id=${encodeURIComponent(shopId || "")}`;
  }

  function resolveSellerPageHref(product) {
    const shopId = String(product?.shopId || "").trim();
    if (typeof document !== "undefined" && document.body?.dataset?.page === "shop_market_product") {
      return shopStoreDetailHref(shopId);
    }
    return sellerPageHref(shopId);
  }

  function sellerProductsPageHref(shopId) {
    const sid = String(shopId || getDefaultSellerShopId()).trim();
    return `shop-market-seller-products.html?shopId=${encodeURIComponent(sid)}`;
  }

  function formatOrderDateTime(iso) {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function paymentLabelFromValue(value) {
    return PAYMENT_LABELS[value] || String(value || PAYMENT_LABELS.card);
  }

  function incrementCartCount(qty, lineItem) {
    const n = Math.max(1, Math.min(99, Number(qty) || 1));
    if (lineItem?.shopId && lineItem?.productId) {
      addCartLineItem({ ...lineItem, qty: n });
      return;
    }
    try {
      const cur = Number(localStorage.getItem(CART_KEY)) || 0;
      localStorage.setItem(CART_KEY, String(cur + n));
    } catch {
      /* ignore */
    }
    window.TasfulMarketHeader?.updateCartBadge?.();
    window.dispatchEvent(new Event("tasful-market-cart-updated"));
  }

  function formatYenAmount(amount) {
    const n = Math.max(0, Math.round(Number(amount) || 0));
    return `¥${n.toLocaleString("ja-JP")}`;
  }

  function resolveLineUnitPrice(product) {
    return product?.priceYen || parsePriceYen(product?.price) || 0;
  }

  function buildCheckoutLinesFromCart(pool) {
    const items = getCartItems();
    const lines = items
      .map((item) => {
        let product = findProduct(pool, item.shopId, item.productId);
        if (!product && item.title) product = productFromCartSnapshot(item);
        if (!product) return null;
        return { product: enrichProductImage(product), qty: item.qty };
      })
      .filter(Boolean);
    if (lines.length) return lines;

    const count = Math.max(0, Number(localStorage.getItem(CART_KEY)) || 0);
    if (!count) return [];
    return pool
      .filter((p) => !String(p.id).includes("::dup-") && productHasDisplayImage(p))
      .slice(0, Math.min(count, 5))
      .map((product) => ({ product: enrichProductImage(product), qty: 1 }));
  }

  function buildCheckoutLinesBuyNow(pool, shopId, productId, quantity) {
    const product = enrichProductImage(findProduct(pool, shopId, productId));
    if (!product) return [];
    const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
    return [{ product, qty }];
  }

  function calculateCheckoutTotals(lines) {
    let subtotal = 0;
    lines.forEach(({ product, qty }) => {
      subtotal += resolveLineUnitPrice(product) * Math.max(1, Number(qty) || 1);
    });
    const allFreeShipping = lines.length > 0 && lines.every(({ product }) => product.freeShipping);
    const shipping = allFreeShipping ? 0 : 500;
    const fee = 0;
    return { subtotal, shipping, fee, total: subtotal + shipping + fee };
  }

  function getFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch {
      return [];
    }
  }

  function isFavorite(productId) {
    return getFavorites().includes(String(productId || "").trim());
  }

  function toggleFavorite(productId, product) {
    const key = String(productId || "").trim();
    if (!key) return false;
    const set = new Set(getFavorites());
    const saved = set.has(key);
    if (saved) set.delete(key);
    else set.add(key);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
    if (saved) removeFavoriteItemSnapshot(key);
    else if (product) pushFavoriteItemSnapshot(product);
    return !saved;
  }

  window.TasfulMarketProductData = {
    CART_KEY,
    CART_ITEMS_KEY,
    LAST_ORDER_KEY,
    ORDER_HISTORY_KEY,
    PAYMENT_LABELS,
    FAVORITES_KEY,
    RECENT_KEY,
    RECENT_ITEMS_KEY,
    FAVORITE_ITEMS_KEY,
    FOLLOW_SHOPS_KEY,
    SELLER_PRODUCTS_KEY,
    SELLER_PROFILE_KEY,
    DEFAULT_SELLER_SHOP_ID,
    LISTING_CATEGORIES,
    SHIP_DAYS_OPTIONS,
    ORDER_STATUSES,
    CONDITION_TYPES,
    CATEGORY_FILTERS,
    DEMO_CATALOG,
    esc,
    escAttr,
    fetchShopListings,
    flattenProducts,
    buildProductPool,
    loadProductPool,
    invalidateProductPoolCache,
    findProduct,
    findProductById,
    productHref,
    formatRating,
    formatPriceDisplay,
    formatMiniPrice,
    parsePriceYen,
    normalizePriceBase,
    resolveConditionLabel,
    buildConditionHtml,
    resolveProductImageFields,
    normalizeImageUrl,
    isUsableImageUrl,
    getFallbackImageUrl,
    resolvePrimaryImage,
    productImageOnErrorAttr,
    productLookupKey,
    enrichProductImage,
    productHasDisplayImage,
    isSameDayShipping,
    pickRecommendFillProduct,
    getCartCrossSellProducts,
    buildMiniCardPlaceholder,
    pickShelfProducts,
    buildMiniCardHtml,
    buildGridCardHtml,
    pushRecentProduct,
    pushRecentItem,
    getRecentItems,
    getRecentItemProducts,
    getRecentProducts,
    getRelatedProducts,
    getFrequentlyBoughtTogether,
    resolveCategoryDisplay,
    resolveCategoryFamily,
    getBrowsedProducts,
    buildAboutBullets,
    buildProductFeatureBullets,
    buildDescriptionSections,
    normalizeDescriptionSections,
    buildShippingDetail,
    buildSpecRows,
    buildSampleReviews,
    getProductGallery,
    getProductThumbnails,
    buildRecommendPoints,
    buildSellerProfile,
    formatStarDisplay,
    formatReviewScore,
    incrementCartCount,
    getCartItems,
    addCartLineItem,
    removeCartLineItem,
    materializeLegacyCartItems,
    clearCart,
    saveLastOrder,
    getLastOrder,
    getOrderHistory,
    appendOrderHistory,
    updateOrderStatus,
    findOrderHistoryEntry,
    resetOrderStatus,
    ensureSellerOrderEntry,
    getSellerOrders,
    getProductsByShop,
    getSellerProfile,
    saveSellerProfile,
    getDefaultSellerShopId,
    getSellerProducts,
    saveSellerProducts,
    getSellerProductsByShop,
    sellerListingToProduct,
    validateListingInput,
    publishSellerProduct,
    listingNewHref,
    listingCategoryLabel,
    shipDaysFromKey,
    getFavoriteProducts,
    getFollowedShopIds,
    getFollowedShops,
    sellerPageHref,
    shopStoreDetailHref,
    resolveSellerPageHref,
    flattenShopProductsFiller,
    sellerProductsPageHref,
    formatOrderDateTime,
    paymentLabelFromValue,
    syncCartCountFromItems,
    formatYenAmount,
    resolveLineUnitPrice,
    buildCheckoutLinesFromCart,
    buildCheckoutLinesBuyNow,
    calculateCheckoutTotals,
    getFavorites,
    isFavorite,
    toggleFavorite,
    seedFromProduct,
  };
})();

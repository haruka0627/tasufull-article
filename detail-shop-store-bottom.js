/**
 * detail-shop.html — shop_store 専用 renderer
 * カテゴリ設定は shop-detail-category.js（TasuShopDetailCategory）
 */
(function () {
  "use strict";

  const pageGlobal = typeof globalThis !== "undefined" ? globalThis : window;
  const IS_FILE_PROTOCOL = pageGlobal.location?.protocol === "file:";

  if (IS_FILE_PROTOCOL && pageGlobal.self !== pageGlobal.top) {
    return;
  }

  function shopLogWarn(...args) {
    console.warn("[detail-shop]", ...args);
  }

  function shopLogError(...args) {
    if (IS_FILE_PROTOCOL) {
      console.warn("[detail-shop]", ...args);
      return;
    }
    console.error("[detail-shop]", ...args);
  }

  function buildShopAiConsultHref(listing) {
    if (pageGlobal.TasuAiWorkspaceLinks?.buildListingConsultUrl) {
      return pageGlobal.TasuAiWorkspaceLinks.buildListingConsultUrl(listing);
    }
    const id = String(listing?.id || "").trim();
    return id
      ? `ai-workspace.html?mode=cross-matching&listingId=${encodeURIComponent(id)}`
      : "ai-workspace.html?mode=cross-matching";
  }

  const SELECTORS = {
    root: "[data-biz-detail-root]",
    status: "[data-listing-detail-status]",
    breadcrumb: "[data-breadcrumb]",
    title: "[data-biz-detail-title]",
    company: "[data-biz-detail-company]",
    lead: "[data-biz-detail-hero-lead]",
    genreTags: "[data-biz-detail-hero-genre-tags]",
    conditionTags: "[data-biz-detail-hero-condition-tags]",
    quick: "[data-biz-detail-hero-quick]",
    heroRatingRow: "[data-biz-detail-hero-rating-row]",
    heroRatingStars: "[data-biz-detail-hero-rating-stars]",
    heroRatingScore: "[data-biz-detail-hero-rating-score]",
    heroRatingCount: "[data-biz-detail-hero-rating-count]",
    heroImg: "[data-biz-detail-hero-img]",
    thumbs: "[data-biz-detail-gallery]",
    restaurantCtas: "[data-shop-restaurant-ctas]",
    restaurantPoints: "[data-shop-restaurant-points]",
    restaurantTabs: "[data-shop-restaurant-tabs]",
    restaurantBody: "[data-shop-restaurant-body]",
    restaurantSidebar: "[data-shop-restaurant-sidebar]",
    sidebarRatingWrap: "[data-biz-detail-sidebar-rating]",
    sidebarRatingStars: "[data-biz-detail-sidebar-rating-stars]",
    sidebarRatingScore: "[data-biz-detail-sidebar-rating-score]",
    sidebarRatingCount: "[data-biz-detail-sidebar-rating-count]",
    sidebarPrice: "[data-biz-detail-sidebar-price]",
    sidebarActions: "[data-biz-detail-sidebar-actions]",
    favoriteBtn: "[data-biz-detail-favorite]",
    stickyBar: "[data-biz-detail-sticky-bar]",
    stickyAi: "[data-biz-detail-sticky-ai]",
    stickyInquiry: "[data-biz-detail-sticky-inquiry]",
    stickyEstimate: "[data-biz-detail-sticky-estimate]",
    actionNav: "[data-shop-sticky-action-nav]",
    actionNavSpacer: "[data-shop-sticky-action-spacer]",
    actionNavTabs: "[data-shop-sticky-action-tabs]",
    actionNavActions: "[data-shop-sticky-action-actions]",
  };

  const FOOD_DEMO = {
    images: [
      "https://images.unsplash.com/photo-1554118811-1e0d58220f8b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80",
    ],
    menu: [
      { title: "季節のフルーツタルト", price: "¥550", tax: "（税込）", img: "https://images.unsplash.com/photo-1505253213348-cec6a1b7c4b2?auto=format&fit=crop&w=900&q=80" },
      { title: "カフェラテ", price: "¥550", tax: "（税込）", img: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80" },
      { title: "伝統的プリン", price: "¥600", tax: "（税込）", img: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=900&q=80" },
      { title: "本日のコーヒー", price: "¥450", tax: "（税込）", img: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80" },
    ],
    reviews: [
      {
        name: "ゆかりさん",
        rating: 5,
        date: "2024/09/12",
        text: "コーヒーが本当に美味しい！店内の雰囲気も落ち着いていて、つい長居してしまいます。スイーツも全部手作りで、また来たいと思えるカフェです。",
      },
      {
        name: "S.K.",
        rating: 4,
        date: "2024/08/03",
        text: "ラテが安定して美味しいです。店内が静かで作業もしやすく、スタッフさんも丁寧でした。",
      },
      {
        name: "たくみ",
        rating: 5,
        date: "2024/07/18",
        text: "プリンが想像以上。甘すぎず、コーヒーとの相性が最高でした。席の間隔も広めで居心地が良いです。",
      },
    ],
    distribution: [
      { stars: 5, count: 123, label: "123件" },
      { stars: 4, count: 35, label: "35件" },
      { stars: 3, count: 9, label: "9件" },
      { stars: 2, count: 2, label: "2件" },
      { stars: 1, count: 1, label: "1件" },
    ],
    news: [
      { date: "2024/05/20", title: "季節限定スイーツが登場しました" },
      { date: "2024/05/10", title: "テラス席のご予約受付を開始" },
      { date: "2024/05/01", title: "ランチメニューをリニューアル" },
    ],
  };

  const BEAUTY_DEMO = {
    images: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1500840216050-6ffa99d75160?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80",
    ],
    points: ["丁寧なカウンセリング", "髪質改善メニュー", "トレンド提案", "リラックス空間"],
    tags: ["個室あり", "Wi‑Fiあり", "充電器あり", "クレカOK", "メンズ歓迎", "当日予約OK", "ヘアセットOK"],
    menu: [
      { title: "カット＋カラー", duration: "120分", price: "¥12,800〜", img: "" },
      { title: "髪質改善トリートメント", duration: "90分", price: "¥9,900〜", img: "" },
      { title: "ヘッドスパ（30分）", duration: "30分", price: "¥4,400〜", img: "" },
      { title: "前髪カット", duration: "20分", price: "¥1,100〜", img: "" },
    ],
    stylists: [
      {
        name: "山田 絵衣",
        specialty: "似合わせカット / 透明感カラー",
        desc: "丁寧なカウンセリングで、あなたらしさを引き出します。",
        img: "",
      },
      {
        name: "佐藤 美咲",
        specialty: "髪質改善 / ヘッドスパ",
        desc: "毎日の扱いやすさを重視した提案が得意です。",
        img: "",
      },
      {
        name: "鈴木 友紀",
        specialty: "メンズカット / パーマ",
        desc: "清潔感とトレンドを両立したスタイルを。",
        img: "",
      },
    ],
  };

  const RELAX_DEMO = {
    images: [
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=900&q=80",
    ],
    points: ["厳選アロマオイルを使用", "経験豊富なセラピスト", "完全個室のプライベート空間", "心と身体の深いリラクゼーション"],
    tags: ["個室あり", "着替えあり", "アロマ使用", "クレカOK", "男女OK", "当日予約OK", "深夜営業", "ペア利用OK"],
    menu: [
      { title: "アロマオイルトリートメント", duration: "60分", price: "¥7,800", img: "" },
      { title: "ヘッドスパ", duration: "30分", price: "¥3,800", img: "" },
      { title: "リフレクソロジー", duration: "45分", price: "¥5,500", img: "" },
      { title: "ホットストーントリートメント", duration: "90分", price: "¥12,800", img: "" },
    ],
    therapists: [
      { name: "山田 優子", role: "トップセラピスト", specialty: "アロマ / もみほぐし", desc: "お疲れに合わせて、呼吸が深くなるケアを丁寧に。", img: "" },
      { name: "鈴木 美咲", role: "セラピスト", specialty: "ヘッドスパ / リフレ", desc: "首肩のこわばりをゆるめて、すっきり軽い毎日へ。", img: "" },
      { name: "田中 香織", role: "セラピスト", specialty: "ホットストーン / ボディ", desc: "温かい手技で、深いリラックスへ導きます。", img: "" },
    ],
  };

  const VINTAGE_BRAND_DEMO = {
    tags: ["ヴィンテージ", "ブランド古着", "メンズ", "レディース", "買取対応"],
    images: [
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1469334031218-e155a4493b1c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1489987707024-afc025104726?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=80",
    ],
    products: [
      {
        title: "デニムジャケット",
        sub: "90s リーバイス系",
        price: "¥8,800",
        img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "レザーバッグ",
        sub: "ヴィンテージレザー",
        price: "¥12,000",
        img: "https://images.unsplash.com/photo-1489987707024-afc025104726?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "スウェット",
        sub: "USA製カレッジ",
        price: "¥4,200",
        img: "https://images.unsplash.com/photo-1469334031218-e155a4493b1c?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "スニーカー",
        sub: "90s ランニング",
        price: "¥9,800",
        img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    news: [
      { date: "2024/05/18", title: "週末入荷：90s デニム・スウェット大量追加" },
      { date: "2024/05/08", title: "買取強化キャンペーン実施中" },
    ],
  };

  const RETAIL_DEMO = {
    images: [
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=80",
    ],
    products: [
      {
        title: "アロマキャンドル",
        sub: "リラックスできる香り",
        price: "¥2,200",
        img: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "北欧デザインマグカップ",
        sub: "やさしい色合いが人気",
        price: "¥1,430",
        img: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "ウッドトレー",
        sub: "天然木のぬくもり",
        price: "¥2,750",
        img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "ドライフラワーブーケ",
        sub: "ギフトにおすすめ",
        price: "¥3,300",
        img: "https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    news: [
      { date: "2024/05/20", title: "新商品入荷のお知らせ" },
      { date: "2024/05/10", title: "5月限定：ギフトラッピング無料キャンペーン" },
      { date: "2024/05/01", title: "オンラインショップに新色を追加しました" },
    ],
  };

  /** 雑貨・インテリア専用デモ（TOP・商品・店内・口コミ等） */
  const GOODS_INTERIOR_DEMO = {
    top: {
      shopName: "TASFUL 雑貨店",
      storeType: "雑貨・インテリア",
      description:
        "暮らしを彩るインテリア雑貨や生活小物を集めたセレクトショップです。ギフトにも使いやすいアイテムを中心に、毎日の生活が少し楽しくなる商品を揃えています。",
      area: "大阪府 大阪市北区",
      address: "大阪府大阪市北区梅田2-2-2 TASFULビル 1F",
      station: "大阪駅から徒歩8分",
      hours: "10:00〜20:00",
      phone: "06-6347-0000",
      email: "shop@tasful.example",
      rating: 4.7,
      reviewCount: 128,
    },
    tags: [
      "ギフト対応",
      "電子マネーOK",
      "クレカOK",
      "駐車場あり",
      "オンラインショップあり",
      "ラッピング対応",
    ],
    images: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1556906784-6f2b2c7a3e3b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1555529669-e69e7a0ba4b6?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1528697203043-733bfd65a4ec?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1490750967868-88e4481c4b7b?auto=format&fit=crop&w=1200&q=80",
    ],
    products: [
      {
        title: "アロマキャンドル",
        sub: "リラックスできる香り",
        price: "¥2,200（税込）",
        img: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "北欧デザインマグカップ",
        sub: "やさしい色合いが人気",
        price: "¥1,430（税込）",
        img: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "ウッドトレー",
        sub: "天然木の温もり",
        price: "¥2,750（税込）",
        img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
      },
      {
        title: "ドライフラワーブーケ",
        sub: "ギフトにおすすめ",
        price: "¥3,300（税込）",
        img: "https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    news: [
      { date: "2024/05/20", title: "新商品入荷のお知らせ" },
      { date: "2024/05/10", title: "ギフトラッピング無料キャンペーン" },
      { date: "2024/05/01", title: "オンラインショップに新商品を追加しました" },
    ],
    reviews: [
      {
        name: "M.K.",
        meta: "30代 / 女性",
        date: "2024/05/18",
        text: "素敵な雑貨がたくさんあり、プレゼント選びにも使いやすいお店でした。",
      },
      {
        name: "T.S.",
        meta: "40代 / 男性",
        date: "2024/05/12",
        text: "店内の雰囲気が良く、スタッフさんの対応も丁寧でした。また利用したいです。",
      },
    ],
  };

  const SECTION_IDS = {
    overview: "section-shop-overview",
    handling: "section-shop-handling-info",
    products: "section-products",
    cases: "section-shop-cases",
    highlights: "section-shop-highlights",
    bottom: "section-shop-bottom",
    reviews: "section-reviews",
    faq: "section-faq",
  };

  function isShopOtherCategory(cfg, listing) {
    if (listing && window.TasuShopDetailCategory?.isShopOtherListing) {
      return window.TasuShopDetailCategory.isShopOtherListing(listing);
    }
    return String(cfg?.categoryKey || "").trim() === "other";
  }

  function shopStoreDataHelpers(listing) {
    const store = window.TasuListingLocalStore;
    return {
      hasProducts: store?.hasShopProductData?.(listing) || false,
      hasAccess: store?.hasShopAccessData?.(listing) || false,
      hasReviews: store?.hasShopReviewData?.(listing) || false,
      hasHandling: store?.hasShopHandlingInfo?.(listing) || false,
      priceLabel: store?.resolveShopPriceLabel?.(listing) || "要相談",
    };
  }

  function pickHandlingInfo(listing) {
    return listing?.handlingInfo || listing?.handling_info || {};
  }

  function hideShopSectionElement(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.classList.add("is-hidden", "shop-section--empty");
    el.innerHTML = "";
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
  }

  function hideShopSectionById(id) {
    hideShopSectionElement(document.getElementById(id));
  }

  function showShopSectionElement(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.classList.remove("is-hidden", "shop-section--empty");
    el.style.display = "";
    el.removeAttribute("aria-hidden");
  }

  function getHeroTitleBlockAnchor(main) {
    if (!main) return null;
    const genre = main.querySelector("[data-biz-detail-hero-genre-tags]");
    if (genre && !genre.hidden) {
      const gStyle = window.getComputedStyle(genre);
      if (gStyle.display !== "none" && gStyle.visibility !== "hidden") {
        const gRect = genre.getBoundingClientRect();
        if (gRect.height > 0) return genre;
      }
    }
    const candidates = [
      "[data-biz-detail-title-badges]",
      "[data-biz-detail-title]",
    ];
    for (const sel of candidates) {
      const el = main.querySelector(sel);
      if (!el || el.hidden) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.getBoundingClientRect().height < 1) continue;
      return el;
    }
    return main.querySelector("[data-biz-detail-title]");
  }

  function layoutHeroAsidePoints() {
    const points = qs(SELECTORS.restaurantPoints);
    if (!points || points.hidden) return;
    points.style.transform = "";
    points.style.top = "";
    points.style.position = "";
    if (window.matchMedia("(max-width: 960px)").matches) {
      points.style.marginTop = "";
      return;
    }
    const main = document.querySelector(
      ".shop-hero-main, .biz-detail-fv__main, .shop-detail-main-info"
    );
    const anchor = getHeroTitleBlockAnchor(main);
    if (!anchor) {
      points.style.marginTop = "";
      return;
    }
    const offset = Math.round(
      anchor.getBoundingClientRect().top - points.getBoundingClientRect().top
    );
    const aligned = Math.abs(offset) <= 2;
    if (offset > 2) {
      points.style.marginTop = `${offset}px`;
    } else if (offset < -8) {
      points.style.marginTop = "0";
    } else if (!aligned && offset > 0) {
      points.style.marginTop = `${offset}px`;
    }
    points.dataset.heroLayoutOffset = String(offset);
  }

  let heroAsideLayoutTimer = 0;
  let heroAsideLayoutObserver = null;

  function scheduleHeroAsideLayout() {
    layoutHeroAsidePoints();
    requestAnimationFrame(() => {
      layoutHeroAsidePoints();
      requestAnimationFrame(layoutHeroAsidePoints);
    });
    window.setTimeout(layoutHeroAsidePoints, 80);
    window.setTimeout(layoutHeroAsidePoints, 350);
    window.setTimeout(layoutHeroAsidePoints, 900);
    window.setTimeout(layoutHeroAsidePoints, 1600);
    ensureHeroAsideLayoutObserver();
  }

  function ensureHeroAsideLayoutObserver() {
    const main = document.querySelector(
      ".shop-hero-main, .biz-detail-fv__main, .shop-detail-main-info"
    );
    const points = qs(SELECTORS.restaurantPoints);
    if (!main || main.dataset.heroLayoutWatch === "1") return;
    main.dataset.heroLayoutWatch = "1";
    const run = () => {
      window.clearTimeout(heroAsideLayoutTimer);
      heroAsideLayoutTimer = window.setTimeout(layoutHeroAsidePoints, 32);
    };
    if (typeof ResizeObserver !== "undefined") {
      heroAsideLayoutObserver = new ResizeObserver(run);
      heroAsideLayoutObserver.observe(main);
      const genre = main.querySelector("[data-biz-detail-hero-genre-tags]");
      if (genre) heroAsideLayoutObserver.observe(genre);
      if (points) heroAsideLayoutObserver.observe(points);
    }
    window.addEventListener("load", run, { once: true });
    if (document.fonts?.ready) {
      document.fonts.ready.then(run).catch(() => {});
    }
  }

  function hasMeaningfulSectionContent(el) {
    if (!el || el.hidden) return false;
    if (
      el.querySelector(
        "img, article, .food-menu-card, .shop-prod-card, .shop-case-card, details.shop-faq-item, .food-info-row, .beauty-info-row, .retail-news__item, .food-review-pickup, .food-review-row, .shop-highlights-list__item, .shop-other-handling__row"
      )
    ) {
      return true;
    }
    const title = el.querySelector(
      ".shop-sec__title, .food-sec-title, h2, h3"
    );
    const text = String(el.textContent || "")
      .replace(/\s+/g, "")
      .trim();
    if (!text) return false;
    if (title) {
      const titleText = String(title.textContent || "")
        .replace(/\s+/g, "")
        .trim();
      return text.length > titleText.length + 4;
    }
    return text.length > 8;
  }

  function hideAllShopDetailSections() {
    Object.values(SECTION_IDS).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
      el.classList.add("is-hidden", "shop-section--empty");
    });
  }

  function revealShopSection(el) {
    showShopSectionElement(el);
  }

  /** hideAllShopDetailSections 後に口コミ HTML を入れたら必ず呼ぶ（is-hidden 残留防止） */
  function revealReviewsSectionIfRendered(reviewsRoot) {
    if (!reviewsRoot || !String(reviewsRoot.innerHTML || "").trim()) return;
    revealShopSection(reviewsRoot);
  }

  function canUseShopOtherDemoFallback(id, explicit) {
    const key = String(id || "").trim();
    const loader = pageGlobal.TasuDetailShopStoreLoader;
    if (!key) return true;
    if (loader?.isShopStoreOtherDemoId?.(key)) return true;
    if (explicit === false) return true;
    return false;
  }

  function pruneEmptyShopSections(listing, cfg) {
    const c = cfg || {};
    const visible = c.visibleSections || {};
    if (visible.overview !== true) hideShopSectionById(SECTION_IDS.overview);
    if (visible.handling !== true) hideShopSectionById(SECTION_IDS.handling);
    Object.values(SECTION_IDS).forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.hidden) return;
      if (!hasMeaningfulSectionContent(el)) {
        hideShopSectionElement(el);
      }
    });
    document
      .querySelectorAll("#shop-sections-root [data-shop-section], #shop-sections-root > section.shop-card")
      .forEach((el) => {
        if (!el.id) return;
        if (!hasMeaningfulSectionContent(el)) {
          hideShopSectionElement(el);
        }
      });
  }

  function getCategoryConfig(listing) {
    if (window.TasuShopDetailCategory?.applyShopCategoryUi) {
      return window.TasuShopDetailCategory.applyShopCategoryUi(listing);
    }
    return { mainSectionTitle: "掲載商品", ctaPrimaryText: "問い合わせる", ctaSecondaryText: "見積もり相談" };
  }

  function pickExtra(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const ce = fd.category_extra?.shop_store || fd.category_extra || {};
    return listing?.category_extra?.shop_store || ce.shop_store || ce || {};
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clampText(text, max) {
    const s = String(text ?? "").trim();
    if (!s) return "";
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }

  function pickFoodDemoImage(i = 0) {
    const arr = Array.isArray(FOOD_DEMO?.images) ? FOOD_DEMO.images : [];
    if (!arr.length) return "";
    const idx = Math.max(0, Math.min(arr.length - 1, Number(i) || 0));
    return String(arr[idx] || "").trim();
  }

  function buildImgTagWithFallback(src, fallbackSrc, alt = "") {
    const primary = String(src || "").trim();
    const fallback = String(fallbackSrc || "").trim() || pickFoodDemoImage(0);
    const safeAlt = esc(alt || "");
    const safePrimary = esc(primary || fallback);
    const safeFallback = esc(fallback);
    // 壊れた/失敗したimgはプレースホルダーではなくデモ画像へ
    return `<img src="${safePrimary}" alt="${safeAlt}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${safeFallback}'">`;
  }

  function isShopStoreDetailPage() {
    if (document.body?.dataset?.detailType === "shop_store") return true;
    if (window.TasuDetailShopStoreLoader?.isShopStoreDetailPage?.()) return true;
    const path = String(window.location.pathname || "");
    return /detail-shop(?:-store)?\.html/i.test(path);
  }

  /** ?id= をそのまま使う（demo 等を置換しない）。破損 ID のみ復元 */
  function normalizeShopDetailQueryId(raw) {
    let id = String(raw ?? "").trim();
    if (!id) return "";
    try {
      id = decodeURIComponent(id);
    } catch (_) {
      /* keep */
    }
    id = String(id).trim();
    if (/^---shop-/i.test(id)) {
      const recovered = `demo${id.slice(3)}`;
      console.warn("[detail-shop] recovered query id:", { was: id, recovered });
      id = recovered;
    }
    return id;
  }

  function getQueryId() {
    const params = new URLSearchParams(window.location.search);
    return normalizeShopDetailQueryId(
      params.get("id") || params.get("listingId") || params.get("listing_id") || ""
    );
  }

  let shopDetailIframeObserver = null;

  /** file:// / ネスト iframe 内の detail-shop.html 自己読み込みを止める */
  function disableNestedShopDetailIframes() {
    if (window.__TASU_DETAIL_SHOP_GUARD__?.removeBlockedFrames) {
      window.__TASU_DETAIL_SHOP_GUARD__.removeBlockedFrames(document);
      return;
    }
    const shouldBlock = IS_FILE_PROTOCOL || window.self !== window.top;
    if (!shouldBlock) return;
    document.querySelectorAll("iframe").forEach((frame) => {
      const src = String(frame.getAttribute("src") || frame.src || "").trim();
      if (!/detail-shop(?:-store)?\.html/i.test(src)) return;
      frame.remove();
    });
  }

  function watchNestedShopDetailIframes() {
    if (shopDetailIframeObserver || typeof MutationObserver === "undefined") return;
    shopDetailIframeObserver = new MutationObserver(() => disableNestedShopDetailIframes());
    shopDetailIframeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  }

  function listSearchTargets() {
    const demoIds = (window.TasuShopStoreDemo?.getListings?.() || [])
      .map((l) => String(l?.id || l?.form_data?.demo_id || "").trim())
      .filter(Boolean);
    const boardIds = (window.TasuBusinessBoardDemo?.getListings?.("") || [])
      .map((l) => String(l?.id || l?.form_data?.demo_id || l?.demo_id || "").trim())
      .filter(Boolean);
    return {
      demo_shop_store_ids: Array.from(new Set(demoIds)).slice(0, 200),
      board_demo_ids: Array.from(new Set(boardIds)).slice(0, 200),
    };
  }

  function debugLog(phase, payload) {
    try {
      console.groupCollapsed(`[detail-shop] ${phase}`);
      console.log(payload);
      console.groupEnd();
    } catch (_) {
      // ignore
    }
  }

  function showStatus(kind, html) {
    const el = qs(SELECTORS.status);
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.classList.remove("listing-detail-status--loading", "listing-detail-status--error");
    el.classList.add(`listing-detail-status--${kind}`);
    el.innerHTML = html;
  }

  function clearStatus() {
    const el = qs(SELECTORS.status);
    if (el) el.hidden = true;
  }

  function revealShopChromeForError() {
    document.body.dataset.listingLoaded = "error";
    const banner = document.querySelector("[data-biz-detail-simple-banner]");
    const header = document.querySelector("[data-biz-detail-market-header]");
    if (banner) {
      banner.hidden = false;
      banner.removeAttribute("hidden");
    }
    if (header) {
      header.hidden = false;
      header.removeAttribute("hidden");
    }
  }

  function showShopNotFound(message, idHint) {
    const id = normalizeShopDetailQueryId(idHint ?? getQueryId());
    const msg = String(message || "店舗情報が見つかりません。").trim();
    revealShopChromeForError();
    const root = qs(SELECTORS.root);
    if (root) {
      root.hidden = true;
      root.setAttribute("hidden", "");
    }
    showStatus(
      "error",
      `<strong>${esc(msg)}</strong>${
        id
          ? `<p style="margin:.65rem 0 0;font-weight:600;">掲載ID: <code>${esc(id)}</code></p>`
          : ""
      }<p style="margin:.75rem 0 0;"><a href="shop-store.html">店舗・販売一覧へ戻る</a></p>`
    );
  }

  function showRoot() {
    const root = qs(SELECTORS.root);
    if (!root) return;
    revealShopSection(root);
    root.style.visibility = "visible";
    document.body.dataset.listingLoaded = "true";
    pageGlobal.TasuListingDetailContacts?.refresh?.(
      pageGlobal.__tasuDetailContactListing || { id: document.body.dataset.listingId }
    );
  }

  function showRenderError(root, message, error) {
    shopLogError("render:error", error);
    const host = root || qs(SELECTORS.root);
    if (!host) return;
    host.hidden = false;
    host.removeAttribute("hidden");
    host.style.visibility = "visible";
    host.innerHTML = `<div class="listing-detail-status listing-detail-status--error" style="margin:2rem auto;max-width:42rem;padding:1.25rem;"><strong>${esc(
      message || "店舗情報の表示に失敗しました。"
    )}</strong>${
      error
        ? `<p style="margin-top:.5rem;font-size:.85rem;color:#64748b;">${esc(String(error?.message || error))}</p>`
        : ""
    }</div>`;
    document.body.dataset.listingLoaded = "error";
    clearStatus();
  }

  function reorderRetailSections() {
    const wrap = document.getElementById("shop-sections-root");
    if (!wrap) return;
    [
      document.getElementById(SECTION_IDS.products),
      document.getElementById(SECTION_IDS.cases),
      document.getElementById(SECTION_IDS.highlights),
      document.getElementById(SECTION_IDS.bottom),
      document.getElementById(SECTION_IDS.reviews),
      document.getElementById(SECTION_IDS.faq),
    ].forEach((el) => {
      if (el && el.parentElement === wrap) wrap.appendChild(el);
    });
  }

  function usesGoodsInteriorShopLayout(cfg, listing) {
    if (isBeauty(cfg) || isRelax(cfg)) return false;
    const categoryKey = String(cfg?.categoryKey || "").trim();
    if (window.TasuShopDetailCategory?.usesGoodsInteriorShopLayout) {
      return window.TasuShopDetailCategory.usesGoodsInteriorShopLayout(categoryKey);
    }
    return usesShopStickyActionNav(cfg);
  }

  function renderRetailDetail(listing, cfg) {
    enableRelaxLayout(cfg);
    const fv = document.querySelector(".biz-detail-fv");
    if (fv) {
      fv.classList.remove("food-top-fv", "beauty-top-fv", "relax-top-fv");
      fv.classList.add("retail-top-fv");
    }
    const legacyTop = document.querySelector("[data-biz-detail-legacy-top]");
    if (legacyTop) {
      legacyTop.hidden = true;
      legacyTop.setAttribute("hidden", "");
    }
    renderBreadcrumb(listing, cfg);
    if (usesShopStickyActionNav(cfg)) {
      hideLegacyDetailTabs();
    } else {
      applyRetailTabs();
      setupRetailTabsScroll(cfg);
      renderRestaurantTabsActive();
    }
    renderRetailHeroCtas(listing, cfg);
    renderRetailPoints(listing, cfg);
    renderRetailSidebar(listing, cfg);
    reorderRetailSections();
  }

  function renderShopDetailContent(listing, cfg) {
    const categoryKey = String(cfg?.categoryKey || cfg?.profileKey || "").trim();
    const shopId = String(listing?.id || listing?.demo_id || "").trim();
    console.log("[detail-shop] render:start", categoryKey, shopId);

    window.__TASU_SHOP_APPLY_SECTION_VISIBILITY__ = false;
    hideAllShopDetailSections();

    const root = qs(SELECTORS.root);
    if (!root) {
      showRenderError(null, "描画先（data-biz-detail-root）が見つかりません。", new Error("missing root"));
      return;
    }
    if (!listing) {
      showRenderError(root, "店舗データがありません。", new Error("missing listing"));
      return;
    }
    if (!cfg) {
      showRenderError(root, "カテゴリ設定を読み込めませんでした。", new Error("missing category config"));
      return;
    }

    renderHeroGallery(listing);
    renderHeroTags(listing);
    renderHeroText(listing);
    renderHeroMeta(listing);
    renderSidebar(listing, cfg);

    if (isBeauty(cfg)) {
      enableBeautyLayout();
      document.querySelector(".biz-detail-fv")?.classList.add("beauty-top-fv");
      renderBreadcrumb(listing, cfg);
      applyBeautyTabs();
      renderBeautyHeroCtas(listing, cfg);
      renderBeautyPoints(listing, cfg);
      renderBeautySidebar(listing, cfg);
      renderRestaurantTabsActive();
    }
    if (isRelax(cfg)) {
      enableRelaxLayout(cfg);
      document.querySelector(".biz-detail-fv")?.classList.add("relax-top-fv");
      renderBreadcrumb(listing, cfg);
      applyRelaxTabs();
      setupRelaxTabsScroll(cfg);
      renderRelaxHeroCtas(listing, cfg);
      renderRelaxPoints(listing, cfg);
      renderRelaxSidebar(listing, cfg);
      renderRestaurantTabsActive();
    }
    if (usesGoodsInteriorShopLayout(cfg, listing)) {
      renderRetailDetail(listing, cfg);
    }

    renderProductsSection(listing, cfg);
    renderCasesSection(listing, cfg);
    renderHighlightsSection(listing, cfg);
    renderInfoAndReviews(listing, cfg);
    renderFaq(listing, cfg);
    if (isRelax(cfg)) {
      reorderRelaxSections();
    }
    scheduleHeroAsideLayout();
    pruneEmptyShopSections(listing, cfg);
    if (usesShopStickyActionNav(cfg)) {
      hideLegacyDetailTabs();
      renderShopStickyActionNav(listing, cfg);
      setupShopStickyActionNavScroll(cfg);
      setupShopStickyActionNavSticky(listing, cfg);
    }
    renderStickyCta(cfg);
    if (isRelax(cfg)) {
      applyRelaxStickyNav(cfg);
    }
    setupStickySubnav(cfg);
    setupStickyFooterAvoidance(cfg);
    if (isRestaurant(cfg)) {
      setupRestaurantReviewScroll();
    }

    pageGlobal.__lastShopListing = listing;
    pageGlobal.__lastShopCfg = cfg;
    if (window.TasuShopDetailMobile?.apply) {
      window.TasuShopDetailMobile.apply(cfg);
    }
    applyRetailMobileHeroLayout(cfg);
    renderShopMobileInquiryDock(cfg);

    console.log("[detail-shop] render:done", categoryKey, shopId);
  }

  function syncShopMobileChrome(cfg) {
    const c = cfg || pageGlobal.__lastShopCfg;
    if (!c) return;
    const body = qs(SELECTORS.restaurantBody);
    if (body) {
      body.hidden = false;
      body.removeAttribute("hidden");
    }
    const fv = document.querySelector(".biz-detail-fv");
    if (fv && usesGoodsInteriorShopLayout(c)) {
      fv.classList.add("retail-top-fv");
    }
    applyRetailMobileHeroLayout(c);
    renderShopMobileInquiryDock(c);
  }

  function restoreRetailHeroGenrePlacement(fv, genre) {
    const main = fv?.querySelector(".biz-detail-fv__main, .shop-detail-main-info");
    if (!main || !genre) return;
    const title = main.querySelector("[data-biz-detail-title]");
    if (title && genre.parentElement !== main) {
      main.insertBefore(genre, title);
      return;
    }
    if (title && genre.parentElement === main && genre.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_PRECEDING) {
      main.insertBefore(genre, title);
      return;
    }
    if (genre.parentElement !== main) {
      if (title) main.insertBefore(genre, title);
      else main.prepend(genre);
    }
  }

  function applyRetailMobileHeroLayout(cfg) {
    const c = cfg || {};
    const fv = document.querySelector(".biz-detail-fv");
    if (!fv || !usesRetailUi(c)) return;

    const titleEl = qs(SELECTORS.title);
    const companyRow = fv.querySelector(".biz-detail-hero__company-row");
    const genre = qs(SELECTORS.genreTags);
    const media = fv.querySelector(".biz-detail-fv__media, .biz-detail-hero__media");
    const ctaHost = qs(SELECTORS.restaurantCtas);
    const listing = pageGlobal.__lastShopListing;

    if (!isShopMobileStickyNavViewport()) {
      fv.classList.remove("retail-top-fv--mobile-hero");
      if (titleEl) {
        titleEl.hidden = false;
        titleEl.removeAttribute("hidden");
        if (!String(titleEl.textContent || "").trim() && listing) {
          renderHeroText(listing);
        }
      }
      if (companyRow) {
        companyRow.hidden = false;
        companyRow.removeAttribute("hidden");
      }
      if (genre) {
        genre.hidden = false;
        genre.removeAttribute("hidden");
        restoreRetailHeroGenrePlacement(fv, genre);
      }
      if (listing) {
        renderRetailHeroCtas(listing, c);
      }
      scheduleHeroAsideLayout();
      return;
    }

    fv.classList.add("retail-top-fv--mobile-hero");
    if (titleEl) {
      titleEl.hidden = true;
      titleEl.setAttribute("hidden", "");
    }
    if (companyRow) {
      companyRow.hidden = true;
      companyRow.setAttribute("hidden", "");
    }
    if (ctaHost) {
      ctaHost.hidden = true;
      ctaHost.setAttribute("hidden", "");
      ctaHost.innerHTML = "";
    }
    if (media && genre) {
      media.insertAdjacentElement("afterend", genre);
    }
  }

  function renderShopMobileInquiryDock(cfg) {
    const c = cfg || {};
    const mobile = isShopMobileStickyNavViewport();
    let dock = document.querySelector("[data-shop-mobile-inquiry-dock]");

    if (!mobile || !usesGoodsInteriorShopLayout(c)) {
      if (dock) dock.remove();
      document.body.classList.remove("shop-detail-page--mobile-inquiry-dock");
      return;
    }

    if (!dock) {
      dock = document.createElement("div");
      dock.className = "shop-mobile-inquiry-dock";
      dock.setAttribute("data-shop-mobile-inquiry-dock", "");
      document.body.appendChild(dock);
    }

    const href = String(c.ctaPrimaryHref || "chat.html").trim() || "chat.html";
    dock.innerHTML = `<a class="shop-mobile-inquiry-dock__btn" data-biz-detail-inquiry href="${esc(href)}">
      <span class="shop-mobile-inquiry-dock__main">
        <span class="shop-mobile-inquiry-dock__icon" aria-hidden="true">✉</span>
        <span class="shop-mobile-inquiry-dock__label">お問い合わせ</span>
      </span>
      <span class="shop-mobile-inquiry-dock__line" aria-hidden="true">
        <span class="shop-mobile-inquiry-dock__line-badge">LINE</span>
      </span>
    </a>`;
    document.body.classList.add("shop-detail-page--mobile-inquiry-dock");

    const listing = pageGlobal.__lastShopListing;
    if (listing) {
      pageGlobal.TasuContactActions?.mountForListing?.(listing);
    }

    const stickyBar = document.querySelector("[data-biz-detail-sticky-bar]");
    if (stickyBar) {
      stickyBar.hidden = true;
      stickyBar.setAttribute("hidden", "");
    }
  }

  function renderBreadcrumb(listing, cfg) {
    const title = String(listing?.title || listing?.company_name || "店舗").trim();
    window.TasuCommonBreadcrumb?.setCurrentLabel(title);
  }

  function normalizeImages(listing) {
    const candidates = [
      listing?.image_url,
      listing?.main_image_url,
      listing?.thumbnail_url,
      ...(Array.isArray(listing?.gallery_urls) ? listing.gallery_urls : []),
      ...(Array.isArray(listing?.images) ? listing.images : []),
    ];
    const out = [];
    const seen = new Set();
    candidates.forEach((raw) => {
      const u = String(raw || "").trim();
      if (!u || seen.has(u)) return;
      seen.add(u);
      out.push(u);
    });
    return out;
  }

  function isRestaurant(cfgOrListing) {
    const key =
      typeof cfgOrListing === "object"
        ? String(cfgOrListing?.profileKey || cfgOrListing?.categoryKey || "").trim()
        : "";
    return key === "restaurant";
  }

  function isBeauty(cfgOrListing) {
    const key =
      typeof cfgOrListing === "object"
        ? String(cfgOrListing?.profileKey || cfgOrListing?.categoryKey || "").trim()
        : "";
    return key === "beauty_salon";
  }

  function isRelax(cfgOrListing) {
    const key =
      typeof cfgOrListing === "object"
        ? String(cfgOrListing?.profileKey || cfgOrListing?.categoryKey || "").trim()
        : "";
    return key === "relaxation";
  }

  function isVintageBrand(cfgOrListing) {
    const key =
      typeof cfgOrListing === "object"
        ? String(cfgOrListing?.categoryKey || cfgOrListing?.profileKey || "").trim()
        : "";
    return key === "vintage_brand";
  }

  function isRetail(cfgOrListing) {
    if (typeof cfgOrListing !== "object") return false;
    const categoryKey = String(cfgOrListing?.categoryKey || "").trim();
    const profileKey = String(cfgOrListing?.profileKey || "").trim();
    return (
      categoryKey === "retail" ||
      categoryKey === "vintage_brand" ||
      profileKey === "retail" ||
      profileKey === "vintage_brand"
    );
  }

  function isGoodsInterior(cfgOrListing) {
    const key =
      typeof cfgOrListing === "object"
        ? String(cfgOrListing?.categoryKey || cfgOrListing?.profileKey || "").trim()
        : "";
    return key === "goods_interior";
  }

  function usesRetailUi(cfgOrListing) {
    if (typeof cfgOrListing !== "object") return false;
    if (isBeauty(cfgOrListing) || isRelax(cfgOrListing)) return false;
    const categoryKey = String(cfgOrListing?.categoryKey || "").trim();
    if (window.TasuShopDetailCategory?.usesGoodsInteriorShopLayout?.(categoryKey)) return true;
    return isRetail(cfgOrListing) || isGoodsInterior(cfgOrListing) || isVintageBrand(cfgOrListing);
  }

  function usesShopStickyActionNav(cfgOrListing) {
    if (typeof cfgOrListing !== "object") return false;
    const categoryKey = String(cfgOrListing?.categoryKey || "").trim();
    if (window.TasuShopDetailCategory?.isShopStoreStickyNavCategory) {
      return window.TasuShopDetailCategory.isShopStoreStickyNavCategory(categoryKey);
    }
    return categoryKey === "restaurant" || usesRetailUi(cfgOrListing);
  }

  function buildShopProductsUrl(listing) {
    const id = String(listing?.id || listing?.demo_id || "").trim();
    return id ? `shop-products.html?id=${encodeURIComponent(id)}` : "shop-products.html";
  }

  function resolveProductsListHref(listing, cfg) {
    if (usesShopStickyActionNav(cfg)) return buildShopProductsUrl(listing);
    return String(cfg?.ctaSecondaryHref || "#section-products").trim() || "#section-products";
  }

  function isShopBuybackMobileCategory(cfgOrKey) {
    const key =
      typeof cfgOrKey === "string"
        ? cfgOrKey
        : String(cfgOrKey?.categoryKey || cfgOrKey?.profileKey || "").trim();
    if (window.TasuShopDetailCategory?.isShopBuybackMobileCategory) {
      return window.TasuShopDetailCategory.isShopBuybackMobileCategory(key);
    }
    return key === "vintage_brand" || key === "hobby_anime" || key === "tools_equipment";
  }

  function isShopInternalFlagValue(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return true;
    return /^(yes|no|true|false|enabled|disabled|on|off|1|0)$/.test(raw);
  }

  /** 買取系フィールドの yes/true 等をユーザー向け文言に変換（内部値はそのまま出さない） */
  function resolveBuybackUserDesc(value, { flagText = "買取対応中", fallback = "" } = {}) {
    const raw = String(value ?? "").trim();
    if (!raw || isShopInternalFlagValue(raw)) {
      const lower = raw.toLowerCase();
      if (lower === "yes" || lower === "true" || lower === "enabled" || lower === "1" || lower === "on") {
        return String(flagText || fallback || "").trim();
      }
      return String(fallback || "").trim();
    }
    return raw;
  }

  function filterBuybackBulletLabels(items) {
    return (Array.isArray(items) ? items : [])
      .map((t) => String(t ?? "").trim())
      .filter((t) => t && !isShopInternalFlagValue(t));
  }

  function buildBuybackMobileCopy(listing, cfg) {
    const extra = pickExtra(listing);
    const area = String(extra.visit_area || listing?.service_area || listing?.area || "関西エリア").trim();
    const corpRaw = extra.corporate_support || extra.corporate_contract || "";
    return {
      main: {
        title: String(cfg?.caseLabel || "買取対応").trim(),
        desc: resolveBuybackUserDesc(extra.buyback_support, {
          flagText: "買取対応中",
          fallback: "工具・機材・電動工具・測定器など幅広く買取。状態不問の品もご相談ください。",
        }),
        bullets: filterBuybackBulletLabels(["無料査定", "即日現金化", "大量査定OK"]),
      },
      visit: {
        title: "出張買取",
        desc: resolveBuybackUserDesc(extra.visit_buyback, {
          flagText: "出張買取対応中",
          fallback: `ご自宅・事業所へ訪問査定。${area}を中心に対応します。`,
        }),
      },
      corp: {
        title: "法人対応",
        desc: resolveBuybackUserDesc(corpRaw, {
          flagText: "法人・事業者向けに対応中",
          fallback: "法人・現場・倉庫の在庫整理、移転・閉鎖に伴う買取にも対応します。",
        }),
      },
      appraisal: {
        title: "査定案内",
        desc: resolveBuybackUserDesc(extra.appraisal_guide, {
          flagText: "",
          fallback: "写真査定・店頭持込・出張査定からお選びいただけます。お気軽にお問い合わせください。",
        }),
        href: String(cfg?.ctaPrimaryHref || "chat.html").trim() || "chat.html",
      },
    };
  }

  function renderBuybackMobileDescHtml(desc) {
    const text = String(desc || "").trim();
    if (!text || isShopInternalFlagValue(text)) return "";
    return `<p class="shop-mobile-feature__desc">${esc(text)}</p>`;
  }

  function renderBuybackMobileMainBlock(listing, cfg) {
    const copy = buildBuybackMobileCopy(listing, cfg);
    const bullets = filterBuybackBulletLabels(copy.main.bullets);
    return `<article class="shop-mobile-feature shop-mobile-feature--block shop-detail-sp-only" id="shop-sp-buyback-main">
      <h3 class="shop-mobile-feature__title">${esc(copy.main.title)}</h3>
      ${renderBuybackMobileDescHtml(copy.main.desc)}
      ${
        bullets.length
          ? `<ul class="shop-mobile-feature__list">${bullets.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
          : ""
      }
    </article>`;
  }

  function renderBuybackMobileServiceBlocks(listing, cfg) {
    const copy = buildBuybackMobileCopy(listing, cfg);
    return `<div class="shop-mobile-buyback-list shop-detail-sp-only">
      <article class="shop-mobile-feature shop-mobile-feature--block" id="shop-sp-buyback-visit">
        <h3 class="shop-mobile-feature__title">${esc(copy.visit.title)}</h3>
        ${renderBuybackMobileDescHtml(copy.visit.desc)}
      </article>
      <article class="shop-mobile-feature shop-mobile-feature--block" id="shop-sp-buyback-corp">
        <h3 class="shop-mobile-feature__title">${esc(copy.corp.title)}</h3>
        ${renderBuybackMobileDescHtml(copy.corp.desc)}
      </article>
      <article class="shop-mobile-feature shop-mobile-feature--block" id="shop-sp-buyback-appraisal">
        <h3 class="shop-mobile-feature__title">${esc(copy.appraisal.title)}</h3>
        ${renderBuybackMobileDescHtml(copy.appraisal.desc)}
        <a class="shop-mobile-feature__cta shop-mobile-feature__cta--full" href="${esc(copy.appraisal.href)}">査定を依頼する</a>
      </article>
    </div>`;
  }

  function renderRetailAccessDesktopTable(listing) {
    const extra = pickExtra(listing);
    const rows = [
      ["住所", extra.address || ""],
      ["営業時間", listing.business_hours || ""],
      ["定休日", extra.closed_day || ""],
      ["電話番号", listing.phone || ""],
      ["支払い方法", extra.payment_methods || extra.payments || ""],
      ["駐車場", extra.parking === "yes" ? "あり" : extra.parking === "no" ? "なし" : extra.parking || ""],
      ["アクセス", extra.access || extra.station || ""],
    ].filter((r) => String(r[1] || "").trim());
    if (!rows.length) return "";
    return `<div class="beauty-info-table shop-detail-pc-only" role="table" aria-label="アクセス情報">
      ${rows
        .map(
          ([k, v]) =>
            `<div class="beauty-info-row"><div class="beauty-info-key">${esc(k)}</div><div class="beauty-info-val">${esc(
              v
            )}</div></div>`
        )
        .join("")}
    </div>`;
  }

  function renderRetailAccessMobileList(listing) {
    const extra = pickExtra(listing);
    const email = String(extra.email || extra.shop_email || "shop@tasful.example").trim();
    const rows = [
      ["住所", extra.address || ""],
      ["営業時間", listing.business_hours || ""],
      ["電話番号", listing.phone || ""],
      ["メール", email],
      ["アクセス", extra.access || extra.station || ""],
    ].filter((r) => String(r[1] || "").trim());
    if (!rows.length) return "";
    return `<div class="shop-mobile-access-list shop-detail-sp-only" aria-label="アクセス情報">
      ${rows
        .map(
          ([k, v]) =>
            `<div class="shop-mobile-access-item">
              <div class="shop-mobile-access-label">${esc(k)}</div>
              <div class="shop-mobile-access-value">${esc(v)}</div>
            </div>`
        )
        .join("")}
    </div>`;
  }

  function getShopStickySecondaryCtaLabel(cfg) {
    const c = cfg || {};
    const key = String(c.categoryKey || "").trim();
    if (window.TasuShopDetailCategory?.buildStickyActionNavConfig) {
      return window.TasuShopDetailCategory.buildStickyActionNavConfig(key).cta.secondary;
    }
    if (key === "restaurant") return String(c.ctaSecondaryText || "メニューを見る").trim();
    if (key === "vintage_brand" || key === "hobby_anime" || key === "tools_equipment") {
      return String(c.ctaSecondaryText || "査定・商品を見る").trim();
    }
    return String(c.ctaSecondaryText || "商品を見る").trim();
  }

  function shouldUseRetailCssProfile(cfgOrListing) {
    return usesRetailUi(cfgOrListing);
  }

  function getRetailDemoPack(cfgOrListing) {
    if (isVintageBrand(cfgOrListing)) return VINTAGE_BRAND_DEMO;
    if (isGoodsInterior(cfgOrListing)) return GOODS_INTERIOR_DEMO;
    return RETAIL_DEMO;
  }

  function pickRetailDemoImage(i = 0, cfgOrListing) {
    const arr = Array.isArray(getRetailDemoPack(cfgOrListing)?.images) ? getRetailDemoPack(cfgOrListing).images : [];
    if (!arr.length) return pickFoodDemoImage(i);
    const idx = Math.max(0, Math.min(arr.length - 1, Number(i) || 0));
    return String(arr[idx] || "").trim();
  }

  function goodsInteriorTopDefaults(cfg) {
    if (!isGoodsInterior(cfg)) return null;
    return GOODS_INTERIOR_DEMO.top || null;
  }

  function pickRelaxDemoImage(i = 0) {
    const arr = Array.isArray(RELAX_DEMO?.images) ? RELAX_DEMO.images : [];
    if (!arr.length) return "";
    const idx = Math.max(0, Math.min(arr.length - 1, Number(i) || 0));
    return String(arr[idx] || "").trim();
  }

  function pickBeautyDemoImage(i = 0) {
    const arr = Array.isArray(BEAUTY_DEMO?.images) ? BEAUTY_DEMO.images : [];
    if (!arr.length) return "";
    const idx = Math.max(0, Math.min(arr.length - 1, Number(i) || 0));
    return String(arr[idx] || "").trim();
  }

  function pickFoodImages(listing) {
    const urls = normalizeImages(listing);
    const extra = pickExtra(listing);
    const fd = listing?.form_data || {};
    const prodImgs = (Array.isArray(listing?.products) ? listing.products : [])
      .map((p) => String(p?.image_url || p?.product_image_url || "").trim())
      .filter(Boolean);
    const merged = [
      ...urls,
      ...prodImgs,
      ...(Array.isArray(fd?.gallery_urls) ? fd.gallery_urls : []),
      ...(Array.isArray(extra?.gallery_urls) ? extra.gallery_urls : []),
    ]
      .map((u) => String(u || "").trim())
      .filter(Boolean);
    const uniq = [];
    const seen = new Set();
    merged.forEach((u) => {
      if (seen.has(u)) return;
      seen.add(u);
      uniq.push(u);
    });
    if (uniq.length) return uniq;
    return FOOD_DEMO.images.slice();
  }

  function renderRestaurantHeroCtas(listing, cfg) {
    const host = qs(SELECTORS.restaurantCtas);
    if (!host) return;
    host.hidden = false;
    host.removeAttribute("hidden");
    const consultHref = "chat.html";
    const reserveHref = String(cfg?.ctaPrimaryHref || "chat.html");
    host.innerHTML = [
      `<a class="shop-restaurant-cta shop-restaurant-cta--consult" href="${esc(
        consultHref
      )}"><span class="shop-restaurant-cta__icon" aria-hidden="true">💬</span>相談する</a>`,
      `<a class="shop-restaurant-cta shop-restaurant-cta--reserve" href="${esc(
        reserveHref
      )}"><span class="shop-restaurant-cta__icon" aria-hidden="true">📅</span>予約する</a>`,
    ].join("");
  }

  function renderRestaurantPoints(listing, cfg) {
    const box = qs(SELECTORS.restaurantPoints);
    if (!box) return;
    const points = Array.isArray(cfg?.points) ? cfg.points : [];
    const items = points.length ? points : FOOD_DEMO.points || [];
    if (!items.length) {
      box.hidden = true;
      box.setAttribute("hidden", "");
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.removeAttribute("hidden");
    box.innerHTML = `<h3 class="shop-restaurant-points__title">こだわりのポイント</h3>
      <ul class="shop-restaurant-points__list">
        ${(items || [])
          .slice(0, 6)
          .map((t) => `<li class="shop-restaurant-points__item"><span class="shop-restaurant-points__icon">✓</span><span>${esc(t)}</span></li>`)
          .join("")}
      </ul>`;
    scheduleHeroAsideLayout();
  }

  function renderBeautyHeroCtas(listing, cfg) {
    const host = qs(SELECTORS.restaurantCtas);
    if (!host) return;
    host.hidden = false;
    host.removeAttribute("hidden");
    host.innerHTML = `
      <div class="beauty-ctas">
        <a class="beauty-cta beauty-cta--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}"><span aria-hidden="true">📅</span>予約する</a>
        <a class="beauty-cta beauty-cta--ghost" href="chat.html"><span aria-hidden="true">💬</span>相談する</a>
      </div>
    `;
  }

  function renderBeautyPoints(listing, cfg) {
    const box = qs(SELECTORS.restaurantPoints);
    if (!box) return;
    const items = Array.isArray(cfg?.points) && cfg.points.length ? cfg.points : BEAUTY_DEMO.points;
    box.hidden = false;
    box.removeAttribute("hidden");
    box.innerHTML = `
      <div class="beauty-points">
        <h3 class="beauty-points__title">サロンのこだわり</h3>
        <ul class="beauty-points__list">
          ${(items || [])
            .slice(0, 6)
            .map((t) => `<li class="beauty-points__item"><span class="beauty-points__icon">✓</span><span>${esc(t)}</span></li>`)
            .join("")}
        </ul>
      </div>
    `;
    scheduleHeroAsideLayout();
  }

  function enableBeautyLayout() {
    qs(SELECTORS.restaurantTabs)?.removeAttribute("hidden");
    qs(SELECTORS.restaurantTabs) && (qs(SELECTORS.restaurantTabs).hidden = false);
    qs(SELECTORS.restaurantBody)?.removeAttribute("hidden");
    qs(SELECTORS.restaurantBody) && (qs(SELECTORS.restaurantBody).hidden = false);
  }

  function renderBeautySidebar(listing, cfg) {
    const host = qs(SELECTORS.restaurantSidebar);
    if (!host) return;
    const extra = pickExtra(listing);
    const hours = String(listing.business_hours || extra.business_hours_extra || "10:00〜20:00").trim();
    const closed = String(extra.closed_day || "—").trim();
    const phone = String(listing.phone || extra.phone || "03-1234-5678").trim();
    const area =
      String(extra.city || extra.city_area || "").trim() ||
      String(extra.address_simple || "").trim() ||
      "東京都 渋谷区 神宮前";
    const access = String(extra.access || extra.station || "表参道駅 徒歩3分").trim();

    host.innerHTML = `
      <section class="beauty-side-card" aria-label="予約">
        <h3 class="beauty-side-card__title">ご予約・お問い合わせ</h3>
        <div class="beauty-side-kv">
          <div><span aria-hidden="true">🕐</span> ${esc(hours)}</div>
          <div><span aria-hidden="true">📅</span> 定休日 ${esc(closed)}</div>
          <div><span aria-hidden="true">☎</span> ${esc(phone)}</div>
        </div>
        <div class="beauty-side-actions">
          <a class="beauty-side-btn beauty-side-btn--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}">Web予約する</a>
          <a class="beauty-side-btn" href="chat.html">LINEで予約する</a>
          <a class="beauty-side-btn" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">電話する</a>
        </div>
      </section>

      <section class="beauty-side-card" aria-label="アクセス">
        <h3 class="beauty-side-card__title">アクセス</h3>
        <div class="beauty-side-kv">
          <div><span aria-hidden="true">📍</span> ${esc(area)}</div>
          <div><span aria-hidden="true">🚃</span> ${esc(access)}</div>
        </div>
        <div class="beauty-side-actions">
          <a class="beauty-side-btn" href="#section-shop-bottom">地図を見る</a>
        </div>
      </section>
    `;
  }

  function renderRelaxHeroCtas(listing, cfg) {
    const host = qs(SELECTORS.restaurantCtas);
    if (!host) return;
    host.hidden = false;
    host.removeAttribute("hidden");
    host.innerHTML = `
      <div class="relax-ctas">
        <a class="relax-cta relax-cta--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}"><span aria-hidden="true">📅</span>予約する</a>
        <a class="relax-cta relax-cta--ghost" href="chat.html"><span aria-hidden="true">💬</span>相談する</a>
      </div>
    `;
  }

  function renderRetailHeroCtas(listing, cfg) {
    const host = qs(SELECTORS.restaurantCtas);
    if (!host) return;
    if (isShopMobileStickyNavViewport()) {
      host.hidden = true;
      host.setAttribute("hidden", "");
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.removeAttribute("hidden");
    host.innerHTML = `
      <div class="retail-ctas">
        <a class="retail-cta retail-cta--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}"><span aria-hidden="true">✉</span>お問い合わせ</a>
        <a class="retail-cta retail-cta--line" href="chat.html"><span aria-hidden="true">💬</span>LINE問い合わせ</a>
        <button type="button" class="retail-cta" data-retail-fav-cta><span aria-hidden="true">♡</span>お気に入り</button>
      </div>
    `;
  }

  function resolveRetailHeroPoints(listing, cfg) {
    const fromCfg = Array.isArray(cfg?.points) ? cfg.points.map((t) => String(t || "").trim()).filter(Boolean) : [];
    if (fromCfg.length) return fromCfg;
    const tags = Array.isArray(listing?.tags)
      ? listing.tags.map((t) => String(t || "").trim()).filter(Boolean)
      : [];
    if (tags.length) return tags.slice(0, 6);
    return [];
  }

  function renderRetailPoints(listing, cfg) {
    const box = qs(SELECTORS.restaurantPoints);
    if (!box) return;
    const items = resolveRetailHeroPoints(listing, cfg);
    if (!items.length) {
      box.hidden = true;
      box.setAttribute("hidden", "");
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.removeAttribute("hidden");
    box.innerHTML = `
      <div class="retail-points">
        <h3 class="retail-points__title">お店のこだわり</h3>
        <ul class="retail-points__list">
          ${(items || [])
            .slice(0, 6)
            .map(
              (t) =>
                `<li class="retail-points__item"><span class="retail-points__icon" aria-hidden="true">◆</span><span>${esc(
                  t
                )}</span></li>`
            )
            .join("")}
        </ul>
      </div>
    `;
    scheduleHeroAsideLayout();
  }

  function renderRelaxPoints(listing, cfg) {
    const box = qs(SELECTORS.restaurantPoints);
    if (!box) return;
    const items = Array.isArray(cfg?.points) && cfg.points.length ? cfg.points : RELAX_DEMO.points;
    box.hidden = false;
    box.removeAttribute("hidden");
    box.innerHTML = `
      <div class="relax-points">
        <h3 class="relax-points__title">サロンのこだわり</h3>
        <ul class="relax-points__list">
          ${(items || [])
            .slice(0, 6)
            .map((t) => `<li class="relax-points__item"><span class="relax-points__icon">✓</span><span>${esc(t)}</span></li>`)
            .join("")}
        </ul>
      </div>
    `;
    scheduleHeroAsideLayout();
  }

  function enableRelaxLayout(cfg) {
    if (!usesShopStickyActionNav(cfg)) {
      qs(SELECTORS.restaurantTabs)?.removeAttribute("hidden");
      if (qs(SELECTORS.restaurantTabs)) qs(SELECTORS.restaurantTabs).hidden = false;
    }
    qs(SELECTORS.restaurantBody)?.removeAttribute("hidden");
    if (qs(SELECTORS.restaurantBody)) qs(SELECTORS.restaurantBody).hidden = false;
  }

  function renderRetailSidebar(listing, cfg) {
    const host = qs(SELECTORS.restaurantSidebar);
    if (!host) return;
    const extra = pickExtra(listing);
    const topDef = goodsInteriorTopDefaults(cfg);
    const hours = String(listing.business_hours || extra.business_hours_extra || topDef?.hours || "10:00〜20:00").trim();
    const closed = String(extra.closed_day || "不定休").trim();
    const phone = String(listing.phone || extra.phone || topDef?.phone || "06-6347-0000").trim();
    const email = String(extra.email || extra.shop_email || topDef?.email || "shop@tasful.example").trim();
    const address = String(extra.address || topDef?.address || "").trim() || "大阪府大阪市北区梅田2-2-2";
    const access = String(extra.access || extra.station || topDef?.station || "最寄駅から徒歩8分").trim();

    host.innerHTML = `
      <section class="relax-side-card" aria-label="お問い合わせ">
        <h3 class="relax-side-card__title">お問い合わせ</h3>
        <div class="relax-side-kv">
          <div><span aria-hidden="true">🕐</span> ${esc(hours)}</div>
          <div><span aria-hidden="true">📅</span> 定休日 ${esc(closed)}</div>
          <div><span aria-hidden="true">☎</span> ${esc(phone)}</div>
          <div><span aria-hidden="true">✉</span> ${esc(email)}</div>
        </div>
        <div class="relax-side-actions">
          <a class="relax-side-btn relax-side-btn--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}">Webで問い合わせる</a>
          <a class="relax-side-btn" href="chat.html">LINEで問い合わせる</a>
        </div>
      </section>

      <section class="relax-side-card" aria-label="アクセス">
        <h3 class="relax-side-card__title">アクセス</h3>
        <div class="relax-side-kv">
          <div><span aria-hidden="true">📍</span> ${esc(address)}</div>
          <div><span aria-hidden="true">🚃</span> ${esc(access)}</div>
        </div>
        <div class="relax-side-actions">
          <a class="relax-side-btn" href="#section-shop-bottom">地図アプリで見る</a>
        </div>
      </section>

      <section class="relax-side-card" aria-label="SNS">
        <h3 class="relax-side-card__title">SNS</h3>
        <div class="relax-side-actions">
          <a class="relax-side-btn" href="index.html">Instagram</a>
          <a class="relax-side-btn" href="chat.html">LINE</a>
          <a class="relax-side-btn" href="index.html">フォローする</a>
        </div>
      </section>
    `;
  }

  function renderRelaxSidebar(listing, cfg) {
    const host = qs(SELECTORS.restaurantSidebar);
    if (!host) return;
    const extra = pickExtra(listing);
    const hours = String(listing.business_hours || extra.business_hours_extra || "10:00〜24:00").trim();
    const closed = String(extra.closed_day || "年中無休").trim();
    const phone = String(listing.phone || extra.phone || "03-1234-5678").trim();
    const area =
      String(extra.city || extra.city_area || "").trim() ||
      String(extra.address_simple || "").trim() ||
      "東京都 渋谷区 神宮前";
    const address = String(extra.address || "").trim() || "東京都 渋谷区 神宮前4-12-10 ○○ビル 2F";
    const access = String(extra.access || extra.station || "表参道駅A2出口から徒歩3分").trim();

    host.innerHTML = `
      <section class="relax-side-card" aria-label="ご予約・お問い合わせ">
        <h3 class="relax-side-card__title">ご予約・お問い合わせ</h3>
        <div class="relax-side-kv">
          <div><span aria-hidden="true">🕐</span> ${esc(hours)} <span style="color:var(--relax-muted);font-weight:800;">(最終受付 23:00)</span></div>
          <div><span aria-hidden="true">📅</span> 定休日 ${esc(closed)}</div>
          <div><span aria-hidden="true">☎</span> ${esc(phone)}</div>
        </div>
        <div class="relax-side-actions">
          <a class="relax-side-btn relax-side-btn--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}">Webで予約する</a>
          <a class="relax-side-btn" href="chat.html">LINEで予約する</a>
          <a class="relax-side-btn" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">電話する</a>
        </div>
      </section>

      <section class="relax-side-card" aria-label="アクセス">
        <h3 class="relax-side-card__title">アクセス</h3>
        <div class="relax-side-kv">
          <div><span aria-hidden="true">📍</span> ${esc(address || area)}</div>
          <div><span aria-hidden="true">🚃</span> ${esc(access)}</div>
        </div>
        <div class="relax-side-actions">
          <a class="relax-side-btn" href="#section-shop-bottom">地図アプリで見る</a>
        </div>
      </section>

      <section class="relax-side-card" aria-label="SNS">
        <h3 class="relax-side-card__title">SNS</h3>
        <div class="relax-side-actions">
          <a class="relax-side-btn" href="index.html">Instagram</a>
          <a class="relax-side-btn" href="chat.html">LINE</a>
          <a class="relax-side-btn" href="index.html">フォローする</a>
        </div>
      </section>
    `;
  }

  function hideLegacyDetailTabs() {
    const legacyWrap = document.querySelector("[data-relax-tabs-sticky-wrap]");
    if (legacyWrap) {
      legacyWrap.hidden = true;
      legacyWrap.setAttribute("hidden", "");
    }
    const legacyTabs = qs(SELECTORS.restaurantTabs);
    if (legacyTabs) {
      legacyTabs.hidden = true;
      legacyTabs.setAttribute("hidden", "");
    }
  }

  function enableRestaurantLayout() {
    hideLegacyDetailTabs();
    const legacyTop = document.querySelector("[data-biz-detail-legacy-top]");
    if (legacyTop) {
      legacyTop.hidden = true;
      legacyTop.setAttribute("hidden", "");
    }
    qs(SELECTORS.restaurantBody)?.removeAttribute("hidden");
    qs(SELECTORS.restaurantBody) && (qs(SELECTORS.restaurantBody).hidden = false);
  }

  function enableShopOtherLayout() {
    enableRestaurantLayout();
    document.body.classList.add("shop-detail-page--other");
  }

  function renderShopOtherOverview(listing, cfg) {
    const root = document.getElementById(SECTION_IDS.overview);
    if (!root) return;
    const heading =
      cfg?.shopCategoryDetail?.heading ||
      cfg?.stickyNav?.overview ||
      "概要";
    const desc = String(listing?.description || pickExtra(listing).shop_description || "").trim();
    if (!desc) {
      hideShopSectionById(SECTION_IDS.overview);
      return;
    }
    revealShopSection(root);
    root.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">${esc(heading)}</h2></div>
      <p class="shop-other-overview__text">${esc(desc)}</p>`;
  }

  function renderShopOtherHandlingInfo(listing, cfg) {
    const store = window.TasuListingLocalStore;
    const section = document.getElementById(SECTION_IDS.handling);
    if (!section) return;
    if (!store?.hasShopHandlingInfo?.(listing)) {
      hideShopSectionById(SECTION_IDS.handling);
      return;
    }
    const info = pickHandlingInfo(listing);
    const title =
      cfg?.handlingInfoTitle ||
      cfg?.shopCategoryDetail?.handlingInfoTitle ||
      cfg?.stickyNav?.handling ||
      "取扱情報";
    const rows = [
      ["取扱商品", info.productsHandled || info.products_handled],
      ["販売方法", info.salesMethods || info.sales_methods],
      ["対応エリア", info.serviceArea || info.service_area],
      ["相談方法", info.consultationMethod || info.consultation_method],
    ].filter(([, value]) => String(value || "").trim());
    revealShopSection(section);
    section.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">${esc(title)}</h2></div>
      <dl class="shop-other-handling__list">
        ${rows
          .map(
            ([label, value]) =>
              `<div class="shop-other-handling__row"><dt class="shop-other-handling__key">${esc(
                label
              )}</dt><dd class="shop-other-handling__val">${esc(value)}</dd></div>`
          )
          .join("")}
      </dl>`;
  }

  function applyShopOtherHeroMeta(listing, cfg) {
    const quick = qs(SELECTORS.quick);
    if (!quick) return;
    const data = shopStoreDataHelpers(listing);
    quick.hidden = false;
    quick.removeAttribute("hidden");
    quick.innerHTML = `<li class="shop-hero-meta__item"><span class="shop-hero-meta__icon" aria-hidden="true">💴</span><span class="shop-hero-meta__label">価格：</span><span class="shop-hero-meta__value">${esc(
      data.priceLabel
    )}</span></li>`;
  }

  function applyShopOtherSidebar(listing, cfg) {
    const data = shopStoreDataHelpers(listing);
    const ratingWrap = qs(SELECTORS.sidebarRatingWrap);
    const priceEl = qs(SELECTORS.sidebarPrice);
    const priceLabelEl = document.querySelector("[data-biz-detail-sidebar-price-label]");
    const actions = qs(SELECTORS.sidebarActions);
    const favBtn = qs(SELECTORS.favoriteBtn);

    if (ratingWrap) ratingWrap.hidden = !data.hasReviews;
    if (priceLabelEl && cfg?.priceLabel) priceLabelEl.textContent = cfg.priceLabel;
    if (priceEl) priceEl.textContent = data.priceLabel;

    if (actions) {
      actions.innerHTML = [
        `<a class="biz-detail-btn biz-detail-btn--primary" data-biz-detail-inquiry href="${esc(cfg?.ctaPrimaryHref || "chat.html")}">${esc(
          cfg?.ctaPrimaryText || "問い合わせる"
        )}</a>`,
        `<button type="button" class="biz-detail-btn biz-detail-btn--outline" data-biz-detail-favorite aria-label="お気に入りに追加" aria-pressed="false"><span aria-hidden="true">♡</span> ${esc(
          cfg?.favoriteLabel || cfg?.ctaSecondaryText || "お気に入りに追加"
        )}</button>`,
      ].join("");
    }
    if (favBtn) {
      favBtn.hidden = true;
      favBtn.setAttribute("hidden", "");
    }
  }

  function applyShopOtherSectionVisibility(listing, cfg) {
    const data = shopStoreDataHelpers(listing);
    const allowProducts = cfg?.showProducts !== false && data.hasProducts;
    const allowAccess = cfg?.showAccess !== false && data.hasAccess;
    const allowReviews = cfg?.showReviews !== false && data.hasReviews;

    if (!allowProducts) hideShopSectionById(SECTION_IDS.products);
    hideShopSectionById(SECTION_IDS.cases);
    hideShopSectionById(SECTION_IDS.highlights);
    if (!allowAccess) hideShopSectionById(SECTION_IDS.bottom);
    if (!allowReviews) hideShopSectionById(SECTION_IDS.reviews);
    hideShopSectionById(SECTION_IDS.faq);
    if (!data.hasHandling) hideShopSectionById(SECTION_IDS.handling);
  }

  function applyShopOtherPresentation(listing, cfg) {
    if (!isShopOtherCategory(cfg, listing)) return cfg;
    applyShopOtherSectionVisibility(listing, cfg);
    renderShopOtherOverview(listing, cfg);
    renderShopOtherHandlingInfo(listing, cfg);
    applyShopOtherHeroMeta(listing, cfg);
    applyShopOtherSidebar(listing, cfg);
    applyShopOtherSectionVisibility(listing, cfg);
    hideLegacyDetailTabs();
    renderShopStickyActionNav(listing, cfg);
    setupShopStickyActionNavScroll(cfg);
    setupShopStickyActionNavSticky(listing, cfg);
    window.TasuFavoriteActions?.mountForListing?.(listing);
    return cfg;
  }

  function isSectionVisibleForNav(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return false;
    if (el.hidden || el.hasAttribute("hidden")) return false;
    if (el.classList.contains("is-hidden") || el.classList.contains("shop-section--empty")) {
      return false;
    }
    return hasMeaningfulSectionContent(el);
  }

  function buildShopStickyActionNavTabs(cfg, listing) {
    const c = cfg || {};
    const mobile = window.matchMedia("(max-width: 960px)").matches;
    const Cat = window.TasuShopDetailCategory;
    const vis =
      mobile && Cat?.getShopMobileVisibleSections
        ? Cat.getShopMobileVisibleSections(c)
        : Cat?.getShopPcNavSections
          ? Cat.getShopPcNavSections(c)
          : c.navSections || c.visibleSections || {};
    const navLabels =
      mobile && Cat?.getShopMobileStickyNav ? Cat.getShopMobileStickyNav(c) : c.stickyNav || {};
    const anchorMap =
      mobile && Cat?.getShopMobileStickyAnchors ? Cat.getShopMobileStickyAnchors(c) : {};
    const productsLabel = String(
      navLabels.products || (isRestaurant(c) ? c.itemLabel || "メニュー" : c.itemLabel || "商品")
    ).trim();
    const tabs = [];
    const push = (key, label, sectionId, hrefOverride) => {
      const targetId = String(sectionId || "").trim();
      if (!targetId) return;
      if (hrefOverride) {
        const anchorEl = document.querySelector(String(hrefOverride));
        const sectionEl = document.getElementById(targetId);
        if (!sectionEl || sectionEl.hidden) return;
        if (!anchorEl && !sectionEl) return;
        tabs.push({
          key,
          label,
          href: String(hrefOverride),
          sectionId: anchorEl?.id || targetId,
        });
        return;
      }
      if (!isSectionVisibleForNav(targetId)) return;
      tabs.push({ key, label, href: `#${targetId}`, sectionId: targetId });
    };
    if (vis.overview === true) {
      push("overview", String(navLabels.overview || "概要").trim(), SECTION_IDS.overview);
    }
    if (vis.handling === true) {
      push(
        "handling",
        String(navLabels.handling || c.handlingInfoTitle || "取扱情報").trim(),
        SECTION_IDS.handling
      );
    }
    if (vis.products !== false) push("products", productsLabel || "商品", SECTION_IDS.products);
    if (vis.cases !== false) push("cases", String(navLabels.cases || c.caseLabel || "店内・雰囲気").trim(), SECTION_IDS.cases);
    if (vis.highlights !== false) {
      if (mobile && anchorMap.buyback_visit) {
        push(
          "buyback_visit",
          String(navLabels.buyback_visit || "出張買取").trim(),
          SECTION_IDS.highlights,
          anchorMap.buyback_visit
        );
        push(
          "buyback_corp",
          String(navLabels.buyback_corp || "法人対応").trim(),
          SECTION_IDS.highlights,
          anchorMap.buyback_corp
        );
        push(
          "buyback_appraisal",
          String(navLabels.buyback_appraisal || "査定案内").trim(),
          SECTION_IDS.highlights,
          anchorMap.buyback_appraisal
        );
      } else {
        const highlightsLabel = String(
          navLabels.highlights || c.highlightsTitle || "お知らせ"
        ).trim();
        push("highlights", highlightsLabel, SECTION_IDS.highlights);
      }
    }
    if (vis.info !== false) {
      const accessAnchor = mobile && document.getElementById("section-shop-info") ? "#section-shop-info" : "";
      push(
        "access",
        String(navLabels.bottom || c.infoTitle || "アクセス").trim(),
        SECTION_IDS.bottom,
        accessAnchor || undefined
      );
    }
    if (vis.reviews !== false) push("reviews", String(navLabels.reviews || "口コミ").trim(), SECTION_IDS.reviews);
    if (vis.faq !== false) push("faq", String(navLabels.faq || c.faqTitle || "FAQ").trim(), SECTION_IDS.faq);
    return tabs;
  }

  function getActionNavScrollOffset() {
    const header = document.querySelector("[data-biz-detail-market-header]");
    const nav = qs(SELECTORS.actionNav);
    const headerH = header?.getBoundingClientRect?.().height || 72;
    const navH = nav?.getBoundingClientRect?.().height || 64;
    return Math.round(headerH + navH + 12);
  }

  function getShopStickyNavTop() {
    return window.matchMedia("(max-width: 768px)").matches ? 60 : 72;
  }

  function isShopMobileStickyNavViewport() {
    try {
      return window.matchMedia("(max-width: 960px)").matches;
    } catch {
      return false;
    }
  }

  function renderShopStickyActionNav(listing, cfg) {
    const nav = qs(SELECTORS.actionNav);
    const tabsHost = qs(SELECTORS.actionNavTabs);
    const actionsHost = qs(SELECTORS.actionNavActions);
    if (!nav || !tabsHost || !actionsHost) return;

    const c = cfg || getCategoryConfig(listing);
    const mobileNav = isShopMobileStickyNavViewport();
    nav.classList.toggle("shop-mobile-sticky-nav", mobileNav);
    if (mobileNav) {
      nav.style.bottom = "auto";
      nav.style.height = "auto";
      nav.style.minHeight = "0";
    }
    const tabs = buildShopStickyActionNavTabs(c, listing);
    if (!tabs.length) {
      nav.hidden = true;
      nav.setAttribute("hidden", "");
      return;
    }

    tabsHost.innerHTML = tabs
      .map(
        (t, i) =>
          `<a class="shop-sticky-action-nav__tab shop-mobile-sticky-nav__item${i === 0 ? " is-active" : ""}" href="${esc(t.href)}" data-shop-action-tab="${esc(
            t.key
          )}" data-target="${esc(t.sectionId)}">${esc(t.label)}</a>`
      )
      .join("");
    tabsHost.classList.toggle("shop-mobile-sticky-nav__list", mobileNav);

    if (isShopOtherCategory(c, listing)) {
      actionsHost.innerHTML = `
        <a href="${esc(c.ctaPrimaryHref || "chat.html")}" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--gold">${esc(
          c.ctaPrimaryText || "問い合わせる"
        )}</a>
        <button type="button" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--outline shop-sticky-action-nav__btn--fav" data-biz-detail-favorite aria-label="お気に入りに追加" aria-pressed="false"><span class="shop-sticky-action-nav__fav-icon" aria-hidden="true">♡</span><span> ${esc(
          c.favoriteLabel || c.ctaSecondaryText || "お気に入りに追加"
        )}</span></button>
      `;
      nav.hidden = false;
      nav.removeAttribute("hidden");
      document.body.classList.add("shop-detail-page--action-nav");
      return;
    }

    if (mobileNav) {
      actionsHost.innerHTML = "";
      actionsHost.hidden = true;
      actionsHost.setAttribute("hidden", "");
    } else {
      const navCta =
        window.TasuShopDetailCategory?.buildStickyActionNavConfig?.(c.categoryKey)?.cta || {};
      const secondaryLabel = getShopStickySecondaryCtaLabel(c);
      actionsHost.hidden = false;
      actionsHost.removeAttribute("hidden");
      actionsHost.innerHTML = `
      <a href="${esc(buildShopAiConsultHref(listing))}" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--gold">${esc(
        navCta.ai || c.ctaAiText || "AIに相談する"
      )}</a>
      <a href="${esc(navCta.primaryHref || c.ctaPrimaryHref || "chat.html")}" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--outline">${esc(
        navCta.primary || c.ctaPrimaryText || "お問い合わせ"
      )}</a>
      <a href="${esc(buildShopProductsUrl(listing))}" class="shop-sticky-action-nav__btn shop-sticky-action-nav__btn--outline">${esc(
        secondaryLabel
      )}</a>
    `;
    }

    nav.hidden = false;
    nav.removeAttribute("hidden");
    document.body.classList.add("shop-detail-page--action-nav");
  }

  function setupShopStickyActionNavSticky(listing, cfg) {
    const nav = qs(SELECTORS.actionNav);
    const spacer = qs(SELECTORS.actionNavSpacer);
    if (!nav || nav.hidden || nav.dataset.shopStickyNavBound === "1") return;
    nav.dataset.shopStickyNavBound = "1";

    if (isShopMobileStickyNavViewport()) {
      nav.classList.remove("is-stuck");
      document.body.classList.remove("shop-detail-page--action-nav-stuck");
      if (spacer) {
        spacer.hidden = true;
        spacer.setAttribute("hidden", "");
        spacer.style.height = "0";
      }
      const syncMobileStickyTop = () => {
        const top = getShopStickyNavTop();
        nav.style.setProperty("--shop-sticky-nav-top", `${top}px`);
        nav.style.bottom = "auto";
        nav.style.height = "auto";
        nav.style.minHeight = "0";
        document.documentElement.style.setProperty("--shop-sticky-nav-top", `${top}px`);
      };
      syncMobileStickyTop();
      window.addEventListener("resize", syncMobileStickyTop, { passive: true });
      return;
    }
    const categoryKey = String(cfg?.categoryKey || cfg?.profileKey || "").trim();
    const shopId = String(listing?.id || listing?.demo_id || "").trim();
    console.log("[shop-sticky-nav] mounted", categoryKey, shopId);

    let stickY = 0;

    const applyTopVar = () => {
      const top = getShopStickyNavTop();
      nav.style.setProperty("--shop-sticky-nav-top", `${top}px`);
      document.documentElement.style.setProperty("--shop-sticky-nav-top", `${top}px`);
      if (isShopMobileStickyNavViewport()) {
        nav.style.bottom = "auto";
        nav.style.height = "auto";
        nav.style.minHeight = "0";
      }
      return top;
    };

    const measure = () => {
      nav.classList.remove("is-stuck");
      document.body.classList.remove("shop-detail-page--action-nav-stuck");
      if (spacer) {
        spacer.hidden = true;
        spacer.style.height = "0";
      }
      applyTopVar();
      const top = getShopStickyNavTop();
      const rect = nav.getBoundingClientRect();
      stickY = rect.top + window.scrollY - top;
    };

    const update = () => {
      const shouldStick = window.scrollY >= stickY - 0.5;

      if (shouldStick) {
        if (!nav.classList.contains("is-stuck")) {
          const rect = nav.getBoundingClientRect();
          nav.style.setProperty("--shop-sticky-nav-left", `${rect.left}px`);
          nav.style.setProperty("--shop-sticky-nav-width", `${rect.width}px`);
          if (spacer) {
            const navH = isShopMobileStickyNavViewport()
              ? Math.min(Math.round(nav.getBoundingClientRect().height) || 0, 56)
              : nav.offsetHeight;
            spacer.style.height = `${Math.max(navH, 0)}px`;
            spacer.hidden = false;
          }
        }
        nav.classList.add("is-stuck");
        document.body.classList.add("shop-detail-page--action-nav-stuck");
      } else {
        nav.classList.remove("is-stuck");
        document.body.classList.remove("shop-detail-page--action-nav-stuck");
        if (spacer) {
          spacer.hidden = true;
          spacer.style.height = "0";
        }
      }
    };

    const onLayout = () => {
      measure();
      update();
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onLayout, { passive: true });
    if (document.fonts?.ready) {
      document.fonts.ready.then(onLayout).catch(() => {});
    }
    requestAnimationFrame(() => requestAnimationFrame(onLayout));
  }

  function setupShopStickyActionNavScroll(cfg) {
    const c = cfg || {};
    const nav = qs(SELECTORS.actionNav);
    const tabsHost = qs(SELECTORS.actionNavTabs);
    if (!nav || !tabsHost || tabsHost.dataset.shopStickyScrollBound === "1") return;
    tabsHost.dataset.shopStickyScrollBound = "1";

    const tabs = buildShopStickyActionNavTabs(c);
    const tabLinks = Array.from(tabsHost.querySelectorAll("[data-shop-action-tab]"));

    function setActive(sectionId) {
      tabLinks.forEach((a) => {
        a.classList.toggle("is-active", a.getAttribute("data-target") === sectionId);
      });
    }

    tabLinks.forEach((a) => {
      a.addEventListener("click", (ev) => {
        const sectionId = a.getAttribute("data-target") || "";
        const href = String(a.getAttribute("href") || "").trim();
        const anchor =
          href.startsWith("#") && href.length > 1 ? document.querySelector(href) : null;
        const el = anchor || document.getElementById(sectionId);
        if (!el) return;
        ev.preventDefault();
        setActive(sectionId);
        const top = el.getBoundingClientRect().top + window.scrollY - getActionNavScrollOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    });

    const resolveObserveTarget = (tab) => {
      const href = String(tab.href || "").trim();
      if (href.startsWith("#") && href.length > 1) {
        const anchor = document.querySelector(href);
        if (anchor) return anchor;
      }
      return document.getElementById(tab.sectionId);
    };

    const targets = tabs.map(resolveObserveTarget).filter(Boolean);

    if ("IntersectionObserver" in window && targets.length) {
      const marginTop = isShopMobileStickyNavViewport()
        ? -72
        : -getActionNavScrollOffset();
      const obs = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => (a.boundingClientRect.top || 0) - (b.boundingClientRect.top || 0))[0];
          if (visible?.target?.id) setActive(visible.target.id);
        },
        { root: null, threshold: 0.2, rootMargin: `${marginTop}px 0px -55% 0px` }
      );
      targets.forEach((t) => obs.observe(t));
    }
  }

  function renderRestaurantTabsActive() {
    const nav = qs(SELECTORS.restaurantTabs);
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll("a.shop-restaurant-tab"));
    if (!links.length) return;
    const byHref = new Map(
      links
        .map((a) => [String(a.getAttribute("href") || ""), a])
        .filter(([h]) => h.startsWith("#"))
    );
    const targets = Array.from(byHref.keys())
      .map((h) => document.querySelector(h))
      .filter(Boolean);
    if (!("IntersectionObserver" in window) || !targets.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top || 0) - (b.boundingClientRect.top || 0))[0];
        if (!top?.target?.id) return;
        const h = `#${top.target.id}`;
        links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === h));
      },
      { root: null, threshold: 0.35 }
    );
    targets.forEach((t) => obs.observe(t));
  }

  function applyBeautyTabs() {
    const nav = qs(SELECTORS.restaurantTabs);
    if (!nav) return;
    const map = {
      top: { label: "トップ", href: "#top" },
      menu: { label: "メニュー", href: "#section-products" },
      photos: { label: "スタイル", href: "#section-shop-cases" },
      reviews: { label: "口コミ", href: "#section-reviews" },
      details: { label: "スタイリスト", href: "#section-shop-highlights" },
      access: { label: "サロン情報・アクセス", href: "#section-shop-bottom" },
    };
    nav.querySelectorAll("a.shop-restaurant-tab").forEach((a) => {
      const key = String(a.getAttribute("data-shop-tab") || "").trim();
      const m = map[key];
      if (!m) return;
      a.textContent = m.label;
      a.setAttribute("href", m.href);
    });
  }

  function applyRelaxTabs() {
    const nav = qs(SELECTORS.restaurantTabs);
    if (!nav) return;
    const map = {
      top: { label: "トップ", href: "#section-top" },
      menu: { label: "メニュー", href: "#section-menu" },
      photos: { label: "店内・雰囲気", href: "#section-gallery" },
      details: { label: "セラピスト", href: "#section-therapists" },
      access: { label: "サロン情報・アクセス", href: "#section-info" },
      reviews: { label: "口コミ", href: "#section-reviews" },
    };
    const nodes = new Map(
      Array.from(nav.querySelectorAll("a.shop-restaurant-tab")).map((a) => [
        String(a.getAttribute("data-shop-tab") || "").trim(),
        a,
      ])
    );
    // 指定順: トップ / メニュー / 店内・雰囲気 / セラピスト / サロン情報・アクセス / 口コミ
    const order = ["top", "menu", "photos", "details", "access", "reviews"];
    order.forEach((key) => {
      const a = nodes.get(key);
      const m = map[key];
      if (!a || !m) return;
      a.textContent = m.label;
      a.setAttribute("href", m.href);
    });
    // DOM順を入れ替える（見た目・横スクロール順を一致させる）
    order.forEach((key) => {
      const a = nodes.get(key);
      if (a) nav.appendChild(a);
    });
  }

  function applyRetailTabs() {
    const nav = qs(SELECTORS.restaurantTabs);
    if (!nav) return;
    const map = {
      top: { label: "トップ", href: "#section-top" },
      menu: { label: "商品・サービス", href: "#section-menu" },
      photos: { label: "店内・雰囲気", href: "#section-gallery" },
      details: { label: "お知らせ", href: "#section-news" },
      access: { label: "アクセス", href: "#section-info" },
      reviews: { label: "口コミ", href: "#section-reviews" },
    };
    const nodes = new Map(
      Array.from(nav.querySelectorAll("a.shop-restaurant-tab")).map((a) => [
        String(a.getAttribute("data-shop-tab") || "").trim(),
        a,
      ])
    );
    const order = ["top", "menu", "photos", "details", "access", "reviews"];
    order.forEach((key) => {
      const a = nodes.get(key);
      const m = map[key];
      if (!a || !m) return;
      a.textContent = m.label;
      a.setAttribute("href", m.href);
    });
    order.forEach((key) => {
      const a = nodes.get(key);
      if (a) nav.appendChild(a);
    });
  }

  function setupRetailTabsScroll(cfg) {
    const c = cfg || {};
    if (!usesRetailUi(c)) return;
    const nav = qs(SELECTORS.restaurantTabs);
    if (!nav) return;
    nav.classList.add("relax-detail-tabs"); // 既存のfloating pill navを流用

    const topEl = document.querySelector(".biz-detail-fv");
    if (topEl && !topEl.id) topEl.id = "section-top";
    const menuEl = document.getElementById("section-products");
    if (menuEl && !menuEl.getAttribute("data-retail-anchor")) {
      menuEl.setAttribute("data-retail-anchor", "1");
      menuEl.setAttribute("data-retail-alias", "section-menu");
    }
    const galleryEl = document.getElementById("section-shop-cases");
    if (galleryEl && !galleryEl.getAttribute("data-retail-anchor")) {
      galleryEl.setAttribute("data-retail-anchor", "1");
      galleryEl.setAttribute("data-retail-alias", "section-gallery");
    }
    const newsEl = document.getElementById("section-shop-highlights");
    if (newsEl && !newsEl.getAttribute("data-retail-anchor")) {
      newsEl.setAttribute("data-retail-anchor", "1");
      newsEl.setAttribute("data-retail-alias", "section-news");
    }
    const infoEl = document.getElementById("section-shop-bottom");
    if (infoEl && !infoEl.getAttribute("data-retail-anchor")) {
      infoEl.setAttribute("data-retail-anchor", "1");
      infoEl.setAttribute("data-retail-alias", "section-info");
    }
    const reviewsEl = document.getElementById("section-reviews");
    if (reviewsEl && !reviewsEl.id) reviewsEl.id = "section-reviews";

    function resolveTargetFromHref(href) {
      const h = String(href || "");
      if (!h.startsWith("#")) return null;
      const id = h.slice(1);
      if (!id) return null;
      if (id === "section-menu") return document.getElementById("section-products");
      if (id === "section-gallery") return document.getElementById("section-shop-cases");
      if (id === "section-news") return document.getElementById("section-shop-highlights");
      if (id === "section-info") return document.getElementById("section-shop-bottom");
      return document.getElementById(id);
    }

    function setActiveByHref(href) {
      const h = String(href || "");
      nav.querySelectorAll("a.shop-restaurant-tab").forEach((a) => {
        a.classList.toggle("is-active", String(a.getAttribute("href") || "") === h);
      });
    }

    nav.querySelectorAll("a.shop-restaurant-tab").forEach((a) => {
      a.addEventListener("click", (ev) => {
        const href = a.getAttribute("href") || "";
        const target = resolveTargetFromHref(href);
        if (!target) return;
        ev.preventDefault();
        setActiveByHref(href);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function setupRelaxTabsScroll(cfg) {
    const c = cfg || {};
    if (!isRelax(c)) return;
    const nav = qs(SELECTORS.restaurantTabs);
    if (!nav) return;
    nav.classList.add("relax-detail-tabs");

    // セクションIDを付与（HTML構造は維持、id を追加するだけ）
    const topEl = document.querySelector(".biz-detail-fv");
    if (topEl && !topEl.id) topEl.id = "section-top";
    const menuEl = document.getElementById("section-products");
    if (menuEl) menuEl.id = menuEl.id || "section-products";
    if (menuEl && !menuEl.getAttribute("data-relax-anchor")) {
      menuEl.setAttribute("data-relax-anchor", "1");
      menuEl.setAttribute("data-relax-alias", "section-menu");
    }
    const galleryEl = document.getElementById("section-shop-cases");
    if (galleryEl && !galleryEl.getAttribute("data-relax-anchor")) {
      galleryEl.setAttribute("data-relax-anchor", "1");
      galleryEl.setAttribute("data-relax-alias", "section-gallery");
    }
    const therapistsEl = document.getElementById("section-shop-highlights");
    if (therapistsEl && !therapistsEl.getAttribute("data-relax-anchor")) {
      therapistsEl.setAttribute("data-relax-anchor", "1");
      therapistsEl.setAttribute("data-relax-alias", "section-therapists");
    }
    const infoEl = document.getElementById("section-shop-bottom");
    if (infoEl && !infoEl.getAttribute("data-relax-anchor")) {
      infoEl.setAttribute("data-relax-anchor", "1");
      infoEl.setAttribute("data-relax-alias", "section-info");
    }
    const reviewsEl = document.getElementById("section-reviews");
    if (reviewsEl && !reviewsEl.id) reviewsEl.id = "section-reviews";

    function resolveTargetFromHref(href) {
      const h = String(href || "");
      if (!h.startsWith("#")) return null;
      const id = h.slice(1);
      if (!id) return null;
      if (id === "section-menu") return document.getElementById("section-products");
      if (id === "section-gallery") return document.getElementById("section-shop-cases");
      if (id === "section-therapists") return document.getElementById("section-shop-highlights");
      if (id === "section-info") return document.getElementById("section-shop-bottom");
      return document.getElementById(id);
    }

    function setActiveByHref(href) {
      const h = String(href || "");
      nav.querySelectorAll("a.shop-restaurant-tab").forEach((a) => {
        a.classList.toggle("is-active", String(a.getAttribute("href") || "") === h);
      });
    }

    nav.querySelectorAll("a.shop-restaurant-tab").forEach((a) => {
      a.addEventListener("click", (ev) => {
        const href = a.getAttribute("href") || "";
        const target = resolveTargetFromHref(href);
        if (!target) return;
        ev.preventDefault();
        setActiveByHref(href);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function reorderRelaxSections() {
    const wrap = document.getElementById("shop-sections-root");
    if (!wrap) return;
    const products = document.getElementById(SECTION_IDS.products);
    const therapists = document.getElementById(SECTION_IDS.highlights);
    const gallery = document.getElementById(SECTION_IDS.cases);
    const reviews = document.getElementById(SECTION_IDS.reviews);
    const info = document.getElementById(SECTION_IDS.bottom);

    // 指定順: おすすめメニュー → セラピスト → 店内・雰囲気 → 口コミ → サロン情報
    [products, therapists, gallery, reviews, info].forEach((el) => {
      if (el && el.parentElement === wrap) wrap.appendChild(el);
    });
  }

  /** リラク：下部固定バーから FAQ タブを除去 */
  function removeRelaxStickyFaqLink(nav) {
    if (!nav) return;
    nav.querySelectorAll('[data-shop-sticky-nav="faq"]').forEach((el) => el.remove());
  }

  /** リラク：下部固定バーの項目順・ラベル・スクロール先（alias id） */
  function applyRelaxStickyNav(cfg) {
    const c = cfg || {};
    if (!isRelax(c)) return;
    const nav = qs("[data-shop-sticky-nav]");
    if (!nav) return;

    removeRelaxStickyFaqLink(nav);

    const items = [
      { key: "products", label: "メニュー", href: "#section-menu", target: "section-products" },
      { key: "highlights", label: "セラピスト", href: "#section-therapists", target: "section-shop-highlights" },
      { key: "cases", label: "店内・雰囲気", href: "#section-gallery", target: "section-shop-cases" },
      { key: "reviews", label: "口コミ", href: "#section-reviews", target: "section-reviews" },
      { key: "bottom", label: "サロン情報", href: "#section-info", target: "section-shop-bottom" },
    ];

    const nodes = new Map(
      Array.from(nav.querySelectorAll("a.shop-sticky-nav__item")).map((a) => [
        String(a.getAttribute("data-shop-sticky-nav") || "").trim(),
        a,
      ])
    );

    items.forEach((item) => {
      const a = nodes.get(item.key);
      if (!a) return;
      a.textContent = item.label;
      a.setAttribute("href", item.href);
      a.setAttribute("data-target", item.target);
      a.hidden = false;
      a.removeAttribute("hidden");
    });

    items.forEach((item) => {
      const a = nodes.get(item.key);
      if (a) nav.appendChild(a);
    });
  }

  function resolveRelaxStickyTarget(idOrHref) {
    const id = String(idOrHref || "").replace("#", "").trim();
    if (!id) return null;
    if (id === "section-menu") return document.getElementById("section-products");
    if (id === "section-gallery") return document.getElementById("section-shop-cases");
    if (id === "section-therapists") return document.getElementById("section-shop-highlights");
    if (id === "section-info") return document.getElementById("section-shop-bottom");
    return document.getElementById(id);
  }

  function setupRestaurantReviewScroll() {
    // anchor href に任せる（将来、複数導線が増えたらここで統一しても良い）
  }

  function renderRestaurantSidebar(listing, cfg) {
    const host = qs(SELECTORS.restaurantSidebar);
    if (!host) return;
    const extra = pickExtra(listing);
    const hours = String(listing.business_hours || extra.business_hours_extra || "10:00〜19:00").trim();
    const closed = String(extra.closed_day || "—").trim();
    const phone = String(listing.phone || extra.phone || "06-1234-5678").trim();
    const address = String(extra.address || listing.service_area || "").trim() || "大阪府 大阪市北区○○1-2-3";
    const access = String(extra.access || extra.station || "最寄駅から徒歩5分").trim();
    const favBtn = qs(SELECTORS.favoriteBtn);

    host.innerHTML = `
      <section class="food-side-card" aria-label="お問い合わせ・予約">
        <h3 class="food-side-card__title">お問い合わせ・予約</h3>
        <div class="food-side-kv">
          <div class="food-side-kv__row"><span aria-hidden="true">🕐</span><span>${esc(hours)} <span style="color:var(--food-muted);font-weight:800;">(L.O.18:30)</span></span></div>
          <div class="food-side-kv__row"><span aria-hidden="true">📅</span><span>定休日　${esc(closed)}</span></div>
          <div class="food-side-kv__row"><span aria-hidden="true">☎</span><span>${esc(phone)}</span></div>
        </div>
        <div class="food-side-actions">
          <a class="food-side-btn" href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">電話する</a>
          <a class="food-side-btn food-side-btn--primary" href="${esc(cfg?.ctaPrimaryHref || "chat.html")}">Web予約する</a>
        </div>
      </section>

      <section class="food-side-card" aria-label="アクセス">
        <h3 class="food-side-card__title">アクセス</h3>
        <div class="food-side-kv">
          <div class="food-side-kv__row"><span aria-hidden="true">📍</span><span>${esc(address)}</span></div>
          <div class="food-side-kv__row"><span aria-hidden="true">🚉</span><span>${esc(access)}</span></div>
        </div>
        <div class="food-map" aria-hidden="true"></div>
        <div class="food-side-actions" style="grid-template-columns: 1fr;">
          <a class="food-side-btn" href="#section-shop-bottom">ルートを確認</a>
        </div>
      </section>

      <section class="food-side-card" aria-label="SNS">
        <h3 class="food-side-card__title">SNS</h3>
        <div class="food-sns-row" aria-label="SNSリンク">
          <a class="food-sns-icon food-sns-icon--ig" href="#" aria-label="Instagram">IG</a>
          <a class="food-sns-icon food-sns-icon--x" href="#" aria-label="X">X</a>
          <a class="food-sns-icon food-sns-icon--fb" href="#" aria-label="Facebook">f</a>
        </div>
        <div class="food-side-actions" style="grid-template-columns: 1fr;margin-top:10px;">
          <a class="food-side-btn" href="#" aria-label="Share">このお店をシェア</a>
        </div>
      </section>

      <section class="food-side-card" aria-label="お気に入り">
        <h3 class="food-side-card__title">お気に入りに追加</h3>
        <p style="margin:0;color:var(--food-muted);font-weight:700;font-size:0.88rem;line-height:1.6;">気になるお店は保存しておくと、あとからゆっくりチェックできます。</p>
        <div class="food-side-actions" style="grid-template-columns: 1fr;margin-top:12px;">
          <div data-food-favorite-host></div>
        </div>
      </section>
    `;

    const favHost = host.querySelector("[data-food-favorite-host]");
    if (favBtn && favHost) {
      favBtn.hidden = false;
      favBtn.removeAttribute("hidden");
      favHost.appendChild(favBtn);
    }
  }

  function renderHeroGallery(listing) {
    const cfg = window.TasuShopDetailCategory?.getConfigForListing?.(listing);
    const urls = isRestaurant(cfg)
      ? pickFoodImages(listing)
      : isBeauty(cfg)
      ? (() => {
          const base = normalizeImages(listing);
          const merged = [...base, ...BEAUTY_DEMO.images]
            .map((u) => String(u || "").trim())
            .filter(Boolean);
          const uniq = [];
          const seen = new Set();
          merged.forEach((u) => {
            if (seen.has(u)) return;
            seen.add(u);
            uniq.push(u);
          });
          return uniq.length ? uniq : BEAUTY_DEMO.images.slice();
        })()
      : isRelax(cfg)
      ? (() => {
          const base = normalizeImages(listing);
          const merged = [...base, ...RELAX_DEMO.images]
            .map((u) => String(u || "").trim())
            .filter(Boolean);
          const uniq = [];
          const seen = new Set();
          merged.forEach((u) => {
            if (seen.has(u)) return;
            seen.add(u);
            uniq.push(u);
          });
          return uniq.length ? uniq : RELAX_DEMO.images.slice();
        })()
      : usesRetailUi(cfg)
      ? (() => {
          const base = normalizeImages(listing);
          const demoImgs = getRetailDemoPack(cfg).images || [];
          const merged = [...base, ...demoImgs].map((u) => String(u || "").trim()).filter(Boolean);
          const uniq = [];
          const seen = new Set();
          merged.forEach((u) => {
            if (seen.has(u)) return;
            seen.add(u);
            uniq.push(u);
          });
          return uniq.length ? uniq : demoImgs.slice();
        })()
      : normalizeImages(listing);
    const heroImg = qs(SELECTORS.heroImg);
    const thumbs = qs(SELECTORS.thumbs);
    if (heroImg) {
      const fallback = isBeauty(cfg)
        ? pickBeautyDemoImage(0)
        : isRelax(cfg)
        ? pickRelaxDemoImage(0)
        : usesRetailUi(cfg)
        ? pickRetailDemoImage(0, cfg)
        : pickFoodDemoImage(0);
      const src = String(urls?.[0] || "").trim() || fallback;
      heroImg.src = src;
      heroImg.onerror = () => {
        if (fallback) heroImg.src = fallback;
      };
    }
    if (!thumbs) return;
    if (urls.length <= 1) {
      thumbs.hidden = true;
      thumbs.innerHTML = "";
      return;
    }
    const visibleCount = isRestaurant(cfg) || isBeauty(cfg) || isRelax(cfg) ? 6 : 4;
    const visible = urls.slice(0, visibleCount);
    const overflow = Math.max(0, urls.length - visible.length);
    thumbs.hidden = false;
    thumbs.innerHTML = visible
      .map((u, i) => {
        const overlay =
          isRestaurant(cfg) && overflow > 0 && i === visible.length - 1
            ? `<span class="shop-thumb-more-overlay" aria-hidden="true">+${overflow}</span>`
            : "";
        const fallback = isBeauty(cfg)
          ? pickBeautyDemoImage(i)
          : isRelax(cfg)
          ? pickRelaxDemoImage(i)
          : usesRetailUi(cfg)
          ? pickRetailDemoImage(i, cfg)
          : pickFoodDemoImage(i);
        return `<button type="button" class="shop-thumb-btn${i === 0 ? " is-active" : ""}" data-url="${esc(
          u
        )}" aria-label="画像 ${i + 1}">
          <img src="${esc(String(u || "").trim() || fallback)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${esc(
            fallback
          )}'">
          ${overlay}
        </button>`;
      })
      .join("");

    thumbs.querySelectorAll(".shop-thumb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const u = String(btn.getAttribute("data-url") || "").trim();
        if (heroImg && u) heroImg.src = u;
        thumbs.querySelectorAll(".shop-thumb-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });
  }

  function renderHeroMeta(listing) {
    const cfg = window.TasuShopDetailCategory?.getConfigForListing?.(listing);
    if (isRestaurant(cfg)) {
      const quick = qs(SELECTORS.quick);
      if (quick) {
        const extra = listing?.category_extra?.shop_store || {};
        const addrRaw =
          String(extra.city || extra.city_area || "").trim() ||
          String(extra.address_simple || "").trim() ||
          String(listing.service_area || "").trim() ||
          String(extra.address || "").trim() ||
          "";
        const shortAddr = addrRaw
          ? addrRaw.replace(/\s+/g, " ").trim().slice(0, 24)
          : "大阪府 大阪市北区";
        quick.hidden = false;
        quick.removeAttribute("hidden");
        quick.classList.add("food-top-location");
        quick.innerHTML = `<li class="food-top-location__item"><span class="food-top-location__icon" aria-hidden="true">📍</span><span class="food-top-location__text">${esc(
          shortAddr
        )}</span></li>`;
      }
      return;
    }
    if (isBeauty(cfg)) {
      const quick = qs(SELECTORS.quick);
      if (quick) {
        const extra = pickExtra(listing);
        const area =
          String(extra.city || extra.city_area || "").trim() ||
          String(extra.address_simple || "").trim() ||
          "東京都 渋谷区 神宮前";
        quick.hidden = false;
        quick.removeAttribute("hidden");
        quick.innerHTML = `<p class="beauty-top-area"><span class="beauty-top-area__icon" aria-hidden="true">📍</span><span>${esc(
          area
        )}</span></p>`;
      }
      return;
    }
    if (isRelax(cfg)) {
      const quick = qs(SELECTORS.quick);
      if (quick) {
        const extra = pickExtra(listing);
        const area =
          String(extra.city || extra.city_area || "").trim() ||
          String(extra.address_simple || "").trim() ||
          "東京都 渋谷区 神宮前";
        quick.hidden = false;
        quick.removeAttribute("hidden");
        quick.innerHTML = `<p class="relax-top-area"><span class="relax-top-area__icon" aria-hidden="true">📍</span><span>${esc(
          area
        )}</span></p>`;
      }
      return;
    }
    if (usesRetailUi(cfg)) {
      const quick = qs(SELECTORS.quick);
      if (quick) {
        const extra = pickExtra(listing);
        const topDef = goodsInteriorTopDefaults(cfg);
        const area =
          String(extra.city || extra.city_area || "").trim() ||
          String(extra.address_simple || listing.service_area || "").trim() ||
          topDef?.area ||
          "東京都 渋谷区 神宮前";
        const hours = String(
          listing.business_hours || extra.business_hours_extra || topDef?.hours || "10:00〜20:00"
        ).trim();
        quick.hidden = false;
        quick.removeAttribute("hidden");
        quick.innerHTML = `<p class="relax-top-area"><span class="relax-top-area__icon" aria-hidden="true">📍</span><span>${esc(
          area
        )}</span></p><p class="retail-top-hours"><span aria-hidden="true">🕐</span> ${esc(hours)}</p>`;
      }
      return;
    }
    const extra = listing?.category_extra?.shop_store || {};
    const quick = qs(SELECTORS.quick);
    if (!quick) return;
    quick.classList.add("shop-hero-meta");
    const rows = [
      { icon: "📍", label: "住所", value: extra.address || "" },
      { icon: "🕐", label: "営業時間", value: listing.business_hours || "" },
      { icon: "📅", label: "定休日", value: extra.closed_day || "" },
      { icon: "🚉", label: "アクセス", value: extra.access || "" },
    ].filter((r) => String(r.value || "").trim());
    quick.innerHTML = rows
      .map(
        (r) =>
          `<li class="shop-hero-meta__item"><span class="shop-hero-meta__icon" aria-hidden="true">${r.icon}</span><span class="shop-hero-meta__label">${esc(
            r.label
          )}</span><span class="shop-hero-meta__value">${esc(r.value)}</span></li>`
      )
      .join("");
  }

  function renderHeroTags(listing) {
    const genre = qs(SELECTORS.genreTags);
    const cond = qs(SELECTORS.conditionTags);
    const categoryLabel =
      String(listing.categoryLabel || listing.business_subcategory || "店舗・販売").trim() || "店舗・販売";
    const tags = [
      categoryLabel,
      ...(Array.isArray(listing.service_tags) ? listing.service_tags : []),
      ...(Array.isArray(listing.tags) ? listing.tags : []),
    ]
      .map((t) => String(t || "").trim())
      .filter(Boolean);
    const uniq = [];
    const seen = new Set();
    tags.forEach((t) => {
      if (seen.has(t)) return;
      seen.add(t);
      uniq.push(t);
    });
    const cfg = window.TasuShopDetailCategory?.getConfigForListing?.(listing);
    const top = uniq.slice(0, 5);
    if (genre) {
      if (isRestaurant(cfg)) {
        // restaurant: 「retail」等のバッジ群は出さず、カテゴリバッジのみ
        const extra = pickExtra(listing);
        const badge =
          String(extra.store_type || extra.shop_type || "").trim() ||
          String(cfg?.categoryLabel || "カフェ・喫茶店").trim() ||
          "カフェ・喫茶店";
        genre.hidden = false;
        genre.removeAttribute("hidden");
        genre.innerHTML = `<span class="food-category-badge">${esc(badge)}</span>`;
      } else if (isBeauty(cfg)) {
        const extra = pickExtra(listing);
        const badge =
          String(extra.store_type || extra.shop_type || "").trim() ||
          String(cfg?.categoryLabel || "美容サロン・ヘアサロン").trim() ||
          "美容サロン・ヘアサロン";
        genre.hidden = false;
        genre.removeAttribute("hidden");
        genre.innerHTML = `<span class="beauty-category-badge">${esc(badge)}</span>`;
      } else if (isRelax(cfg)) {
        const badge = String(cfg?.categoryLabel || "リラクゼーション・マッサージ").trim() || "リラクゼーション・マッサージ";
        genre.hidden = false;
        genre.removeAttribute("hidden");
        genre.innerHTML = `<span class="relax-category-badge">${esc(badge)}</span>`;
      } else if (usesRetailUi(cfg)) {
        const extra = pickExtra(listing);
        const topDef = goodsInteriorTopDefaults(cfg);
        const badge =
          String(extra.store_type || extra.shop_type || "").trim() ||
          String(cfg?.categoryLabel || topDef?.storeType || "小売・物販").trim() ||
          "小売・物販";
        genre.hidden = false;
        genre.removeAttribute("hidden");
        genre.innerHTML = `<span class="food-category-badge">${esc(badge)}</span>`;
      } else {
        genre.hidden = top.length === 0;
        genre.innerHTML = top.map((t) => `<span class="shop-tag shop-tag--top">${esc(t)}</span>`).join("");
      }
    }
    if (cond) {
      const cfg = window.TasuShopDetailCategory?.getConfigForListing?.(listing);
      if (isRestaurant(cfg)) {
        const extra = pickExtra(listing);
        const fd = listing?.form_data || {};
        const chips = [
          extra.wifi === "yes" || fd.wifi === "yes" ? "Wi‑Fiあり" : "",
          extra.power === "yes" || fd.power === "yes" ? "電源あり" : "",
          extra.takeout === "yes" || fd.takeout === "yes" ? "テイクアウトOK" : "",
          extra.pet === "yes" || fd.pet === "yes" ? "ペット同伴OK" : "",
        ].filter(Boolean);
        const demo = ["Wi‑Fiあり", "電源あり", "テイクアウトOK", "ペット同伴OK"];
        const final = chips.length ? chips : demo;
        cond.hidden = false;
        cond.removeAttribute("hidden");
        cond.innerHTML = final.map((t) => `<span class="food-facility-chip">${esc(t)}</span>`).join("");
      } else if (isBeauty(cfg)) {
        const extra = pickExtra(listing);
        const fd = listing?.form_data || {};
        const chips = [
          extra.private_room === "yes" || fd.private_room === "yes" ? "個室あり" : "",
          extra.wifi === "yes" || fd.wifi === "yes" ? "Wi‑Fiあり" : "",
          extra.charger === "yes" || fd.charger === "yes" ? "充電器あり" : "",
          extra.card === "yes" || fd.card === "yes" ? "クレカOK" : "",
          extra.mens === "yes" || fd.mens === "yes" ? "メンズ歓迎" : "",
          extra.today === "yes" || fd.today === "yes" ? "当日予約OK" : "",
          extra.hairset === "yes" || fd.hairset === "yes" ? "ヘアセットOK" : "",
        ].filter(Boolean);
        const final = chips.length ? chips : BEAUTY_DEMO.tags;
        cond.hidden = false;
        cond.removeAttribute("hidden");
        cond.innerHTML = final.slice(0, 7).map((t) => `<span class="beauty-chip">${esc(t)}</span>`).join("");
      } else if (isRelax(cfg)) {
        const extra = pickExtra(listing);
        const fd = listing?.form_data || {};
        const chips = [
          extra.private_room === "yes" || fd.private_room === "yes" ? "個室あり" : "",
          extra.change_clothes === "yes" || fd.change_clothes === "yes" ? "着替えあり" : "",
          extra.aroma === "yes" || fd.aroma === "yes" ? "アロマ使用" : "",
          extra.card === "yes" || fd.card === "yes" ? "クレカOK" : "",
          extra.unisex === "yes" || fd.unisex === "yes" ? "男女OK" : "",
          extra.today === "yes" || fd.today === "yes" ? "当日予約OK" : "",
          extra.night === "yes" || fd.night === "yes" ? "深夜営業" : "",
          extra.pair === "yes" || fd.pair === "yes" ? "ペア利用OK" : "",
        ].filter(Boolean);
        const final = chips.length ? chips : RELAX_DEMO.tags;
        cond.hidden = false;
        cond.removeAttribute("hidden");
        cond.innerHTML = final.slice(0, 8).map((t) => `<span class="relax-chip">${esc(t)}</span>`).join("");
      } else if (usesRetailUi(cfg)) {
        const tagsFromCfg = Array.isArray(cfg?.facilityTags) ? cfg.facilityTags : [];
        const demoTags = isVintageBrand(cfg)
          ? VINTAGE_BRAND_DEMO.tags
          : isGoodsInterior(cfg)
            ? GOODS_INTERIOR_DEMO.tags
            : [];
        const final = tagsFromCfg.length ? tagsFromCfg : demoTags;
        cond.hidden = false;
        cond.removeAttribute("hidden");
        cond.innerHTML = final.slice(0, 8).map((t) => `<span class="beauty-chip">${esc(t)}</span>`).join("");
      } else {
        cond.hidden = true;
        cond.innerHTML = "";
      }
    }
  }

  function renderHeroText(listing) {
    const titleEl = qs(SELECTORS.title);
    const companyEl = qs(SELECTORS.company);
    const leadEl = qs(SELECTORS.lead);
    const extra = pickExtra(listing);
    const cfg = window.TasuShopDetailCategory?.getConfigForListing?.(listing);
    const topDef = goodsInteriorTopDefaults(cfg);

    const name = String(extra.shop_name || listing.company_name || topDef?.shopName || "").trim();
    const title = String(listing.title || "").trim();
    if (titleEl) {
      titleEl.textContent =
        isRestaurant(cfg) || usesRetailUi(cfg) ? name || title || "店舗詳細" : title || name || "店舗詳細";
    }
    if (companyEl) companyEl.textContent = name || listing.company_name || "";
    if (leadEl) {
      const d = String(extra.shop_description || listing.description || topDef?.description || "").trim();
      leadEl.hidden = !d;
      leadEl.textContent = clampText(d, isRestaurant(cfg) ? 120 : 200);
    }

    if (isRestaurant(cfg)) {
      const row = qs(SELECTORS.heroRatingRow);
      const starsEl = qs(SELECTORS.heroRatingStars);
      const scoreEl = qs(SELECTORS.heroRatingScore);
      const countEl = qs(SELECTORS.heroRatingCount);
      const avg = Number(listing.rating || 0) || 4.8;
      const cnt = Number(listing.review_count || listing.reviewCount || 0) || 123;
      if (row) {
        row.hidden = false;
        row.removeAttribute("hidden");
      }
      if (starsEl) starsEl.textContent = "★";
      if (scoreEl) scoreEl.textContent = avg.toFixed(1);
      if (countEl) countEl.textContent = `（${cnt}件の口コミ）`;
    }
    if (isBeauty(cfg)) {
      const row = qs(SELECTORS.heroRatingRow);
      const starsEl = qs(SELECTORS.heroRatingStars);
      const scoreEl = qs(SELECTORS.heroRatingScore);
      const countEl = qs(SELECTORS.heroRatingCount);
      const avg = Number(listing.rating || 0) || 4.8;
      const cnt = Number(listing.review_count || listing.reviewCount || 0) || 126;
      if (row) {
        row.hidden = false;
        row.removeAttribute("hidden");
      }
      if (starsEl) starsEl.textContent = "★";
      if (scoreEl) scoreEl.textContent = avg.toFixed(1);
      if (countEl) countEl.textContent = `（${cnt}件の口コミ）`;
    }
    if (isRelax(cfg)) {
      const row = qs(SELECTORS.heroRatingRow);
      const starsEl = qs(SELECTORS.heroRatingStars);
      const scoreEl = qs(SELECTORS.heroRatingScore);
      const countEl = qs(SELECTORS.heroRatingCount);
      const avg = Number(listing.rating || 0) || 4.8;
      const cnt = Number(listing.review_count || listing.reviewCount || 0) || 126;
      if (row) {
        row.hidden = false;
        row.removeAttribute("hidden");
      }
      if (starsEl) starsEl.textContent = "★";
      if (scoreEl) scoreEl.textContent = avg.toFixed(1);
      if (countEl) countEl.textContent = `（${cnt}件の口コミ）`;
    }
    if (usesRetailUi(cfg)) {
      const row = qs(SELECTORS.heroRatingRow);
      const starsEl = qs(SELECTORS.heroRatingStars);
      const scoreEl = qs(SELECTORS.heroRatingScore);
      const countEl = qs(SELECTORS.heroRatingCount);
      const topDef = goodsInteriorTopDefaults(cfg);
      const avg = Number(listing.rating || 0) || topDef?.rating || 4.7;
      const cnt = Number(listing.review_count || listing.reviewCount || 0) || topDef?.reviewCount || 128;
      if (row) {
        row.hidden = false;
        row.removeAttribute("hidden");
      }
      if (starsEl) starsEl.textContent = "★";
      if (scoreEl) scoreEl.textContent = avg.toFixed(1);
      if (countEl) countEl.textContent = `（${cnt}件の口コミ）`;
    }
  }

  function formatStars(avg) {
    const a = Math.max(0, Math.min(5, Number(avg) || 0));
    const full = Math.floor(a);
    const half = a - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "☆" : "") + "☆".repeat(empty);
  }

  function parseReviewDistributionCount(row) {
    if (row == null) return 0;
    if (typeof row === "number" && Number.isFinite(row)) return Math.max(0, Math.round(row));
    const count = Number(row?.count);
    if (Number.isFinite(count) && count >= 0) return Math.round(count);
    const pct = Number(row?.pct);
    if (Number.isFinite(pct) && pct > 0 && pct <= 1) return Math.round(pct * 100);
    const m = String(row?.label || "").match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  /** 最多件数を100%として星別バー幅を算出（例: 123件=100%, 35件≈28%, 9件≈7%） */
  function buildReviewBarRows(distribution) {
    const rows = Array.isArray(distribution) ? distribution : [];
    const counts = rows.map(parseReviewDistributionCount);
    const maxCount = Math.max(1, ...counts, 0);
    return rows.map((row, i) => {
      const count = parseReviewDistributionCount(row);
      const widthPct = Math.round((count / maxCount) * 100);
      return {
        stars: row?.stars != null ? row.stars : 5 - i,
        count,
        label: String(row?.label || `${count}件`).trim(),
        widthPct,
      };
    });
  }

  function renderReviewBarsHtml(rows, options = {}) {
    const trackClass = String(options.trackClass || "food-reviews-bar__track").trim();
    const fillClass = String(options.fillClass || "food-reviews-bar__fill").trim();
    const barClass = String(options.barClass || "food-reviews-bar").trim();
    const labelClass = String(options.labelClass || "food-reviews-bar__label").trim();
    const pctClass = String(options.pctClass || "food-reviews-bar__pct").trim();
    const pctMode = options.pctMode === "width" ? "width" : "label";
    return (rows || [])
      .map((row) => {
        const width = Math.max(0, Math.min(100, Number(row.widthPct) || 0));
        const pctText = pctMode === "width" ? `${width}%` : esc(row.label || `${row.count}件`);
        return `<div class="${barClass}">
          <span class="${labelClass}">${esc(String(row.stars ?? ""))}</span>
          <span class="${trackClass}"><span class="${fillClass}" style="width:${width}%"></span></span>
          <span class="${pctClass}">${pctText}</span>
        </div>`;
      })
      .join("");
  }

  function renderCompactReviewBarsHtml(rows, options = {}) {
    const trackClass = String(options.trackClass || "beauty-review-bar__track").trim();
    const fillClass = String(options.fillClass || "beauty-review-bar__fill").trim();
    const barClass = String(options.barClass || "beauty-review-bar").trim();
    const pctMode = options.pctMode === "label" ? "label" : "width";
    return (rows || [])
      .map((row) => {
        const width = Math.max(0, Math.min(100, Number(row.widthPct) || 0));
        const pctText = pctMode === "label" ? esc(row.label || `${row.count}件`) : `${width}%`;
        return `<div class="${barClass}"><span>${esc(String(row.stars ?? ""))}</span><span class="${trackClass}"><span class="${fillClass}" style="width:${width}%"></span></span><span>${pctText}</span></div>`;
      })
      .join("");
  }

  function renderSidebar(listing, cfg) {
    const c = cfg || getCategoryConfig(listing);
    const ratingWrap = qs(SELECTORS.sidebarRatingWrap);
    const starsEl = qs(SELECTORS.sidebarRatingStars);
    const scoreEl = qs(SELECTORS.sidebarRatingScore);
    const countEl = qs(SELECTORS.sidebarRatingCount);
    const priceEl = qs(SELECTORS.sidebarPrice);
    const actions = qs(SELECTORS.sidebarActions);
    const favBtn = qs(SELECTORS.favoriteBtn);

    const avg = Number(listing.rating || 0) || 4.8;
    const cnt = Number(listing.review_count || listing.reviewCount || 0) || 35;
    if (ratingWrap) ratingWrap.hidden = false;
    if (starsEl) starsEl.textContent = formatStars(avg);
    if (scoreEl) scoreEl.textContent = avg.toFixed(1);
    if (countEl) countEl.textContent = `口コミ${cnt}件`;
    if (priceEl) priceEl.textContent = String(listing.budget || listing.main_price_text || "見積無料〜").trim();

    if (actions) {
      const aiHref = buildShopAiConsultHref(listing);
      const primaryHref = esc(c.ctaPrimaryHref || "chat.html");
      const secondaryHref = esc(resolveProductsListHref(listing, c));
      actions.innerHTML = [
        `<a class="biz-detail-btn biz-detail-btn--primary biz-detail-btn--store-ai" href="${aiHref}">${esc(c.ctaAiText || "AIに相談する")}</a>`,
        `<a class="biz-detail-btn biz-detail-btn--primary" data-biz-detail-inquiry href="${primaryHref}">${esc(c.ctaPrimaryText || "問い合わせる")}</a>`,
        `<a class="biz-detail-btn biz-detail-btn--outline" href="${secondaryHref}">${esc(getShopStickySecondaryCtaLabel(c))}</a>`,
      ].join("");
    }

    if (favBtn) {
      favBtn.hidden = false;
      favBtn.removeAttribute("hidden");
    }
  }

  function renderProductsSection(listing, cfg) {
    const c = cfg || getCategoryConfig(listing);
    const root = document.getElementById(SECTION_IDS.products);
    if (!root) return;
    root.classList.add("shop-card");
    const allProductsHref = esc(resolveProductsListHref(listing, c));

    if (isRestaurant(c)) {
      const extra = pickExtra(listing);
      const intro =
        String(extra.shop_introduction || extra.shop_description || listing.description || "").trim() ||
        "こだわりのスペシャルティコーヒーと、毎日手作りするスイーツが自慢のカフェです。落ち着いた空間で、ゆったりとした時間をお過ごしください。";
      const imgs = pickFoodImages(listing).slice(0, 4);
      const prod = Array.isArray(listing.products) ? listing.products : [];
      const menu =
        prod
          .map((p) => ({
            title: String(p?.title || "").trim(),
            price: String(p?.price || "").trim(),
            img: String(p?.image_url || p?.product_image_url || "").trim(),
          }))
          .filter((m) => m.title) || [];
      const menuCards = (menu.length ? menu : FOOD_DEMO.menu)
        .slice(0, 4)
        .map((m) => {
          const fallback = String(m?.img || "").trim() || pickFoodDemoImage(0);
          const src = String(m?.img || "").trim() || fallback;
          const img = buildImgTagWithFallback(src, fallback, "");
          const price = m.price || "¥—";
          const tax = m.tax || "（税込）";
          return `<article class="food-menu-card">
            <div class="food-menu-card__img">${img}</div>
            <div class="food-menu-card__body">
              <h3 class="food-menu-card__name">${esc(m.title)}</h3>
              <p class="food-menu-card__price">${esc(price)} <small>${esc(tax)}</small></p>
            </div>
          </article>`;
        })
        .join("");

      showShopSectionElement(root);
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">お店の紹介</h2>
        </div>
        <p style="margin:0;color:var(--food-muted);font-weight:700;line-height:1.75;">${esc(
          clampText(intro, 340)
        )}</p>
        <div class="food-intro-photos" aria-label="紹介写真">
          ${imgs
            .map(
              (u) =>
                `<div class="food-photo" style="aspect-ratio:16/11;"><img src="${esc(
                  u
                )}" alt="" loading="lazy" decoding="async"></div>`
            )
            .join("")}
        </div>
        <div style="height:16px"></div>
        <div class="food-sec-head">
          <h2 class="food-sec-title">おすすめメニュー</h2>
          <a class="food-link" href="${allProductsHref}">すべてのメニューを見る ›</a>
        </div>
        <div class="food-menu-grid">${menuCards}</div>
      `;
      return;
    }

    if (isBeauty(c)) {
      const prod = Array.isArray(listing.products) ? listing.products : [];
      const menu =
        prod
          .map((p) => ({
            title: String(p?.title || p?.name || "").trim(),
            price: String(p?.price || "").trim(),
            duration: String(p?.duration || p?.time || "").trim(),
            img: String(p?.image_url || p?.product_image_url || "").trim(),
          }))
          .filter((m) => m.title) || [];

      const base = menu.length ? menu : BEAUTY_DEMO.menu;
      const cards = base
        .slice(0, 4)
        .map((m, i) => {
          const fallback = pickBeautyDemoImage(i);
          const src = String(m?.img || "").trim() || fallback;
          const img = buildImgTagWithFallback(src, fallback, "");
          const price = m.price || "¥—";
          const dur = m.duration || "—分";
          return `<article class="beauty-menu-card">
            <div class="beauty-menu-card__img">${img}</div>
            <div class="beauty-menu-card__body">
              <h3 class="beauty-menu-card__name">${esc(m.title)}</h3>
              <div class="beauty-menu-card__meta"><span>${esc(dur)}</span><span class="beauty-menu-card__price">${esc(
                price
              )}</span></div>
            </div>
          </article>`;
        })
        .join("");

      revealShopSection(root);
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">おすすめメニュー</h2>
          <a class="food-link" href="#section-products">すべてのメニューを見る ›</a>
        </div>
        <div class="beauty-menu-grid">${cards}</div>
      `;
      return;
    }

    if (isRelax(c)) {
      const prod = Array.isArray(listing.products) ? listing.products : [];
      const menu =
        prod
          .map((p) => ({
            title: String(p?.title || p?.name || "").trim(),
            price: String(p?.price || "").trim(),
            duration: String(p?.duration || p?.time || "").trim(),
            img: String(p?.image_url || p?.product_image_url || "").trim(),
          }))
          .filter((m) => m.title) || [];

      const base = menu.length ? menu : RELAX_DEMO.menu;
      const cards = base
        .slice(0, 4)
        .map((m, i) => {
          const fallback = pickRelaxDemoImage(i);
          const src = String(m?.img || "").trim() || fallback;
          const img = buildImgTagWithFallback(src, fallback, "");
          const price = m.price || "¥—";
          const dur = m.duration || "—分";
          return `<article class="relax-menu-card">
            <div class="relax-menu-card__img">${img}</div>
            <div class="relax-menu-card__body">
              <h3 class="relax-menu-card__name">${esc(m.title)} <span class="relax-menu-card__dur">${esc(
                dur
              )}</span></h3>
              <p class="relax-menu-card__price">${esc(price)}</p>
            </div>
          </article>`;
        })
        .join("");

      revealShopSection(root);
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">おすすめメニュー</h2>
          <a class="food-link" href="#section-products">すべてのメニューを見る ›</a>
        </div>
        <div class="relax-menu-grid" aria-label="おすすめメニュー">${cards}</div>
      `;
      return;
    }

    if (usesRetailUi(c)) {
      const demoPack = getRetailDemoPack(c);
      const prod = Array.isArray(listing.products) ? listing.products : [];
      const items =
        prod
          .map((p) => ({
            title: String(p?.title || p?.name || "").trim(),
            sub: String(p?.description || p?.sub || "").trim(),
            price: String(p?.price || "").trim(),
            img: String(p?.image_url || p?.product_image_url || "").trim(),
          }))
          .filter((m) => m.title) || [];

      const merged = [...items, ...(Array.isArray(demoPack.products) ? demoPack.products : [])]
        .map((m) => ({
          title: String(m?.title || "").trim(),
          sub: String(m?.sub || m?.description || "").trim(),
          price: String(m?.price || "").trim(),
          img: String(m?.img || "").trim(),
        }))
        .filter((m) => m.title);
      const uniq = [];
      const seen = new Set();
      merged.forEach((m) => {
        const key = m.title;
        if (!key || seen.has(key)) return;
        seen.add(key);
        uniq.push(m);
      });

      const cards = uniq
        .slice(0, 4)
        .map((m, i) => {
          const fallback = pickRetailDemoImage(i, c);
          const src = String(m?.img || "").trim() || fallback;
          const img = buildImgTagWithFallback(src, fallback, "");
          const price = m.price || "¥—";
          const sub = m.sub || "—";
          return `<article class="retail-prod-card">
            <div class="retail-prod-card__img">${img}</div>
            <button type="button" class="retail-prod-card__fav" aria-label="お気に入り">♡</button>
            <div class="retail-prod-card__body">
              <h3 class="retail-prod-card__name">${esc(m.title)}</h3>
              <p class="retail-prod-card__sub">${esc(clampText(sub, 44))}</p>
              <p class="retail-prod-card__price">${esc(price)}</p>
            </div>
          </article>`;
        })
        .join("");

      revealShopSection(root);
      root.classList.add("shop-mobile-products-section");
      const mobileProductsUi =
        isShopMobileStickyNavViewport() &&
        window.TasuShopDetailCategory?.usesNativeShopDetailMobile?.(c.categoryKey);
      root.innerHTML = `
        <div class="food-sec-head shop-mobile-section-head">
          <h2 class="food-sec-title">${esc(c.mainSectionTitle || "おすすめ商品")}</h2>
          ${mobileProductsUi ? "" : `<a class="food-link" href="${allProductsHref}">すべての商品を見る ›</a>`}
        </div>
        <div class="shop-mobile-products-rail">
          <div class="retail-prod-grid shop-mobile-prod-grid" aria-label="おすすめ商品">${cards}</div>
        </div>
        ${
          mobileProductsUi
            ? `<a class="shop-mobile-products-all-btn" href="${allProductsHref}">すべての商品を見る</a>`
            : ""
        }
      `;
      return;
    }

    const products = Array.isArray(listing.products) ? listing.products : [];
    const shopId = String(listing?.id || listing?.demo_id || "").trim();
    const checkout = window.TasuShopCheckout;
    const purchaseEval = window.TasuShopPayout?.evaluatePurchase?.(listing) || { ok: false };
    const shopPurchaseEnabled = purchaseEval.ok === true;
    const connectNotice =
      !shopPurchaseEnabled && purchaseEval.reason
        ? String(purchaseEval.reason).trim()
        : window.TasuPlatformChatCategoryFlow?.getConnectRequiredSetupMessage?.("shop_store") || "";
    const cards = products
      .slice(0, 20)
      .map((p, idx) => {
        const img = String(p.image_url || p.product_image_url || "").trim();
        if (!img) return "";
        const title = String(p.title || "").trim();
        const price = String(p.price || "要相談").trim();
        const state = String(p.condition || p.condition_state || "").trim();
        const stock = String(p.stock || "").trim();
        const productId = String(p.id || p.product_id || `p-${idx}`).trim();
        const detailHref = checkout?.buildProductDetailUrl
          ? checkout.buildProductDetailUrl(shopId, productId)
          : `detail-shop-product.html?shopId=${encodeURIComponent(shopId)}&productId=${encodeURIComponent(productId)}`;
        const priceYen = checkout?.parsePriceYen?.(p.price) ?? 0;
        const purchase = purchaseEval;
        const canBuy = shopPurchaseEnabled && purchase.ok && priceYen > 0;
        const checkoutHref =
          canBuy && checkout?.buildCheckoutUrl
            ? checkout.buildCheckoutUrl({
                shopId,
                productId,
                productName: title,
                price: priceYen,
                quantity: 1,
              })
            : detailHref;
        const inquiryHref = checkout?.buildInquiryUrl
          ? checkout.buildInquiryUrl(shopId, productId, title)
          : "chat.html";
        const buyLabel = canBuy ? "購入する" : "準備中";
        const buyClass = canBuy ? "shop-prod-btn--buy" : "shop-prod-btn--buy is-disabled";
        const buyActionHtml = canBuy
          ? `<a class="shop-prod-btn ${buyClass}" href="${esc(checkoutHref)}">${esc(buyLabel)}</a>`
          : "";
        return `<article class="shop-prod-card">
          <a class="shop-prod-card__link" href="${esc(detailHref)}">
            <div class="shop-prod-card__media">
              <img src="${esc(img)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.shop-prod-card')?.remove()">
            </div>
            <div class="shop-prod-card__body">
              <h3 class="shop-prod-card__title">${esc(title)}</h3>
              <p class="shop-prod-card__price">${esc(price)}</p>
              <div class="shop-prod-card__meta">
                ${state ? `<span class="shop-prod-chip">${esc(state)}</span>` : ""}
                ${stock ? `<span class="shop-prod-chip shop-prod-chip--stock">${esc(stock)}</span>` : ""}
              </div>
            </div>
          </a>
          <div class="shop-prod-card__actions">
            ${buyActionHtml}
            <a class="shop-prod-btn shop-prod-btn--inquiry" href="${esc(inquiryHref)}">問い合わせる</a>
          </div>
        </article>`;
      })
      .filter(Boolean)
      .join("");

    if (!cards) {
      root.hidden = true;
      root.setAttribute("hidden", "");
      return;
    }
    revealShopSection(root);
    const connectNoticeHtml =
      connectNotice && !shopPurchaseEnabled
        ? `<div class="shop-connect-setup-notice" role="status">${esc(connectNotice)}</div>`
        : "";
    root.innerHTML = `${connectNoticeHtml}<div class="shop-sec__head"><h2 class="shop-sec__title">${esc(c.mainSectionTitle || "掲載商品")}</h2></div>
      <div class="shop-products-grid">${cards}</div>`;
  }

  function collectCaseItems(listing) {
    const extra = pickExtra(listing);
    const workCases = Array.isArray(listing.work_cases) ? listing.work_cases : [];
    const repair = Array.isArray(listing.repair_services) ? listing.repair_services : [];
    const gallery = normalizeImages(listing);
    const items = [];

    workCases.forEach((w) => {
      const img = String(w?.image_url || w?.after_image || w?.before_image || "").trim();
      const title = String(w?.title || w?.label || "").trim();
      if (img || title) items.push({ img, title, desc: String(w?.description || "").trim() });
    });
    repair.forEach((r) => {
      const title = String(r?.title || r?.name || "").trim();
      if (title) items.push({ img: "", title, desc: String(r?.description || "").trim() });
    });
    if (!items.length && gallery.length > 1) {
      gallery.slice(1, 7).forEach((url, i) => {
        items.push({ img: url, title: `${extra.shop_name || listing.title || "写真"} ${i + 1}`, desc: "" });
      });
    }
    return items;
  }

  function renderCasesSection(listing, cfg) {
    const c = cfg || getCategoryConfig(listing);
    const root = document.getElementById(SECTION_IDS.cases);
    if (!root) return;
    if (c.visibleSections?.cases === false) {
      root.hidden = true;
      root.setAttribute("hidden", "");
      root.innerHTML = "";
      return;
    }

    if (isRestaurant(c)) {
      const photos = pickFoodImages(listing).slice(0, 6);
      if (!photos.length) {
        root.hidden = true;
        root.setAttribute("hidden", "");
        root.innerHTML = "";
        return;
      }
      revealShopSection(root);
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">${esc(c.caseLabel || "店内・雰囲気")}</h2>
        </div>
        <div class="food-photo-grid">
          ${photos
            .map((u) => `<div class="food-photo"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></div>`)
            .join("")}
        </div>
      `;
      return;
    }

    if (isBeauty(c)) {
      const base = normalizeImages(listing);
      const merged = [...base, ...BEAUTY_DEMO.images]
        .map((u) => String(u || "").trim())
        .filter(Boolean);
      const uniq = [];
      const seen = new Set();
      merged.forEach((u) => {
        if (seen.has(u)) return;
        seen.add(u);
        uniq.push(u);
      });
      const photos = (uniq.length ? uniq : BEAUTY_DEMO.images).slice(0, 5);
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">スタイル</h2>
          <a class="food-link" href="#section-shop-cases">すべてのスタイルを見る ›</a>
        </div>
        <div class="beauty-style-grid" aria-label="スタイル写真">
          ${photos
            .map((u, i) => `<div class="beauty-style-photo">${buildImgTagWithFallback(u, pickBeautyDemoImage(i), "")}</div>`)
            .join("")}
        </div>
      `;
      return;
    }

    if (isRelax(c)) {
      const base = normalizeImages(listing);
      const merged = [...base, ...RELAX_DEMO.images]
        .map((u) => String(u || "").trim())
        .filter(Boolean);
      const uniq = [];
      const seen = new Set();
      merged.forEach((u) => {
        if (seen.has(u)) return;
        seen.add(u);
        uniq.push(u);
      });
      const photos = (uniq.length ? uniq : RELAX_DEMO.images).slice(0, 6);
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">店内・雰囲気</h2>
          <a class="food-link" href="#section-shop-cases">すべての写真を見る ›</a>
        </div>
        <div class="food-photo-grid">
          ${photos
            .slice(0, 6)
            .map((u, i) => `<div class="food-photo">${buildImgTagWithFallback(u, pickRelaxDemoImage(i), "")}</div>`)
            .join("")}
        </div>
      `;
      return;
    }

    if (usesRetailUi(c)) {
      const demoPack = getRetailDemoPack(c);
      const base = normalizeImages(listing);
      const merged = [...base, ...(demoPack.images || [])]
        .map((u) => String(u || "").trim())
        .filter(Boolean);
      const uniq = [];
      const seen = new Set();
      merged.forEach((u) => {
        if (seen.has(u)) return;
        seen.add(u);
        uniq.push(u);
      });
      const photos = (uniq.length ? uniq : demoPack.images || []).slice(0, 6);
      const buyback = isShopBuybackMobileCategory(c);
      const caseTitle = String(c.caseLabel || "店内・雰囲気").trim();
      const photoBlock = photos.length
        ? `<div class="shop-detail-pc-only">
        <div class="food-sec-head">
          <h2 class="food-sec-title">${esc(caseTitle)}</h2>
          <a class="food-link" href="#section-shop-cases">すべての写真を見る ›</a>
        </div>
        <div class="food-photo-grid">
          ${photos
            .slice(0, 6)
            .map((u, i) => `<div class="food-photo">${buildImgTagWithFallback(u, pickRetailDemoImage(i, c), "")}</div>`)
            .join("")}
        </div>
      </div>`
        : "";
      const mobileBlock = buyback ? renderBuybackMobileMainBlock(listing, c) : "";
      if (!photoBlock && !mobileBlock) {
        root.hidden = true;
        root.setAttribute("hidden", "");
        root.innerHTML = "";
        return;
      }
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `
        ${photoBlock}
        ${mobileBlock}
      `;
      return;
    }

    const items = collectCaseItems(listing);
    if (!items.length) {
      root.hidden = true;
      root.setAttribute("hidden", "");
      root.innerHTML = "";
      return;
    }
    const cards = items
      .slice(0, 8)
      .map((it) => {
        const media = it.img
          ? `<img src="${esc(it.img)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.shop-case-card')?.remove()">`
          : `<span class="shop-case-card__placeholder" aria-hidden="true">📷</span>`;
        return `<article class="shop-case-card">
          <div class="shop-case-card__media">${media}</div>
          <div class="shop-case-card__body">
            <h3 class="shop-case-card__title">${esc(it.title || c.caseLabel)}</h3>
            ${it.desc ? `<p class="shop-case-card__desc">${esc(clampText(it.desc, 80))}</p>` : ""}
          </div>
        </article>`;
      })
      .join("");
    revealShopSection(root);
    root.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">${esc(c.caseLabel || "事例")}</h2></div>
      <div class="shop-cases-grid">${cards}</div>`;
  }

  function buildHighlightRows(listing, cfg) {
    const extra = pickExtra(listing);
    const keys = cfg.highlightRows || ["hours", "access"];
    const map = {
      hours: { label: "営業時間", value: listing.business_hours || extra.business_hours_extra },
      seats: {
        label: "席・設備",
        value: extra.seats_equipment || extra.seats || extra.facilities || extra.services,
      },
      access: { label: "アクセス", value: extra.access || extra.station },
      parking: {
        label: "駐車場",
        value: extra.parking === "yes" ? "あり" : extra.parking === "no" ? "なし" : extra.parking,
      },
      area: { label: "対応エリア", value: extra.visit_area || listing.service_area },
      delivery: {
        label: "配送・受け取り",
        value: [extra.fast_shipping === "yes" ? "即日発送可" : "", extra.sales_support, extra.buyback_support]
          .filter(Boolean)
          .join(" / ") || extra.notices,
      },
      sales: {
        label: "販売方法",
        value: [extra.sales_support, extra.used_sales, extra.new_sales].filter(Boolean).join(" / "),
      },
      estimate: {
        label: "見積",
        value: extra.show_estimate === "yes" ? "見積無料" : listing.budgetLabel || listing.main_price_text,
      },
    };
    return keys
      .map((k) => map[k])
      .filter((r) => r && String(r.value || "").trim());
  }

  function renderHighlightsSection(listing, cfg) {
    const c = cfg || getCategoryConfig(listing);
    const root = document.getElementById(SECTION_IDS.highlights);
    if (!root) return;
    if (c.visibleSections?.highlights === false) {
      root.hidden = true;
      root.setAttribute("hidden", "");
      root.innerHTML = "";
      return;
    }

    if (isBeauty(c)) {
      const stylists = Array.isArray(BEAUTY_DEMO.stylists) ? BEAUTY_DEMO.stylists : [];
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">スタイリスト</h2>
          <a class="food-link" href="#section-shop-highlights">すべてのスタイリストを見る ›</a>
        </div>
        <div class="beauty-stylist-row" aria-label="スタイリスト一覧">
          ${stylists
            .slice(0, 3)
            .map((s, i) => {
              const src = String(s?.img || "").trim() || pickBeautyDemoImage(i + 1);
              const img = buildImgTagWithFallback(src, pickBeautyDemoImage(i + 1), "");
              return `<article class="beauty-stylist-card">
                <div class="beauty-stylist-card__img">${img}</div>
                <div class="beauty-stylist-card__body">
                  <h3 class="beauty-stylist-card__name">${esc(s.name)}</h3>
                  <p class="beauty-stylist-card__spec">${esc(s.specialty)}</p>
                  <p class="beauty-stylist-card__desc">${esc(s.desc)}</p>
                  <a class="beauty-stylist-card__btn" href="chat.html">指名して予約</a>
                </div>
              </article>`;
            })
            .join("")}
        </div>
      `;
      return;
    }

    if (isRelax(c)) {
      const list = Array.isArray(RELAX_DEMO.therapists) ? RELAX_DEMO.therapists : [];
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">セラピスト</h2>
          <a class="food-link" href="#section-shop-highlights">すべてのセラピストを見る ›</a>
        </div>
        <div class="beauty-stylist-row" aria-label="セラピスト一覧">
          ${list
            .slice(0, 3)
            .map((t, i) => {
              const src = String(t?.img || "").trim() || pickRelaxDemoImage(i + 1);
              const img = buildImgTagWithFallback(src, pickRelaxDemoImage(i + 1), "");
              return `<article class="beauty-stylist-card">
                <div class="beauty-stylist-card__img">${img}</div>
                <div class="beauty-stylist-card__body">
                  <h3 class="beauty-stylist-card__name">${esc(t.name)}</h3>
                  <p class="beauty-stylist-card__spec">${esc(String(t.role || ""))}　/　${esc(String(t.specialty || ""))}</p>
                  <p class="beauty-stylist-card__desc">${esc(t.desc)}</p>
                  <a class="beauty-stylist-card__btn" href="chat.html">指名して予約</a>
                </div>
              </article>`;
            })
            .join("")}
        </div>
      `;
      return;
    }

    if (usesRetailUi(c)) {
      const list = Array.isArray(getRetailDemoPack(c).news) ? getRetailDemoPack(c).news : [];
      const buyback = isShopBuybackMobileCategory(c);
      const newsBlock = list.length
        ? `<div class="shop-detail-pc-only">
        <div class="food-sec-head">
          <h2 class="food-sec-title">お知らせ</h2>
          <a class="food-link" href="#section-shop-highlights">すべてのお知らせを見る ›</a>
        </div>
        <div class="retail-news" aria-label="お知らせ一覧">
          ${list
            .slice(0, 5)
            .map(
              (n) => `<a class="retail-news__item" href="#">
                <span class="retail-news__date">${esc(n.date)}</span>
                <span class="retail-news__title">${esc(n.title)}</span>
                <span class="retail-news__arrow" aria-hidden="true">›</span>
              </a>`
            )
            .join("")}
        </div>
      </div>`
        : "";
      const mobileBlock = buyback ? renderBuybackMobileServiceBlocks(listing, c) : "";
      if (!newsBlock && !mobileBlock) {
        root.hidden = true;
        root.setAttribute("hidden", "");
        root.innerHTML = "";
        return;
      }
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `${newsBlock}${mobileBlock}`;
      return;
    }

    if (isRestaurant(c)) {
      const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
      const raw = listing?.shop_news || fd?.shop_news || [];
      const list = (Array.isArray(raw) ? raw : [])
        .map((n) => ({
          date: String(n?.date || "").trim(),
          title: String(n?.title || "").trim(),
        }))
        .filter((n) => n.title);
      const news = list.length ? list : FOOD_DEMO.news || [];
      if (!news.length) {
        root.hidden = true;
        root.setAttribute("hidden", "");
        root.innerHTML = "";
        return;
      }
      revealShopSection(root);
      root.classList.add("shop-card");
      root.innerHTML = `
        <div class="food-sec-head">
          <h2 class="food-sec-title">${esc(c.highlightsTitle || "お知らせ")}</h2>
        </div>
        <div class="retail-news food-news-list" aria-label="お知らせ一覧">
          ${news
            .slice(0, 5)
            .map(
              (n) => `<div class="retail-news__item retail-news__item--static">
                <span class="retail-news__date">${esc(n.date)}</span>
                <span class="retail-news__title">${esc(n.title)}</span>
              </div>`
            )
            .join("")}
        </div>
      `;
      return;
    }

    const rows = buildHighlightRows(listing, c);
    if (!rows.length) {
      root.hidden = true;
      root.setAttribute("hidden", "");
      root.innerHTML = "";
      return;
    }
    revealShopSection(root);
    root.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">${esc(c.highlightsTitle || "店舗の特徴")}</h2></div>
      <ul class="shop-highlights-list">
        ${rows
          .map(
            (r) =>
              `<li class="shop-highlights-list__item"><span class="shop-highlights-list__label">${esc(r.label)}</span><span class="shop-highlights-list__value">${esc(r.value)}</span></li>`
          )
          .join("")}
      </ul>`;
  }

  function renderInfoAndReviews(listing, cfg) {
    const c = cfg || getCategoryConfig(listing);
    const root = document.getElementById(SECTION_IDS.bottom);
    if (!root) return;
    root.classList.add("shop-card");
    const reviewsRoot = document.getElementById(SECTION_IDS.reviews);
    const extra = listing?.category_extra?.shop_store || {};
    const store = window.TasuListingLocalStore;
    const data = shopStoreDataHelpers(listing);

    const infoRows = [
      ["住所", extra.address],
      ["営業時間", listing.business_hours],
      ["定休日", extra.closed_day],
      ["電話番号", listing.phone],
      ["出張エリア", extra.visit_area || listing.service_area],
      ["席数", extra.seats || extra.seats_equipment],
      ["支払い方法", extra.payment_methods || extra.payments],
      ["駐車場", extra.parking === "yes" ? "あり" : extra.parking === "no" ? "なし" : extra.parking],
      ["禁煙/喫煙", extra.smoking || extra.smoke_policy],
    ].filter((r) => String(r[1] || "").trim());

    const avg = Number(listing.rating || 0) || 4.8;
    const cnt = Number(listing.review_count || 0) || 35;
    const reviewBarRows = buildReviewBarRows(FOOD_DEMO.distribution);

    if (infoRows.length === 0 && (!avg || !cnt)) {
      root.hidden = true;
      root.setAttribute("hidden", "");
      if (reviewsRoot) {
        reviewsRoot.hidden = true;
        reviewsRoot.setAttribute("hidden", "");
        reviewsRoot.innerHTML = "";
      }
      return;
    }

    revealShopSection(root);
    root.innerHTML = isRestaurant(c)
      ? `<section class="shop-info-card shop-card food-info-card" id="section-shop-info">
          <div class="food-sec-head"><h2 class="food-sec-title">${esc(c.infoTitle || "店舗情報")}</h2></div>
          <div class="food-info-table" role="table" aria-label="店舗情報">
            ${infoRows
              .map(([k, v]) => {
                const key = String(k || "").trim();
                const icon =
                  key === "住所"
                    ? "pin"
                    : key === "営業時間"
                    ? "clock"
                    : key === "電話番号"
                    ? "phone"
                    : key === "出張エリア"
                    ? "truck"
                    : "info";
                const svg =
                  icon === "pin"
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.3"/></svg>`
                    : icon === "clock"
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`
                    : icon === "phone"
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.8v2a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 013.2 4.2 2 2 0 015.2 2h2a2 2 0 012 1.7c.1.8.3 1.6.6 2.3a2 2 0 01-.5 2.1L9 9a16 16 0 006 6l.9-.9a2 2 0 012.1-.5c.7.3 1.5.5 2.3.6A2 2 0 0122 16.8z"/></svg>`
                    : icon === "truck"
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h12v10H3z"/><path d="M15 10h4l2 2v5h-6z"/><circle cx="7" cy="19" r="1.8"/><circle cx="18" cy="19" r="1.8"/></svg>`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
                return `<div class="food-info-row" role="row">
                  <div class="food-info-key" role="cell">
                    <span class="food-info-icon" aria-hidden="true">${svg}</span>
                    <span class="food-info-label">${esc(key)}</span>
                  </div>
                  <div class="food-info-val" role="cell">${esc(v)}</div>
                </div>`;
              })
              .join("")}
          </div>
        </section>`
      : isBeauty(c)
      ? `<section class="beauty-info-card" id="section-shop-info" aria-label="サロン情報・アクセス">
          <div class="food-sec-head"><h2 class="food-sec-title">サロン情報・アクセス</h2></div>
          <div class="beauty-info-table" role="table" aria-label="サロン情報">
            ${[
              ["住所", extra.address || ""],
              ["営業時間", listing.business_hours || ""],
              ["定休日", extra.closed_day || ""],
              ["電話番号", listing.phone || ""],
              ["支払い方法", extra.payment_methods || extra.payments || ""],
              ["席数", extra.seats || extra.seats_equipment || ""],
              ["スタッフ数", extra.staff_count || ""],
              ["駐車場", extra.parking === "yes" ? "あり" : extra.parking === "no" ? "なし" : extra.parking || ""],
              ["メンズ対応", extra.mens === "yes" ? "対応" : extra.mens === "no" ? "非対応" : extra.mens || ""],
              ["当日予約", extra.today === "yes" ? "OK" : extra.today === "no" ? "NG" : extra.today || ""],
            ]
              .filter((r) => String(r[1] || "").trim())
              .map(
                ([k, v]) =>
                  `<div class="beauty-info-row"><div class="beauty-info-key">${esc(k)}</div><div class="beauty-info-val">${esc(
                    v
                  )}</div></div>`
              )
              .join("")}
          </div>
        </section>`
      : isRelax(c)
      ? `<section class="beauty-info-card" id="section-shop-info" aria-label="サロン情報・アクセス">
          <div class="food-sec-head"><h2 class="food-sec-title">サロン情報・アクセス</h2></div>
          <div class="beauty-info-table" role="table" aria-label="サロン情報">
            ${[
              ["住所", extra.address || ""],
              ["営業時間", listing.business_hours || ""],
              ["定休日", extra.closed_day || ""],
              ["電話番号", listing.phone || ""],
              ["支払い方法", extra.payment_methods || extra.payments || ""],
              ["着替え", extra.change_clothes || ""],
              ["個室", extra.private_room || ""],
              ["駐車場", extra.parking === "yes" ? "あり" : extra.parking === "no" ? "なし" : extra.parking || ""],
            ]
              .filter((r) => String(r[1] || "").trim())
              .map(
                ([k, v]) =>
                  `<div class="beauty-info-row"><div class="beauty-info-key">${esc(k)}</div><div class="beauty-info-val">${esc(
                    v
                  )}</div></div>`
              )
              .join("")}
          </div>
        </section>`
      : usesRetailUi(c)
      ? `<section class="beauty-info-card shop-mobile-access-section" id="section-shop-info" aria-label="アクセス">
          <div class="food-sec-head shop-mobile-section-head"><h2 class="food-sec-title">${esc(c.infoTitle || "アクセス")}</h2></div>
          ${renderRetailAccessDesktopTable(listing)}
          ${renderRetailAccessMobileList(listing)}
        </section>`
      : `<div class="shop-info-review-grid">
          <section class="shop-info-card shop-card" id="section-shop-info">
            <div class="shop-sec__head"><h2 class="shop-sec__title">${esc(c.infoTitle || "店舗情報")}</h2></div>
            <ul class="shop-info-list">
              ${infoRows
                .map(
                  ([k, v]) =>
                    `<li class="shop-info-row"><span class="shop-info-key">${esc(k)}</span><span class="shop-info-val">${esc(
                      v
                    )}</span></li>`
                )
                .join("")}
            </ul>
          </section>
          <section class="shop-review-card shop-card" id="section-shop-reviews">
            <div class="shop-sec__head"><h2 class="shop-sec__title">${esc(c.reviewsTitle || "口コミ・評価")}</h2><a class="shop-reviews-more" href="#section-shop-reviews">すべての口コミを見る</a></div>
            <div class="shop-reviews-summary">
              <div class="shop-reviews-score">
                <div class="shop-reviews-score__num">${avg.toFixed(1)}</div>
                <div class="shop-reviews-score__stars">${esc(formatStars(avg))}</div>
                <div class="shop-reviews-score__count">${esc(`(${cnt}件)`)}</div>
              </div>
              <div class="shop-reviews-bars">
                ${renderReviewBarsHtml(reviewBarRows, {
                  barClass: "shop-reviews-bar",
                  trackClass: "shop-reviews-bar__track",
                  fillClass: "shop-reviews-bar__fill",
                  labelClass: "shop-reviews-bar__label",
                  pctClass: "shop-reviews-bar__pct",
                  pctMode: "width",
                })}
              </div>
            </div>
            <a class="shop-reviews-btn" href="#section-reviews">すべての口コミを見る</a>
          </section>
        </div>`;

    // restaurant: レビューは専用UIで section-reviews に描画
    if (reviewsRoot) {
      if (isRestaurant(c)) {
        const avg = Number(listing.rating || 0) || 4.8;
        const cnt = Number(listing.review_count || listing.reviewCount || 0) || 123;
        const dist = FOOD_DEMO.distribution || [];
        const reviewBarRows = buildReviewBarRows(dist);
        const reviews = Array.isArray(FOOD_DEMO.reviews) ? FOOD_DEMO.reviews : [];
        const pickup = reviews[0] || null;
        const rest = reviews.slice(1, 3);

        const pickupHtml = pickup
          ? (() => {
              const name = String(pickup?.name || "ユーザー").trim();
              const date = String(pickup?.date || "").trim();
              const rate = Math.max(0, Math.min(5, Number(pickup?.rating || 0) || 0));
              const stars = "★".repeat(rate) + "☆".repeat(Math.max(0, 5 - rate));
              const text = String(pickup?.text || "").trim();
              const initial = name ? name.slice(0, 1).toUpperCase() : "U";
              return `<article class="food-review-pickup">
                <div class="food-review-pickup__head">
                  <div class="food-review-avatar" aria-hidden="true"><span>${esc(initial)}</span></div>
                  <div class="food-review-meta">
                    <p class="food-review-name">${esc(name)}</p>
                    <p class="food-review-sub">${esc(date)}</p>
                  </div>
                  <div class="food-review-stars detail-gold-stars detail-gold-stars--sm">${esc(stars)} <span class="food-review-rate">${esc(
                String(rate)
              )}</span></div>
                </div>
                <p class="food-review-text">${esc(text)}</p>
              </article>`;
            })()
          : `<div class="food-review-pickup food-review-pickup--empty"><p>口コミがまだありません。</p></div>`;

        const restHtml = rest
          .map((r) => {
            const name = String(r?.name || "ユーザー").trim();
            const date = String(r?.date || "").trim();
            const rate = Math.max(0, Math.min(5, Number(r?.rating || 0) || 0));
            const stars = "★".repeat(rate) + "☆".repeat(Math.max(0, 5 - rate));
            const text = String(r?.text || "").trim();
            const initial = name ? name.slice(0, 1).toUpperCase() : "U";
            return `<article class="food-review-row">
              <div class="food-review-row__head">
                <div class="food-review-avatar" aria-hidden="true"><span>${esc(initial)}</span></div>
                <div class="food-review-meta">
                  <p class="food-review-name">${esc(name)}</p>
                  <p class="food-review-sub"><span class="food-star detail-gold-stars detail-gold-stars--sm">${esc(stars)}</span><span class="food-date">　${esc(
               date
             )}</span></p>
                </div>
              </div>
              <p class="food-review-text">${esc(text)}</p>
            </article>`;
          })
          .join("");

        reviewsRoot.hidden = false;
        reviewsRoot.removeAttribute("hidden");
        reviewsRoot.classList.add("shop-card");
        reviewsRoot.innerHTML = `
          <div class="food-sec-head">
            <h2 class="food-sec-title">口コミ</h2>
            <a class="food-link food-reviews-head-link" href="#section-reviews">すべての口コミを見る ›</a>
          </div>
          <div class="food-reviews-layout">
            <div class="food-reviews-summary-band" aria-label="総合評価 ${esc(avg.toFixed(1))}">
              <div class="food-reviews-scoreblock">
                <div class="food-reviews-scoreblock__num">${avg.toFixed(1)}</div>
                <div class="food-reviews-scoreblock__stars detail-gold-stars detail-gold-stars--lg" aria-hidden="true">${esc(formatStars(avg))}</div>
                <div class="food-reviews-scoreblock__count">${esc(`(${String(cnt)}件の口コミ)`)}</div>
              </div>
            </div>
            <div class="food-reviews-barsblock" aria-label="評価の内訳">
              ${renderReviewBarsHtml(reviewBarRows)}
            </div>
            <div class="food-reviews-list">
              ${pickupHtml ? `<div class="food-reviews-list__featured">${pickupHtml}</div>` : ""}
              ${restHtml}
            </div>
            <div class="food-reviews-footer">
              <a class="food-review-more-btn" href="#section-reviews">すべての口コミを見る</a>
            </div>
          </div>
        `;
      } else if (isBeauty(c)) {
        const avgB = Number(listing.rating || 0) || 4.8;
        const cntB = Number(listing.review_count || listing.reviewCount || 0) || 126;
        reviewsRoot.hidden = false;
        reviewsRoot.removeAttribute("hidden");
        reviewsRoot.classList.add("shop-card");
        reviewsRoot.innerHTML = `
          <div class="food-sec-head">
            <h2 class="food-sec-title">口コミ</h2>
            <a class="food-link" href="#section-reviews">すべての口コミを見る ›</a>
          </div>
          <div class="beauty-review-top">
            <div class="beauty-review-score">
              <div class="beauty-review-score__num">${esc(avgB.toFixed(1))}</div>
              <div class="beauty-review-score__stars">★★★★★</div>
              <div class="beauty-review-score__count">（${esc(cntB)}件の口コミ）</div>
            </div>
            <div class="beauty-review-bars">
              ${renderCompactReviewBarsHtml(buildReviewBarRows(FOOD_DEMO.distribution), {
                trackClass: "beauty-review-bar__track",
                fillClass: "beauty-review-bar__fill",
              })}
            </div>
          </div>
          <div class="beauty-review-cards">
            ${[
              { name: "ゆうたさん", meta: "20代後半 / 女性", date: "2024/05/08", text: "カウンセリングが丁寧で、イメージ通りの色に。髪質改善で手触りも良くなりました！" },
              { name: "あおいさん", meta: "20代前半 / 女性", date: "2024/05/12", text: "トレンド提案が的確で安心。セットもやりやすく、鏡を見るのが楽しくなりました。" },
            ]
              .map(
                (r) => `<article class="beauty-review-card">
                  <div class="beauty-review-card__head">
                    <div class="beauty-review-avatar" aria-hidden="true"><span>${esc(String(r.name || "?").slice(0, 1))}</span></div>
                    <div class="beauty-review-meta">
                      <div class="beauty-review-name">${esc(r.name)}</div>
                      <div class="beauty-review-sub">${esc(r.meta)} <span class="beauty-review-date">${esc(r.date)}</span></div>
                    </div>
                    <div class="beauty-review-stars">★★★★★</div>
                  </div>
                  <p class="beauty-review-text">${esc(r.text)}</p>
                </article>`
              )
              .join("")}
          </div>
        `;
      } else if (isRelax(c)) {
        const avgR = Number(listing.rating || 0) || 4.8;
        const cntR = Number(listing.review_count || listing.reviewCount || 0) || 126;
        reviewsRoot.hidden = false;
        reviewsRoot.removeAttribute("hidden");
        reviewsRoot.classList.add("shop-card");
        reviewsRoot.innerHTML = `
          <div class="food-sec-head">
            <h2 class="food-sec-title">口コミ</h2>
            <a class="food-link" href="#section-reviews">すべての口コミを見る ›</a>
          </div>
          <div class="beauty-review-top">
            <div class="beauty-review-score">
              <div class="beauty-review-score__num">${esc(avgR.toFixed(1))}</div>
              <div class="beauty-review-score__stars">★★★★★</div>
              <div class="beauty-review-score__count">（${esc(cntR)}件の口コミ）</div>
            </div>
            <div class="beauty-review-bars">
              ${renderCompactReviewBarsHtml(buildReviewBarRows(FOOD_DEMO.distribution), {
                trackClass: "relax-review-bar__track",
                fillClass: "relax-review-bar__fill",
              })}
            </div>
          </div>
          <div class="beauty-review-cards">
            ${[
              { name: "ゆうたさん", meta: "40代前半 / 女性", date: "2024/05/08", text: "施術がとても丁寧で、終わったあと身体が軽くなりました。アロマの香りに癒されます。" },
              { name: "かなさん", meta: "30代後半 / 男性", date: "2024/05/12", text: "首肩がガチガチだったのがすごく楽に。スタッフの対応も親切で通いやすいです。" },
            ]
              .map(
                (r) => `<article class="beauty-review-card">
                  <div class="beauty-review-card__head">
                    <div class="beauty-review-avatar" aria-hidden="true"><span>${esc(String(r.name || "?").slice(0, 1))}</span></div>
                    <div class="beauty-review-meta">
                      <div class="beauty-review-name">${esc(r.name)}</div>
                      <div class="beauty-review-sub">${esc(r.meta)} <span class="beauty-review-date">${esc(r.date)}</span></div>
                    </div>
                    <div class="beauty-review-stars">★★★★★</div>
                  </div>
                  <p class="beauty-review-text">${esc(r.text)}</p>
                </article>`
              )
              .join("")}
          </div>
        `;
      } else if (usesRetailUi(c)) {
        const topDef = goodsInteriorTopDefaults(c);
        const avgR = Number(listing.rating || 0) || topDef?.rating || 4.7;
        const cntR = Number(listing.review_count || listing.reviewCount || 0) || topDef?.reviewCount || 128;
        const reviewCards =
          isGoodsInterior(c) ||
          window.TasuShopDetailCategory?.isShopBuybackMobileCategory?.(c.categoryKey)
            ? GOODS_INTERIOR_DEMO.reviews
            : [
              { name: "ゆかりさん", meta: "30代前半", date: "2024/05/20", text: "店内が素敵で、つい長居してしまいました。ギフト選びにもぴったりです。" },
              { name: "S.K.", meta: "40代", date: "2024/05/10", text: "スタッフさんの提案が的確で助かりました。ラッピングも丁寧で満足。" },
            ];
        reviewsRoot.hidden = false;
        reviewsRoot.removeAttribute("hidden");
        reviewsRoot.classList.add("shop-card");
        reviewsRoot.innerHTML = `
          <div class="food-sec-head">
            <h2 class="food-sec-title">口コミ・レビュー</h2>
            <a class="food-link" href="#section-reviews">すべての口コミを見る ›</a>
          </div>
          <div class="beauty-review-top">
            <div class="beauty-review-score">
              <div class="beauty-review-score__num">${esc(avgR.toFixed(1))}</div>
              <div class="beauty-review-score__stars">★★★★★</div>
              <div class="beauty-review-score__count">（${esc(cntR)}件の口コミ）</div>
            </div>
            <div class="beauty-review-bars">
              ${renderCompactReviewBarsHtml(buildReviewBarRows(FOOD_DEMO.distribution), {
                trackClass: "relax-review-bar__track",
                fillClass: "relax-review-bar__fill",
              })}
            </div>
          </div>
          <div class="beauty-review-cards">
            ${reviewCards
              .map(
                (r) => `<article class="beauty-review-card">
                  <div class="beauty-review-card__head">
                    <div class="beauty-review-avatar" aria-hidden="true"><span>${esc(String(r.name || "?").slice(0, 1))}</span></div>
                    <div class="beauty-review-meta">
                      <div class="beauty-review-name">${esc(r.name)}</div>
                      <div class="beauty-review-sub">${esc(r.meta)} <span class="beauty-review-date">${esc(r.date)}</span></div>
                    </div>
                    <div class="beauty-review-stars">★★★★★</div>
                  </div>
                  <p class="beauty-review-text">${esc(r.text)}</p>
                </article>`
              )
              .join("")}
          </div>
        `;
      } else {
        // 空のレビュー一覧は出さない（レビュー実装がある場合のみ表示）
        reviewsRoot.hidden = true;
        reviewsRoot.setAttribute("hidden", "");
        reviewsRoot.innerHTML = "";
      }
      revealReviewsSectionIfRendered(reviewsRoot);
    }
  }

  function renderFaq(listing, cfg) {
    const c = cfg || getCategoryConfig(listing);
    const root = document.getElementById(SECTION_IDS.faq);
    if (!root) return;
    root.classList.add("shop-card");
    const extra = listing?.category_extra?.shop_store || {};
    const rawFaqs =
      listing?.faqs ??
      listing?.form_data?.faqs ??
      listing?.form_data?.category_extra?.shop_store?.faqs ??
      extra.faqs ??
      "";
    let faqs = [];
    if (Array.isArray(rawFaqs)) faqs = rawFaqs;
    else if (rawFaqs) {
      try {
        const parsed = JSON.parse(String(rawFaqs));
        if (Array.isArray(parsed)) faqs = parsed;
      } catch (_) {}
    }
    const items = (faqs || [])
      .map((it) => ({
        q: String(it?.question || it?.q || "").trim(),
        a: String(it?.answer || it?.a || "").trim(),
      }))
      .filter((it) => it.q && it.a)
      .slice(0, 5);

    if (!items.length) {
      hideShopSectionById(SECTION_IDS.faq);
      return;
    }

    showShopSectionElement(root);
    root.innerHTML = `<div class="shop-sec__head"><h2 class="shop-sec__title">${esc(c.faqTitle || "よくある質問")}</h2></div>
      <div class="shop-faq">
        ${items
          .map(
            (it) =>
              `<details class="shop-faq-item"><summary><span>${esc(it.q)}</span><span class="shop-faq-plus" aria-hidden="true">+</span></summary><div class="shop-faq-a"><p>${esc(
                it.a
              )}</p></div></details>`
          )
          .join("")}
      </div>`;
  }

  function renderStickyCta(cfg) {
    const c = cfg || {};
    const bar = qs(SELECTORS.stickyBar);
    if (!bar) return;
    if (usesShopStickyActionNav(c)) {
      bar.hidden = true;
      bar.setAttribute("hidden", "");
      return;
    }
    const ai = qs(SELECTORS.stickyAi);
    const inq = qs(SELECTORS.stickyInquiry);
    const est = qs(SELECTORS.stickyEstimate);
    if (ai) {
      ai.hidden = false;
      ai.href = "chat.html";
      ai.textContent = c.ctaAiText || "AIに相談する";
    }
    if (inq) {
      inq.href = c.ctaPrimaryHref || "chat.html";
      inq.textContent = c.ctaPrimaryText || "問い合わせる";
    }
    if (est) {
      est.href = resolveProductsListHref(
        { id: document.body.dataset.shopListingId || new URLSearchParams(location.search).get("id") },
        c
      );
      est.textContent = getShopStickySecondaryCtaLabel(c);
    }
    const nav = qs("[data-shop-sticky-nav]");
    if (isRelax(c) && nav) removeRelaxStickyFaqLink(nav);

    document.querySelectorAll("[data-shop-sticky-nav]").forEach((link) => {
      const key = link.getAttribute("data-shop-sticky-nav");
      if (!key || !c.visibleSections) return;
      if (isRelax(c) && key === "faq") return;
      const sectionKey =
        key === "bottom" ? "info" : key === "cases" ? "cases" : key === "highlights" ? "highlights" : key;
      const show = c.visibleSections[sectionKey] !== false;
      link.hidden = !show;
      if (!show) link.setAttribute("hidden", "");
      else link.removeAttribute("hidden");
    });
    bar.hidden = false;
  }

  function setupStickySubnav(cfg) {
    const c = cfg || {};
    if (usesShopStickyActionNav(c)) return;
    const nav = qs("[data-shop-sticky-nav]");
    if (!nav) return;

    function resolveTargetElement(raw) {
      const id = String(raw || "").replace("#", "").trim();
      if (!id) return null;
      if (isRelax(c)) return resolveRelaxStickyTarget(id);
      return document.getElementById(id);
    }

    nav.querySelectorAll("a[href^='#']").forEach((a) => {
      if (a.hidden || a.hasAttribute("hidden")) return;
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const raw = a.getAttribute("data-target") || a.getAttribute("href") || "";
        const el = resolveTargetElement(raw);
        if (!el) return;
        const stickyBar = qs(SELECTORS.stickyBar);
        const offset = (stickyBar?.getBoundingClientRect?.().height || 0) + 12;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
        const targetId = el.id;
        nav.querySelectorAll(".shop-sticky-nav__item").forEach((item) => {
          item.classList.toggle("is-active", item.getAttribute("data-target") === targetId);
        });
      });
    });

    const targetIds = isRelax(c)
      ? [
          "section-products",
          "section-shop-highlights",
          "section-shop-cases",
          "section-reviews",
          "section-shop-bottom",
        ]
      : [
          "section-products",
          "section-shop-cases",
          "section-shop-highlights",
          "section-shop-bottom",
          "section-faq",
        ];

    const targets = targetIds
      .map((id) => {
        const el = document.getElementById(id);
        if (!el || el.hidden) return null;
        return el;
      })
      .filter(Boolean);

    function setActive(id) {
      nav.querySelectorAll(".shop-sticky-nav__item").forEach((item) => {
        if (item.hidden || item.hasAttribute("hidden")) return;
        item.classList.toggle("is-active", item.getAttribute("data-target") === id);
      });
    }

    if ("IntersectionObserver" in window && targets.length) {
      const obs = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => (a.boundingClientRect.top || 0) - (b.boundingClientRect.top || 0))[0];
          if (visible?.target?.id) setActive(visible.target.id);
        },
        { root: null, threshold: 0.2, rootMargin: "-80px 0px -55% 0px" }
      );
      targets.forEach((t) => obs.observe(t));
    }
  }

  function setupStickyFooterAvoidance(cfg) {
    const c = cfg || {};
    if (!isRestaurant(c)) return;
    const bar = qs(SELECTORS.stickyBar);
    if (!bar) return;
    const footer = document.querySelector("[data-biz-detail-market-footer]") || document.querySelector("footer.shop-footer");
    if (!footer) return;

    const cls = "is-near-footer";
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          const hit = entries.some((e) => e.isIntersecting);
          bar.classList.toggle(cls, hit);
        },
        { root: null, threshold: 0.01 }
      );
      obs.observe(footer);
    } else {
      // fallback: scroll-based
      const onScroll = () => {
        const rect = footer.getBoundingClientRect();
        bar.classList.toggle(cls, rect.top < window.innerHeight);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  function guardListing(listing) {
    const type = String(listing?.listing_type || listing?.type || "").trim();
    if (type !== "shop_store") {
      shopLogWarn("[invalid shop listing]", listing);
      return false;
    }
    return true;
  }

  function getFallbackListing(id) {
    const loader = pageGlobal.TasuDetailShopStoreLoader;
    const key = String(id || "").trim();
    const otherId = loader?.SHOP_STORE_OTHER_DEMO_ID || "shop-store-demo-other-001";
    const isOtherDemo =
      loader?.isShopStoreOtherDemoId?.(key) ||
      !key ||
      key === otherId;
    if (key && !isOtherDemo) return null;
    if (loader?.getFallbackShopListing) {
      return loader.getFallbackShopListing(key || otherId);
    }
    if (loader?.buildShopStoreOtherDemoInline) {
      return loader.buildShopStoreOtherDemoInline({ id: otherId });
    }
    return null;
  }

  async function fetchListingForBoot(id, explicit) {
    const loader = pageGlobal.TasuDetailShopStoreLoader;
    if (!loader?.fetchShopStoreDetailById) return null;
    try {
      return await loader.fetchShopStoreDetailById(id);
    } catch (err) {
      shopLogWarn("loader fetch failed:", err?.message || err);
      if (canUseShopOtherDemoFallback(id, explicit)) return getFallbackListing(id);
      return null;
    }
  }

  function renderListingOrFallback(listing, id) {
    const cfg = getCategoryConfig(listing);
    showRoot();
    try {
      renderShopDetailContent(listing, cfg);
      return true;
    } catch (renderErr) {
      shopLogWarn("render failed, trying fallback:", renderErr?.message || renderErr);
      const fallback = canUseShopOtherDemoFallback(id || listing?.id, true)
        ? getFallbackListing(id || listing?.id)
        : null;
      if (!fallback || !guardListing(fallback)) {
        showRenderError(qs(SELECTORS.root), "店舗情報の表示に失敗しました。", renderErr);
        return false;
      }
      try {
        renderShopDetailContent(fallback, getCategoryConfig(fallback));
        document.body.dataset.shopFileFallback = "true";
        return true;
      } catch (fallbackErr) {
        showRenderError(qs(SELECTORS.root), "店舗情報の表示に失敗しました。", fallbackErr);
        return false;
      }
    }
  }

  async function boot() {
    if (!isShopStoreDetailPage()) return;
    if (window.__TASU_SHOP_DETAIL_BOOT__) return;
    window.__TASU_SHOP_DETAIL_BOOT__ = true;

    disableNestedShopDetailIframes();
    watchNestedShopDetailIframes();

    const idTarget =
      window.TasuDetailShopStoreLoader?.resolveShopLoadTarget?.() ||
      (() => {
        const raw = getQueryId();
        return raw
          ? { id: raw, explicit: true }
          : {
              id:
                window.TasuListingLocalStore?.SHOP_STORE_OTHER_DEMO_ID ||
                "shop-store-demo-other-001",
              explicit: false,
            };
      })();
    const id = idTarget.id;
    debugLog("boot:start", { id, explicit: idTarget.explicit, targets: listSearchTargets() });
    if (!id) {
      debugLog("boot:fail", { reason: "missing_id", id, targets: listSearchTargets() });
      showShopNotFound("URL に掲載IDがありません。", "");
      return;
    }
    document.body.dataset.shopDemoMode = idTarget.explicit ? "false" : "true";
    showStatus("loading", "掲載データを読み込んでいます…");
    let activeListing = null;
    try {
      if (!pageGlobal.TasuDetailShopStoreLoader?.fetchShopStoreDetailById) {
        debugLog("boot:fail", {
          reason: "loader_missing",
          id,
          hasLoader: Boolean(pageGlobal.TasuDetailShopStoreLoader),
          targets: listSearchTargets(),
        });
        const fallbackOnly = getFallbackListing(id);
        if (fallbackOnly && guardListing(fallbackOnly)) {
          shopLogWarn("loader missing — inline demo fallback");
          if (!renderListingOrFallback(fallbackOnly, id)) return;
          activeListing = fallbackOnly;
        } else {
          showShopNotFound(
            "詳細ローダーが読み込めませんでした（JSの読み込み順をご確認ください）。",
            id
          );
          return;
        }
      } else {
        let listing = await fetchListingForBoot(id, idTarget.explicit);
        if ((!listing || !guardListing(listing)) && canUseShopOtherDemoFallback(id, idTarget.explicit)) {
          listing = getFallbackListing(id);
        }
        if (!listing || !guardListing(listing)) {
          debugLog("boot:fail", {
            reason: !listing ? "listing_not_found" : "invalid_listing_type",
            id,
            listing,
            listing_type: String(listing?.listing_type || listing?.type || "").trim(),
            targets: listSearchTargets(),
          });
          showShopNotFound("店舗情報が見つかりません。", id);
          return;
        }

        const cfg = getCategoryConfig(listing);
        debugLog("boot:match", {
          id,
          listing,
          categoryKey: cfg?.categoryKey,
          profileKey: cfg?.profileKey,
        });
        if (!renderListingOrFallback(listing, id)) return;
        activeListing = listing;
      }
      showRoot();
      const readyCfg = getCategoryConfig(activeListing);
      document.body.dataset.listingId = String(activeListing?.id || id || "");
      debugLog("boot:ready", {
        id,
        categoryKey: readyCfg?.categoryKey,
        usesRetailUi: usesRetailUi(readyCfg),
        data_listing_loaded: document.body?.dataset?.listingLoaded,
        root_hidden: qs(SELECTORS.root)?.hidden,
        shop_category_profile: document.body?.dataset?.shopCategoryProfile,
      });
      clearStatus();
      if (activeListing && pageGlobal.TasuListingLocalStore?.renderAiBadge) {
        pageGlobal.TasuListingLocalStore.renderAiBadge(activeListing);
      }
      if (activeListing) {
        pageGlobal.TasuFavoriteActions?.mountForListing?.(activeListing);
        pageGlobal.TasuContactActions?.mountForListing?.(activeListing);
      }
    } catch (e) {
      shopLogError("boot failed:", e);
      debugLog("boot:exception", {
        id,
        error: String(e?.message || e),
        stack: e?.stack,
        targets: listSearchTargets(),
      });
      const fallback = canUseShopOtherDemoFallback(id, idTarget.explicit)
        ? getFallbackListing(id)
        : null;
      if (fallback && guardListing(fallback) && renderListingOrFallback(fallback, id)) {
        showRoot();
        document.body.dataset.listingId = String(fallback.id || id || "");
        clearStatus();
        pageGlobal.TasuFavoriteActions?.mountForListing?.(fallback);
        pageGlobal.TasuContactActions?.mountForListing?.(fallback);
        return;
      }
      showShopNotFound("店舗情報が見つかりません。", id);
    }
  }

  pageGlobal.TasuDetailShopStoreBottom = {
    getQueryId,
    normalizeShopDetailQueryId,
    disableNestedShopDetailIframes,
    layoutHeroAsidePoints,
    scheduleHeroAsideLayout,
    renderShopStickyActionNav,
    setupShopStickyActionNavScroll,
    syncShopMobileChrome,
    applyRetailMobileHeroLayout,
    renderShopMobileInquiryDock,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    void boot();
  }
})();


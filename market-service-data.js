/**
 * Market サービス詳細 — URL 生成・掲載データ解決（モック / Store 共通）
 */
(function () {
  "use strict";

  const TYPE_LABEL = {
    product: "商品",
    skill: "スキル",
    job: "求人",
    worker: "ワーカー",
  };

  const CATEGORY_LABELS = {
    video: "動画・映像",
    ai_it: "AI・IT",
    design: "デザイン",
    web: "Web制作",
    marketing: "マーケティング",
    writing: "ライティング",
    home_appliances: "家電",
    light_work: "軽作業",
    office: "オフィス",
  };

  function resolveId(raw) {
    const key = String(raw || "").trim();
    if (!key) return "";
    const R = window.TasuListingRouteResolver;
    return R?.resolveListingId?.(key) || key;
  }

  function buildUrl(id) {
    const key = String(id || "").trim();
    if (!key) return "#";
    return `/market-service-detail?id=${encodeURIComponent(key)}`;
  }

  /** pretty URL（_redirects / middleware 用） */
  function buildPrettyUrl(id) {
    const key = String(id || "").trim();
    if (!key) return "#";
    return `/market/services/${encodeURIComponent(key)}`;
  }

  function normalizeTags(listing) {
    const raw = listing?.tags ?? listing?.displayTags;
    if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
    if (typeof raw === "string") {
      return raw
        .split(/[,、]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }

  function resolveCategoryLabel(listing) {
    const type = listing?.listing_type || listing?.type || "";
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const key =
      fd.skill_category ||
      fd.product_category ||
      fd.workerCategory ||
      fd.worker_task ||
      listing?.category ||
      listing?.category_key ||
      "";
    if (key && CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
    if (listing?.category && String(listing.category).trim()) return String(listing.category).trim();
    return TYPE_LABEL[type] || "サービス";
  }

  function resolvePriceText(listing) {
    const text =
      listing?.priceText ||
      listing?.price_text ||
      listing?.price ||
      listing?.form_data?.price ||
      "";
    if (text) return String(text);
    const amount = Number(listing?.price_amount);
    if (Number.isFinite(amount) && amount > 0) return `¥${amount.toLocaleString("ja-JP")}〜`;
    return "要相談";
  }

  function resolveRating(listing) {
    const avg = Number(listing?.review_average ?? listing?.rating ?? 0) || 0;
    const count = Number(listing?.review_count ?? 0) || 0;
    return { average: avg, count };
  }

  function resolveAchievements(listing, seller) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const fromForm = String(fd.achievements || fd.achievement || "").trim();
    if (fromForm) return fromForm;
    const deals = seller?.dealsCount ?? seller?.deals_count;
    if (deals != null && deals !== "") return `取引実績 ${deals}件以上`;
    return "—";
  }

  async function resolveListing(id) {
    const lookup = resolveId(id);
    const rawKey = String(id || "").trim();
    if (!lookup && !rawKey) return null;

    let listing = null;
    if (window.TasuListingStore?.fetchListingById) {
      try {
        listing = await window.TasuListingStore.fetchListingById(lookup || rawKey);
      } catch (err) {
        console.warn("[TasuMarketServiceDetail] fetchListingById failed:", err);
      }
    }

    if (!listing && window.TasuListingDemoCatalog?.getStoreListing) {
      listing = window.TasuListingDemoCatalog.getStoreListing(lookup || rawKey);
    }

    if (!listing && window.TasuPortalListingUiDemo?.getAll) {
      const candidates = new Set([rawKey, lookup].filter(Boolean));
      listing =
        window.TasuPortalListingUiDemo.getAll().find((row) => candidates.has(String(row?.id || ""))) ||
        null;
    }

    if (!listing) return null;

    let seller = null;
    const userId = String(listing.user_id || listing.userId || "").trim();
    if (userId && window.TasuListingSellerProfile?.fetchSellerProfile) {
      try {
        seller = await window.TasuListingSellerProfile.fetchSellerProfile(userId, { demoFallback: true });
      } catch (err) {
        console.warn("[TasuMarketServiceDetail] fetchSellerProfile failed:", err);
      }
    }

    return { listing, seller, id: listing.id || lookup };
  }

  function consultUrl(listing) {
    const id = encodeURIComponent(String(listing?.id || ""));
    const type = encodeURIComponent(String(listing?.listing_type || listing?.type || "skill"));
    return `/talk-home.html?listingId=${id}&category=${type}`;
  }

  window.TasuMarketServiceDetail = {
    TYPE_LABEL,
    buildUrl,
    buildPrettyUrl,
    resolveId,
    resolveListing,
    normalizeTags,
    resolveCategoryLabel,
    resolvePriceText,
    resolveRating,
    resolveAchievements,
    consultUrl,
  };
})();

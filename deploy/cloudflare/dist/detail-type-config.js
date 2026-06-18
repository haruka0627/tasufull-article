/**
 * TASFUL 詳細ページ — 種別ごとの表示文言・CTA・セクション設定
 */
(function (global) {
  "use strict";

  const DETAIL_TYPE_CONFIG = {
    general: {
      typeKey: "general",
      label: "その他",
      titleLabel: "掲載内容",
      overviewTitle: "掲載内容",
      pricingTitle: "料金・メニュー",
      pricingLead: "掲載内容・対応範囲・目安料金をご確認ください。",
      casesTitle: "実績・事例",
      reviewsTitle: "口コミ・評価",
      flowTitle: "ご依頼の流れ",
      companyTitle: "掲載者情報",
      areaTitle: "対応エリア",
      ctaHeadMain: "ご相談はこちら",
      ctaHeadSub: "24時間受付",
      ctaPrimary: "相談する",
      ctaSecondary: "お気に入りに追加",
      favoriteLabel: "お気に入りに追加",
      backLabel: "掲載管理へ戻る",
      backHref: "listing-management.html",
      pageTitleSuffix: "一般掲載",
      serviceProfile: "consulting",
      sections: {
        overview: true,
        pricing: true,
        cases: true,
        license: true,
        flow: true,
        reviews: true,
        company: true,
        area: true,
        payment: false,
        faq: false,
      },
    },
    business_service: {
      typeKey: "business_service",
      label: "業務サービス",
      titleLabel: "サービス内容",
      overviewTitle: "業務概要",
      pricingTitle: "サービスメニュー",
      pricingLead: "提供サービス内容・対応範囲・目安料金をご確認ください。",
      casesTitle: "実績・事例",
      reviewsTitle: "口コミ・評価",
      flowTitle: "ご依頼の流れ",
      companyTitle: "会社・事業者情報",
      areaTitle: "対応エリア",
      ctaHeadMain: "ご相談・お見積りはこちら",
      ctaHeadSub: "24時間受付",
      ctaPrimary: "見積もりを依頼する",
      ctaSecondary: "チャットで問い合わせ",
      favoriteLabel: "お気に入り",
      backLabel: "法人・業者一覧に戻る",
      backHref: "business.html",
      pageTitleSuffix: "業務サービス",
      serviceProfile: null,
      sections: {
        overview: true,
        pricing: true,
        cases: true,
        license: true,
        flow: true,
        reviews: true,
        company: true,
        area: true,
        payment: true,
        faq: true,
      },
    },
    shop_store: {
      typeKey: "shop_store",
      label: "店舗・販売",
      titleLabel: "商品・店舗情報",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      backHref: "business.html",
      pageTitleSuffix: "店舗・販売",
    },
    skill: {
      typeKey: "skill",
      label: "スキル",
      titleLabel: "スキル内容",
      ctaPrimary: "依頼する",
      ctaSecondary: "お気に入りに追加",
      pageTitleSuffix: "スキル",
    },
    product: {
      typeKey: "product",
      label: "商品",
      titleLabel: "商品情報",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      pageTitleSuffix: "商品",
    },
    job: {
      typeKey: "job",
      label: "求人",
      titleLabel: "募集内容",
      ctaPrimary: "応募する",
      ctaSecondary: "お気に入りに追加",
      pageTitleSuffix: "求人",
    },
    worker: {
      typeKey: "worker",
      label: "人材",
      titleLabel: "プロフィール",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      pageTitleSuffix: "人材",
    },
  };

  const SHOP_CATEGORY_DETAIL_CONFIG = {
    "飲食": {
      label: "飲食",
      heading: "店舗・メニュー情報",
      priceLabel: "価格・メニュー",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      showProducts: true,
      showAccess: true,
      showReviews: true,
    },
    "飲食・カフェ": {
      label: "飲食・カフェ",
      heading: "店舗・メニュー情報",
      priceLabel: "価格・メニュー",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      showProducts: true,
      showAccess: true,
      showReviews: true,
    },
    "小売・物販": {
      label: "小売・物販",
      heading: "商品・店舗情報",
      priceLabel: "価格・商品情報",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      showProducts: true,
      showAccess: true,
      showReviews: true,
    },
    "雑貨・インテリア": {
      label: "雑貨・インテリア",
      heading: "商品・店舗情報",
      priceLabel: "価格・商品情報",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      showProducts: true,
      showAccess: true,
      showReviews: true,
    },
    "その他": {
      label: "その他",
      heading: "概要",
      priceLabel: "価格",
      ctaPrimary: "問い合わせる",
      ctaSecondary: "お気に入りに追加",
      showProducts: false,
      showAccess: false,
      showReviews: false,
      showHandlingInfo: true,
      handlingInfoTitle: "取扱情報",
    },
  };

  function resolveShopCategoryLabel(record) {
    if (window.TasuShopDetailCategory?.resolveExplicitCategoryLabel) {
      const explicit = window.TasuShopDetailCategory.resolveExplicitCategoryLabel(record);
      if (explicit) return explicit;
    }
    const label = String(
      record?.category ||
        record?.normalized_store_category ||
        record?.form_data?.category ||
        ""
    ).trim();
    if (label) return label;
    const profile = String(
      record?.shop_store_category ||
        record?.shop_category ||
        record?.categoryProfile ||
        record?.store_category_key ||
        ""
    ).trim();
    if (profile && window.TasuShopDetailCategory?.categoryLabelFromProfileKey) {
      return window.TasuShopDetailCategory.categoryLabelFromProfileKey(profile) || "";
    }
    return "";
  }

  function getShopCategoryDetailConfig(recordOrLabel) {
    const label =
      typeof recordOrLabel === "object"
        ? resolveShopCategoryLabel(recordOrLabel)
        : String(recordOrLabel || "").trim();
    if (!label) return null;
    return SHOP_CATEGORY_DETAIL_CONFIG[label] || null;
  }

  function mergeShopCategoryDetailIntoConfig(cfg, record) {
    const isOtherCategory =
      window.TasuShopDetailCategory?.isShopOtherListing?.(record) ||
      String(cfg?.categoryKey || "").trim() === "other";
    if (!isOtherCategory) return cfg;

    const detail = getShopCategoryDetailConfig(record);
    if (!detail) return cfg;

    const next = { ...cfg, shopCategoryDetail: detail };
    if (detail.label) next.categoryLabel = detail.label;
    if (detail.heading) next.mainSectionTitle = detail.heading;
    if (detail.priceLabel) next.priceLabel = detail.priceLabel;
    if (detail.ctaPrimary) next.ctaPrimaryText = detail.ctaPrimary;
    if (detail.ctaSecondary) {
      next.ctaSecondaryText = detail.ctaSecondary;
      next.favoriteLabel = detail.ctaSecondary;
    }
    if (detail.handlingInfoTitle) next.handlingInfoTitle = detail.handlingInfoTitle;
    if (detail.showProducts === false) {
      next.showProducts = false;
      next.visibleSections = { ...(next.visibleSections || {}), products: false };
    }
    if (detail.showAccess === false) {
      next.showAccess = false;
      next.visibleSections = { ...(next.visibleSections || {}), info: false };
    }
    if (detail.showReviews === false) {
      next.showReviews = false;
      next.visibleSections = { ...(next.visibleSections || {}), reviews: false };
    }
    if (isOtherCategory) {
      next.useOverviewNav = true;
      next.stickyNav = {
        ...(next.stickyNav || {}),
        overview: "概要",
        handling: detail.handlingInfoTitle || "取扱情報",
      };
      if (detail.showHandlingInfo !== false) {
        next.showHandlingInfo = true;
        next.visibleSections = {
          ...(next.visibleSections || {}),
          overview: true,
          handling: true,
        };
      }
    } else {
      delete next.useOverviewNav;
    }
    return next;
  }

  const SECTION_IDS = {
    overview: "section-overview",
    pricing: "section-service-menu",
    cases: "section-achievements",
    license: "section-license",
    flow: "section-flow",
    reviews: "section-reviews",
    company: "section-company-info",
    area: "section-service-area",
    payment: "section-business-payment",
    faq: "section-faq",
  };

  function normalizeConfigKey(raw) {
    const key = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    if (!key) return "general";
    if (DETAIL_TYPE_CONFIG[key]) return key;
    if (key === "business_service" || key === "field_service" || key === "business") {
      return "business_service";
    }
    if (key === "shop" || key === "shop_store") return "shop_store";
    if (key === "item") return "product";
    if (key === "other" || key === "その他") return "general";
    return key in DETAIL_TYPE_CONFIG ? key : "general";
  }

  function getConfig(typeKeyOrRecord) {
    if (typeKeyOrRecord && typeof typeKeyOrRecord === "object") {
      const store = global.TasuListingLocalStore;
      const resolved = store?.resolveListingTypeKey?.(typeKeyOrRecord) || "general";
      return getConfig(resolved);
    }
    const key = normalizeConfigKey(typeKeyOrRecord);
    return { ...DETAIL_TYPE_CONFIG.general, ...DETAIL_TYPE_CONFIG[key] };
  }

  function setText(sel, value) {
    const el = document.querySelector(sel);
    if (el && value != null && value !== "") el.textContent = value;
  }

  function applyDetailTypeConfig(config, record) {
    const cfg = config || getConfig("general");
    const category = String(record?.category || cfg.label || "").trim();

    const back = document.querySelector("[data-biz-detail-back]");
    if (back) {
      if (global.TasuDetailNav?.applyDetailNav) {
        global.TasuDetailNav.applyDetailNav(record, { breadcrumb: false });
      } else {
        if (cfg.backLabel) back.textContent = `← ${cfg.backLabel}`;
        if (cfg.backHref) back.setAttribute("href", cfg.backHref);
      }
    }

    const catEl = document.querySelector("[data-bsd-hero-category]");
    if (catEl && category) {
      catEl.textContent = category;
      catEl.hidden = false;
      catEl.removeAttribute("hidden");
    }

    setText(".bsd-cta-card__head-main", cfg.ctaHeadMain);
    setText(".bsd-cta-card__head-sub", cfg.ctaHeadSub);

    const primary =
      document.querySelector("[data-business-service-estimate]") ||
      document.querySelector("[data-biz-detail-estimate]");
    const secondary =
      document.querySelector("[data-business-service-chat]") ||
      document.querySelector("[data-biz-detail-inquiry]");
    if (primary && cfg.ctaPrimary) primary.textContent = cfg.ctaPrimary;
    if (secondary && cfg.ctaSecondary) secondary.textContent = cfg.ctaSecondary;

    const favLabel = document.querySelector("[data-bsd-favorite-label]");
    if (favLabel && cfg.favoriteLabel) favLabel.textContent = ` ${cfg.favoriteLabel}`;

    setText("#section-overview .business-summary__title", cfg.overviewTitle || cfg.titleLabel);
    setText("[data-biz-detail-service-menu-title]", cfg.pricingTitle);
    setText("[data-biz-detail-service-menu-lead]", cfg.pricingLead);
    setText("#section-achievements .case-studies__title", cfg.casesTitle);
    setText("#section-reviews .section-title", cfg.reviewsTitle);
    setText("#section-flow .request-flow__title", cfg.flowTitle);
    setText("#section-company-info .section-title", cfg.companyTitle);
    setText("#section-service-area .section-title", cfg.areaTitle);

    const sections = cfg.sections || {};
    Object.entries(SECTION_IDS).forEach(([key, id]) => {
      if (sections[key] === undefined) return;
      const el = document.getElementById(id);
      if (!el) return;
      if (sections[key]) {
        el.hidden = false;
        el.removeAttribute("hidden");
      } else {
        el.hidden = true;
        el.setAttribute("hidden", "");
      }
    });

    document.body.dataset.detailTypeConfig = cfg.typeKey || "general";
    return cfg;
  }

  global.TasuDetailTypeConfig = {
    DETAIL_TYPE_CONFIG,
    SHOP_CATEGORY_DETAIL_CONFIG,
    SECTION_IDS,
    getConfig,
    normalizeConfigKey,
    applyDetailTypeConfig,
    resolveShopCategoryLabel,
    getShopCategoryDetailConfig,
    mergeShopCategoryDetailIntoConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);

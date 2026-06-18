/**
 * スマホ詳細ページ共通テンプレ（960px以下）
 */
(function () {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {};
  const MOBILE_MQ = "(max-width: 960px)";

  const DETAIL_PAGES = new Set([
    "detail-business-service.html",
    "detail-job.html",
    "detail-product.html",
    "detail-shop.html",
    "detail-shop-store.html",
    "detail-general.html",
    "demo-progress.html",
  ]);

  const VARIANT_LABELS = {
    business_service: "業務サービス",
    job: "求人",
    product: "商品",
    shop: "店舗・販売",
    general: "その他",
    progress: "案件",
  };

  const CTA_PRESETS = {
    business_service: [
      { key: "primary", label: "見積もりを依頼", role: "primary" },
      { key: "secondary", label: "チャットで相談", role: "secondary" },
    ],
    job: [
      { key: "primary", label: "応募する", role: "primary" },
      { key: "secondary", label: "チャット", role: "secondary" },
    ],
    product: [
      { key: "primary", label: "購入する", role: "primary" },
      { key: "secondary", label: "問い合わせ", role: "secondary" },
    ],
    shop: [
      { key: "primary", label: "店舗に問い合わせ", role: "primary" },
      { key: "secondary", label: "商品を見る", role: "secondary" },
    ],
    progress: [
      { key: "primary", label: "チャット", role: "primary" },
      { key: "secondary", label: "詳細を見る", role: "secondary" },
    ],
    general: [
      { key: "primary", label: "参加について相談", role: "primary" },
      { key: "secondary", label: "チャット", role: "secondary" },
    ],
  };

  const SCRAPE = {
    business_service: {
      category: ".bsd-hero__category, [data-business-category-badge]",
      title: "[data-biz-detail-title]",
      provider: "[data-biz-detail-company]",
      price: "[data-biz-detail-sidebar-price]",
      rating: "[data-biz-detail-hero-rating-score]",
      area: "[data-biz-detail-hero-quick]",
      desc: "[data-biz-detail-hero-lead], [data-biz-detail-description]",
      ctaPrimary: "[data-biz-detail-sidebar-actions] .biz-detail-btn--primary, [data-biz-detail-sidebar-actions] a.biz-detail-btn:first-of-type",
      ctaSecondary: "[data-biz-detail-sidebar-actions] .biz-detail-btn--outline, [data-biz-detail-sidebar-actions] a.biz-detail-btn:nth-of-type(2)",
    },
    job: {
      category: "[data-listing-category-badge]",
      title: "[data-listing-title]",
      provider: "[data-listing-job-hero-seller], [data-listing-seller-name]",
      price: "[data-listing-job-fv-price], [data-listing-price]",
      rating: "[data-listing-rating-score]",
      area: "[data-listing-job-hero-summary], [data-listing-subtitle]",
      desc: "[data-listing-job-description], [data-listing-description]",
      ctaPrimary: "[data-listing-primary-cta], .hero-apply-btn",
      ctaSecondary: ".skill-cta-panel__secondary, .cta-consult",
    },
    product: {
      category: "[data-listing-category-badge]",
      title: "[data-listing-title]",
      provider: "[data-listing-product-hero-seller]",
      price: "[data-listing-price]",
      rating: "[data-listing-rating-score]",
      area: "[data-listing-subtitle]",
      desc: "[data-listing-description]",
      ctaPrimary: "[data-listing-primary-cta], .product-cta-panel a.hero-apply-btn",
      ctaSecondary: ".skill-cta-panel__secondary, .product-cta-panel .skill-cta-panel__secondary",
    },
    shop: {
      category: "[data-shop-category-label], .shop-hero__category",
      title: "[data-biz-detail-title], [data-shop-store-title]",
      provider: "[data-biz-detail-company], [data-shop-store-company]",
      price: "[data-biz-detail-sidebar-price], [data-shop-price-label]",
      rating: "[data-biz-detail-hero-rating-score]",
      area: "[data-biz-detail-hero-quick], [data-shop-area]",
      desc: "[data-biz-detail-hero-lead], [data-shop-lead]",
      ctaPrimary: "[data-biz-detail-sticky-inquiry], [data-shop-bind='ctaPrimaryText']",
      ctaSecondary: "[data-biz-detail-sticky-estimate], a[href*='section-products']",
    },
    general: {
      category: "[data-business-category-badge]",
      title: "[data-biz-detail-title]",
      provider: "[data-biz-detail-company]",
      price: "[data-biz-detail-sidebar-price]",
      rating: "[data-biz-detail-hero-rating-score]",
      area: "[data-biz-detail-hero-quick]",
      desc: "[data-biz-detail-hero-lead]",
      ctaPrimary: "[data-biz-detail-sidebar-actions] .biz-detail-btn--primary",
      ctaSecondary: "[data-biz-detail-sidebar-actions] .biz-detail-btn--outline",
    },
    progress: {
      category: null,
      title: ".demo-deals-page-head__title",
      provider: "[data-demo-deals-list] .demo-progress-deal-card__rows dd",
      price: null,
      rating: null,
      area: null,
      desc: ".demo-deals-page-head__sub",
      ctaPrimary: "a[href*='talk-home.html?tab=chat']",
      ctaSecondary: "[data-demo-deals-list] .demo-progress-deal-card",
    },
  };

  /** 業務サービス詳細 — スマホ表示順（PC #id を cloneNode のみで反映） */
  const BUSINESS_SERVICE_SECTION_SPECS = [
    { label: "概要", ids: ["section-overview"], fallbackKey: "overview" },
    { label: "ギャラリー", gallery: true },
    { label: "サービスメニュー", ids: ["section-service-menu"] },
    { label: "施工事例", ids: ["section-achievements"] },
    { label: "スタッフ紹介", extract: "staff", fallbackKey: "staff" },
    { label: "資格・認証", ids: ["section-license"], extract: "license" },
    { label: "ご依頼の流れ", ids: ["section-flow"] },
    { label: "口コミ", ids: ["section-reviews"] },
    { label: "会社情報", ids: ["section-company-info"], fallbackKey: "company" },
    { label: "対応エリア", ids: ["section-service-area"], fallbackKey: "area" },
    { label: "FAQ", ids: ["section-faq"], fallbackKey: "faq" },
    {
      label: "注意事項",
      ids: [],
      extraSelectors: ["[data-biz-detail-disclaimer]"],
      fallbackKey: "notes",
    },
  ];

  const BUSINESS_SERVICE_REQUIRED_SECTION_IDS = new Set([
    "section-overview",
    "section-service-menu",
    "section-achievements",
    "section-license",
    "section-flow",
    "section-reviews",
    "section-company-info",
    "section-service-area",
    "section-faq",
  ]);

  const BUSINESS_SERVICE_STRUCTURE_CHECKS = {
    "section-overview": (root) =>
      root.querySelector(
        "[data-bsd-overview-description], .business-summary__description, [data-bsd-overview-cards] .bsd-feature-pill, [data-bsd-overview-kpis] .bsd-kpi-card"
      ),
    "section-service-menu": (root) =>
      root.querySelector("[data-bsd-pricing-tbody] tr, .bsd-pricing-table tbody tr"),
    "section-achievements": (root) =>
      root.querySelector(
        ".bsd-work-case-card, [data-bsd-work-cases-grid] > *, [data-biz-detail-cases] > *"
      ),
    "section-license": (root) =>
      root.querySelector("[data-bsd-license-list] [data-bsd-cert-item], [data-bsd-license-list] li, [data-bsd-license-list] article"),
    "section-flow": (root) =>
      root.querySelector("[data-bsd-flow-steps] > li, [data-bsd-flow-steps] .bsd-flow__step"),
    "section-reviews": (root) =>
      root.querySelector(
        ".reviews-panel__card, .taxi-review-section__card, [data-biz-detail-reviews-strip] > *"
      ),
    "section-company-info": (root) =>
      root.querySelector("[data-bsd-company-table] tr"),
    "section-service-area": (root) =>
      root.querySelector(
        "[data-bsd-area-online-value], [data-bsd-area-visit-value], .bsd-area-v2__mode-value, .bsd-area-v2__about-list li"
      ),
    "section-faq": (root) =>
      root.querySelector("[data-bsd-faq-list] details, .biz-detail-faq__item"),
  };

  const BUSINESS_SERVICE_FALLBACK = {
    overview:
      "<p>戸建・マンションの外壁塗装・防水、現地調査のうえお見積りします。</p>",
    company: "<p><strong>会社名:</strong> TASFULリフォームパートナー</p>",
    area: "<p>東京都・神奈川県・オンライン相談対応</p>",
    faq:
      "<ul class=\"tasu-mdetail-fallback-list\">" +
      "<li>見積もりは無料ですか？</li>" +
      "<li>オンラインのみの対応は可能ですか？</li>" +
      "<li>契約前に内容を相談できますか？</li>" +
      "</ul>",
    notes:
      "<p class=\"tasu-mdetail-notes\">掲載内容は参考情報です。契約条件・料金は掲載者とのご相談でご確認ください。</p>",
    staff:
      "<p class=\"tasu-mdetail-body\">自社職人＋協力職人15名体制。現地調査から施工管理まで専任担当が対応します。</p>",
  };

  const SECTION_GROUPS = {
    job: [
      { label: "仕事内容", ids: ["section-description"] },
      { label: "報酬", ids: ["section-reward"] },
      { label: "応募条件", ids: ["section-requirements"] },
      { label: "歓迎スキル", ids: ["section-welcome"] },
      { label: "福利厚生", ids: ["section-benefits"] },
      { label: "契約条件", ids: ["section-contract"] },
      { label: "掲載者情報", ids: ["section-seller"] },
      { label: "職場イメージ", ids: ["section-workplace"] },
      { label: "この企業の他の求人", ids: ["otherServices"] },
    ],
    product: [
      { label: "概要", ids: ["section-details"] },
      { label: "詳細情報", ids: ["section-options", "section-portfolio"] },
      { label: "提供者情報", ids: ["section-seller"] },
      { label: "口コミ", ids: ["section-reviews"] },
    ],
    shop: [
      { label: "概要", ids: ["section-products", "section-shop-highlights"] },
      { label: "詳細情報", ids: ["section-shop-cases", "section-shop-bottom"] },
      { label: "口コミ", ids: ["section-shop-reviews", "section-reviews"] },
      { label: "FAQ", ids: ["section-faq"] },
    ],
    general: [
      { label: "概要", ids: ["section-overview", "section-general-event-info"] },
      { label: "詳細情報", ids: ["section-service-menu", "section-achievements", "section-flow"] },
      { label: "提供者情報", ids: ["section-general-organizer", "section-company-info"] },
      { label: "口コミ", ids: ["section-reviews"] },
      { label: "FAQ", ids: ["section-faq"] },
    ],
    progress: [{ label: "進行中の取引", ids: ["demo-deals-panel"] }],
  };

  const CTA_SKIP_SELECTORS =
    ".bsd-cta-card, .hero-cta-card, .biz-detail-fv-card, [data-bsd-cta-actions], [data-biz-detail-sidebar-actions], " +
    ".skill-cta-panel, .product-cta-panel, .job-cta-panel, .bsd-ai-band, [data-fs-ai-band], " +
    ".bsd-footer, .fs-site-footer, [data-fs-site-footer], [data-bsd-materials-link], .bsd-cta-card__fav, .hero-download-card";

  const PC_INLINE_STYLE_PROPS = [
    "display",
    "height",
    "maxHeight",
    "minHeight",
    "overflow",
    "visibility",
    "opacity",
    "margin",
    "padding",
    "pointerEvents",
    "border",
    "boxShadow",
  ];

  const PC_SOURCE_HIDE_SELECTORS = [
    "#business-service-detail-root",
    ".tasu-banner",
    ".biz-detail-status-wrap",
    "[data-biz-detail-sticky-bar]",
    ".bsd-sticky",
    ".skill-detail-wrap",
    ".shop-detail-page",
    ".biz-detail-page-wrap",
    ".demo-deals-layout",
    ".post-page",
    ".business-detail-main",
    ".detail-main",
  ];

  const JUNK_TEXT_PATTERNS = [
    /^TASFUL$/i,
    /^©\s*\d{4}/i,
    /All Rights Reserved/i,
    /ご相談・お見積りはこちら/,
    /ご相談・お見積りはこちめ/,
    /^相談め$/,
    /資料をダウンロード/,
    /お気に入りに追加/,
    /業務内容.*見積もりについて.*ご相談/,
    /業務内容め積もりについて/,
    /あなたの「困った」を解決する地域密着型/,
  ];

  let applied = false;
  let heroEl = null;
  let ctaDockEl = null;
  let detailShellEl = null;
  let bottomChromeResizeBound = false;

  function syncMobileBottomChromeInsets() {
    const doc = root.document;
    if (!doc?.documentElement || !isMobile()) return;

    const tab = doc.querySelector(".tasu-app-tabbar, .talk-mobile-tabbar");
    const tabH = tab ? Math.max(tab.offsetHeight, Math.ceil(tab.getBoundingClientRect().height)) : 0;
    if (tabH > 0) {
      doc.documentElement.style.setProperty("--tasu-mdetail-tabbar-measured", `${tabH}px`);
      doc.documentElement.style.setProperty("--tasu-mdetail-tabbar-offset", `${tabH}px`);
    }

    const cta = ctaDockEl || doc.querySelector("[data-tasu-mdetail-cta-dock]");
    let ctaH = 0;
    if (cta) {
      cta.style.removeProperty("bottom");
      ctaH = Math.max(cta.offsetHeight, Math.ceil(cta.getBoundingClientRect().height));
      if (ctaH > 0) {
        doc.documentElement.style.setProperty("--tasu-mdetail-cta-measured", `${ctaH}px`);
        doc.documentElement.style.setProperty("--tasu-mdetail-cta-h", `${ctaH}px`);
      }
    }

    const isJobMobile =
      doc.body?.dataset?.detailType === "job" && doc.body?.classList.contains("tasu-mdetail-ready");
    const footerGap = 12;
    let stack = (tabH || 60) + (ctaH || 64);
    if (isJobMobile) {
      stack = 0;
    }
    const stackPx = `${stack}px`;
    const jobStackPad = "calc(132px + env(safe-area-inset-bottom, 0px))";
    const jobTabPad = tabH > 0 ? `${tabH}px` : "var(--tasu-app-tabbar-pad)";
    const footerPad = isJobMobile ? 132 + footerGap : stack + footerGap;
    const footerPadPx = `${footerPad}px`;
    doc.documentElement.style.setProperty("--tasu-mdetail-bottom-stack", stackPx);
    doc.documentElement.style.setProperty(
      "--tasu-mdetail-footer-clearance",
      isJobMobile ? jobStackPad : `${footerPad}px`
    );
    doc.documentElement.style.setProperty("--tasu-mdetail-site-footer-pad-bottom", footerPadPx);

    if (isJobMobile) {
      doc.body.style.removeProperty("padding-bottom");
      const fixedCtaVisible = doc.body.classList.contains("job-fixed-cta-visible");
      const dock = doc.querySelector("[data-job-bottom-dock]");
      if (dock) {
        const dockH = Math.max(dock.offsetHeight, Math.ceil(dock.getBoundingClientRect().height));
        if (dockH > 0) {
          doc.documentElement.style.setProperty("--job-mobile-cta-measured", `${dockH}px`);
        }
        if (tabH > 0) {
          doc.documentElement.style.setProperty(
            "--job-mobile-stack-measured",
            `${dockH + 8 + tabH}px`
          );
        }
      }
      if (fixedCtaVisible) {
        doc.documentElement.style.setProperty("--job-mobile-stack-pad", jobStackPad);
      } else {
        doc.documentElement.style.setProperty("--job-mobile-stack-pad", jobTabPad);
      }
      return;
    }

    const isBizService =
      doc.body?.classList.contains("biz-detail-page--business-service") &&
      doc.body?.classList.contains("tasu-mdetail-ready");
    if (isBizService) {
      doc.body.style.setProperty("padding-bottom", "0", "important");
      const footerSlot = doc.querySelector("[data-tasu-mdetail-site-footer]");
      if (footerSlot) {
        footerSlot.style.setProperty("padding-bottom", footerPadPx);
      }
    } else if (doc.body?.classList.contains("tasu-mdetail-ready")) {
      doc.body.style.removeProperty("padding-bottom");
    }
  }

  function appendJobMobileSiteFooter() {
    const shell = ensureMobileDetailShell();
    if (!shell) return;

    let slot = shell.querySelector("[data-tasu-mdetail-site-footer]");
    if (!slot) {
      slot = root.document.createElement("div");
      slot.className = "tasu-mdetail-site-footer tasu-mdetail-site-footer--job";
      slot.setAttribute("data-tasu-mdetail-site-footer", "");
      shell.appendChild(slot);
    }

    slot.innerHTML =
      `<footer class="job-detail-footer tasu-mdetail-job-footer" role="contentinfo">` +
      `© TasuFull — 求人マーケットプレイス</footer>`;
  }

  function buildBusinessServiceMobileSiteFooterHtml() {
    const siteFooter = getBusinessServicePcRoot()?.querySelector(
      "[data-fs-site-footer], footer.bsd-footer.fs-site-footer"
    );
    const tagline =
      siteFooter?.querySelector(".bsd-footer__tagline")?.textContent?.trim() ||
      "あなたの「困った」を解決する地域密着型便利プラットフォーム";
    const copy =
      siteFooter?.querySelector(".bsd-footer__copy")?.textContent?.trim() ||
      "© 2026 TASFUL All Rights Reserved.";
    return (
      `<footer class="bsd-footer tasu-mdetail-mobile-footer fs-site-footer" data-fs-site-footer role="contentinfo">` +
      `<div class="bsd-footer__inner">` +
      `<p class="bsd-footer__brand"><span class="bsd-footer__mark" aria-hidden="true"></span> TASFUL</p>` +
      `<p class="bsd-footer__tagline">${escapeHtml(tagline)}</p>` +
      `<p class="bsd-footer__copy">${escapeHtml(copy)}</p>` +
      `</div></footer>`
    );
  }

  function bindBottomChromeResize() {
    if (bottomChromeResizeBound) return;
    bottomChromeResizeBound = true;
    root.addEventListener?.("resize", () => {
      if (!isMobile() || !root.document?.body?.classList.contains("tasu-mdetail-ready")) return;
      syncMobileBottomChromeInsets();
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pageFileName() {
    const path = root.location?.pathname || "";
    const parts = path.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function isMobile() {
    try {
      return root.matchMedia(MOBILE_MQ).matches;
    } catch {
      return false;
    }
  }

  function detectVariant() {
    const file = pageFileName();
    if (file === "detail-business-service.html") return "business_service";
    if (file === "detail-job.html") return "job";
    if (file === "detail-product.html") return "product";
    if (file === "detail-shop.html" || file === "detail-shop-store.html") return "shop";
    if (file === "detail-general.html") return "general";
    if (file === "demo-progress.html") return "progress";
    const dt = String(root.document?.body?.dataset?.detailType || "").toLowerCase();
    if (dt === "field_service") return "business_service";
    if (dt === "job") return "job";
    if (dt === "product") return "product";
    if (dt === "shop_store") return "shop";
    if (dt === "general") return "general";
    return "";
  }

  function isTargetPage() {
    return DETAIL_PAGES.has(pageFileName());
  }

  function isDemoBusinessServiceListing() {
    try {
      const raw = new URLSearchParams(root.location?.search || "").get("id") || "";
      const id = root.TasuListingDemoCatalog?.resolveId?.(raw) || raw.trim();
      if (root.TasuListingDemoCatalog?.isBusinessServiceDemoId?.(id)) return true;
      return /^demo-(business-service|bs|business)-/i.test(id);
    } catch {
      return false;
    }
  }

  function getBusinessServicePcRoot() {
    return root.document?.getElementById("business-service-detail-root");
  }

  function pickText(selectors) {
    if (!selectors) return "";
    const list = String(selectors).split(",").map((s) => s.trim());
    for (let i = 0; i < list.length; i += 1) {
      const el = root.document?.querySelector(list[i]);
      const t = String(el?.textContent || "").trim();
      if (t) return t;
    }
    return "";
  }

  function pickHref(selectors) {
    if (!selectors) return "";
    const list = String(selectors).split(",").map((s) => s.trim());
    for (let i = 0; i < list.length; i += 1) {
      const el = root.document?.querySelector(list[i]);
      const href = String(el?.getAttribute?.("href") || "").trim();
      if (href && href !== "#") return href;
    }
    return "";
  }

  function isJunkOnlyText(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return true;
    if (JUNK_TEXT_PATTERNS.some((re) => re.test(t))) return true;
    if (/^TASFUL\b/i.test(t) && t.length < 120 && !/戸建|外壁|会社名|見積もりは無料/.test(t)) return true;
    return false;
  }

  function isFooterOnlyNode(el) {
    if (!el) return true;
    if (el.matches(".bsd-footer, .fs-site-footer, [data-fs-site-footer], footer.bsd-footer")) return true;
    const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
    if (/^TASFUL/i.test(t) && /©|All Rights Reserved|地域密着型便利プラットフォーム/.test(t)) return true;
    return isJunkOnlyText(t);
  }

  function allChildrenEffectivelyHidden(el) {
    if (!el?.children?.length) return true;
    return [...el.children].every((ch) => isElementHidden(ch) || !hasMeaningfulContent(ch));
  }

  function insertMobileDetailShellElement(el) {
    const anchors = [
      () => root.document?.getElementById("business-service-detail-root"),
      () => root.document?.querySelector(".skill-detail-wrap"),
      () => root.document?.querySelector(".shop-detail-page"),
      () => root.document?.querySelector(".biz-detail-page-wrap"),
      () => root.document?.querySelector(".demo-deals-layout"),
      () => root.document?.querySelector("main"),
    ];
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i]();
      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(el, anchor.nextSibling);
        return;
      }
    }
    root.document?.body?.appendChild(el);
  }

  function ensureMobileDetailShell() {
    if (!detailShellEl) {
      detailShellEl = root.document?.querySelector("[data-tasu-mobile-detail-shell]");
    }
    if (!detailShellEl) {
      detailShellEl = root.document.createElement("div");
      detailShellEl.className = "tasu-mobile-detail-shell";
      detailShellEl.setAttribute("data-tasu-mobile-detail-shell", "");
      insertMobileDetailShellElement(detailShellEl);
    } else {
      const parent = detailShellEl.parentNode;
      const hiddenAncestor = detailShellEl.closest("[data-tasu-mdetail-pc-hidden], .skill-detail-wrap, #business-service-detail-root");
      if (hiddenAncestor && hiddenAncestor !== detailShellEl) {
        insertMobileDetailShellElement(detailShellEl);
      } else if (parent && detailShellEl.closest("#business-service-detail-root")) {
        insertMobileDetailShellElement(detailShellEl);
      }
    }
    detailShellEl.hidden = false;
    detailShellEl.removeAttribute("aria-hidden");
    detailShellEl.style.removeProperty("display");
    detailShellEl.style.removeProperty("height");
    detailShellEl.style.removeProperty("overflow");
    detailShellEl.classList.add("tasu-mobile-detail-shell--active");
    return detailShellEl;
  }

  function cssPropToDatasetKey(prop) {
    return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  }

  function snapshotPcElement(el) {
    if (!el || el.closest("[data-tasu-mobile-detail-shell]")) return;
    if (el.hasAttribute("data-tasu-mdetail-pc-hidden")) return;

    if (el.hasAttribute("hidden")) {
      el.setAttribute("data-tasu-mdetail-prev-hidden", "1");
    }
    if (el.hasAttribute("aria-hidden")) {
      el.setAttribute("data-tasu-mdetail-prev-aria-hidden", el.getAttribute("aria-hidden") || "true");
    } else {
      el.setAttribute("data-tasu-mdetail-prev-aria-hidden", "");
    }

    PC_INLINE_STYLE_PROPS.forEach((prop) => {
      const inline = el.style[prop];
      if (inline) {
        el.setAttribute(`data-tasu-mdetail-prev-style-${cssPropToDatasetKey(prop)}`, inline);
      }
    });

    el.setAttribute("data-tasu-mdetail-pc-hidden", "");

    if (el.id === "business-service-detail-root" || el.tagName === "MAIN") {
      el.setAttribute("data-tasu-mdetail-applied-aria", "1");
      el.setAttribute("aria-hidden", "true");
    }
  }

  function hidePcDetailSources() {
    PC_SOURCE_HIDE_SELECTORS.forEach((sel) => {
      root.document?.querySelectorAll(sel).forEach((el) => snapshotPcElement(el));
    });
    root.document?.querySelectorAll(".bsd-page .bsd-footer, .bsd-ai-band, [data-fs-ai-band]").forEach((el) => {
      snapshotPcElement(el);
    });
  }

  function restorePcElement(el) {
    if (!el || el.closest("[data-tasu-mobile-detail-shell]")) return;

    el.removeAttribute("data-tasu-mdetail-pc-hidden");

    if (el.hasAttribute("data-tasu-mdetail-prev-hidden")) {
      el.hidden = true;
      el.removeAttribute("data-tasu-mdetail-prev-hidden");
    }

    if (el.hasAttribute("data-tasu-mdetail-prev-aria-hidden")) {
      const prevAria = el.getAttribute("data-tasu-mdetail-prev-aria-hidden");
      if (prevAria === "") el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", prevAria);
      el.removeAttribute("data-tasu-mdetail-prev-aria-hidden");
    } else if (el.hasAttribute("data-tasu-mdetail-applied-aria")) {
      el.removeAttribute("aria-hidden");
      el.removeAttribute("data-tasu-mdetail-applied-aria");
    }

    [...el.attributes].forEach((attr) => {
      const prefix = "data-tasu-mdetail-prev-style-";
      if (!attr.name.startsWith(prefix)) return;
      const cssProp = attr.name.slice(prefix.length);
      const val = attr.value;
      if (val) el.style.setProperty(cssProp, val);
      else el.style.removeProperty(cssProp);
      el.removeAttribute(attr.name);
    });
  }

  function restorePcDetailState() {
    root.document?.querySelectorAll("[data-tasu-mdetail-pc-hidden]").forEach((el) => restorePcElement(el));
    root.document
      ?.querySelectorAll("[data-tasu-mdetail-applied-aria], [data-tasu-mdetail-prev-aria-hidden], [data-tasu-mdetail-prev-hidden]")
      .forEach((el) => restorePcElement(el));

    const pcRoot = root.document?.getElementById("business-service-detail-root");
    if (pcRoot) {
      pcRoot.removeAttribute("aria-hidden");
      pcRoot.removeAttribute("data-tasu-mdetail-pc-hidden");
      pcRoot.removeAttribute("data-tasu-mdetail-applied-aria");
      pcRoot.hidden = false;
      pcRoot.style.removeProperty("display");
      pcRoot.style.removeProperty("height");
      pcRoot.style.removeProperty("overflow");
      pcRoot.style.removeProperty("visibility");
      pcRoot.style.removeProperty("opacity");
    }

    root.document?.querySelectorAll("[data-tasu-mobile-detail-shell]").forEach((shell) => {
      shell.innerHTML = "";
      shell.hidden = true;
      shell.setAttribute("aria-hidden", "true");
      shell.classList.remove("tasu-mobile-detail-shell--active");
      shell.style.removeProperty("display");
      shell.style.removeProperty("height");
      shell.style.removeProperty("overflow");
    });

    root.document?.body?.classList.remove("tasu-mdetail-page", "tasu-mdetail-ready");
  }

  function sanitizeSectionClone(clone) {
    if (!clone) return;
    clone.querySelectorAll(
      `${CTA_SKIP_SELECTORS}, .bsd-sr-only, [data-bsd-materials-link], .reviews-panel__more`
    ).forEach((n) => n.remove());
  }

  function isElementHidden(el) {
    if (!el || !(el instanceof Element)) return true;
    if (el.hidden) return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    try {
      const st = root.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return true;
      if (parseFloat(st.height) === 0 && el.offsetHeight === 0 && !el.querySelector("img[src]")) {
        const text = String(el.textContent || "").replace(/\s+/g, "").trim();
        if (!text) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function stripForMeaningCheck(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(
      `${CTA_SKIP_SELECTORS}, script, style, noscript, .bsd-sr-only, [hidden], [aria-hidden="true"]`
    ).forEach((n) => n.remove());
    return clone;
  }

  function getMeaningfulText(el, minLen) {
    if (!el) return "";
    const cleaned = stripForMeaningCheck(el);
    const text = String(cleaned.textContent || "").replace(/\s+/g, " ").trim();
    return text.length >= (minLen || 6) ? text : "";
  }

  function isCtaOnlySection(el) {
    if (!el) return false;
    if (
      el.matches(
        ".bsd-cta-card, .hero-cta-card, .biz-detail-fv-card, [data-bsd-cta-actions], [data-biz-detail-sidebar-actions]"
      )
    ) {
      return true;
    }
    const hasCta = el.querySelector(CTA_SKIP_SELECTORS);
    if (!hasCta) return false;
    const withoutCta = stripForMeaningCheck(el);
    const text = String(withoutCta.textContent || "").replace(/\s+/g, " ").trim();
    return text.length < 12;
  }

  function hasMeaningfulContent(el) {
    if (!el) return false;
    const cleaned = stripForMeaningCheck(el);
    if (getMeaningfulText(cleaned, 5)) return true;
    if (
      cleaned.querySelector(
        "img[src], video, iframe, table tbody tr, li, .bsd-work-cases-grid > *, [data-bsd-faq-list] > *, [data-bsd-company-table] tr, [data-bsd-flow-steps] > *"
      )
    ) {
      const subText = getMeaningfulText(cleaned, 2);
      if (subText) return true;
      const hasMedia = cleaned.querySelector("img[src], table tbody tr, li");
      if (hasMedia) return true;
    }
    return false;
  }

  function isSectionMeaningful(el) {
    if (!el || !(el instanceof Element)) return false;
    if (isElementHidden(el)) return false;
    if (isFooterOnlyNode(el)) return false;
    if (el.matches(".bsd-ai-band, [data-fs-ai-band]")) return false;
    if (isCtaOnlySection(el)) return false;
    if (allChildrenEffectivelyHidden(el)) return false;
    return hasMeaningfulContent(el);
  }

  function unhideCloneTree(clone) {
    if (!clone) return;
    clone.removeAttribute("hidden");
    clone.hidden = false;
    clone.querySelectorAll("[hidden]").forEach((n) => {
      n.removeAttribute("hidden");
      n.hidden = false;
    });
    clone.querySelectorAll("[aria-hidden='true']").forEach((n) => {
      if (!n.matches(".bsd-sr-only, [hidden]")) n.removeAttribute("aria-hidden");
    });
  }

  function hasBusinessServiceStructuralContent(clone, sectionId) {
    if (!clone) return false;
    const check = BUSINESS_SERVICE_STRUCTURE_CHECKS[sectionId];
    if (check && check(clone)) return true;
    const cleaned = stripForMeaningCheck(clone);
    if (getMeaningfulText(cleaned, 4)) return true;
    return Boolean(
      cleaned.querySelector(
        "img[src], table tbody tr, li, ol, ul, .bsd-work-case-card, .reviews-panel__card"
      )
    );
  }

  function shouldForceBusinessServiceSection(sectionId, clone) {
    if (!isDemoBusinessServiceListing()) return false;
    if (!sectionId || !BUSINESS_SERVICE_REQUIRED_SECTION_IDS.has(sectionId)) return false;
    return hasBusinessServiceStructuralContent(clone, sectionId);
  }

  function normalizeHeadingText(text) {
    return String(text || "")
      .replace(/\s+/g, "")
      .replace(/[・･]/g, "")
      .trim();
  }

  /** スマホテンプレ見出しと重複する clone 内の先頭見出しを除去 */
  function stripDuplicateSectionHeading(root, sectionLabel) {
    if (!root || !sectionLabel) return;
    const want = normalizeHeadingText(sectionLabel);
    if (!want) return;

    const headingMatches = (text) => {
      const t = normalizeHeadingText(text);
      if (!t) return false;
      if (t === want || t.includes(want) || want.includes(t)) return true;
      if (want === "口コミ" && /口コミ/.test(t)) return true;
      if (want === "FAQ" && /FAQ|よくある質問|よくある質啁/.test(t)) return true;
      if (want === "資格認証" && /資格|認証|許可/.test(t)) return true;
      if (want === "スタッフ紹介" && /スタッフ/.test(t)) return true;
      return false;
    };

    const headingSel =
      "h2, h3, .bsd-section__title, .section-title, .bsd-trust-section__title, " +
      ".request-flow__title, .pricing-plan__title, .license-credentials__title";
    const headings = root.querySelectorAll(headingSel);
    for (const el of headings) {
      if (!headingMatches(el.textContent)) continue;
      el.remove();
      break;
    }

    root.querySelectorAll(
      ".section-header, .bsd-trust-section__head, .bsd-section__head, header.bsd-trust-section__head"
    ).forEach((head) => {
      if (!normalizeHeadingText(head.textContent)) head.remove();
    });
  }

  function finalizeBusinessServiceCloneHtml(clone, sectionId, sectionLabel) {
    sanitizeSectionClone(clone);
    if (sectionLabel) stripDuplicateSectionHeading(clone, sectionLabel);
    const html = String(clone.innerHTML || "").trim();
    if (!html) return "";
    if (isJunkOnlyText(clone.textContent) && !clone.querySelector("img[src], table tbody tr, li, ul, ol")) {
      if (!shouldForceBusinessServiceSection(sectionId, clone)) return "";
    }
    if (
      !getMeaningfulText(clone, 4) &&
      !clone.querySelector("img[src], table tbody tr, li, ul, ol, .bsd-work-case-card")
    ) {
      if (!shouldForceBusinessServiceSection(sectionId, clone)) return "";
    }
    return html;
  }

  function pickTeamCapacityText(scope) {
    const kpiVal = scope?.querySelector(
      "[data-bsd-overview-kpis] .bsd-kpi-card__value, [data-bsd-overview-kpis] .bsd-kpi-card__label"
    );
    const kpiText = String(kpiVal?.closest(".bsd-kpi-card")?.textContent || kpiVal?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (kpiText && /職人|体制|スタッフ|在籍|技能士/.test(kpiText)) return kpiText;
    const quick = String(scope?.querySelector("[data-biz-detail-hero-quick]")?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (quick && /職人|体制/.test(quick)) return quick;
    return "";
  }

  function extractBusinessServiceStaffHtml() {
    const scope = getBusinessServicePcRoot() || root.document;
    const host = root.document.createElement("div");
    host.className = "tasu-mdetail-staff-clone";

    const cardHost = scope?.querySelector("[data-biz-detail-license]");
    if (cardHost) {
      const cards = cardHost.cloneNode(true);
      unhideCloneTree(cards);
      cards.classList.remove("bsd-sr-only");
      cards.removeAttribute("hidden");
      cards.hidden = false;
      const inner = finalizeBusinessServiceCloneHtml(cards, "");
      if (inner) {
        host.innerHTML = inner;
        return host.outerHTML;
      }
    }

    const kpiHost = scope?.querySelector("[data-bsd-overview-kpis]");
    if (kpiHost?.children?.length) {
      const kClone = kpiHost.cloneNode(true);
      kClone.classList.add("tasu-mdetail-staff-kpis");
      host.appendChild(kClone);
      const html = finalizeBusinessServiceCloneHtml(host, "");
      if (html) return host.outerHTML;
    }

    const teamLine = pickTeamCapacityText(scope);
    if (teamLine) {
      host.innerHTML = `<p class="tasu-mdetail-staff-lead tasu-mdetail-body">${escapeHtml(teamLine)}</p>`;
      return host.outerHTML;
    }

    if (isDemoBusinessServiceListing()) {
      return String(BUSINESS_SERVICE_FALLBACK.staff || "").trim();
    }
    return "";
  }

  function extractBusinessServiceLicenseHtml(sectionEl) {
    if (!sectionEl) return "";
    const clone = sectionEl.cloneNode(true);
    unhideCloneTree(clone);
    clone.querySelectorAll(
      "[data-biz-detail-license], .biz-detail-license-cards, .bsd-sr-only, [data-bsd-trust-verification-badges]"
    ).forEach((n) => n.remove());
    sanitizeSectionClone(clone);
    return finalizeBusinessServiceCloneHtml(clone, "section-license", "資格・認証");
  }

  /** PC ルートが display:none でも DOM を clone（移動・remove なし） */
  function extractBusinessServiceSectionHtml(el, spec) {
    if (!el) return "";
    if (spec?.extract === "staff") return extractBusinessServiceStaffHtml();
    if (spec?.extract === "license") return extractBusinessServiceLicenseHtml(el);
    if (isFooterOnlyNode(el) || el.matches(".bsd-ai-band, [data-fs-ai-band]")) return "";

    const clone = el.cloneNode(true);
    unhideCloneTree(clone);
    clone.querySelectorAll(".bsd-sr-only").forEach((n) => n.remove());
    clone.querySelectorAll("[hidden]").forEach((n) => {
      const keep =
        n.matches("img[src]") ||
        n.querySelector?.("img[src], table tbody tr, li, .bsd-work-case-card, details") ||
        getMeaningfulText(n, 3);
      if (!keep) n.remove();
      else {
        n.removeAttribute("hidden");
        n.hidden = false;
      }
    });

    const sectionId = el.id || spec?.ids?.[0] || "";
    return finalizeBusinessServiceCloneHtml(clone, sectionId, spec?.label);
  }

  function extractBusinessServiceGalleryHtml() {
    const scope = getBusinessServicePcRoot() || root.document;
    const gallery = scope?.querySelector("[data-biz-detail-gallery]");
    const mainImg = scope?.querySelector("[data-biz-detail-hero-img]");
    if (!gallery && !mainImg) return "";

    const wrap = root.document.createElement("div");
    wrap.className = "tasu-mdetail-gallery-clone";

    if (mainImg?.getAttribute("src")) {
      const fig = root.document.createElement("figure");
      fig.className = "tasu-mdetail-gallery__main";
      const img = root.document.createElement("img");
      img.src = mainImg.getAttribute("src");
      img.alt = mainImg.getAttribute("alt") || "メイン画像";
      img.loading = "lazy";
      img.decoding = "async";
      fig.appendChild(img);
      wrap.appendChild(fig);
    }

    const seenUrls = new Set();
    const pushThumb = (url) => {
      const u = String(url || "").trim();
      if (!u || seenUrls.has(u)) return;
      seenUrls.add(u);
      const img = root.document.createElement("img");
      img.src = u;
      img.alt = "";
      img.loading = "lazy";
      img.className = "tasu-mdetail-gallery__thumb";
      wrap.appendChild(img);
    };

    if (gallery) {
      const gClone = gallery.cloneNode(true);
      unhideCloneTree(gClone);
      gClone.querySelectorAll("button, [data-biz-detail-thumb]").forEach((btn) => {
        pushThumb(btn.getAttribute("data-url") || btn.querySelector("img")?.getAttribute("src"));
      });
      gClone.querySelectorAll("img.hero-thumb, img").forEach((img) => {
        pushThumb(img.getAttribute("src"));
      });
    }

    const thumbs = wrap.querySelectorAll(".tasu-mdetail-gallery__thumb, .tasu-mdetail-gallery__main img");
    if (!thumbs.length) return "";
    return wrap.outerHTML;
  }

  function collectBusinessServiceSectionBody(spec) {
    if (spec.gallery) {
      const html = extractBusinessServiceGalleryHtml();
      return html ? `<div class="tasu-mdetail-section__chunk" data-tasu-mdetail-from="gallery">${html}</div>` : "";
    }

    if (spec.extract === "staff") {
      const html = extractBusinessServiceStaffHtml();
      if (html) {
        return `<div class="tasu-mdetail-section__chunk tasu-mdetail-section__chunk--staff" data-tasu-mdetail-from="staff">${html}</div>`;
      }
      if (spec.fallbackKey && BUSINESS_SERVICE_FALLBACK[spec.fallbackKey]) {
        return `<div class="tasu-mdetail-section__chunk" data-tasu-mdetail-from="staff-fallback">${BUSINESS_SERVICE_FALLBACK[spec.fallbackKey]}</div>`;
      }
      return "";
    }

    const parts = [];
    (spec.ids || []).forEach((id) => {
      const el = resolveSectionElement(id);
      const html = extractBusinessServiceSectionHtml(el, spec);
      if (html) {
        parts.push(
          `<div class="tasu-mdetail-section__chunk" data-tasu-mdetail-from="${escapeHtml(id)}">${html}</div>`
        );
      }
    });
    (spec.extraSelectors || []).forEach((sel) => {
      const scope = getBusinessServicePcRoot() || root.document;
      scope?.querySelectorAll(sel).forEach((el) => {
        if (isFooterOnlyNode(el)) return;
        const host = el.closest("section, footer, div") || el;
        if (isFooterOnlyNode(host)) return;
        const html = extractBusinessServiceSectionHtml(host, spec);
        if (!html) return;
        const fromKey =
          sel.includes("disclaimer") ? "disclaimer" : sel.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "extra";
        const chunkClass =
          fromKey === "disclaimer" ? "tasu-mdetail-section__chunk tasu-mdetail-section__chunk--notices" : "tasu-mdetail-section__chunk";
        parts.push(`<div class="${chunkClass}" data-tasu-mdetail-from="${escapeHtml(fromKey)}">${html}</div>`);
      });
    });

    if (parts.length) return parts.join("");
    if (spec.fallbackKey && BUSINESS_SERVICE_FALLBACK[spec.fallbackKey]) {
      return BUSINESS_SERVICE_FALLBACK[spec.fallbackKey];
    }
    return "";
  }

  function isJobDetailPage() {
    return root.document?.body?.dataset?.detailType === "job";
  }

  /** 出品者セクション clone 時に host 属性を復元する（求人はランク属性を付けない） */
  function wrapSectionHostAttributes(sourceEl, innerHtml) {
    const html = String(innerHtml || "").trim();
    if (!html || !sourceEl?.hasAttribute?.("data-listing-seller")) return html;

    const classes = ["tasu-mdetail-seller-host"];
    if (sourceEl.classList.contains("detail-product-seller-section")) {
      classes.push("detail-product-seller-section");
    }
    if (sourceEl.classList.contains("job-company-section")) {
      classes.push("job-company-section");
    } else if (!isJobDetailPage() && sourceEl.classList.contains("skill-seller-premium")) {
      classes.push("skill-seller-premium");
    }

    const attrs = [
      `class="${escapeHtml(classes.join(" "))}"`,
      'data-listing-seller=""',
      'data-tasu-mdetail-seller-host=""',
    ];
    if (sourceEl.id) attrs.push(`data-tasu-mdetail-from="${escapeHtml(sourceEl.id)}"`);
    if (!isJobDetailPage() && sourceEl.dataset.sellerRank) {
      attrs.push(`data-seller-rank="${escapeHtml(sourceEl.dataset.sellerRank)}"`);
    }
    if (sourceEl.dataset.authorUserId) {
      attrs.push(`data-author-user-id="${escapeHtml(sourceEl.dataset.authorUserId)}"`);
    }

    return `<div ${attrs.join(" ")}>${html}</div>`;
  }

  /** 既存DOMは移動せず cloneNode のみで読み取る */
  function extractSectionHtml(el) {
    if (!el || !isSectionMeaningful(el)) return "";
    const clone = el.cloneNode(true);
    unhideCloneTree(clone);
    clone.querySelectorAll("[hidden], [aria-hidden='true']").forEach((n) => {
      if (!getMeaningfulText(n, 3)) n.remove();
    });
    sanitizeSectionClone(clone);
    if (isJunkOnlyText(clone.textContent) && !clone.querySelector("img[src], table tbody tr, li")) return "";
    const html = String(clone.innerHTML || "").trim();
    if (!html) return "";
    if (isJunkOnlyText(clone.textContent) && !clone.querySelector("img[src], table, li, ul, ol")) return "";
    if (!(getMeaningfulText(clone, 4) || clone.querySelector("img[src], table, li, ol, ul"))) return "";
    return wrapSectionHostAttributes(el, html);
  }

  function resolveSectionElement(id) {
    if (id === "demo-deals-panel") {
      return root.document?.querySelector("[data-demo-deals-list]")?.closest(".demo-deals-panel") || null;
    }
    return root.document?.getElementById(id);
  }

  function collectSectionBody(group) {
    const parts = [];
    const ids = group.ids || [];
    ids.forEach((id) => {
      const el = resolveSectionElement(id);
      const html = extractSectionHtml(el);
      if (html) parts.push(`<div class="tasu-mdetail-section__chunk" data-tasu-mdetail-from="${escapeHtml(id)}">${html}</div>`);
    });
    (group.extraSelectors || []).forEach((sel) => {
      root.document?.querySelectorAll(sel).forEach((el) => {
        if (isFooterOnlyNode(el)) return;
        const host = el.closest("section, footer, div") || el;
        if (isFooterOnlyNode(host)) return;
        const html = extractSectionHtml(host);
        if (html) parts.push(`<div class="tasu-mdetail-section__chunk">${html}</div>`);
      });
    });
    if (parts.length) return parts.join("");
    if (group.fallbackKey && BUSINESS_SERVICE_FALLBACK[group.fallbackKey]) {
      return BUSINESS_SERVICE_FALLBACK[group.fallbackKey];
    }
    return "";
  }

  function ensureSectionsHost() {
    const shell = ensureMobileDetailShell();
    let host = shell.querySelector("[data-tasu-mdetail-sections]");
    if (!host) {
      host = root.document.createElement("div");
      host.className = "tasu-mdetail-sections";
      host.setAttribute("data-tasu-mdetail-sections", "");
      shell.appendChild(host);
    } else if (host.parentNode !== shell) {
      shell.appendChild(host);
    }
    return host;
  }

  function appendSection(host, label, bodyHtml) {
    let body = String(bodyHtml || "").trim();
    if (!body) return false;
    const probe = root.document.createElement("div");
    probe.innerHTML = body;
    sanitizeSectionClone(probe);
    stripDuplicateSectionHeading(probe, label);
    body = String(probe.innerHTML || "").trim();
    if (!body) return false;
    if (isJunkOnlyText(probe.textContent) && !probe.querySelector("img[src], table, li, ul, ol")) {
      return false;
    }
    if (!getMeaningfulText(probe, 4) && !probe.querySelector("img[src], table tbody tr, li, ul, ol")) {
      return false;
    }
    if (allChildrenEffectivelyHidden(probe)) return false;
    const wrap = root.document.createElement("div");
    wrap.className = "tasu-mdetail-section";
    if (isJobDetailPage()) {
      wrap.classList.add("section-anchor", "job-section");
    }
    wrap.innerHTML =
      `<h3 class="tasu-mdetail-section__label">${escapeHtml(label)}</h3>` +
      `<div class="tasu-mdetail-section__body tasu-mdetail-pc-content">${body}</div>`;
    host.appendChild(wrap);
    return true;
  }

  function renderBusinessServiceSections() {
    const host = ensureSectionsHost();
    host.innerHTML = "";
    const seenBodies = new Set();
    BUSINESS_SERVICE_SECTION_SPECS.forEach((spec) => {
      const body = collectBusinessServiceSectionBody(spec);
      if (body) seenBodies.add(body);
      appendSection(host, spec.label, body);
    });
    ensureBusinessServiceMobileScrollPadding();
  }

  function ensureBusinessServiceMobileScrollPadding() {
    const shell = ensureMobileDetailShell();
    if (!shell) return;
    shell.style.removeProperty("padding-bottom");
    syncMobileBottomChromeInsets();
  }

  /** FAQ → 注意事項（sections）→ TASFULフッター（スマホ専用HTML） */
  function appendBusinessServiceMobileSiteFooter() {
    const shell = ensureMobileDetailShell();
    if (!shell) return;

    let slot = shell.querySelector("[data-tasu-mdetail-site-footer]");
    if (!slot) {
      slot = root.document.createElement("div");
      slot.className = "tasu-mdetail-site-footer tasu-mdetail-site-footer--business-service";
      slot.setAttribute("data-tasu-mdetail-site-footer", "");
      shell.appendChild(slot);
    }

    slot.innerHTML = buildBusinessServiceMobileSiteFooterHtml();
    ensureBusinessServiceMobileScrollPadding();
  }

  function renderGenericSections(variant) {
    const groups = SECTION_GROUPS[variant];
    if (!groups?.length) return;
    const host = ensureSectionsHost();
    host.innerHTML = "";
    groups.forEach((group) => {
      const parts = [];
      (group.ids || []).forEach((id) => {
        const el = resolveSectionElement(id);
        const html = extractSectionHtml(el);
        if (html) {
          parts.push(
            `<div class="tasu-mdetail-section__chunk" data-tasu-mdetail-from="${escapeHtml(id)}">${html}</div>`
          );
        }
      });
      appendSection(host, group.label, parts.join(""));
    });
  }

  function renderProgressMobileSections() {
    const host = ensureSectionsHost();
    host.innerHTML = "";
    window.TasuDemoDeals?.init?.("demo-progress");
    const bodyHost = root.document.createElement("div");
    bodyHost.className = "tasu-mdetail-section__body tasu-mdetail-pc-content demo-progress-mobile-body";
    window.TasuDemoDeals?.renderProgressMobile?.(bodyHost);
    const wrap = root.document.createElement("div");
    wrap.className = "tasu-mdetail-section";
    wrap.innerHTML = `<h3 class="tasu-mdetail-section__label">進行中の取引</h3>`;
    wrap.appendChild(bodyHost);
    host.appendChild(wrap);
  }

  function renderSections(variant) {
    if (variant === "business_service") {
      renderBusinessServiceSections();
      return;
    }
    if (variant === "progress") {
      renderProgressMobileSections();
      return;
    }
    renderGenericSections(variant);
  }

  function scrapeHero(variant) {
    const cfg = SCRAPE[variant] || SCRAPE.business_service;
    const category = pickText(cfg.category) || VARIANT_LABELS[variant] || "掲載";
    const title =
      pickText(cfg.title) ||
      root.document?.querySelector(".tasu-mobile-page-head__title")?.textContent?.trim() ||
      "詳細";
    const provider = pickText(cfg.provider);
    const price = pickText(cfg.price);
    let rating = pickText(cfg.rating);
    const countEl = root.document?.querySelector("[data-biz-detail-hero-rating-count]");
    const count = String(countEl?.textContent || "").trim();
    if (rating && count) rating = `${rating} ${count}`;
    const area = pickText(cfg.area);
    const desc = pickText(cfg.desc);
    return { category, title, provider, price, rating, area, desc };
  }

  function enhanceBackBar(variant, hero) {
    const head = root.document?.querySelector("[data-tasu-mobile-shell-head]");
    if (!head) return;
    if (!head.querySelector("[data-tasu-mdetail-menu]")) {
      const menu = root.document.createElement("button");
      menu.type = "button";
      menu.className = "tasu-mdetail-head__menu";
      menu.setAttribute("data-tasu-mdetail-menu", "");
      menu.setAttribute("aria-label", "メニュー");
      menu.textContent = "︙";
      menu.addEventListener("click", () => {
        const first = root.document?.querySelector(".tasu-mdetail-section, [data-tasu-mdetail-sections]");
        first?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
      const endSlot = head.querySelector(".tasu-mobile-page-head__slot--end");
      if (endSlot) {
        endSlot.removeAttribute("aria-hidden");
        endSlot.appendChild(menu);
      } else {
        head.appendChild(menu);
      }
    }
    const titleEl = head.querySelector(".tasu-mobile-page-head__title");
    if (titleEl && hero.title) titleEl.textContent = hero.title;
    const backBtn = head.querySelector("[data-tasu-mobile-back]");
    if (backBtn && !backBtn.dataset.tasuMdetailBackLabel) {
      backBtn.dataset.tasuMdetailBackLabel = "1";
      backBtn.setAttribute("aria-label", "戻る");
    }
  }

  function pickHeroImageSrc(variant) {
    if (variant === "job") return pickJobHeroImageSrc();
    const scope = getBusinessServicePcRoot() || root.document;
    const main = scope?.querySelector("[data-biz-detail-hero-img]");
    const src = String(main?.getAttribute("src") || "").trim();
    if (src) return src;
    const thumb = scope?.querySelector("[data-biz-detail-gallery] img[src], [data-biz-detail-thumb] img");
    return String(thumb?.getAttribute("src") || "").trim();
  }

  function pickJobHeroImageSrc() {
    const selectors = [
      "[data-listing-image]",
      "#mainImage",
      "[data-listing-hero-figure] img",
      "#portfolioStrip img",
      "[data-listing-portfolio-strip] img",
    ];
    for (const selector of selectors) {
      const el = root.document?.querySelector(selector);
      const src = String(el?.getAttribute("src") || "").trim();
      if (src) return src;
    }
    return "";
  }

  function buildJobMobileHeroFvTagsHtml() {
    const host = root.document?.querySelector("[data-listing-job-hero-fv-tags]");
    if (!host) return "";
    const tags = [...host.querySelectorAll(".job-tag-pill, .job-hero-fv-tag")]
      .map((el) => String(el.textContent || "").trim())
      .filter(Boolean);
    if (!tags.length) return "";
    return [...host.querySelectorAll(".job-tag-pill, .job-hero-fv-tag")]
      .map((el) => el.outerHTML)
      .join("");
  }

  function buildJobMobileHeroRewardHtml(price) {
    const text = String(price || "").trim();
    if (!text) return "";
    return (
      `<div class="tasu-mdetail-hero__reward tasu-mdetail-hero__reward--job">` +
      `<span class="tasu-mdetail-hero__reward-label">報酬</span>` +
      `<p class="tasu-mdetail-hero__reward-price">${escapeHtml(text)}</p>` +
      `</div>`
    );
  }

  function buildJobMobileHeroMiniSellerHtml() {
    const miniHost = root.document?.querySelector("[data-listing-job-hero-fv-seller]");
    if (miniHost && !miniHost.hidden && miniHost.innerHTML.trim()) {
      return `<a class="tasu-mdetail-hero__seller-mini" href="#section-seller">${miniHost.innerHTML}</a>`;
    }

    const sellerEl = root.document?.querySelector("[data-listing-job-hero-seller]");
    if (!sellerEl || sellerEl.hidden) return "";

    const name = sellerEl.querySelector(".job-top-company__name")?.textContent?.trim() || "";
    if (!name) return "";

    const logoWrap = sellerEl.querySelector(".job-top-company__logo-wrap");
    const logoHtml = logoWrap?.innerHTML?.trim() || "";
    const intro = sellerEl.querySelector(".job-top-company__intro");
    const badgesHtml = intro?.querySelector(".job-top-company__badges")?.outerHTML || "";
    const onlineHtml = sellerEl.querySelector(".job-top-company__online")?.outerHTML || "";
    const handleHtml = sellerEl.querySelector(".job-top-company__handle")?.outerHTML || "";
    const metaHtml = sellerEl.querySelector(".job-top-company__meta-rows")?.outerHTML || "";

    return (
      `<a class="tasu-mdetail-hero__seller-mini" href="#section-seller">` +
      `<div class="job-hero-fv-seller__header">` +
      (logoHtml ? `<span class="job-hero-fv-seller__logo-wrap">${logoHtml}</span>` : "") +
      `<div class="job-hero-fv-seller__intro">` +
      `<p class="job-hero-fv-seller__name">${escapeHtml(name)}</p>` +
      badgesHtml +
      `</div></div>` +
      (onlineHtml || handleHtml
        ? `<div class="job-hero-fv-seller__identity">${onlineHtml}${handleHtml}</div>`
        : "") +
      (metaHtml ? `<div class="job-hero-fv-seller__meta">${metaHtml}</div>` : "") +
      `</a>`
    );
  }

  function buildJobMobileHeroSummaryHtml(summary) {
    const text = String(summary || "").trim();
    if (!text) return "";
    return `<p class="tasu-mdetail-hero__summary tasu-mdetail-hero__summary--job">${escapeHtml(text)}</p>`;
  }

  function scrapeJobHeroExtras() {
    const fvTagsHtml = buildJobMobileHeroFvTagsHtml();
    const miniSellerHtml = buildJobMobileHeroMiniSellerHtml();
    const ctaEl = root.document?.querySelector("[data-listing-primary-cta], .hero-apply-btn");
    const ctaHref = String(ctaEl?.getAttribute("href") || "#").trim() || "#";
    const ctaLabel = String(ctaEl?.textContent || "応募する").trim() || "応募する";
    const favEl = root.document?.querySelector(
      "[data-job-hero-cta] [data-favorite-button], [data-job-hero-cta] [data-tasu-favorite]"
    );
    const favoriteTargetId = String(favEl?.getAttribute("data-target-id") || "").trim();
    const favoriteTargetType = String(favEl?.getAttribute("data-target-type") || "job").trim();
    return {
      fvTagsHtml,
      miniSellerHtml,
      ctaHref,
      ctaLabel,
      favoriteTargetId,
      favoriteTargetType,
    };
  }

  function buildJobHeroFavoriteButtonHtml(extras) {
    const attrs = [
      'type="button"',
      'class="tasu-mdetail-hero__favorite-btn"',
      'data-tasu-mdetail-hero-favorite',
      'data-favorite-button',
      'data-favorite-icon-only="1"',
      'data-tasu-favorite',
      `data-target-type="${escapeHtml(extras.favoriteTargetType || "job")}"`,
      'aria-label="お気に入り"',
    ];
    if (extras.favoriteTargetId) {
      attrs.push(`data-target-id="${escapeHtml(extras.favoriteTargetId)}"`);
    }
    return (
      `<button ${attrs.join(" ")}>` +
      `<svg class="tasu-mdetail-hero__favorite-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">` +
      `<path stroke-linecap="round" stroke-linejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` +
      `</button>`
    );
  }

  function bindJobHeroApplyButton() {
    const applyBtn = heroEl?.querySelector("[data-tasu-mdetail-hero-apply]");
    if (!applyBtn || applyBtn.dataset.tasuMdetailHeroApplyBound === "1") return;
    applyBtn.dataset.tasuMdetailHeroApplyBound = "1";
    applyBtn.addEventListener("click", (event) => {
      const native = root.document?.querySelector("[data-listing-primary-cta], .hero-apply-btn");
      if (!native) return;
      event.preventDefault();
      const Actions = root.TasuContactActions;
      if (Actions?.isContactCtaButton?.(native) && Actions?.startContact) {
        Actions.startContact(native);
        return;
      }
      native.click();
    });
  }

  function bindJobHeroConsultButton() {
    const consultBtn = heroEl?.querySelector("[data-tasu-mdetail-hero-consult]");
    if (!consultBtn || consultBtn.dataset.tasuMdetailHeroConsultBound === "1") return;
    consultBtn.dataset.tasuMdetailHeroConsultBound = "1";
    consultBtn.addEventListener("click", (event) => {
      const native = root.document?.querySelector(
        "[data-job-hero-cta] .cta-consult, [data-job-hero-cta] .job-top-cta__consult"
      );
      if (!native) return;
      event.preventDefault();
      native.click();
    });
  }

  function buildJobMobileHeroCtaActionsHtml(extras) {
    const consultEl = root.document?.querySelector(
      "[data-job-hero-cta] .cta-consult, [data-job-hero-cta] .job-top-cta__consult, .skill-cta-panel__secondary"
    );
    const consultHref = String(consultEl?.getAttribute("href") || "chat.html").trim() || "chat.html";
    const showConsult = consultEl ? !consultEl.hidden : true;
    const consultHtml = showConsult
      ? `<a class="tasu-mdetail-hero__consult" href="${escapeHtml(consultHref)}" data-tasu-mdetail-hero-consult>相談する</a>`
      : "";

    return (
      `<div class="tasu-mdetail-hero__cta-actions job-hero-fv-cta-actions" data-job-fv-cta-actions>` +
      `<a class="tasu-mdetail-hero__apply" href="${escapeHtml(extras.ctaHref)}" data-tasu-mdetail-hero-apply>${escapeHtml(extras.ctaLabel)}</a>` +
      consultHtml +
      `</div>`
    );
  }

  function renderJobHeroCard(data, extras) {
    const shell = ensureMobileDetailShell();
    if (!heroEl) {
      heroEl = root.document.createElement("article");
      heroEl.setAttribute("data-tasu-mdetail-hero", "");
      shell.insertBefore(heroEl, shell.firstChild);
    } else if (heroEl.parentNode !== shell) {
      shell.insertBefore(heroEl, shell.firstChild);
    }
    heroEl.className = "tasu-mdetail-hero tasu-mdetail-hero--job";

    const heroImg = pickJobHeroImageSrc();
    const favoriteHtml = buildJobHeroFavoriteButtonHtml(extras);
    const imageHtml = heroImg
      ? `<div class="tasu-mdetail-hero__media-wrap tasu-mdetail-hero__media-wrap--job">${favoriteHtml}<figure class="tasu-mdetail-hero__media tasu-mdetail-hero__media--job"><img class="tasu-mdetail-hero__img tasu-mdetail-hero__img--job" src="${escapeHtml(heroImg)}" alt="" loading="eager" decoding="async"></figure></div>`
      : `<div class="tasu-mdetail-hero__topbar tasu-mdetail-hero__topbar--job">${favoriteHtml}</div>`;

    const contentRows = [
      `<h2 class="tasu-mdetail-hero__title tasu-mdetail-hero__title--job">${escapeHtml(data.title)}</h2>`,
      buildJobMobileHeroSummaryHtml(data.area || data.desc),
      extras.fvTagsHtml
        ? `<div class="tasu-mdetail-hero__fv-tags" aria-label="求人条件タグ">${extras.fvTagsHtml}</div>`
        : "",
      extras.miniSellerHtml || "",
      buildJobMobileHeroRewardHtml(data.price),
      buildJobMobileHeroCtaActionsHtml(extras),
    ];

    heroEl.innerHTML =
      imageHtml +
      `<div class="tasu-mdetail-hero__content tasu-mdetail-hero__content--job">${contentRows.filter(Boolean).join("")}</div>`;
    bindJobHeroApplyButton();
    bindJobHeroConsultButton();
    root.requestAnimationFrame(() => {
      root.TasuDetailFavorites?.syncAllButtonsOnPage?.();
      root.TasuDetailJob?.refreshFixedCtaReveal?.();
      root.TasuJobDetailApplications?.syncApplicantApplySuccessBanner?.();
    });
  }

  function renderHeroCard(variant, data) {
    const shell = ensureMobileDetailShell();
    if (!heroEl) {
      heroEl = root.document.createElement("article");
      heroEl.className = "tasu-mdetail-hero";
      heroEl.setAttribute("data-tasu-mdetail-hero", "");
      shell.insertBefore(heroEl, shell.firstChild);
    } else if (heroEl.parentNode !== shell) {
      shell.insertBefore(heroEl, shell.firstChild);
    }
    const heroImg = variant === "business_service" ? "" : pickHeroImageSrc(variant);
    const rows = [
      data.category ? `<span class="tasu-mdetail-hero__chip">${escapeHtml(data.category)}</span>` : "",
      heroImg
        ? `<figure class="tasu-mdetail-hero__media"><img class="tasu-mdetail-hero__img" src="${escapeHtml(heroImg)}" alt="" loading="lazy" decoding="async"></figure>`
        : "",
      `<h2 class="tasu-mdetail-hero__title">${escapeHtml(data.title)}</h2>`,
      data.provider ? `<p class="tasu-mdetail-hero__provider">${escapeHtml(data.provider)}</p>` : "",
      data.price ? `<p class="tasu-mdetail-hero__price">${escapeHtml(data.price)}</p>` : "",
      data.rating ? `<p class="tasu-mdetail-hero__rating">★ ${escapeHtml(data.rating)}</p>` : "",
      data.area ? `<p class="tasu-mdetail-hero__area">${escapeHtml(data.area)}</p>` : "",
      data.desc ? `<p class="tasu-mdetail-hero__desc">${escapeHtml(data.desc)}</p>` : "",
    ];
    heroEl.innerHTML = rows.filter(Boolean).join("");
  }

  function defaultCtaHref(variant, key) {
    const R = root.TasuListingRouteResolver;
    if (key === "secondary") return "talk-home.html?tab=chat";
    if (variant === "shop" && key === "secondary") return "#section-products";
    if (variant === "progress" && R?.buildDetailUrl) return R.buildDetailUrl("progress");
    if (variant === "product") return "checkout.html";
    return "chat.html";
  }

  function buildCtaDock(variant) {
    const cfg = SCRAPE[variant] || {};
    const presets = CTA_PRESETS[variant] || CTA_PRESETS.general;
    if (ctaDockEl) ctaDockEl.remove();
    ctaDockEl = root.document.createElement("div");
    ctaDockEl.className = "tasu-mdetail-cta-dock tasu-mdetail-fixed-cta";
    ctaDockEl.setAttribute("data-tasu-mdetail-cta-dock", "");
    ctaDockEl.setAttribute("data-tasu-mdetail-fixed-cta", "");

    presets.forEach((preset) => {
      const sel = preset.key === "primary" ? cfg.ctaPrimary : cfg.ctaSecondary;
      let href = pickHref(sel) || defaultCtaHref(variant, preset.key);
      if (preset.key === "secondary" && variant === "shop" && !href.startsWith("#")) {
        href = "#section-products";
      }
      const el = root.document.createElement("a");
      el.className = `tasu-mdetail-cta-dock__btn tasu-mdetail-cta-dock__btn--${preset.role}`;
      el.href = href;
      el.textContent = preset.label;
      const nativeSelector = preset.key === "primary" ? cfg.ctaPrimary : cfg.ctaSecondary;
      if (nativeSelector) {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const native = root.document?.querySelector(nativeSelector);
          const Actions = root.TasuContactActions;
          if (native && Actions?.isContactCtaButton?.(native) && Actions?.startContact) {
            Actions.startContact(native);
            return;
          }
          const listing =
            root.__tasuDetailContactListing ||
            root.__tasuDetailFavoriteListing ||
            null;
          const Entry = root.TasuPlatformChatConnectEntryFlow;
          if (
            preset.key === "primary" &&
            listing &&
            Entry?.usesConnectEntryPayment?.(listing) &&
            /購入|依頼/.test(preset.label) &&
            Entry?.submitConnectEntry
          ) {
            const result = Entry.submitConnectEntry(listing, {
              intent: /購入/.test(preset.label) ? "purchase" : "consult",
            });
            if (result?.payUrl) root.location.href = result.payUrl;
            return;
          }
          const Gate = root.TasuPlatformChatFeeGateFlow;
          if (
            preset.key === "primary" &&
            listing &&
            Gate?.usesConnectFreeFeeGate?.(listing) &&
            Gate?.submitConnectFreeContact
          ) {
            Gate.submitConnectFreeContact(listing, {
              intent: /見積|依頼|購入|参加/.test(preset.label) ? "estimate" : "consult",
            });
            return;
          }
          if (native) native.click();
        });
      }
      ctaDockEl.appendChild(el);
    });

    root.document?.body?.appendChild(ctaDockEl);
    root.requestAnimationFrame(() => {
      syncMobileBottomChromeInsets();
      root.requestAnimationFrame(syncMobileBottomChromeInsets);
    });
  }

  function usesNativeShopDetailMobilePage() {
    if (detectVariant() !== "shop") return false;
    const body = root.document?.body;
    if (!body?.classList.contains("shop-detail-page")) return false;
    const key = String(body.dataset.shopCategoryProfile || body.dataset.shopCategoryMobile || "").trim();
    if (key === "other") return false;
    if (window.TasuShopDetailCategory?.usesNativeShopDetailMobile) {
      const cfgKey = String(body.dataset.shopCategoryKey || "").trim();
      if (cfgKey) return window.TasuShopDetailCategory.usesNativeShopDetailMobile(cfgKey);
    }
    return true;
  }

  function syncViewportMode() {
    if (!isTargetPage()) {
      restorePcDetailState();
      applied = false;
      return;
    }
    if (!isMobile()) {
      teardown();
      return;
    }
    if (usesNativeShopDetailMobilePage()) {
      teardown();
      root.TasuShopDetailMobile?.refresh?.();
      return;
    }
    applyTemplate();
  }

  function teardown() {
    applied = false;
    heroEl?.remove();
    heroEl = null;
    ctaDockEl?.remove();
    ctaDockEl = null;
    root.document?.querySelectorAll("[data-tasu-mdetail-sections]").forEach((n) => n.remove());
    root.document?.querySelectorAll("[data-tasu-mdetail-site-footer]").forEach((n) => n.remove());
    root.document?.querySelectorAll("[data-tasu-mdetail-menu]").forEach((n) => n.remove());
    root.document?.querySelectorAll("[data-tasu-mdetail-hero]").forEach((n) => n.remove());
    root.document?.querySelectorAll("[data-tasu-mdetail-cta-dock], [data-tasu-mdetail-fixed-cta]").forEach((n) => n.remove());
    restorePcDetailState();
    root.document?.body?.classList.remove("tasu-mdetail-page--business-service");
    root.document?.body?.style.removeProperty("padding-bottom");
    root.document?.querySelectorAll("[data-tasu-mdetail-site-footer]").forEach((el) => {
      el.style.removeProperty("padding-bottom");
    });
    root.document?.documentElement?.style.removeProperty("--tasu-mdetail-tabbar-measured");
    root.document?.documentElement?.style.removeProperty("--tasu-mdetail-site-footer-pad-bottom");
    root.document?.documentElement?.style.removeProperty("--tasu-mdetail-cta-measured");
    root.document?.documentElement?.style.removeProperty("--tasu-mdetail-bottom-stack");
    detailShellEl = null;
  }

  function applyTemplate() {
    if (!isTargetPage() || !isMobile()) {
      teardown();
      return;
    }
    const variant = detectVariant();
    if (!variant) return;
    if (variant === "shop" && usesNativeShopDetailMobilePage()) {
      teardown();
      root.TasuShopDetailMobile?.refresh?.();
      return;
    }

    root.document.body.classList.add("tasu-mdetail-page");
    if (variant === "business_service") {
      root.document.body.classList.add("tasu-mdetail-page--business-service");
    } else {
      root.document.body.classList.remove("tasu-mdetail-page--business-service");
    }
    ensureMobileDetailShell();
    const hero = scrapeHero(variant);
    enhanceBackBar(variant, hero);
    if (variant === "job") {
      renderJobHeroCard(hero, scrapeJobHeroExtras());
    } else {
      renderHeroCard(variant, hero);
    }
    if (variant === "job" || variant === "progress") {
      ctaDockEl?.remove();
      ctaDockEl = null;
    } else {
      buildCtaDock(variant);
    }
    if (variant === "business_service") {
      renderBusinessServiceSections();
      appendBusinessServiceMobileSiteFooter();
    } else {
      hidePcDetailSources();
      renderSections(variant);
      if (variant === "job") {
        appendJobMobileSiteFooter();
      }
    }
    hidePcDetailSources();
    root.document.body.classList.add("tasu-mdetail-ready");
    bindBottomChromeResize();
    syncMobileBottomChromeInsets();
    if (variant === "business_service") {
      globalThis.TasuDetailBusinessServiceStickyNav?.suspendForMobile?.();
    }
    applied = true;
  }

  function scheduleRefresh() {
    requestAnimationFrame(() => {
      syncViewportMode();
      if (isJobDetailPage() && root.TasuDetailJob?.refresh) {
        root.TasuDetailJob.refresh();
      }
    });
  }

  root.TasuMobileDetailTemplate = {
    applyTemplate,
    scheduleRefresh,
    syncViewportMode,
    syncMobileBottomChromeInsets,
    detectVariant,
    isTargetPage,
    teardown,
    restorePcDetailState,
    isSectionMeaningful,
  };

  function boot() {
    syncViewportMode();
  }

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
    root.addEventListener("tasu:demo-progress-rendered", scheduleRefresh);
    root.addEventListener("tasu:listing-loaded", scheduleRefresh);
    root.addEventListener("tasu:listing-seller-ready", scheduleRefresh);
    root.addEventListener("tasu:listing-applied", () => {
      if (!isMobile()) return;
      root.requestAnimationFrame(() => {
        syncMobileBottomChromeInsets();
        root.requestAnimationFrame(syncMobileBottomChromeInsets);
      });
    });
    root.addEventListener?.("resize", scheduleRefresh);
    try {
      const mdetailMq = root.matchMedia(MOBILE_MQ);
      const onMqChange = () => scheduleRefresh();
      if (mdetailMq.addEventListener) mdetailMq.addEventListener("change", onMqChange);
      else if (mdetailMq.addListener) mdetailMq.addListener(onMqChange);
    } catch {
      /* ignore */
    }
    const obs = new MutationObserver(() => {
      if (!isMobile() || !isTargetPage()) return;
      if (root.document.body.dataset.listingLoaded === "true") scheduleRefresh();
    });
    obs.observe(root.document.body, { attributes: true, attributeFilter: ["data-listing-loaded"] });
  }
})();

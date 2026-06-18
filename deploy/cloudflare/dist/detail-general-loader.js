/**
 * 一般掲載詳細（detail-general.html）
 * detail-business-service.html と同一レイアウト + general config 差し替え
 */
(function (global) {
  "use strict";

  function pickStr(...vals) {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getQueryId() {
    try {
      const params = new URLSearchParams(global.location.search);
      return String(params.get("id") || params.get("listingId") || "").trim();
    } catch {
      return "";
    }
  }

  function resolveLoadTarget() {
    const rawId = getQueryId();
    if (global.TasuListingLocalStore?.resolveGeneralDetailId) {
      return global.TasuListingLocalStore.resolveGeneralDetailId(rawId);
    }
    if (rawId) return { id: rawId, explicit: true };
    return { id: "general-demo-002", explicit: false };
  }

  function loadRecord(id) {
    const store = global.TasuListingLocalStore;
    const demoId = store?.GENERAL_DEMO_ID || "general-demo-002";
    const resolvedId =
      global.TasuListingRouteResolver?.resolveListingId?.(id) ||
      global.TasuListingDemoCatalog?.resolveId?.(id) ||
      id;

    if (global.TasuListingDemoCatalog?.getGeneralListing) {
      const catalogRow = global.TasuListingDemoCatalog.getGeneralListing(resolvedId);
      if (catalogRow) return catalogRow;
    }

    if (!store) {
      if (resolvedId === "demo-general-001" || id === demoId || resolvedId === demoId) {
        return {
          id: demoId,
          title: "地域交流イベント参加者募集",
          category: "その他",
          listingType: "general",
          scope: "general",
          price: 0,
          priceLabel: "無料",
          description:
            "地域の交流イベントを開催します。\n初心者歓迎です。\nお気軽にご参加ください。",
          images: ["https://placehold.co/800x600/2563eb/ffffff?text=Event"],
          tags: ["イベント", "地域交流", "初心者歓迎", "TASFUL"],
          status: "active",
          source: "demo",
          imageUrl: "https://placehold.co/800x600/2563eb/ffffff?text=Event",
          serviceArea: null,
          access: null,
          reviews: [],
          eventInfo: {
            date: "2026-07-01",
            time: "10:00〜17:00",
            location: "千葉県成田市",
            capacity: "50名",
          },
          organizer: "TASFUL運営",
          ctaPrimary: "参加について相談する",
          ctaSecondary: "お気に入りに追加",
          postedAt: new Date().toISOString(),
        };
      }
      return null;
    }

    if (resolvedId === "demo-general-001" || id === demoId || resolvedId === demoId) {
      return store.refreshGeneralDemo?.() || store.buildGeneralDemoRecord?.();
    }
    return store.fetchById?.(id) || null;
  }

  function normalizeGeneralListing(record, config) {
    const store = global.TasuListingLocalStore;
    const loader = global.TasuDetailBusinessServiceLoader;
    let listing = store?.toDetailListing?.(record) || { ...record };

    listing.business_type = "field_service";
    listing.listing_type = pickStr(record.listingType, record.listing_type, "general");
    listing.listingType = listing.listing_type;
    listing.scope = pickStr(record.scope, "general");
    listing.user_id = pickStr(record.user_id, record.seller_user_id, listing.user_id);
    listing.business_category = listing.business_category || "field_service";
    listing.company_name = listing.company_name || listing.title || "TASFUL";
    listing.service_name = listing.title || listing.service_name || "";
    listing.description =
      listing.description ||
      record.description ||
      record.draft?.description ||
      "";
    listing.tags = store?.parseTags
      ? store.parseTags(record.tags || record.draft?.tags)
      : listing.tags || [];
    listing._service_profile = config?.serviceProfile || "consulting";
    listing._detail_page_type = "general";
    listing.eventInfo = record.eventInfo || record.event_info || listing.eventInfo;
    listing.organizer = record.organizer || listing.organizer;
    listing.ctaPrimary = record.ctaPrimary || listing.ctaPrimary;
    listing.ctaSecondary = record.ctaSecondary || listing.ctaSecondary;

    const price = Number(record.price) || 0;
    const descText = String(record.description || record.draft?.description || "").trim();
    if (price > 0) {
      const menuItem = {
        title: record.title || "掲載内容",
        description: String(record.description || "").slice(0, 80),
        scope: record.category || "",
        price: `¥${price.toLocaleString("ja-JP")}`,
      };
      listing.service_menu_items = [menuItem];
      listing.form_data = {
        ...(listing.form_data || {}),
        title: record.title,
        description: record.description,
        category: record.category,
        tags: listing.tags,
        service_menu_items: [menuItem],
        business_service: {
          menu_items: [menuItem],
          hero: { service_description: descText },
          overview: { text: descText, features: [] },
        },
      };
    } else if (descText) {
      listing.form_data = {
        ...(listing.form_data || {}),
        title: record.title,
        description: record.description,
        category: record.category,
        tags: listing.tags,
        business_service: {
          hero: { service_description: descText },
          overview: { text: descText, features: [] },
        },
      };
    }

    if (loader?.normalizeFieldServiceListing) {
      listing = loader.normalizeFieldServiceListing(listing, "local-tasful-general");
    }
    return listing;
  }

  function applyGeneralHeroMeta(record, config) {
    const category = String(record.category || config?.label || "その他").trim();
    const genreEl = document.querySelector("[data-biz-detail-hero-genre-tags]");
    if (genreEl && category) {
      genreEl.hidden = false;
      genreEl.removeAttribute("hidden");
      genreEl.innerHTML = `<span class="bsd-hero__pill biz-detail-hero__genre-tag">${esc(category)}</span>`;
    }

    const host = document.querySelector("[data-bsd-hero-bottom-tags]");
    const store = global.TasuListingLocalStore;
    const tags = store?.parseTags
      ? store.parseTags(record.tags || record.draft?.tags)
      : [];
    if (host && tags.length) {
      host.innerHTML = tags
        .map((tag) => `<span class="bsd-hero__tag">${esc(tag)}</span>`)
        .join("");
      host.hidden = false;
      host.removeAttribute("hidden");
    }
  }

  function applyGeneralPricingRow(record) {
    const price = Number(record.price) || 0;
    const tbody = document.querySelector("[data-bsd-pricing-tbody]");
    const section = document.getElementById("section-service-menu");
    if (!tbody) return;

    if (price > 0) {
      const title = esc(record.title || "掲載内容");
      const desc = esc(String(record.description || "").slice(0, 80) || "—");
      const priceText = esc(`¥${price.toLocaleString("ja-JP")}`);
      tbody.innerHTML = `<tr><td class="service-name">${title}</td><td class="service-menu-detail">${desc}</td><td class="service-menu-price">${priceText}</td></tr>`;
    }

    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function showNotFound(id) {
    const loader = global.TasuDetailBusinessServiceLoader;
    loader?.mountBusinessServiceLayout?.();

    const root = document.getElementById("business-service-detail-root");
    if (root) root.hidden = true;

    const status = document.querySelector("[data-listing-detail-status]");
    if (status) {
      status.hidden = false;
      status.className = "listing-detail-status listing-detail-status--error";
      status.innerHTML = `掲載が見つかりません（ID: <code>${esc(id || "—")}</code>）。`;
    }

    const notFound = document.querySelector("[data-listing-detail-not-found]");
    if (notFound) {
      notFound.hidden = false;
      notFound.removeAttribute("hidden");
      const idEl = notFound.querySelector("[data-listing-detail-not-found-id]");
      if (idEl) idEl.textContent = id ? `ID: ${id}` : "（ID 未指定）";
    }

    document.body.dataset.listingLoaded = "not-found";
    document.title = "掲載が見つかりません | TASFUL";
  }

  function applyGeneralOverview(record) {
    const text = String(record.description || record.draft?.description || "").trim();
    if (!text) return;
    const titleEl = document.querySelector("#section-overview .business-summary__title");
    if (titleEl) titleEl.textContent = "概要";
    const descEl =
      document.querySelector("[data-bsd-overview-description]") ||
      document.querySelector(".business-summary__description");
    if (descEl) descEl.textContent = text;
    const section = document.getElementById("section-overview");
    if (section) {
      section.hidden = false;
      section.removeAttribute("hidden");
    }
  }

  function applyGeneralEventInfo(record) {
    const store = global.TasuListingLocalStore;
    const section = document.getElementById("section-general-event-info");
    if (!section) return;
    if (!store?.hasGeneralEventInfo?.(record)) {
      hideSectionById("section-general-event-info");
      return;
    }
    const info = record.eventInfo || record.event_info || {};
    const host = section.querySelector("[data-general-event-info-list]");
    const rows = [
      ["開催日", info.date],
      ["開催時間", info.time],
      ["開催場所", info.location],
      ["定員", info.capacity],
    ].filter(([, value]) => String(value || "").trim());
    if (host) {
      host.innerHTML = rows
        .map(
          ([label, value]) =>
            `<div class="general-event-info__row"><dt class="general-event-info__key">${esc(
              label
            )}</dt><dd class="general-event-info__val">${esc(value)}</dd></div>`
        )
        .join("");
    }
    section.hidden = false;
    section.removeAttribute("hidden");
  }

  function applyGeneralOrganizerInfo(record) {
    const store = global.TasuListingLocalStore;
    const section = document.getElementById("section-general-organizer");
    if (!section) return;
    if (!store?.hasGeneralOrganizerInfo?.(record)) {
      hideSectionById("section-general-organizer");
      return;
    }
    const organizer = String(record.organizer || record.companyInfo?.name || "").trim();
    const tbody = section.querySelector("[data-general-organizer-table]");
    if (tbody) {
      tbody.innerHTML = `<tr><th scope="row">主催者</th><td>${esc(organizer)}</td></tr>`;
    }
    section.hidden = false;
    section.removeAttribute("hidden");
  }

  function applyGeneralCtaLabels(record, config) {
    const primary = String(record?.ctaPrimary || config?.ctaPrimary || "").trim();
    const secondary = String(record?.ctaSecondary || config?.ctaSecondary || "").trim();
    const favLabel = String(config?.favoriteLabel || secondary || "お気に入りに追加").trim();
    const listingId = String(record?.id || "").trim();
    const favorited = global.TasuFavoriteStore?.isFavorited?.(listingId) || false;
    document
      .querySelectorAll("[data-business-service-estimate], [data-biz-detail-estimate]")
      .forEach((el) => {
        if (primary) el.textContent = primary;
      });
    document
      .querySelectorAll("[data-business-service-chat], [data-biz-detail-inquiry]")
      .forEach((el) => {
        if (secondary) el.textContent = secondary;
      });
    if (!favorited) {
      document.querySelectorAll("[data-bsd-favorite-label]").forEach((el) => {
        if (favLabel) el.textContent = ` ${favLabel}`;
      });
    }
  }

  function hideSectionById(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
  }

  function isGeneralLikeRecord(record) {
    return document.body?.dataset?.detailType === "general";
  }

  function hasReviewData(record) {
    return global.TasuListingLocalStore?.hasGeneralReviewData?.(record) || false;
  }

  function hasAccessData(record) {
    return global.TasuListingLocalStore?.hasGeneralAccessData?.(record) || false;
  }

  function resolvePriceLabel(record) {
    return (
      global.TasuListingLocalStore?.resolveGeneralPriceLabel?.(record) ||
      (Number(record?.price) > 0 ? `¥${Number(record.price).toLocaleString("ja-JP")}` : "要相談")
    );
  }

  function applyGeneralSectionVisibility(record) {
    if (!isGeneralLikeRecord(record)) return;

    const demo = String(record?.source || "").trim() === "demo";
    const extraSectionIds = [
      "section-service-menu",
      "section-achievements",
      "section-license",
      "section-flow",
      "section-faq",
      "section-business-payment",
    ];

    if (demo) {
      extraSectionIds.forEach(hideSectionById);
    }

    if (!hasReviewData(record)) hideSectionById("section-reviews");
    if (!hasAccessData(record)) hideSectionById("section-service-area");
    if (!global.TasuListingLocalStore?.hasGeneralEventInfo?.(record)) {
      hideSectionById("section-general-event-info");
    }
    if (!global.TasuListingLocalStore?.hasGeneralOrganizerInfo?.(record)) {
      hideSectionById("section-general-organizer");
    }
  }

  function applyGeneralPriceDisplay(record) {
    const label = resolvePriceLabel(record);
    const priceEl = document.querySelector("[data-biz-detail-sidebar-price]");
    if (priceEl) priceEl.textContent = label;

    const quick = document.querySelector("[data-biz-detail-hero-quick]");
    if (quick) {
      quick.hidden = false;
      quick.removeAttribute("hidden");
      quick.className = "bsd-hero__meta bsd-hero__meta--area hero-meta-grid hero-meta-row biz-detail-quick";
      quick.innerHTML = `<li class="bsd-hero__quick-item"><span class="bsd-hero__quick-icon" aria-hidden="true">💴</span><span><span class="bsd-hero__quick-label">価格：</span>${esc(label)}</span></li>`;
    }

    const price = Number(record?.price) || 0;
    if (price <= 0) {
      hideSectionById("section-service-menu");
    }
  }

  function refreshGeneralStickyNav(record, config) {
    const listing = normalizeGeneralListing(record, config);
    const navApi = global.TasuDetailBusinessServiceStickyNav;
    if (navApi?.refresh) navApi.refresh(listing);
    else if (navApi?.init) navApi.init(listing);
  }

  function applyDemoSectionVisibility(record) {
    applyGeneralSectionVisibility(record);
  }

  function finalizeGeneralPresentation(record, config) {
    global.TasuDetailTypeConfig?.applyDetailTypeConfig?.(config, record);
    applyGeneralHeroMeta(record, config);
    applyGeneralOverview(record);
    applyGeneralSectionVisibility(record);
    applyGeneralEventInfo(record);
    applyGeneralOrganizerInfo(record);
    applyGeneralPriceDisplay(record);
    applyGeneralPricingRow(record);
    refreshGeneralStickyNav(record, config);
    applyGeneralCtaLabels(record, config);
    const overview = document.getElementById("section-overview");
    if (overview) {
      overview.hidden = false;
      overview.removeAttribute("hidden");
    }
    if (global.TasuListingLocalStore?.isAiAgentSource?.(record)) {
      global.TasuListingLocalStore.renderAiBadge?.(normalizeGeneralListing(record, config));
    }
    const listingForActions = {
      ...normalizeGeneralListing(record, config),
      _localRecord: record,
    };
    global.TasuFavoriteActions?.mountForListing?.(listingForActions);
    global.TasuContactActions?.mountForListing?.(listingForActions);
  }

  async function boot() {
    const store = global.TasuListingLocalStore;
    const loader = global.TasuDetailBusinessServiceLoader;
    const typeConfig = global.TasuDetailTypeConfig;
    const config = typeConfig?.getConfig?.("general") || { typeKey: "general" };

    if (!loader?.renderBusinessServiceDetail) {
      console.error("[TasuDetailGeneralLoader] business-service loader unavailable");
      return;
    }

    const { id, explicit } = resolveLoadTarget();
    const record = loadRecord(id);

    if (!record) {
      showNotFound(id);
      return;
    }

    const demoId = store?.GENERAL_DEMO_ID || "general-demo-002";
    document.body.dataset.generalDemoMode =
      !explicit && id === demoId ? "true" : "false";

    const typeKey = store?.resolveListingTypeKey?.(record);
    const ownTypes = new Set(["general", "その他", "other"]);
    const rawType = String(record.listingType || record.listing_type || "").trim();
    if (
      typeKey &&
      typeKey !== "general" &&
      !ownTypes.has(rawType) &&
      store?.buildDetailPageUrl
    ) {
      const target = store.buildDetailPageUrl(record);
      if (target && !/detail-general\.html/.test(target)) {
        global.location.replace(target);
        return;
      }
    }

    document.body.dataset.listingLoaded = "false";
    const listing = normalizeGeneralListing(record, config);

    try {
      await loader.renderBusinessServiceDetail(listing);
      finalizeGeneralPresentation(record, config);
      global.setTimeout(() => finalizeGeneralPresentation(record, config), 250);

      document.body.dataset.listingId = String(record.id || "");
      document.body.dataset.listingLoaded = "true";
      global.__tasuDetailContactListing = listing;
      global.TasuListingDetailContacts?.refresh?.(listing);
    } catch (err) {
      console.error("[TasuDetailGeneralLoader] boot failed:", err);
      showNotFound(id);
    }
  }

  global.TasuDetailGeneralLoader = {
    getQueryId,
    resolveLoadTarget,
    loadRecord,
    normalizeGeneralListing,
    boot,
  };

  if (document.body?.dataset?.detailType === "general") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        void boot();
      });
    } else {
      void boot();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

/**
 * TasuFull — マーケットプレイス一覧
 * 検索 (search.js) / 並び替え / カテゴリ別フィルター / 注目掲載
 */
(function () {
  "use strict";

  const Search = window.TasuSearch;
  if (!Search) {
    console.warn("[listings] TasuSearch not loaded");
    return;
  }

  const CONFIG = {
    selectors: {
      searchForm: ".search",
      searchInput: "#searchInput",
      sortSelect: "#sortSelect",
      categoryFilters: "#categoryFilters",
      categoryPanel: "[data-category-panel]",
      filterChip: ".filter-chip",
      featuredSection: "#topSpotlightSection",
      featuredStage: "#topSpotlightStage",
      featuredPoolItem: ".featured-pool__item",
      featuredCard: ".featured-card[data-premium]",
      filterableItem: "[data-filterable]",
      card: ".card",
      resultPremium: '[data-result="premium"]',
      resultFree: '[data-result="free"]',
      emptyPremium: "#emptyStatePremium",
      emptyFree: "#emptyStateFree",
    },
    categories: ["all", "product", "skill", "job", "worker"],
    priceRanges: {
      all: () => true,
      "under-10000": (price) => price < 10000,
      "10000-50000": (price) => price >= 10000 && price < 50000,
      "50000-100000": (price) => price >= 50000 && price < 100000,
      "over-100000": (price) => price >= 100000,
    },
    categoryFilterKeys: {
      product: ["price", "condition", "shipping"],
      skill: ["speed", "certified", "popular"],
      job: ["employment", "remote", "urgent"],
      worker: ["sameDay", "night", "hasCar"],
    },
  };

  const DEFAULT_FILTERS = {
    product: { price: "all", condition: "all", shipping: "all" },
    skill: { speed: "all", certified: "all", popular: "all" },
    job: { employment: "all", remote: "all", urgent: "all" },
    worker: { sameDay: "all", night: "all", hasCar: "all" },
  };

  const CATEGORY_LABELS = {
    all: "すべて",
    product: "商品",
    skill: "スキル",
    job: "求人",
    worker: "ワーカー",
  };

  /** state key → URL クエリ名 */
  const URL_PARAM_BY_FILTER = {
    product: { price: "price", condition: "status", shipping: "shipping" },
    skill: { speed: "response", certified: "verified", popular: "popular" },
    job: { employment: "employment", remote: "remote", urgent: "urgency" },
    worker: { sameDay: "sameDay", night: "night", hasCar: "hasCar" },
  };

  /** ワーカー掲載タイトル → target_id（data 属性不整合時の補正） */
  const WORKER_TITLE_TARGET_IDS = {
    即日対応できる動画編集者: "worker_hiro_001",
    丁寧対応のWeb制作パートナー: "worker_web_partner_001",
  };

  /** 掲載タイプ別 CTA（カードデザインは共通・文言のみ差別化） */
  const LISTING_CTA_BY_TYPE = {
    product: "購入・見積もり相談",
    skill: "依頼する",
    job: "応募する",
    worker: "相談する",
  };

  const elements = {
    searchForm: document.querySelector(CONFIG.selectors.searchForm),
    searchInput: document.querySelector(CONFIG.selectors.searchInput),
    sortSelect: document.querySelector(CONFIG.selectors.sortSelect),
    categoryFilters: document.querySelector(CONFIG.selectors.categoryFilters),
    categoryPanels: document.querySelectorAll(CONFIG.selectors.categoryPanel),
    filterChips: document.querySelectorAll(CONFIG.selectors.filterChip),
    featuredSection: document.querySelector(CONFIG.selectors.featuredSection),
    featuredStage: document.querySelector(CONFIG.selectors.featuredStage),
    featuredPoolItems: document.querySelectorAll(CONFIG.selectors.featuredPoolItem),
    filterableItems: [],
    resultPremium: document.querySelector(CONFIG.selectors.resultPremium),
    resultFree: document.querySelector(CONFIG.selectors.resultFree),
    emptyPremium: document.querySelector(CONFIG.selectors.emptyPremium),
    emptyFree: document.querySelector(CONFIG.selectors.emptyFree),
    searchSuggest: document.getElementById("searchSuggest"),
    activeFilters: document.getElementById("activeFilters"),
    activeFiltersTags: document.getElementById("activeFiltersTags"),
    activeFiltersClear: document.getElementById("activeFiltersClear"),
  };

  if (!elements.searchInput) {
    return;
  }

  const state = {
    category: "all",
    sort: elements.sortSelect?.value ?? "newest",
    filters: structuredClone(DEFAULT_FILTERS),
  };

  const FEATURED_ROTATE_MS = 10000;
  const FEATURED_FADE_MS = 450;

  /** @type {Map<HTMLElement, object>} */
  const listingByItem = new Map();
  /** @type {Map<HTMLElement, object>} */
  const metaByItem = new Map();
  /** @type {Map<HTMLElement, number>} */
  const searchScoreByItem = new Map();

  let featuredIndex = 0;
  let featuredTimer = null;
  let restoringFromUrl = false;

  function slugifyId(text) {
    return String(text ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\u3040-\u30ff\u4e00-\u9fff-]/g, "")
      .slice(0, 48);
  }

  function resolveTargetIdFromCard(card, category, title) {
    const existing = card.dataset.targetId || card.dataset.listingId || card.dataset.productId;
    if (existing) {
      return String(existing).trim();
    }

    const link =
      card.querySelector(".listing-card-title__link") ||
      card.querySelector(".card__title-link");
    if (link?.href) {
      try {
        const url = new URL(link.href, window.location.href);
        const fromQuery = url.searchParams.get("id");
        if (fromQuery) {
          return fromQuery.trim();
        }
      } catch {
        /* ignore */
      }
    }

    if (title && WORKER_TITLE_TARGET_IDS[title]) {
      return WORKER_TITLE_TARGET_IDS[title];
    }

    const slug = slugifyId(title);
    return slug ? `${category}_${slug}` : "";
  }

  function extractText(root, selector) {
    const node = root?.querySelector(selector);
    return node ? node.textContent.trim() : "";
  }

  function extractAllText(root, selector) {
    return [...(root?.querySelectorAll(selector) ?? [])].map((n) =>
      n.textContent.trim()
    );
  }

  function parseNumber(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parsePriceFromText(text) {
    const normalized = String(text ?? "");
    const manMatch = normalized.match(/(\d[\d,]*)\s*万/);
    if (manMatch) {
      return parseNumber(manMatch[1].replace(/,/g, "")) * 10000;
    }
    const yenMatch = normalized.match(/¥\s*([\d,]+)/);
    if (yenMatch) {
      return parseNumber(yenMatch[1].replace(/,/g, ""));
    }
    return 0;
  }

  function getListingCardElement(listItem) {
    return listItem.querySelector(".card");
  }

  function resolveListingType(card, listItem) {
    if (!card) {
      return "";
    }

    let type = String(
      card.dataset.targetType || card.dataset.type || card.dataset.category || ""
    ).trim();

    if (type === "ワーカー") {
      type = "worker";
    }

    const label = extractText(card, ".card__category");
    if (/ワーカー/.test(label)) {
      type = "worker";
    }

    const title =
      card.dataset.listingTitle ||
      extractText(card, ".listing-card-title__link") ||
      extractText(card, ".listing-card-title") ||
      extractText(card, ".card__title-link") ||
      extractText(card, ".card__title");

    if (WORKER_TITLE_TARGET_IDS[title]) {
      type = "worker";
    }

    return type;
  }

  /** リンク・CTA を掲載タイプに合わせて適用（カード枠は共通） */
  function applyListingCardPresentation(listing) {
    if (!listing?.card) {
      return;
    }

    const type = listing.targetType || listing.category;
    const ctaLabel = LISTING_CTA_BY_TYPE[type];
    if (ctaLabel) {
      listing.card
        .querySelectorAll(
          ".card__button, .product-list-card__cta, .list-card-product__cta-primary, .premium-listing-card__cta-primary"
        )
        .forEach((button) => {
          button.textContent = ctaLabel;
        });
    }

    applyCardDetailLinks(listing);
  }

  function parseListingFromDom(listItem) {
    const card = getListingCardElement(listItem);
    if (!card) {
      return null;
    }

    const category = resolveListingType(card, listItem);
    const targetType = category;

    if (targetType) {
      card.dataset.targetType = targetType;
      card.dataset.type = targetType;
      card.dataset.category = targetType;
    }

    const rawTitle =
      extractText(card, ".listing-card-title") ||
      extractText(card, ".listing-card-title__link") ||
      extractText(card, ".card__title-link") ||
      extractText(card, ".card__title");

    const titleFields = {
      category,
      type: category,
      title: card.dataset.listingTitle || rawTitle,
      listing_title: card.dataset.listingTitle,
      name:
        card.dataset.productName ||
        extractText(card, ".card__account").replace(/^@/, "").trim(),
      job_title: card.dataset.jobTitle,
      product_name: card.dataset.productName,
      service_name: card.dataset.serviceName,
      rawTitle,
    };

    if (Search.shouldExcludeListing(titleFields, card)) {
      listItem.hidden = true;
      listItem.dataset.dummyHidden = "1";
      return null;
    }

    const title = Search.resolveListingTitle(titleFields);

    const description = extractText(card, ".card__description");

    const tags = extractAllText(card, ".card__tag");

    const categoryLabel = extractText(card, ".card__category");

    const subcategoryParts = extractAllText(card, ".card__condition");

    const account = extractText(card, ".card__account");
    const badge = [
      ...extractAllText(card, ".card__badge"),
      extractText(card, ".card__plate"),
    ].filter(Boolean);

    const area =
      category === "worker" ? extractText(card, ".card__description").split("。")[0] : "";
    const priceText = extractText(card, ".card__price");
    const statusText = extractText(card, ".card__availability");
    const statusCode = card.dataset.status || card.dataset.availability || "";

    const keywords = [
      ...badge,
      account,
      priceText,
      statusText,
      card.querySelector("img")?.getAttribute("alt") || "",
      extractText(card, ".card__reviews"),
      extractText(card, ".card__deals"),
      extractText(card, ".card__rating-score"),
    ].filter(Boolean);

    const ownerName = account.replace(/^@/, "").trim();

    const targetId = resolveTargetIdFromCard(card, category, title);

    const listing = {
      el: listItem,
      card,
      category,
      type: category,
      targetId,
      targetType,
      title,
      description,
      tags,
      categoryLabel,
      subcategory: subcategoryParts.join(" "),
      keywords,
      owner_name: ownerName,
      account,
      badge,
      area,
      brand: ownerName,
      conditionCode: card.dataset.condition ?? "",
      shippingCode: card.dataset.shipping ?? "",
      statusCode,
      condition: "",
      shipping_type: "",
      price: priceText,
      status: statusText || Search.labelFromDataset("status", statusCode),
      service_type: categoryLabel,
      response_speed: card.dataset.speed ?? "",
      verified: card.dataset.certified ?? "",
      skill_name: category === "skill" ? title : ownerName,
      delivery_time:
        Search.labelFromDataset("speed", card.dataset.speed) ||
        tags.find((t) => /即|日|週|納期/.test(t)) ||
        "",
      employment_type: card.dataset.employment ?? "",
      remote_type: card.dataset.remote ?? "",
      urgency: card.dataset.urgent ?? "",
      salary: category === "job" ? priceText : "",
      job_type:
        subcategoryParts.join(" ") ||
        Search.labelFromDataset("employment", card.dataset.employment),
      name: category === "worker" ? titleFields.name : "",
      skills: category === "worker" ? [...subcategoryParts, ...tags].join(" ") : "",
      support_area: area,
      response_type:
        category === "worker"
          ? [
              card.dataset.sameDay === "yes" ? "即日対応" : "",
              card.dataset.night === "yes" ? "深夜対応" : "",
              card.dataset.hasCar === "yes" ? "車あり" : "",
            ]
              .filter(Boolean)
              .join(" ")
          : "",
      available_time: category === "worker" ? tags.join(" ") : "",
      sameDay: card.dataset.sameDay ?? "no",
      night: card.dataset.night ?? "no",
      hasCar: card.dataset.hasCar ?? "no",
    };

    listing.condition =
      Search.labelFromDataset("condition", listing.conditionCode) ||
      subcategoryParts.join(" ");
    listing.shipping_type =
      Search.labelFromDataset("shipping", listing.shippingCode) ||
      listing.shippingCode;

    if (targetId) {
      card.dataset.targetId = targetId;
      card.dataset.targetType = targetType;
    }

    Search.enrichListingSearchFields(listing);
    return listing;
  }

  function listingToDetailItem(listing) {
    return {
      title: listing.title,
      type: listing.targetType || listing.category,
      target_type: listing.targetType || listing.category,
      category: listing.category,
      target_id: listing.targetId,
      id: listing.targetId,
      listing_id: listing.targetId,
    };
  }

  function applyCardDetailLinks(listing) {
    if (!listing?.card || !listing?.targetId) {
      return;
    }

    const item = listingToDetailItem(listing);
    const type = item.target_type || item.type || item.category;
    const id = item.target_id || item.id;
    const href = Search.getDetailUrl(item);

    console.log("[detail-url]", {
      title: listing.title,
      type,
      id,
      href,
    });

    const card = listing.card;
    const linkSelectors = [
      ".listing-card-title__link",
      ".card__title-link",
      ".product-list-card__title-link",
      ".list-card__title-link",
      ".list-card-product__title-link",
      ".premium-listing-card__title-link",
      "a.card__media",
      ".card__media",
      ".product-list-card__media-link",
      ".list-card__media-link",
      ".product-card-media-link",
      ".list-card-product__media-link",
      ".premium-listing-card__main-link",
      ".card__button",
      ".product-list-card__cta",
      ".list-card__cta",
      ".list-card-product__cta-primary",
      ".premium-listing-card__cta-primary",
    ];

    linkSelectors.forEach((selector) => {
      card.querySelectorAll(selector).forEach((anchor) => {
        if (anchor.classList.contains("card-list__favorite")) {
          return;
        }
        anchor.setAttribute("href", href);
      });
    });

    if (card.classList.contains("list-card") || card.classList.contains("product-list-card")) {
      card.dataset.listCardHref = href;
      card.dataset.productListHref = href;
      if (window.TasuListingRenderer?.bindListCardNavigation) {
        window.TasuListingRenderer.bindListCardNavigation(card);
      } else if (window.TasuListingRenderer?.bindProductListCardNavigation) {
        window.TasuListingRenderer.bindProductListCardNavigation(card);
      }
      if (window.TasuListingRenderer?.bindListCardActions) {
        window.TasuListingRenderer.bindListCardActions(card);
      } else if (window.TasuListingRenderer?.bindProductListCardActions) {
        window.TasuListingRenderer.bindProductListCardActions(card);
      }
    } else if (card.classList.contains("list-card-product")) {
      card.dataset.listCardHref = href;
      if (window.TasuListingRenderer?.bindProductListCardNavigation) {
        window.TasuListingRenderer.bindProductListCardNavigation(card);
      }
    }
  }

  /** 一覧カードにタイトル h3 を必ず挿入（生成テンプレート差分の保険） */
  function ensureListingCardTitles() {
    const isListPage =
      document.body.classList.contains("index-page") ||
      document.body.classList.contains("category-list-page");
    if (!isListPage) return;

    document.querySelectorAll(".card-list .card").forEach((card) => {
      const priceEl = card.querySelector(".card__price");
      if (!priceEl) return;

      const title =
        card.dataset.listingTitle ||
        extractText(card, ".listing-card-title") ||
        extractText(card, ".card__title-link") ||
        extractText(card, ".card__title") ||
        "タイトル未設定";

      card.dataset.listingTitle = title;

      let titleEl = card.querySelector(".card__main > .listing-card-title");
      if (!titleEl) {
        titleEl = document.createElement("h3");
        titleEl.className = "listing-card-title";
        priceEl.insertAdjacentElement("beforebegin", titleEl);
      }

      if (titleEl.textContent.trim() !== title) {
        titleEl.textContent = title;
      }

      card.querySelectorAll(".card__title").forEach((legacyTitle) => {
        if (!legacyTitle.classList.contains("listing-card-title")) {
          legacyTitle.hidden = true;
        }
      });

      console.log("CARD TITLE", card.dataset.targetId || card.id, title);
    });
  }

  function applyDisplayTitle(listing) {
    if (!listing?.card) {
      return;
    }

    const { card, category } = listing;
    const displayTitle =
      listing.title ||
      listing.service_name ||
      listing.job_title ||
      listing.name ||
      listing.product_name ||
      card.dataset.listingTitle ||
      extractText(card, ".listing-card-title") ||
      extractText(card, ".listing-card-title__link") ||
      extractText(card, ".card__title-link");

    if (!displayTitle) {
      return;
    }

    const targetType = listing.targetType || listing.category || category;
    card.dataset.listingTitle = displayTitle;
    listing.title = displayTitle;

    card.querySelectorAll(".listing-card-title").forEach((heading) => {
      heading.textContent = displayTitle;
    });

    card.querySelectorAll(".listing-card-title__link, .card__title-link").forEach((anchor) => {
      anchor.textContent = displayTitle;
    });

    const preserveImages =
      card.classList.contains("list-card") ||
      card.classList.contains("product-list-card") ||
      card.classList.contains("list-card-product") ||
      card.classList.contains("premium-listing-card");

    card.querySelectorAll(".card__image").forEach((img) => {
      const width = Number(img.getAttribute("width")) || 360;
      const height = Number(img.getAttribute("height")) || 240;
      if (!preserveImages) {
        img.src = Search.getCategoryPlaceholderUrl(category, width, height);
      }
      img.alt =
        displayTitle === Search.UNSET_TITLE_LABEL
          ? displayTitle
          : `${displayTitle}の画像`;
    });
  }

  function applyDetailLinksToCardElement(card) {
    if (!card) {
      return;
    }

    const category = card.dataset.category || card.dataset.type || "";
    const title = extractText(
      card,
      ".listing-card-title__link, .listing-card-title, .card__title-link, .card__title"
    );
    const targetId = resolveTargetIdFromCard(card, category, title);
    if (!targetId || !category) {
      return;
    }

    const titleFields = {
      category,
      type: category,
      title: card.dataset.listingTitle || title,
      listing_title: card.dataset.listingTitle,
      job_title: card.dataset.jobTitle,
      product_name: card.dataset.productName,
      service_name: card.dataset.serviceName,
      name: extractText(card, ".card__account").replace(/^@/, "").trim(),
      rawTitle: title,
    };

    if (Search.shouldExcludeListing(titleFields, card)) {
      const listItem = card.closest("[data-filterable]");
      if (listItem) {
        listItem.hidden = true;
        listItem.dataset.dummyHidden = "1";
      }
      return;
    }

    const listing = {
      card,
      title: Search.resolveListingTitle(titleFields),
      category,
      targetType: category,
      targetId,
      name: titleFields.name,
    };

    if (targetId) {
      card.dataset.targetId = targetId;
      card.dataset.targetType = category;
    }

    applyDisplayTitle(listing);
    applyListingCardPresentation(listing);
  }

  function applyAllDetailLinks() {
    elements.filterableItems.forEach((listItem) => {
      const listing = listingByItem.get(listItem);
      if (listing) {
        applyListingCardPresentation(listing);
        return;
      }
      const card = listItem.querySelector(CONFIG.selectors.card);
      if (card) {
        applyDetailLinksToCardElement(card);
      }
    });

    document.querySelectorAll("#featuredPool article.card, #featuredPool .featured-card").forEach(
      (card) => {
        applyDetailLinksToCardElement(card);
      }
    );
  }

  function ensureFavoriteButton(listItem, listing) {
    if (!listing?.targetId || !listing?.targetType) {
      return;
    }

    const card = listing.card;
    if (
      listItem.querySelector(".card-list__favorite") ||
      card.querySelector("[data-favorite-button], [data-tasu-favorite]")
    ) {
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-list__favorite tasu-favorite-btn";
    btn.setAttribute("data-favorite-button", "");
    btn.dataset.targetType = listing.targetType;
    btn.dataset.targetId = listing.targetId;
    btn.dataset.userId = "u_me";
    btn.setAttribute("aria-label", "お気に入り");
    btn.setAttribute("aria-pressed", "false");

    const iconSpan = document.createElement("span");
    iconSpan.className = "tasu-favorite-btn__icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.textContent = "♡";
    btn.appendChild(iconSpan);

    listItem.prepend(btn);

    if (window.TasuFavoritesDb?.isFavorite) {
      void window.TasuFavoritesDb.isFavorite("u_me", listing.targetType, listing.targetId).then(
        (saved) => {
          const filter = window.TasuFavoritesDb.buildFilter(
            "u_me",
            listing.targetType,
            listing.targetId
          );
          window.TasuFavoritesDb.syncFavoriteButtonsUi(filter, saved, btn);
        }
      );
    }
  }

  function syncAllFavoriteButtons() {
    listingByItem.forEach((listing, listItem) => {
      ensureFavoriteButton(listItem, listing);
    });
  }

  function buildMetaFromCard(listItem, listing) {
    const card = listing.card;
    const priceAttr = card.dataset.price;
    const price =
      priceAttr !== undefined
        ? parseNumber(priceAttr, 0)
        : parsePriceFromText(extractText(card, ".card__price"));

    return {
      category: listing.category,
      price,
      date: parseNumber(card.dataset.date, 0),
      popular: parseNumber(card.dataset.popular, 0),
      condition: card.dataset.condition ?? "",
      shipping: card.dataset.shipping ?? "standard",
      speed: card.dataset.speed ?? "normal",
      certified: card.dataset.certified ?? "no",
      isPopular: card.dataset.isPopular ?? "no",
      employment: card.dataset.employment ?? "",
      remote: card.dataset.remote ?? "no",
      urgent: card.dataset.urgent ?? "no",
      sameDay: card.dataset.sameDay ?? "no",
      night: card.dataset.night ?? "no",
      hasCar: card.dataset.hasCar ?? "no",
    };
  }

  function refreshListingIndex() {
    elements.filterableItems = [
      ...document.querySelectorAll(CONFIG.selectors.filterableItem),
    ];
    listingByItem.clear();
    metaByItem.clear();
    searchScoreByItem.clear();

    elements.filterableItems.forEach((listItem) => {
      const listing = parseListingFromDom(listItem);
      if (!listing) {
        return;
      }
      listingByItem.set(listItem, listing);
      metaByItem.set(listItem, buildMetaFromCard(listItem, listing));
      listItem.dataset.tasuListingIndexed = "1";
      ensureFavoriteButton(listItem, listing);
      applyDisplayTitle(listing);
      applyListingCardPresentation(listing);
    });

    ensureListingCardTitles();
    applyAllDetailLinks();
  }

  function getSearchQuery() {
    return Search.normalizeSearchText(elements.searchInput.value);
  }

  function getAllListings() {
    return [...listingByItem.values()];
  }

  function matchesField(actual, filterValue) {
    if (filterValue === "all" || !filterValue) {
      return true;
    }
    return actual === filterValue;
  }

  function matchesCategory(meta, category) {
    if (category === "all") {
      return true;
    }
    return meta.category === category;
  }

  function matchesPrice(meta, rangeKey) {
    const matcher = CONFIG.priceRanges[rangeKey];
    return matcher ? matcher(meta.price) : true;
  }

  function matchesCategoryFilters(meta) {
    if (state.category === "all") {
      return true;
    }

    const keys = CONFIG.categoryFilterKeys[state.category];
    if (!keys) {
      return true;
    }

    const filters = state.filters[state.category];

    if (state.category === "product") {
      return (
        matchesPrice(meta, filters.price) &&
        matchesField(meta.condition, filters.condition) &&
        matchesField(meta.shipping, filters.shipping)
      );
    }

    if (state.category === "skill") {
      return (
        matchesField(meta.speed, filters.speed) &&
        matchesField(meta.certified, filters.certified) &&
        matchesField(meta.isPopular, filters.popular)
      );
    }

    if (state.category === "job") {
      return (
        matchesField(meta.employment, filters.employment) &&
        matchesField(meta.remote, filters.remote) &&
        matchesField(meta.urgent, filters.urgent)
      );
    }

    if (state.category === "worker") {
      return (
        matchesField(meta.sameDay, filters.sameDay) &&
        matchesField(meta.night, filters.night) &&
        matchesField(meta.hasCar, filters.hasCar)
      );
    }

    return true;
  }

  function isItemVisible(listItem, query) {
    if (listItem.dataset.dummyHidden === "1") {
      return false;
    }

    const meta = metaByItem.get(listItem);
    const listing = listingByItem.get(listItem);
    if (!meta || !listing) {
      return false;
    }

    if (!matchesCategory(meta, state.category)) {
      return false;
    }
    if (!matchesCategoryFilters(meta)) {
      return false;
    }

    const score = searchScoreByItem.get(listItem);
    if (query && (score === undefined || score <= 0)) {
      return false;
    }

    return true;
  }

  function updateSearchScores(query) {
    searchScoreByItem.clear();
    const listings = getAllListings();
    const { results, keyword, tokens, matchedCount, total } =
      Search.filterAndScoreListings(listings, query);

    results.forEach(({ item, score }) => {
      searchScoreByItem.set(item.el, score);
    });

    listings.forEach((listing) => {
      if (!searchScoreByItem.has(listing.el)) {
        searchScoreByItem.set(listing.el, -1);
      }
    });

    return { keyword, tokens, matched: matchedCount, total };
  }

  function getFeaturedCandidates() {
    return [...elements.featuredPoolItems].filter((item) => {
      if (state.category === "all") {
        return true;
      }
      return item.dataset.category === state.category;
    });
  }

  function clearFeaturedTimer() {
    if (featuredTimer !== null) {
      clearInterval(featuredTimer);
      featuredTimer = null;
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function mountFeaturedCard(sourceCard, animate) {
    if (!elements.featuredStage) {
      return;
    }

    const clone = sourceCard.cloneNode(true);
    const current = elements.featuredStage.firstElementChild;
    const useFade = animate && current && !prefersReducedMotion();

    if (!useFade) {
      elements.featuredStage.replaceChildren(clone);
      return;
    }

    current.classList.add("is-fading-out");
    window.setTimeout(() => {
      clone.classList.add("is-fading-in");
      elements.featuredStage.replaceChildren(clone);
      window.requestAnimationFrame(() => {
        clone.classList.remove("is-fading-in");
      });
    }, FEATURED_FADE_MS);
  }

  function startFeaturedRotation(candidateCount) {
    clearFeaturedTimer();
    if (candidateCount <= 1) {
      return;
    }
    featuredTimer = window.setInterval(() => {
      const candidates = getFeaturedCandidates();
      if (candidates.length <= 1) {
        clearFeaturedTimer();
        return;
      }
      featuredIndex = (featuredIndex + 1) % candidates.length;
      const card = candidates[featuredIndex]?.querySelector(
        CONFIG.selectors.featuredCard
      );
      if (card) {
        mountFeaturedCard(card, true);
      }
    }, FEATURED_ROTATE_MS);
  }

  function renderFeaturedSpotlight(resetIndex = false) {
    clearFeaturedTimer();

    if (document.body.classList.contains("index-page")) {
      window.TasuListingTopSpotlight?.syncCategoryFilter?.(state.category);
      return;
    }

    if (
      elements.featuredSection?.dataset.topSpotlightMode === "dynamic" ||
      elements.featuredSection?.dataset.spotlightMode === "dynamic"
    ) {
      window.TasuListingTopSpotlight?.syncCategoryFilter?.(state.category);
      return;
    }

    if (!elements.featuredSection || elements.featuredPoolItems.length === 0) {
      return;
    }

    const candidates = getFeaturedCandidates();

    if (candidates.length === 0) {
      elements.featuredSection.hidden = true;
      if (elements.featuredStage) {
        elements.featuredStage.replaceChildren();
      }
      return;
    }

    if (resetIndex) {
      featuredIndex = 0;
    } else if (featuredIndex >= candidates.length) {
      featuredIndex = 0;
    }

    const selected = candidates[featuredIndex];
    const card = selected?.querySelector(CONFIG.selectors.featuredCard);

    if (!card) {
      elements.featuredSection.hidden = true;
      return;
    }

    elements.featuredSection.hidden = false;
    mountFeaturedCard(card, !resetIndex);
    startFeaturedRotation(candidates.length);
  }

  function compareItems(a, b) {
    const query = getSearchQuery();
    if (query) {
      const scoreA = searchScoreByItem.get(a) ?? 0;
      const scoreB = searchScoreByItem.get(b) ?? 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
    }

    const metaA = metaByItem.get(a);
    const metaB = metaByItem.get(b);
    if (!metaA || !metaB) {
      return 0;
    }

    switch (state.sort) {
      case "popular":
        return metaB.popular - metaA.popular;
      case "price-desc":
        return metaB.price - metaA.price;
      case "price-asc":
        return metaA.price - metaB.price;
      case "newest":
      default:
        return metaB.date - metaA.date;
    }
  }

  function sortListItems(items) {
    if (items.length === 0) {
      return;
    }
    const byParent = new Map();
    items.forEach((item) => {
      const parent = item.parentElement;
      if (!parent) return;
      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent).push(item);
    });
    byParent.forEach((group, parent) => {
      [...group].sort(compareItems).forEach((node) => parent.appendChild(node));
    });
  }

  function countItemsInSection(items) {
    return items.filter(
      (item) => item.dataset.dummyHidden !== "1" && listingByItem.has(item)
    ).length;
  }

  function formatResultCountText(options) {
    const { total, visible, query, category } = options;
    const categoryLabel = CATEGORY_LABELS[category] || "";

    if (query) {
      return `「${query}」で ${visible}件ヒット`;
    }
    if (category && category !== "all") {
      return `${categoryLabel} ${total}件中 ${visible}件表示`;
    }
    return `全${total}件中 ${visible}件表示`;
  }

  function updateCount(node, total, visible, query, category) {
    if (node) {
      node.textContent = formatResultCountText({ total, visible, query, category });
    }
  }

  function updateEmptyState(node, count) {
    if (node) {
      node.hidden = count > 0;
    }
  }

  function initPageNavigation() {
    document.querySelectorAll('a[href="#top"], a[href="#premium-list"], a[href="#free-list"]').forEach(
      (anchor) => {
        anchor.addEventListener("click", (event) => {
          const id = anchor.getAttribute("href")?.slice(1);
          const target = id ? document.getElementById(id) : null;
          if (!target) {
            return;
          }
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    );
  }

  /**
   * 表示/非表示を更新（カード DOM は renderListings で生成済み）
   */
  function renderItems(items, query) {
    let visibleCount = 0;
    items.forEach((item) => {
      if (!listingByItem.has(item)) {
        return;
      }
      const isVisible = isItemVisible(item, query);
      item.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });
    return visibleCount;
  }

  function getItemsByListClass(listClass) {
    if (listClass === "card-list--premium") {
      return elements.filterableItems.filter(
        (item) =>
          item.closest("#premium-list") &&
          item.closest("#premium-list .card-list") &&
          !item.closest("#topSpotlightSection")
      );
    }
    if (listClass === "card-list--free") {
      return elements.filterableItems.filter((item) => item.closest("#free-list"));
    }
    return elements.filterableItems.filter((item) => item.closest(`.${listClass}`));
  }

  function setChipGroupActive(filterName, activeButton) {
    let scope = document;
    if (
      filterName !== "category" &&
      state.category !== "all" &&
      CONFIG.categoryFilterKeys[state.category]?.includes(filterName)
    ) {
      scope = elements.categoryFilters ?? document;
    }

    scope.querySelectorAll(`.filter-chip[data-filter="${filterName}"]`).forEach((chip) => {
      const isActive = chip === activeButton;
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function resetPanelChips(panel) {
    if (!panel) {
      return;
    }
    panel.querySelectorAll(".filter-chip").forEach((chip) => {
      const isAll = chip.dataset.value === "all";
      chip.classList.toggle("is-active", isAll);
      chip.setAttribute("aria-pressed", String(isAll));
    });
  }

  function updateCategoryFiltersUI() {
    const showDetail = ["product", "skill", "job", "worker"].includes(state.category);

    if (elements.categoryFilters) {
      elements.categoryFilters.hidden = !showDetail;
    }

    elements.categoryPanels.forEach((panel) => {
      const isActive = panel.dataset.categoryPanel === state.category;
      panel.hidden = !isActive;
    });
  }

  function resetCategoryFilters(category) {
    if (!CONFIG.categoryFilterKeys[category]) {
      return;
    }
    state.filters[category] = structuredClone(DEFAULT_FILTERS[category]);
    const panel = document.querySelector(`[data-category-panel="${category}"]`);
    resetPanelChips(panel);
  }

  function findCategoryChip(value) {
    return document.querySelector(
      `.filter-chip[data-filter="category"][data-value="${value}"]`
    );
  }

  function findDetailFilterChip(category, filterName, value) {
    return (
      document.querySelector(
        `[data-category-panel="${category}"] .filter-chip[data-filter="${filterName}"][data-value="${value}"]`
      ) || null
    );
  }

  function getChipLabel(category, filterName, value) {
    const chip = findDetailFilterChip(category, filterName, value);
    return chip?.textContent?.trim() || value;
  }

  function getActiveFilterTags() {
    const tags = [];
    const query = elements.searchInput?.value?.trim() || "";

    if (state.category !== "all") {
      tags.push({
        kind: "category",
        filter: "category",
        value: state.category,
        label: CATEGORY_LABELS[state.category] || state.category,
      });
    }

    if (query) {
      Search.parseSearchQuery(query).forEach((token) => {
        tags.push({
          kind: "q",
          filter: "q",
          value: token,
          label: token,
        });
      });
    }

    if (state.category !== "all" && CONFIG.categoryFilterKeys[state.category]) {
      const filters = state.filters[state.category];
      CONFIG.categoryFilterKeys[state.category].forEach((filterName) => {
        const value = filters[filterName];
        if (!value || value === "all") {
          return;
        }
        tags.push({
          kind: "detail",
          filter: filterName,
          value,
          label: getChipLabel(state.category, filterName, value),
        });
      });
    }

    return tags;
  }

  function renderActiveFilterTags() {
    if (!elements.activeFilters || !elements.activeFiltersTags) {
      return;
    }

    const tags = getActiveFilterTags();
    elements.activeFiltersTags.replaceChildren();

    if (tags.length === 0) {
      elements.activeFilters.hidden = true;
      return;
    }

    elements.activeFilters.hidden = false;

    tags.forEach((tag) => {
      const wrap = document.createElement("span");
      wrap.className = "active-filters__tag";
      wrap.appendChild(document.createTextNode(tag.label));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "active-filters__remove";
      removeBtn.setAttribute("aria-label", `${tag.label} を解除`);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => removeActiveFilterTag(tag));

      wrap.appendChild(removeBtn);
      elements.activeFiltersTags.appendChild(wrap);
    });
  }

  function removeActiveFilterTag(tag) {
    if (tag.kind === "category") {
      const allChip = findCategoryChip("all");
      if (allChip) {
        handleCategoryChange(allChip);
      }
      return;
    }

    if (tag.kind === "q") {
      const tokens = Search.parseSearchQuery(elements.searchInput.value).filter(
        (t) => t !== tag.value
      );
      elements.searchInput.value = tokens.join(" ");
      applyFilters();
      return;
    }

    if (tag.kind === "detail" && state.category !== "all") {
      const allChip = findDetailFilterChip(state.category, tag.filter, "all");
      if (allChip) {
        handleDetailChipClick(allChip);
      }
    }
  }

  function clearAllFilters() {
    elements.searchInput.value = "";
    const allChip = findCategoryChip("all");
    if (allChip) {
      handleCategoryChange(allChip);
      return;
    }
    applyFilters();
  }

  function buildUrlFromState() {
    const params = new URLSearchParams();
    const rawQ = elements.searchInput?.value?.trim() || "";
    const keyword = Search.normalizeSearchText(rawQ);

    if (keyword) {
      params.set("q", rawQ);
    }
    if (state.category !== "all") {
      params.set("category", state.category);
    }
    if (state.sort && state.sort !== "newest") {
      params.set("sort", state.sort);
    }

    if (state.category !== "all") {
      const map = URL_PARAM_BY_FILTER[state.category];
      const filters = state.filters[state.category];
      if (map && filters) {
        Object.entries(map).forEach(([filterKey, paramName]) => {
          const value = filters[filterKey];
          if (value && value !== "all") {
            params.set(paramName, value);
          }
        });
      }
    }

    return params;
  }

  function syncUrlFromState() {
    if (restoringFromUrl) {
      return;
    }
    const params = buildUrlFromState();
    const queryString = params.toString();
    const next = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
    window.history.replaceState({ tasuListings: true }, "", next);
  }

  function applyUrlParamToDetailFilter(category, paramName, paramValue) {
    const map = URL_PARAM_BY_FILTER[category];
    if (!map) {
      return;
    }
    const filterKey = Object.entries(map).find(([, urlKey]) => urlKey === paramName)?.[0];
    if (!filterKey || !paramValue) {
      return;
    }
    state.filters[category][filterKey] = paramValue;
    const chip = findDetailFilterChip(category, filterKey, paramValue);
    if (chip) {
      setChipGroupActive(filterKey, chip);
    }
  }

  function restoreStateFromUrl() {
    restoringFromUrl = true;
    const params = new URLSearchParams(window.location.search);

    if (params.get("category") === "job") {
      const q = params.get("q");
      const target = q
        ? `job-top.html?keyword=${encodeURIComponent(q)}`
        : "job-top.html";
      window.location.replace(target);
      return;
    }

    if (params.has("q")) {
      elements.searchInput.value = params.get("q") || "";
    }

    if (params.has("sort") && elements.sortSelect) {
      state.sort = params.get("sort") || "newest";
      elements.sortSelect.value = state.sort;
    }

    const category = params.get("category") || "all";
    if (CONFIG.categories.includes(category)) {
      state.category = category;
      const chip = findCategoryChip(category);
      if (chip) {
        setChipGroupActive("category", chip);
      }
      updateCategoryFiltersUI();

      if (category !== "all") {
        Object.values(URL_PARAM_BY_FILTER[category] || {}).forEach((paramName) => {
          if (params.has(paramName)) {
            applyUrlParamToDetailFilter(category, paramName, params.get(paramName));
          }
        });
      }
    }

    const restored = {
      q: params.get("q") || "",
      category: state.category,
      sort: state.sort,
      filters: structuredClone(state.filters),
    };

    console.log("[query restored]", restored);

    restoringFromUrl = false;
  }

  function hideSearchSuggestions() {
    if (!elements.searchSuggest) {
      return;
    }
    elements.searchSuggest.hidden = true;
    elements.searchInput?.setAttribute("aria-expanded", "false");
  }

  function renderSearchSuggestions() {
    if (!elements.searchSuggest) {
      return;
    }

    const raw = elements.searchInput?.value || "";
    if (raw.trim().length < 1) {
      hideSearchSuggestions();
      return;
    }

    const listings = getAllListings();
    const suggestions = Search.getSearchSuggestions(raw, listings, 5);

    console.log("[suggestions]", suggestions);

    elements.searchSuggest.replaceChildren();
    if (suggestions.length === 0) {
      hideSearchSuggestions();
      return;
    }

    const popularSet = new Set(Search.POPULAR_SEARCH_WORDS);

    suggestions.forEach((text) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-suggest__item";
      btn.setAttribute("role", "option");
      if (popularSet.has(text)) {
        btn.classList.add("search-suggest__item--popular");
      }
      btn.textContent = text;
      btn.addEventListener("mousedown", (event) => {
        event.preventDefault();
        elements.searchInput.value = text;
        hideSearchSuggestions();
        applyFilters();
      });
      li.appendChild(btn);
      elements.searchSuggest.appendChild(li);
    });

    elements.searchSuggest.hidden = false;
    elements.searchInput?.setAttribute("aria-expanded", "true");
  }

  function initSearchSuggestions() {
    if (!elements.searchSuggest || !elements.searchInput) {
      return;
    }

    elements.searchInput.addEventListener("input", () => {
      renderSearchSuggestions();
    });

    elements.searchInput.addEventListener("focus", () => {
      if (elements.searchInput.value.trim().length >= 1) {
        renderSearchSuggestions();
      }
    });

    elements.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideSearchSuggestions();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        event.target === elements.searchInput ||
        elements.searchSuggest?.contains(event.target)
      ) {
        return;
      }
      hideSearchSuggestions();
    });
  }

  function handleCategoryChange(button) {
    const value = button.dataset.value;
    if (!CONFIG.categories.includes(value)) {
      return;
    }
    const prev = state.category;
    state.category = value;
    setChipGroupActive("category", button);

    if (prev !== value && prev !== "all") {
      resetCategoryFilters(prev);
    }
    if (value !== "all" && value !== prev) {
      resetCategoryFilters(value);
    }

    updateCategoryFiltersUI();
    featuredIndex = 0;
    applyFilters({ resetFeatured: true });
  }

  function handleDetailChipClick(button) {
    const filterName = button.dataset.filter;
    const value = button.dataset.value;
    if (!filterName || value === undefined || state.category === "all") {
      return;
    }

    const keys = CONFIG.categoryFilterKeys[state.category];
    if (!keys?.includes(filterName)) {
      return;
    }

    if (filterName === "price" && !CONFIG.priceRanges[value] && value !== "all") {
      return;
    }

    state.filters[state.category][filterName] = value;
    setChipGroupActive(filterName, button);
    applyFilters();
  }

  function applyFilters(options = {}) {
    const query = getSearchQuery();

    renderFeaturedSpotlight(options.resetFeatured === true);

    const premiumItems = getItemsByListClass("card-list--premium");
    const freeItems = getItemsByListClass("card-list--free");

    sortListItems(premiumItems);
    sortListItems(freeItems);

    const searchStats = updateSearchScores(query);

    console.log("[search]", {
      keyword: searchStats.keyword,
      tokens: searchStats.tokens,
      category: state.category,
      filters: structuredClone(state.filters),
      sort: state.sort,
      matched: searchStats.matched,
      total: searchStats.total,
    });

    const premiumVisible = renderItems(premiumItems, query);
    const freeVisible = renderItems(freeItems, query);
    const premiumTotal = countItemsInSection(premiumItems);
    const freeTotal = countItemsInSection(freeItems);
    const displayQuery = elements.searchInput?.value?.trim() || "";

    updateCount(
      elements.resultPremium,
      premiumTotal,
      premiumVisible,
      displayQuery,
      state.category
    );
    updateCount(elements.resultFree, freeTotal, freeVisible, displayQuery, state.category);
    updateEmptyState(elements.emptyPremium, premiumVisible);
    updateEmptyState(elements.emptyFree, freeVisible);

    renderActiveFilterTags();
    syncUrlFromState();
    hideSearchSuggestions();
  }

  function init() {
    restoreStateFromUrl();
    refreshListingIndex();
    syncAllFavoriteButtons();
    initSearchSuggestions();
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    elements.searchInput.addEventListener("input", applyFilters);

    if (elements.searchForm) {
      elements.searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        applyFilters();
      });
    }

    if (elements.sortSelect) {
      elements.sortSelect.addEventListener("change", () => {
        state.sort = elements.sortSelect.value;
        applyFilters();
      });
    }

    elements.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chip.dataset.filter === "category") {
          handleCategoryChange(chip);
          return;
        }
        handleDetailChipClick(chip);
      });
    });

    if (elements.activeFiltersClear) {
      elements.activeFiltersClear.addEventListener("click", clearAllFilters);
    }

    window.addEventListener("popstate", () => {
      restoreStateFromUrl();
      refreshListingIndex();
      syncAllFavoriteButtons();
      updateCategoryFiltersUI();
      applyFilters({ resetFeatured: true });
    });

    updateCategoryFiltersUI();
    initPageNavigation();
    applyFilters();
  }

  window.TasuListings = {
    applyFilters,
    refreshListingIndex,
    ensureListingCardTitles,
    applyListingCardPresentation,
    syncAllFavoriteButtons,
    restoreStateFromUrl,
    applyAllDetailLinks,
    applyCardDetailLinks,
    getListingByItem: (el) => listingByItem.get(el),
    getDetailUrl: (item) => Search.getDetailUrl(item),
    CONFIG,
    state,
  };

  init();
})();

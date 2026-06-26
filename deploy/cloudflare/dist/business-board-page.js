/**
 * 法人・業者・店舗 サービス掲載一覧ページ
 */
(function () {
  "use strict";

  const PAGE_SIZE = 20;
  const POPULAR_TAGS = [
    { label: "空港送迎", keyword: "空港送迎", category: "transport" },
    { label: "清掃", keyword: "清掃", category: "cleaning" },
    { label: "内装工事", keyword: "内装", category: "construction_work" },
    { label: "水道修理", keyword: "水道", category: "repair_maintenance" },
    { label: "便利屋", keyword: "便利屋", category: "local_support" },
    { label: "出張整体", keyword: "出張整体", category: "field_service" },
    { label: "不用品回収", keyword: "不用品", category: "cleaning" },
    { label: "法人契約", keyword: "法人", category: "" },
  ];

  function normalizeBoardCategory(raw) {
    return (
      window.TasuBusinessCategories?.normalizeBoardFilter?.(raw) ||
      window.TasuBusinessCategories?.normalizeCategory?.(raw) ||
      String(raw || "").trim()
    );
  }

  function applyBoardListingTypeFilter(items, businessCategory) {
    const cats = window.TasuBusinessCategories;
    const filter = String(businessCategory || "").trim();

    if (filter === "shop_store") {
      return cats?.filterListingsForBoard
        ? cats.filterListingsForBoard(items, "shop_store")
        : items.filter((item) => cats?.isShopStoreListing?.(item));
    }

    if (filter === "field_service" || !filter) {
      return cats?.filterListingsForBoard
        ? cats.filterListingsForBoard(items, "field_service")
        : items.filter((item) => cats?.isFieldServiceListing?.(item));
    }

    if (cats?.filterListingsForBoard) {
      return cats.filterListingsForBoard(items, filter);
    }

    return items.filter((item) => cats?.isFieldServiceListing?.(item));
  }

  function categoryMatchesFilter(itemCategory, filterCategory) {
    if (!filterCategory) return true;
    if (window.TasuBusinessCategories?.categoryMatches) {
      return window.TasuBusinessCategories.categoryMatches(itemCategory, filterCategory);
    }
    return itemCategory === filterCategory;
  }

  function isStoreCategory(cat) {
    return window.TasuBusinessCategories?.isStoreProfile?.(cat) ?? cat === "store";
  }

  let allItems = [];
  let filteredItems = [];
  let currentPage = 1;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function readFilterState() {
    const form = $("[data-biz-board-filter-form]");
    if (!form) return {};
    const fd = new FormData(form);
    return {
      area: String(fd.get("area") || "").trim(),
      industry: String(fd.get("industry") || "").trim(),
      budget: String(fd.get("budget") || "").trim(),
      status: String(fd.get("status_filter") || "").trim(),
      condSameDay: fd.get("cond_same_day") === "on",
      condNight: fd.get("cond_night") === "on",
      cond24h: fd.get("cond_24h") === "on",
      condFreeEstimate: fd.get("cond_free_estimate") === "on",
      condInvoice: fd.get("cond_invoice") === "on",
      condPermit: fd.get("cond_permit") === "on",
      condInsurance: fd.get("cond_insurance") === "on",
      condReservation: fd.get("cond_reservation") === "on",
      condOrder: fd.get("cond_order") === "on",
      keyword: String($("[data-biz-board-keyword]")?.value || "").trim(),
      searchIndustry: String($("[data-biz-board-search-industry]")?.value || "").trim(),
      searchArea: String($("[data-biz-board-search-area]")?.value || "").trim(),
      searchBudget: String($("[data-biz-board-search-budget]")?.value || "").trim(),
    };
  }

  function itemSearchHaystack(item) {
    return [
      item.title,
      item.company_name,
      item.description,
      item.service_area,
      item.categoryLabel,
      item.licenseLine,
      item.license_info,
      (item.tags || []).join(" "),
      (item.applicationConditions || []).join(" "),
      (item.conditionBadges || []).map((b) => b.label).join(" "),
    ]
      .join(" ")
      .toLowerCase();
  }

  function matchesServiceCondition(item, state) {
    const hay = itemSearchHaystack(item);
    const badges = (item.conditionBadges || []).map((b) => b.label).join(" ");
    if (state.condSameDay) {
      if (!(item.isStartSoon || item.isUrgent || hay.includes("即日"))) return false;
    }
    if (state.condNight && !hay.includes("夜間")) return false;
    if (state.cond24h && !hay.includes("24")) return false;
    if (state.condFreeEstimate && !/(見積|無料|要相談)/.test(hay)) return false;
    if (
      state.condInvoice &&
      !(item.invoice_support === "yes" || badges.includes("インボイス"))
    ) {
      return false;
    }
    if (state.condPermit && !(item.needsLicense || hay.includes("許可") || hay.includes("資格"))) {
      return false;
    }
    if (state.condInsurance && !badges.includes("保険")) return false;
    if (state.condReservation && !isStoreCategory(item.business_category) && !hay.includes("予約")) {
      return false;
    }
    if (state.condOrder && !isStoreCategory(item.business_category) && !hay.includes("注文")) {
      return false;
    }
    return true;
  }

  function matchesKeyword(item, kw) {
    if (!kw) return true;
    const hay = [
      item.title,
      item.company_name,
      item.description,
      item.service_area,
      item.categoryLabel,
      (item.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(kw.toLowerCase());
  }

  function applyFilters(items, state, tabStatus) {
    return items.filter((item) => {
      if (tabStatus && tabStatus !== "all") {
        if (tabStatus === "open" && item.status !== "available") return false;
        if (tabStatus === "soon" && !(item.isStartSoon || item.isUrgent)) return false;
        if (
          tabStatus === "construction_work" &&
          !categoryMatchesFilter(item.business_category, "construction_work")
        ) {
          return false;
        }
        if (tabStatus === "license" && !(item.needsLicense || item.license_info)) {
          return false;
        }
      }

      const industry = state.industry || state.searchIndustry;
      if (industry && !categoryMatchesFilter(item.business_category, industry)) return false;

      const area = state.area || state.searchArea;
      if (area && !(item.service_area || "").includes(area)) return false;

      const budget = state.budget || state.searchBudget;
      if (budget && !(item.budgetText || "").includes(budget)) return false;

      if (state.status && item.status !== state.status) return false;
      if (!matchesServiceCondition(item, state)) return false;

      const kw = state.keyword;
      if (kw && !matchesKeyword(item, kw)) return false;

      return true;
    });
  }

  /** PR/上位を先頭に、同一テーブル内の通常行として並べる */
  function orderTableRows(items) {
    const spotlight = [];
    const regular = [];
    items.forEach((item) => {
      if (item.isPr || item.isFeatured || item.isFeaturedSlot) {
        spotlight.push(item);
      } else {
        regular.push(item);
      }
    });
    return [...spotlight, ...regular];
  }

  function syncFavorites(root) {
    if (!window.TasuFavoritesDb?.isFavorite) return;
    root.querySelectorAll("[data-favorite-button][data-target-type='business']").forEach((btn) => {
      const id = btn.dataset.targetId;
      if (!id) return;
      void window.TasuFavoritesDb.isFavorite("u_me", "business", id).then((saved) => {
        const filter = window.TasuFavoritesDb.buildFilter("u_me", "business", id);
        window.TasuFavoritesDb.syncFavoriteButtonsUi(filter, saved, btn);
      });
    });
  }

  function renderPagination(totalPages) {
    const nav = $("[data-biz-board-pagination]");
    if (!nav) return;
    nav.innerHTML = "";
    if (totalPages <= 1) return;

    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "前へ";
    prev.disabled = currentPage <= 1;
    prev.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderBoard();
      }
    });
    nav.appendChild(prev);

    for (let p = 1; p <= totalPages; p += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(p);
      btn.classList.toggle("is-active", p === currentPage);
      btn.addEventListener("click", () => {
        currentPage = p;
        renderBoard();
        nav.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      nav.appendChild(btn);
    }

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "次へ";
    next.disabled = currentPage >= totalPages;
    next.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage += 1;
        renderBoard();
      }
    });
    nav.appendChild(next);
  }

  function renderBoard() {
    const renderer = window.TasuBusinessBoardRenderer;
    const sortSelect = $("[data-category-sort]");
    const spotlightEl = $("[data-business-spotlight]");
    const tableBody = $("[data-category-list]");
    const mobileList = $("[data-business-mobile-list]");
    const emptyEl = $("[data-category-empty]");
    const countEl = $("[data-category-count]");

    if (!renderer || !tableBody) return;

    const tabStatus =
      document.querySelector("[data-biz-board-tabs] .is-active")?.dataset.tab || "all";
    const state = readFilterState();
    const sort = sortSelect?.value || "newest";

    filteredItems = applyFilters(allItems, state, tabStatus);
    if (window.TasuListingRenderer?.sortListings) {
      filteredItems = window.TasuListingRenderer.sortListings(filteredItems, sort);
    }

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = orderTableRows(filteredItems.slice(start, start + PAGE_SIZE));
    const spotlightItems = pageItems.filter(
      (item) => item.isPr || item.isFeatured || item.isFeaturedSlot
    );

    const rangeEl = $("[data-biz-board-count-range]");
    if (countEl) countEl.textContent = String(total);
    if (rangeEl && total) {
      const from = start + 1;
      const to = Math.min(start + PAGE_SIZE, total);
      rangeEl.innerHTML = `<span class="biz-board-count__label">${total}件中</span> <strong class="biz-board-count__num">${from}–${to}</strong> <span class="biz-board-count__unit">件を表示</span>`;
    } else if (rangeEl) {
      rangeEl.innerHTML = `<span class="biz-board-count__label">表示</span> <strong class="biz-board-count__num">0</strong> <span class="biz-board-count__unit">件</span>`;
    }

    if (!total) {
      if (countEl) countEl.textContent = "0";
      if (emptyEl) emptyEl.hidden = false;
      if (spotlightEl) spotlightEl.innerHTML = "";
      tableBody.innerHTML = "";
      if (mobileList) mobileList.innerHTML = "";
      renderPagination(0);
      populateEmptyStateTags();
      return;
    }

    if (emptyEl) emptyEl.hidden = true;

    if (spotlightEl) {
      spotlightEl.innerHTML = "";
      spotlightItems.forEach((item) => {
        spotlightEl.appendChild(renderer.buildSpotlightElement(item));
      });
    }

    tableBody.innerHTML = "";
    const tableFrag = document.createDocumentFragment();
    pageItems.forEach((item) => {
      tableFrag.appendChild(renderer.buildTableRowElement(item));
    });
    tableBody.appendChild(tableFrag);

    if (mobileList) {
      mobileList.innerHTML = "";
      const mobileFrag = document.createDocumentFragment();
      pageItems.forEach((item) => {
        const isSpotlight = item.isPr || item.isFeatured || item.isFeaturedSlot;
        mobileFrag.appendChild(
          renderer.buildMobileCardElement(item, { spotlight: isSpotlight })
        );
      });
      mobileList.appendChild(mobileFrag);
      if (window.TasuListingRenderer?.syncPlatformListingBadges) {
        window.TasuListingRenderer.syncPlatformListingBadges(mobileList, pageItems);
      }
    }

    renderPagination(totalPages);
    syncFavorites(document);
  }

  async function fetchItems(businessCategory) {
    const store = window.TasuBusinessListings;
    let items = [];
    if (store?.fetchPublishedBusinessListings) {
      items = await store.fetchPublishedBusinessListings({
        limit: 100,
        business_category: businessCategory || "",
        public_only: false,
        localFallback: true,
      });
    }

    const demo = window.TasuBusinessBoardDemo?.getListings?.(businessCategory) || [];
    const seen = new Set(items.map((item) => item.id));
    const merged = [...demo.filter((d) => d.id && !seen.has(d.id)), ...items];
    return applyBoardListingTypeFilter(merged, businessCategory);
  }

  function populateEmptyStateTags() {
    const host = $("[data-biz-board-empty-tags]");
    if (!host || host.childElementCount) return;
    POPULAR_TAGS.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = tag.label;
      btn.addEventListener("click", () => {
        const kw = $("[data-biz-board-keyword]");
        const industry = $("[data-biz-board-search-industry]");
        if (kw) kw.value = tag.keyword;
        if (industry && tag.category) industry.value = tag.category;
        currentPage = 1;
        renderBoard();
      });
      host.appendChild(btn);
    });
  }

  function initPopularTags() {
    const list = $("[data-biz-board-popular-tags]");
    if (!list) return;

    POPULAR_TAGS.forEach((tag) => {
      const li = document.createElement("li");
      li.className = "biz-board-tags__item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = tag.label;
      btn.addEventListener("click", () => {
        const kw = $("[data-biz-board-keyword]");
        const industry = $("[data-biz-board-search-industry]");
        if (kw) kw.value = tag.keyword;
        if (industry && tag.category) industry.value = tag.category;
        $$("[data-biz-board-popular-tags] button").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        currentPage = 1;
        renderBoard();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function initTabs() {
    const tabs = $("[data-biz-board-tabs]");
    if (!tabs) return;
    tabs.querySelectorAll("button[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        currentPage = 1;
        renderBoard();
      });
    });
  }

  function initBusinessCategoryNav(onChange) {
    const nav = document.querySelector("[data-business-category-nav]");
    if (!nav) return;

    const params = new URLSearchParams(window.location.search);
    const current = normalizeBoardCategory(params.get("business_category") || "");

    nav.querySelectorAll("[data-biz-cat]").forEach((btn) => {
      const value = normalizeBoardCategory(btn.dataset.bizCat || "");
      btn.classList.toggle("is-active", value === current);
      const industry = $('[data-biz-board-filter-form] [name="industry"]');
      if (industry && value === current) industry.value = value;

      btn.addEventListener("click", () => {
        const url = new URL(window.location.href);
        if (value) url.searchParams.set("business_category", value);
        else url.searchParams.delete("business_category");
        window.history.replaceState({}, "", url);
        nav.querySelectorAll("[data-biz-cat]").forEach((b) => {
          b.classList.toggle(
            "is-active",
            normalizeBoardCategory(b.dataset.bizCat || "") === value
          );
        });
        if (industry) industry.value = value;
        const searchIndustry = $("[data-biz-board-search-industry]");
        if (searchIndustry) searchIndustry.value = value;
        onChange(value);
      });
    });
  }

  function bindEvents() {
    $("[data-biz-board-search-form]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      currentPage = 1;
      renderBoard();
    });

    $("[data-biz-board-filter-apply]")?.addEventListener("click", () => {
      currentPage = 1;
      renderBoard();
    });

    $("[data-biz-board-filter-clear]")?.addEventListener("click", () => {
      const form = $("[data-biz-board-filter-form]");
      form?.reset();
      const kw = $("[data-biz-board-keyword]");
      if (kw) kw.value = "";
      $$("[data-biz-board-popular-tags] button").forEach((b) => b.classList.remove("is-active"));
      currentPage = 1;
      renderBoard();
    });

    $("[data-category-sort]")?.addEventListener("change", () => {
      renderBoard();
    });
  }

  async function init() {
    if (document.body.dataset.categoryPage !== "business") return;

    initPopularTags();
    populateEmptyStateTags();
    initTabs();
    bindEvents();

    const demoNote = $("[data-biz-board-demo-note]");
    if (demoNote && window.TasuBusinessBoardDemo?.DEMO_ENABLED) {
      demoNote.hidden = false;
    }

    $("[data-biz-board-empty-clear]")?.addEventListener("click", () => {
      $("[data-biz-board-filter-clear]")?.click();
    });

    async function reload(businessCategory) {
      allItems = await fetchItems(businessCategory);
      currentPage = 1;
      renderBoard();
    }

    initBusinessCategoryNav((cat) => void reload(cat));

    const params = new URLSearchParams(window.location.search);
    const urlKeyword = String(params.get("keyword") || "").trim();
    if (urlKeyword) {
      const kw = $("[data-biz-board-keyword]");
      if (kw) kw.value = urlKeyword;
    }
    await reload(normalizeBoardCategory(params.get("business_category") || ""));
    if (urlKeyword) renderBoard();
  }

  window.TasuBusinessBoard = { init, renderBoard };

  if (document.body.dataset.categoryPage === "business") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => void init());
    } else {
      void init();
    }
  }
})();

/**
 * カテゴリ一覧ページ（skill / product / job / worker / business）
 */
(function () {
  "use strict";

  const PAGE_META = {
    skill: { source: "general", listing_type: "skill", title: "スキル一覧", badge: "スキル" },
    product: { source: "general", listing_type: "product", title: "商品一覧", badge: "商品" },
    job: { source: "general", listing_type: "job", title: "求人一覧", badge: "求人" }, /* job-top.html */
    worker: { source: "general", listing_type: "worker", title: "ワーカー一覧", badge: "ワーカー" },
    business: { source: "business", title: "法人・業者一覧", badge: "法人・業者" },
  };

  async function fetchList(meta, options) {
    if (meta.source === "business") {
      const store = window.TasuBusinessListings;
      if (!store?.fetchPublishedBusinessListings) return [];
      const rows = await store.fetchPublishedBusinessListings({
        limit: 100,
        business_category: options.business_category || "",
        public_only: false,
        localFallback: false,
      });
      return rows;
    }

    const store = window.TasuListingStore;
    if (!store?.fetchPublishedListings) return [];
    return store.fetchPublishedListings({
      limit: 100,
      listing_type: meta.listing_type,
      public_only: false,
      localFallback: false,
    });
  }

  function renderList(list, listEl, emptyEl, countEl) {
    if (!listEl) return;
    listEl.innerHTML = "";
    const renderer = window.TasuListingRenderer;
    const safeList = Array.isArray(list) ? list.filter(Boolean) : [];

    if (!safeList.length || !renderer?.buildCardElement) {
      if (emptyEl) emptyEl.hidden = false;
      if (countEl) countEl.textContent = "0件";
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    const fragment = document.createDocumentFragment();
    safeList.forEach((item) => {
      try {
        fragment.appendChild(renderer.buildCardElement(item));
      } catch (err) {
        console.warn("[listing-category-page] card render skipped:", err);
      }
    });
    listEl.appendChild(fragment);
    if (countEl) countEl.textContent = `${safeList.length}件`;

    if (window.TasuListings?.ensureListingCardTitles) {
      window.TasuListings.ensureListingCardTitles();
    }

    if (window.TasuListingRenderer?.hydrateListCardSellers) {
      void window.TasuListingRenderer.hydrateListCardSellers(listEl);
    } else if (window.TasuListingRenderer?.hydratePremiumProductCardSellers) {
      void window.TasuListingRenderer.hydratePremiumProductCardSellers(listEl);
    } else if (window.TasuListingSellerProfile?.hydratePremiumProductCardSellers) {
      void window.TasuListingSellerProfile.hydratePremiumProductCardSellers(listEl);
    }
  }

  function initBusinessCategoryFilter(meta, onFilter) {
    const nav = document.querySelector("[data-business-category-nav]");
    if (!nav || meta.source !== "business") return;

    const params = new URLSearchParams(window.location.search);
    const current = params.get("business_category") || "";

    nav.querySelectorAll("[data-biz-cat]").forEach((btn) => {
      const value = btn.dataset.bizCat || "";
      btn.classList.toggle("is-active", value === current);
      btn.addEventListener("click", () => {
        const url = new URL(window.location.href);
        if (value) url.searchParams.set("business_category", value);
        else url.searchParams.delete("business_category");
        window.history.replaceState({}, "", url);
        nav.querySelectorAll("[data-biz-cat]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.bizCat === value);
        });
        onFilter(value);
      });
    });
  }

  async function init() {
    const body = document.body;
    const pageKey = body.dataset.categoryPage;
    const meta = PAGE_META[pageKey];
    if (!meta) return;

    if (meta.source === "business" && window.TasuBusinessBoard?.init) {
      return;
    }

    const listEl = document.querySelector("[data-category-list]");
    const emptyEl = document.querySelector("[data-category-empty]");
    const countEl = document.querySelector("[data-category-count]");
    const sortSelect = document.querySelector("[data-category-sort]");
    const titleEl = document.querySelector("[data-category-title]");
    const badgeEl = document.querySelector("[data-category-badge]");

    if (!listEl) return;

    if (titleEl) titleEl.textContent = meta.title;
    if (badgeEl) badgeEl.textContent = meta.badge;

    let allItems = [];

    async function loadAndRender() {
      const params = new URLSearchParams(window.location.search);
      const bizCat =
        meta.source === "business" ? params.get("business_category") || "" : "";
      allItems = await fetchList(meta, { business_category: bizCat });
      const sort = sortSelect?.value || "newest";
      const sorted = window.TasuListingRenderer?.sortListings
        ? window.TasuListingRenderer.sortListings(allItems, sort)
        : allItems;
      renderList(sorted, listEl, emptyEl, countEl);

      if (window.TasuListings?.ensureListingCardTitles) {
        window.TasuListings.ensureListingCardTitles();
      }
      if (window.TasuListings?.refreshListingIndex) {
        window.TasuListings.refreshListingIndex();
      }
    }

    sortSelect?.addEventListener("change", () => {
      const sorted = window.TasuListingRenderer.sortListings(
        allItems,
        sortSelect.value || "newest"
      );
      renderList(sorted, listEl, emptyEl, countEl);
      if (window.TasuListings?.ensureListingCardTitles) {
        window.TasuListings.ensureListingCardTitles();
      }
      if (window.TasuListings?.refreshListingIndex) {
        window.TasuListings.refreshListingIndex();
      }
    });

    initBusinessCategoryFilter(meta, () => void loadAndRender());
    await loadAndRender();
  }

  if (document.body.dataset.categoryPage) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => void init());
    } else {
      void init();
    }
  }
})();

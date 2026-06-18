/**
 * TOP最上部 PR/注目枠 — 単一コンテナに1件のみ描画（#premium-list とは完全分離）
 */
(function () {
  "use strict";

  const TOP_MODE = "dynamic";
  let lastPickedRow = null;
  let renderPromise = null;

  function getSection() {
    return document.getElementById("topSpotlightSection");
  }

  function getStage() {
    return document.getElementById("topSpotlightStage");
  }

  function getBadge() {
    return document.getElementById("topSpotlightBadge");
  }

  function listingTypeOf(row) {
    return String(row?.listing_type || row?.type || "")
      .trim()
      .toLowerCase();
  }

  function clearStage() {
    const stage = getStage();
    if (!stage) return;
    stage.innerHTML = "";
    stage.replaceChildren();
  }

  function hideTopSection() {
    const section = getSection();
    if (section) {
      section.hidden = true;
      delete section.dataset.topSpotlightMode;
    }
    clearStage();
  }

  function setBadge(isPr) {
    const badge = getBadge();
    if (!badge) return;
    if (isPr) {
      badge.textContent = "PR掲載";
      badge.className = "section__badge section__badge--pr";
    } else {
      badge.textContent = "注目掲載";
      badge.className = "section__badge section__badge--featured";
    }
  }

  async function fetchCandidates() {
    const store = window.TasuListingStore;
    if (!store) return [];

    if (store.fetchActiveFeaturedListings) {
      let rows = await store.fetchActiveFeaturedListings({
        limit: 100,
        public_only: true,
      });
      if (!rows.length) {
        rows = await store.fetchActiveFeaturedListings({
          limit: 100,
          public_only: false,
        });
      }
      return rows;
    }

    const rows = await store.fetchPublishedListings({
      limit: 100,
      public_only: false,
      localFallback: true,
    });
    return rows.filter((row) => window.TasuListingFeatured?.isActive?.(row));
  }

  function applyTopPremiumDecor(article, isPr) {
    if (!article) return;

    const ribbonLabel = isPr ? "PR掲載" : "注目掲載";
    const ribbonMod = isPr ? "top-spotlight-ribbon--pr" : "top-spotlight-ribbon--featured";

    let decor = article.querySelector(".card__decor");
    if (!decor) {
      decor = document.createElement("div");
      decor.className = "card__decor";
      decor.setAttribute("aria-hidden", "true");
      article.prepend(decor);
    }

    decor.innerHTML = `<span class="top-spotlight-ribbon ${ribbonMod}">
      <span class="top-spotlight-ribbon__icon" aria-hidden="true"></span>
      <span class="top-spotlight-ribbon__text">${ribbonLabel}</span>
    </span>`;
  }

  /**
   * 最上部ステージへカード1件だけ描画（必ずクリアしてから1 append）
   */
  function renderSingleTopCard(row, isPr) {
    const store = window.TasuListingStore;
    const featured = window.TasuListingFeatured;
    const section = getSection();
    const stage = getStage();
    if (!store?.buildListCardElement || !section || !stage) return null;

    clearStage();

    const normalized = store.rowToListing ? store.rowToListing(row) : { ...row };
    const isFeaturedPlan = featured?.isFeaturedSlotActive
      ? featured.isFeaturedSlotActive(row)
      : false;

    const li = store.buildListCardElement({
      ...normalized,
      isFeaturedSlot: isPr || isFeaturedPlan,
      isPr: Boolean(isPr),
    });
    li.classList.add("top-spotlight__item");
    li.dataset.topSpotlightListing = "1";
    li.dataset.filterable = "";

    const article = li.querySelector(".list-card");
    if (article) {
      article.classList.add("list-card--top-premium", "is-featured");
      article.classList.toggle("top-spotlight--pr", isPr);
      article.classList.remove("list-card--pr-hero", "list-card--spotlight-pr");
      applyTopPremiumDecor(article, isPr);
    }

    const list = document.createElement("ul");
    list.className = "card-list card-list--top-premium top-spotlight__list";
    list.setAttribute("role", "list");
    list.appendChild(li);

    stage.appendChild(list);

    if (stage.querySelectorAll(".top-spotlight__item, .card-list__item").length > 1) {
      console.warn("[TasuListingTopSpotlight] multiple cards detected; resetting stage");
      clearStage();
      stage.appendChild(list);
    }

    setBadge(isPr);
    section.hidden = false;
    section.dataset.topSpotlightMode = TOP_MODE;

    return { id: String(row.id), mode: isPr ? "pr" : "featured", li };
  }

  function syncCategoryFilter(category) {
    const section = getSection();
    if (!section || section.dataset.topSpotlightMode !== TOP_MODE || !lastPickedRow) {
      return;
    }

    const type = listingTypeOf(lastPickedRow);
    const show = category === "all" || !type || category === type;
    section.hidden = !show;
  }

  async function renderTopSpotlight() {
    if (renderPromise) {
      return renderPromise;
    }

    renderPromise = (async () => {
      const featured = window.TasuListingFeatured;
      hideTopSection();
      lastPickedRow = null;

      if (!featured?.pickSpotlightListing) {
        return null;
      }

      const candidates = await fetchCandidates();
      const picked = featured.pickSpotlightListing(candidates);
      if (!picked) {
        return null;
      }

      lastPickedRow = picked;
      const isPr = featured.isPrActive(picked);
      const result = renderSingleTopCard(picked, isPr);

      if (!result) {
        lastPickedRow = null;
        hideTopSection();
        return null;
      }

      syncCategoryFilter(
        window.TasuListings?.state?.category != null ? window.TasuListings.state.category : "all"
      );

      return result;
    })();

    try {
      return await renderPromise;
    } finally {
      renderPromise = null;
    }
  }

  window.TasuListingTopSpotlight = {
    renderTopSpotlight,
    syncCategoryFilter,
    clearTopSpotlight: hideTopSection,
    getLastPickedId: () => (lastPickedRow ? String(lastPickedRow.id) : null),
  };
})();

/**
 * index.html: Supabase / localStorage の掲載で一覧を描画（静的ダミーカードは使わない）
 */
(function () {
  "use strict";

  let feedInitStarted = false;

  function getPremiumList() {
    return document.querySelector("#premium-list .card-list");
  }

  function getFreeList() {
    return document.querySelector("#free-list .card-list");
  }

  function getBusinessList() {
    return document.querySelector("[data-business-feed]");
  }

  function removeStaticCards(ul) {
    if (!ul) return;
    ul.querySelectorAll(
      ":scope > .card-list__item, :scope > .biz-board-mobile-card, :scope > .biz-board-spotlight"
    ).forEach((el) => el.remove());
  }

  function showEmptyStates(premiumCount, freeCount) {
    const emptyPremium = document.getElementById("emptyStatePremium");
    const emptyFree = document.getElementById("emptyStateFree");
    if (emptyPremium) emptyPremium.hidden = premiumCount > 0;
    if (emptyFree) emptyFree.hidden = freeCount > 0;
  }

  function isActiveFeaturedRow(row) {
    if (window.TasuListingFeatured?.isActive) {
      return window.TasuListingFeatured.isActive(row);
    }
    return Boolean(row.is_featured);
  }

  async function fetchActiveFeaturedRows(store) {
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
      return rows.filter(isActiveFeaturedRow);
    }

    let rows = await store.fetchPublishedListings({
      limit: 100,
      public_only: false,
      localFallback: true,
    });
    return rows.filter(isActiveFeaturedRow);
  }

  function buildPremiumListCard(store, row) {
    const featured = window.TasuListingFeatured;
    const normalized = store.rowToListing ? store.rowToListing(row) : row;
    const isPr = featured?.isPrActive ? featured.isPrActive(row) : false;
    const isFeaturedPlan = featured?.isFeaturedSlotActive
      ? featured.isFeaturedSlotActive(row)
      : false;

    return store.buildListCardElement({
      ...normalized,
      isFeaturedSlot: isPr || isFeaturedPlan,
      isPr,
    });
  }

  async function injectPremiumFeaturedListings() {
    const store = window.TasuListingStore;
    const premiumUl = getPremiumList();
    if (!store || !premiumUl) return { premium: 0, featuredIds: new Set() };

    removeStaticCards(premiumUl);

    const featuredRows = await fetchActiveFeaturedRows(store);
    const featuredIds = new Set(featuredRows.map((row) => String(row.id)));
    const shuffledFeatured = window.TasuListingFeatured?.shuffle
      ? window.TasuListingFeatured.shuffle(featuredRows)
      : featuredRows.slice().sort(() => Math.random() - 0.5);

    const premiumFrag = document.createDocumentFragment();
    let premiumCount = 0;

    shuffledFeatured.forEach((row) => {
      const card = buildPremiumListCard(store, row);
      card.dataset.supabaseListing = "1";
      card.dataset.isFeatured = "1";
      card.dataset.premiumFeed = "1";
      premiumFrag.appendChild(card);
      premiumCount += 1;
    });

    premiumUl.appendChild(premiumFrag);

    const premiumMeta = document.querySelector('[data-result="premium"]');
    if (premiumMeta) premiumMeta.textContent = `${premiumCount}件`;

    return { premium: premiumCount, featuredIds };
  }

  async function injectGeneralListings(featuredIds = new Set()) {
    const store = window.TasuListingStore;
    const freeUl = getFreeList();
    if (!store || !freeUl) return { premium: 0, free: 0 };

    removeStaticCards(freeUl);

    let rows = await store.fetchPublishedListings({
      limit: 80,
      public_only: false,
      localFallback: false,
    });

    if (!rows.length) {
      rows = await store.fetchPublishedListings({
        limit: 80,
        public_only: false,
        localFallback: true,
      });
    }

    const regularRows = rows.filter((row) => !featuredIds.has(String(row.id)));

    const freeFrag = document.createDocumentFragment();
    let freeCount = 0;

    regularRows.forEach((row) => {
      const card = store.buildListCardElement(row);
      card.dataset.supabaseListing = "1";
      freeFrag.appendChild(card);
      freeCount += 1;
    });

    freeUl.appendChild(freeFrag);

    const freeMeta = document.querySelector('[data-result="free"]');
    if (freeMeta) freeMeta.textContent = `${freeCount}件`;

    return { free: freeCount };
  }

  async function injectBusinessListings() {
    const store = window.TasuBusinessListings;
    const ul = getBusinessList();
    if (!store || !ul) return 0;

    removeStaticCards(ul);

    const rows = await store.fetchPublishedBusinessListings({
      limit: 30,
      localFallback: false,
    });
    const section = document.getElementById("supabase-business-list");
    if (rows.length && section) section.hidden = false;
    if (!rows.length && section) section.hidden = true;

    const fragment = document.createDocumentFragment();
    rows.slice(0, 8).forEach((row) => {
      const card = store.buildBusinessCardElement(row);
      if (!card) return;
      card.dataset.supabaseListing = "1";
      fragment.appendChild(card);
    });
    ul.appendChild(fragment);

    if (window.TasuFavoritesDb?.isFavorite) {
      ul.querySelectorAll("[data-favorite-button]").forEach((btn) => {
        const id = btn.dataset.targetId;
        if (!id) return;
        void window.TasuFavoritesDb.isFavorite("u_me", "business", id).then((saved) => {
          const filter = window.TasuFavoritesDb.buildFilter("u_me", "business", id);
          window.TasuFavoritesDb.syncFavoriteButtonsUi(filter, saved, btn);
        });
      });
    }
    return rows.length;
  }

  async function init() {
    if (feedInitStarted) {
      return;
    }
    feedInitStarted = true;

    if (window.TasuListingTopSpotlight?.renderTopSpotlight) {
      await window.TasuListingTopSpotlight.renderTopSpotlight();
    }

    const premium = await injectPremiumFeaturedListings();
    const freeCounts = await injectGeneralListings(premium.featuredIds);
    showEmptyStates(premium.premium, freeCounts.free);

    const counts = { premium: premium.premium, free: freeCounts.free };
    const businessCount = await injectBusinessListings();

    if (window.TasuListings?.hydrateListCardSellers) {
      window.TasuListings.hydrateListCardSellers(document);
    }
    if (window.TasuListings?.ensureListingCardTitles) {
      window.TasuListings.ensureListingCardTitles(document);
    }

    if (window.TasuListings?.refreshListingIndex) {
      window.TasuListings.refreshListingIndex();
    }
    if (window.TasuListings?.applyFilters) {
      window.TasuListings.applyFilters({ resetFeatured: true });
    }

    const allRows = [
      ...document.querySelectorAll("#premium-list .card-list__item, #free-list .card-list__item"),
    ];
    if (window.TasuListingRenderer?.syncPlatformListingBadges && allRows.length) {
      const pool = [];
      allRows.forEach((li) => {
        const art = li.querySelector("[data-listing-id]");
        if (art?.dataset?.listingId) {
          pool.push({ id: art.dataset.listingId, listing_type: art.dataset.type || art.dataset.category });
        }
      });
      window.TasuListingRenderer.syncPlatformListingBadges(document, pool);
    }

    document.dispatchEvent(
      new CustomEvent("tasu:listing-feed-ready", {
        detail: {
          ...counts,
          business: businessCount,
        },
      })
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/**
 * お気に入り — 詳細ページ UI（トグル・トースト・ボタン同期）
 */
(function (global) {
  "use strict";

  const LABEL_OFF = "お気に入りに追加";
  const LABEL_ON = "お気に入り済み";

  const FAVORITE_BUTTON_SELECTOR =
    "[data-biz-detail-favorite], [data-favorite-button], [data-tasu-favorite]";

  let currentListing = null;
  let toastTimer = null;

  function getStore() {
    return global.TasuFavoriteStore;
  }

  function pickListingId(listing) {
    return String(listing?.id || listing?.listing_id || "").trim();
  }

  function ensureToastHost() {
    let el = document.querySelector("[data-tasu-favorite-toast]");
    if (el) return el;
    el = document.createElement("div");
    el.className = "tasu-favorite-toast";
    el.setAttribute("data-tasu-favorite-toast", "");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function showToast(message) {
    const el = ensureToastHost();
    el.textContent = String(message || "");
    el.hidden = false;
    el.classList.add("is-visible");
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => {
      el.hidden = true;
      el.classList.remove("is-visible");
    }, 2400);
  }

  function findLabelElement(btn) {
    return (
      btn.querySelector("[data-bsd-favorite-label]") ||
      btn.querySelector(".tasu-favorite-btn__label") ||
      btn.querySelector(".bsd-cta-card__fav-label") ||
      Array.from(btn.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && String(node.textContent || "").trim()
      ) ||
      null
    );
  }

  function findIconElement(btn) {
    return (
      btn.querySelector(".bsd-cta-card__fav-icon") ||
      btn.querySelector(".shop-sticky-action-nav__fav-icon") ||
      btn.querySelector(".tasu-favorite-btn__icon") ||
      null
    );
  }

  function applyButtonState(btn, saved) {
    if (!btn) return;

    btn.classList.toggle("is-active", saved);
    btn.classList.toggle("is-favorite", saved);
    btn.classList.toggle("tasu-favorite-btn--saved", saved);
    btn.setAttribute("aria-pressed", saved ? "true" : "false");
    btn.setAttribute("aria-label", saved ? LABEL_ON : LABEL_OFF);
    btn.dataset.tasuFavoriteSaved = saved ? "1" : "0";

    const icon = findIconElement(btn);
    if (icon) icon.textContent = saved ? "♥" : "♡";

    const label = findLabelElement(btn);
    if (label) {
      if (label.nodeType === Node.TEXT_NODE) {
        label.textContent = saved ? ` ${LABEL_ON}` : ` ${LABEL_OFF}`;
      } else {
        const text = saved ? LABEL_ON : LABEL_OFF;
        label.textContent = text.startsWith(" ") ? ` ${text.trim()}` : text;
      }
      return;
    }

    const iconOnly =
      btn.dataset.favoriteIconOnly === "1" ||
      btn.hasAttribute("data-tasu-mdetail-hero-favorite") ||
      btn.classList.contains("job-favorite-btn");
    if (!iconOnly) {
      const nodes = Array.from(btn.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
      const textNode = nodes[0];
      if (textNode) {
        textNode.textContent = saved ? ` ${LABEL_ON}` : ` ${LABEL_OFF}`;
        return;
      }
      const plain = String(btn.textContent || "").replace(/♡|♥/g, "").trim();
      if (plain.includes("お気に入り")) {
        const iconHtml = icon ? icon.outerHTML : '<span aria-hidden="true">♡</span>';
        btn.innerHTML = `${iconHtml} ${saved ? LABEL_ON : LABEL_OFF}`;
        return;
      }
    }

    if (!iconOnly && !btn.querySelector(".tasu-favorite-btn__label")) {
      const heart = saved ? "♥" : "♡";
      const current = String(btn.textContent || "").trim();
      if (/お気に入り/.test(current) || current === heart) {
        btn.innerHTML = `<span aria-hidden="true">${heart}</span> ${saved ? LABEL_ON : LABEL_OFF}`;
      }
    }
  }

  function syncAllButtons(listingId) {
    const store = getStore();
    const id =
      String(listingId || "").trim() ||
      pickListingId(currentListing) ||
      String(document.body?.dataset?.listingId || "").trim();
    const saved = store?.isFavorited?.(id) || false;
    document.querySelectorAll(FAVORITE_BUTTON_SELECTOR).forEach((btn) => {
      applyButtonState(btn, saved);
    });
  }

  function resolveListingForToggle(btn) {
    if (currentListing && pickListingId(currentListing)) {
      return currentListing;
    }

    const listingId = String(
      btn?.dataset?.targetId ||
        btn?.dataset?.listingId ||
        document.body?.dataset?.listingId ||
        document.body?.dataset?.targetId ||
        new URLSearchParams(global.location.search).get("id") ||
        ""
    ).trim();

    if (!listingId) return null;

    const store = global.TasuListingLocalStore;
    const local = store?.fetchById?.(listingId);
    if (local) {
      const detail = store.toDetailListing?.(local) || local;
      return { ...detail, _localRecord: local };
    }

    return {
      id: listingId,
      title:
        document.querySelector("[data-biz-detail-title]")?.textContent?.trim() ||
        document.querySelector("[data-listing-title]")?.textContent?.trim() ||
        listingId,
      category:
        document.querySelector("[data-listing-category-badge]")?.textContent?.trim() || "",
      listing_type: document.body?.dataset?.detailType || "",
      imageUrl: document.querySelector("[data-listing-image]")?.getAttribute("src") || "",
      priceLabel:
        document.querySelector("[data-biz-detail-sidebar-price]")?.textContent?.trim() || "",
    };
  }

  function bindButtons() {
    document.querySelectorAll(FAVORITE_BUTTON_SELECTOR).forEach((btn) => {
      if (btn.dataset.tasuFavoriteActionsBound === "1") return;
      btn.dataset.tasuFavoriteActionsBound = "1";
      if (btn.tagName === "BUTTON" && !btn.type) btn.type = "button";
      if (btn.tagName === "A") btn.setAttribute("href", "#");
    });
  }

  function toggleFavorite(listing) {
    const store = getStore();
    if (!store) {
      console.warn("[TasuFavoriteActions] TasuFavoriteStore not loaded");
      return { ok: false };
    }

    const target = listing || currentListing || resolveListingForToggle();
    if (!target || !pickListingId(target)) {
      console.warn("[TasuFavoriteActions] listing not found for favorite toggle");
      return { ok: false };
    }

    const listingId = pickListingId(target);
    const wasSaved = store.isFavorited(listingId);
    const result = store.toggleListing(target);
    const saved = Boolean(result?.saved);

    if (saved && !wasSaved) showToast("お気に入りに追加しました");
    else if (!saved && wasSaved) showToast("お気に入りを解除しました");

    try {
      global.TasuTalkFollowStore?.syncFromFavoriteToggle?.(target, saved);
    } catch (err) {
      console.warn("[TasuFavoriteActions] talk follow sync failed:", err);
    }

    syncAllButtons(listingId);
    return result;
  }

  function mountForListing(listing) {
    if (!listing || typeof listing !== "object") return;
    currentListing = listing;
    global.__tasuDetailFavoriteListing = listing;
    const listingId = pickListingId(listing);
    if (listingId) {
      document.body.dataset.listingId = listingId;
      document.body.dataset.targetId = listingId;
    }
    bindButtons();
    syncAllButtons(listingId);
  }

  function onFavoriteButtonClick(event) {
    const btn = event.target?.closest?.(FAVORITE_BUTTON_SELECTOR);
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const listing = resolveListingForToggle(btn);
    toggleFavorite(listing);
  }

  function onListingApplied(event) {
    const listing = event?.detail?.listing;
    if (listing) mountForListing(listing);
  }

  function onStorageSync(event) {
    const key = getStore()?.STORAGE_KEY;
    if (event.key && event.key !== key) return;
    syncAllButtons();
  }

  function onFavoritesChanged() {
    syncAllButtons();
  }

  function init() {
    bindButtons();
    ensureToastHost();
    if (global.__tasuDetailFavoriteListing) {
      mountForListing(global.__tasuDetailFavoriteListing);
      return;
    }
    const listingId = String(document.body?.dataset?.listingId || "").trim();
    if (listingId && getStore()?.isFavorited?.(listingId)) {
      syncAllButtons(listingId);
      return;
    }
    syncAllButtons();
  }

  global.addEventListener("tasu:listing-applied", onListingApplied);
  global.addEventListener(getStore()?.EVENT_NAME || "tasful-favorites-changed", onFavoritesChanged);
  global.addEventListener("storage", onStorageSync);
  document.addEventListener("click", onFavoriteButtonClick, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.TasuFavoriteActions = {
    LABEL_OFF,
    LABEL_ON,
    FAVORITE_BUTTON_SELECTOR,
    mountForListing,
    syncAllButtons,
    toggleFavorite,
    applyButtonState,
    showToast,
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * お気に入り一覧 — localStorage (tasful_favorite_listings) + 管理画面UI
 * file:// 対応（iframe 再読み込みなし）
 */
(function () {
  "use strict";

  const STORAGE_KEY = "tasful_favorite_listings";
  const META_STORAGE_KEY = "tasful_favorite_listings_meta";

  const TYPE_FILTER_LABELS = {
    "business-service": "業務サービス",
    business_service: "業務サービス",
    "shop-store": "店舗・販売",
    shop_store: "店舗・販売",
    store: "店舗・販売",
    general: "その他",
    product: "商品",
    skill: "スキル",
    job: "求人",
    worker: "ワーカー",
    listing: "掲載",
  };

  const DEMO_ITEMS = {
    "demo-biz-pr-1": {
      title: "TASFUL建設パートナー",
      typeLabel: "業務サービス",
      typeKey: "business-service",
      tags: ["建設・工事", "内装工事"],
      description:
        "店舗・オフィスの内装工事から修繕まで、地域密着で対応します。見積もり無料で安心の施工品質。",
      thumb: "",
      thumbInitials: "TA",
      savedAt: "2025-05-25T00:00:00.000Z",
      detailHref: "detail-business-service.html?id=demo-biz-pr-1",
      isDemo: true,
    },
    "demo-biz-pr-2": {
      title: "TASFUL空港送迎サービス",
      typeLabel: "業務サービス",
      typeKey: "business-service",
      tags: ["送迎", "空港"],
      description:
        "空港と市内ホテル・オフィス間の送迎を定額でご提供。早朝・深夜便にも対応可能です。",
      thumb: "images/demo-ranking/popular-01.jpg",
      savedAt: "2025-05-24T00:00:00.000Z",
      detailHref: "detail-business-service.html?id=demo-biz-pr-2",
      isDemo: true,
    },
    "demo-biz-cleaning-1": {
      title: "TASFULハウスケア",
      typeLabel: "業務サービス",
      typeKey: "business-service",
      tags: ["清掃", "ハウスケア"],
      description:
        "オフィス・店舗の定期清掃から入居前クリーニングまで。スタッフ教育と品質管理で安心。",
      thumb: "images/demo-ranking/skill-01.jpg",
      savedAt: "2025-05-23T00:00:00.000Z",
      detailHref: "detail-business-service.html?id=demo-biz-cleaning-1",
      isDemo: true,
    },
  };

  const state = {
    search: "",
    typeFilter: "",
    sort: "date-desc",
    view: "list",
  };

  function removeSelfReloadFrames() {
    const pageRe = /favorites-list\.html/i;
    document.querySelectorAll("iframe, frame, embed, object").forEach((node) => {
      const src = String(node.getAttribute("src") || node.getAttribute("data") || node.src || "").trim();
      if (src && pageRe.test(src)) node.remove();
    });
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readMeta() {
    try {
      const raw = localStorage.getItem(META_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeMeta(meta) {
    try {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    } catch (err) {
      console.warn("[favorites-list] meta save failed:", err);
    }
  }

  function getSavedAt(id) {
    const meta = readMeta();
    const entry = meta[id];
    if (entry?.savedAt) return entry.savedAt;
    return new Date().toISOString();
  }

  function ensureMetaForIds(ids) {
    const meta = readMeta();
    let changed = false;
    const now = new Date().toISOString();
    ids.forEach((id) => {
      if (!meta[id]) {
        const demo = DEMO_ITEMS[id];
        meta[id] = { savedAt: demo?.savedAt || now };
        changed = true;
      }
    });
    if (changed) writeMeta(meta);
  }

  function removeMetaId(id) {
    const meta = readMeta();
    if (!meta[id]) return;
    delete meta[id];
    writeMeta(meta);
  }

  function clearAllMeta() {
    writeMeta({});
  }

  /** @returns {string[]} */
  function getFavoriteIds() {
    const ids = new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.map((id) => String(id || "").trim()).filter(Boolean).forEach((id) => ids.add(id));
      }
    } catch {
      /* ignore */
    }
    if (window.TasuFavoriteStore?.getAllListingIds) {
      window.TasuFavoriteStore.getAllListingIds().forEach((id) => ids.add(id));
    }
    return [...ids];
  }

  function writeFavoriteIds(ids) {
    const unique = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
    return unique;
  }

  function removeFavorite(id) {
    const key = String(id || "").trim();
    if (!key) return getFavoriteIds();
    window.TasuFavoriteStore?.removeByListingId?.(key);
    removeMetaId(key);
    return writeFavoriteIds(getFavoriteIds().filter((item) => item !== key));
  }

  function clearAllFavorites() {
    writeFavoriteIds([]);
    clearAllMeta();
    if (window.TasuFavoriteStore?.writeAll) {
      window.TasuFavoriteStore.writeAll([]);
    }
  }

  function inferTypeKey(listingId) {
    const id = String(listingId || "");
    if (DEMO_ITEMS[id]?.typeKey) return DEMO_ITEMS[id].typeKey;
    if (/^demo-biz-/i.test(id)) return "business-service";
    if (/^demo-shop-/i.test(id) || /^shop_/i.test(id)) return "store";
    if (/^product/i.test(id) || /^demo-product/i.test(id)) return "product";
    if (/^skill/i.test(id) || /^demo-skill/i.test(id)) return "skill";
    if (/^job/i.test(id) || /^demo-job/i.test(id)) return "job";
    if (/^worker/i.test(id) || /^w\d+$/i.test(id)) return "worker";
    return "listing";
  }

  /**
   * @param {string} id
   */
  function resolveFavoriteItem(id) {
    const listingId = String(id || "").trim();
    const stored = window.TasuFavoriteStore?.findByListingId?.(listingId);
    if (stored) {
      const typeKey = String(stored.listingType || inferTypeKey(listingId)).trim();
      const typeLabel = TYPE_FILTER_LABELS[typeKey] || typeKey || "掲載";
      return {
        id: listingId,
        title: stored.title || listingId,
        typeLabel,
        typeKey,
        tags: stored.category ? [stored.category] : [],
        description: stored.price ? `価格: ${stored.price}` : "",
        thumb: stored.image || "",
        thumbInitials: (stored.title || listingId).slice(0, 2),
        savedAt: stored.createdAt || getSavedAt(listingId),
        detailHref: stored.detailUrl || `detail-post.html?listingId=${encodeURIComponent(listingId)}`,
        isDemo: false,
        searchText: [stored.title, stored.category, stored.price, typeLabel].filter(Boolean).join(" "),
      };
    }

    const demo = DEMO_ITEMS[listingId];
    const typeKey = inferTypeKey(listingId);
    const typeLabel = TYPE_FILTER_LABELS[typeKey] || "掲載";
    const savedAt = demo?.savedAt || getSavedAt(listingId);

    if (demo) {
      return {
        id: listingId,
        title: demo.title,
        typeLabel: demo.typeLabel,
        typeKey: demo.typeKey,
        tags: demo.tags || [],
        description: demo.description || "",
        thumb: demo.thumb || "",
        thumbInitials: demo.thumbInitials || "",
        savedAt,
        detailHref: demo.detailHref,
        isDemo: true,
        searchText: [demo.title, demo.description, ...(demo.tags || [])].join(" "),
      };
    }

    if (/^demo-biz-/i.test(listingId)) {
      return {
        id: listingId,
        title: listingId,
        typeLabel: "業務サービス",
        typeKey: "business-service",
        tags: [],
        description: "業務サービスの掲載です。詳細ページで内容をご確認ください。",
        thumb: "",
        thumbInitials: "BS",
        savedAt,
        detailHref: `detail-business-service.html?id=${encodeURIComponent(listingId)}`,
        isDemo: false,
        searchText: listingId,
      };
    }

    return {
      id: listingId,
      title: listingId,
      typeLabel,
      typeKey,
      tags: typeKey === "listing" ? [] : [typeLabel],
      description: "掲載の詳細は詳細ページでご確認いただけます。",
      thumb: "",
      thumbInitials: "ID",
      savedAt,
      detailHref: `detail-post.html?listingId=${encodeURIComponent(listingId)}`,
      isDemo: false,
      searchText: `${listingId} ${typeLabel}`,
    };
  }

  function formatSavedDate(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "—";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}/${m}/${day}`;
    } catch {
      return "—";
    }
  }

  function formatSavedDateMobileLabel(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "—";
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${m}/${day} 保存`;
    } catch {
      return "—";
    }
  }

  function formatSavedDaysAgo(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const saved = new Date(d);
      saved.setHours(0, 0, 0, 0);
      const days = Math.floor((today - saved) / (1000 * 60 * 60 * 24));
      if (days <= 0) return "今日";
      if (days === 1) return "1日前";
      return `${days}日前`;
    } catch {
      return "";
    }
  }

  function savedDateDatetime(iso) {
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function buildSavedBadgeHtml(item, variant) {
    if (variant === "corner") {
      return `
      <span class="fav-item__saved-badge fav-item__saved-badge--corner">
        <time class="fav-item__saved-badge-date" datetime="${escapeHtml(savedDateDatetime(item.savedAt))}">${escapeHtml(formatSavedDateMobileLabel(item.savedAt))}</time>
      </span>
    `;
    }

    const ago = formatSavedDaysAgo(item.savedAt);
    const agoHtml = ago
      ? `<span class="fav-item__saved-badge-ago">${escapeHtml(ago)}</span>`
      : "";
    return `
      <span class="fav-item__saved-badge fav-item__saved-badge--aside">
        <span class="fav-item__saved-badge-star" aria-hidden="true">★</span>
        <span class="fav-item__saved-badge-label">保存日</span>
        <time class="fav-item__saved-badge-date" datetime="${escapeHtml(savedDateDatetime(item.savedAt))}">${escapeHtml(formatSavedDate(item.savedAt))}</time>
        ${agoHtml}
      </span>
    `;
  }

  function buildThumbHtml(item) {
    if (item.thumb) {
      return `<img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" width="120" height="84">`;
    }
    const initials = escapeHtml(item.thumbInitials || item.title.slice(0, 2) || "—");
    return `<span class="fav-item__thumb-placeholder">${initials}</span>`;
  }

  function buildTagsHtml(tags) {
    if (!tags?.length) return "";
    return `<div class="fav-item__tags">${tags
      .map((t) => `<span class="fav-item__tag">${escapeHtml(t)}</span>`)
      .join("")}</div>`;
  }

  function wrapFavoriteDetailHref(href) {
    const url = String(href || "").trim();
    if (!url || url === "#") return url;
    if (window.TasuDetailNav?.appendFavoriteParams) {
      return window.TasuDetailNav.appendFavoriteParams(url);
    }
    return url;
  }

  function buildItemHtml(item) {
    const titleBlock = item.isDemo
      ? `<h2 class="fav-item__title">${escapeHtml(item.title)}</h2>`
      : `<span class="fav-item__id-label">掲載ID</span><h2 class="fav-item__title">${escapeHtml(item.title)}</h2>`;
    const detailLabel = escapeHtml(String(item.title || "").trim() || "詳細");

    return `
      <article class="fav-item" data-favorite-item data-listing-id="${escapeHtml(item.id)}" data-type-key="${escapeHtml(item.typeKey)}">
        ${buildSavedBadgeHtml(item, "corner")}
        <div class="fav-item__thumb">${buildThumbHtml(item)}</div>
        <div class="fav-item__body">
          ${buildTagsHtml(item.tags)}
          ${titleBlock}
          <p class="fav-item__desc">${escapeHtml(item.description)}</p>
        </div>
        <div class="fav-item__aside">
          <p class="fav-item__saved">${buildSavedBadgeHtml(item, "aside")}</p>
          <div class="fav-item__actions">
            <a class="fav-btn fav-btn--detail" href="${escapeHtml(wrapFavoriteDetailHref(item.detailHref))}" data-breadcrumb-label="${detailLabel}">
              詳細を見る <span class="fav-btn__chevron" aria-hidden="true">›</span>
            </a>
            <button type="button" class="fav-btn fav-btn--remove" data-favorites-remove data-listing-id="${escapeHtml(item.id)}">
              <span aria-hidden="true">♥</span> お気に入り解除
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function getFilteredItems() {
    const ids = getFavoriteIds();
    ensureMetaForIds(ids);

    let items = ids.map((id) => resolveFavoriteItem(id));

    const q = state.search.trim().toLowerCase();
    if (q) {
      items = items.filter((item) => {
        const hay = `${item.title} ${item.description} ${item.searchText} ${item.id} ${item.typeLabel}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (state.typeFilter) {
      items = items.filter((item) => item.typeKey === state.typeFilter);
    }

    items.sort((a, b) => {
      if (state.sort === "name") {
        return a.title.localeCompare(b.title, "ja");
      }
      const ta = new Date(a.savedAt).getTime();
      const tb = new Date(b.savedAt).getTime();
      return state.sort === "date-asc" ? ta - tb : tb - ta;
    });

    return items;
  }

  function syncViewToggle() {
    document.body.dataset.favoritesView = state.view;
    document.querySelectorAll("[data-favorites-view-btn]").forEach((btn) => {
      const active = btn.getAttribute("data-favorites-view-btn") === state.view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const listEl = document.querySelector("[data-favorites-list]");
    if (listEl) {
      listEl.classList.toggle("fav-list--cards", state.view === "card");
    }
  }

  function syncPromo(count) {
    const statEl = document.querySelector("[data-favorites-promo-stat]");
    const subEl = document.querySelector("[data-favorites-promo-sub]");
    if (!statEl || !subEl) return;

    if (count > 0) {
      statEl.hidden = false;
      statEl.textContent = `現在 ${count}件のお気に入りがあります`;
      subEl.textContent = "お気に入り登録で後からまとめて比較できます";
    } else {
      statEl.hidden = true;
      statEl.textContent = "";
      subEl.textContent = "気になるサービスをお気に入りに追加すると、ここにまとめて確認できます。";
    }
  }

  function renderFavorites() {
    removeSelfReloadFrames();

    const listEl = document.querySelector("[data-favorites-list]");
    const panelEl = document.querySelector("[data-favorites-panel]");
    const emptyEl = document.querySelector("[data-favorites-empty]");
    const noResultsEl = document.querySelector("[data-favorites-no-results]");
    const countEl = document.querySelector("[data-favorites-count]");

    if (!listEl) return;

    const allIds = getFavoriteIds();
    const items = getFilteredItems();
    const hasAny = allIds.length > 0;

    syncPromo(allIds.length);

    listEl.innerHTML = "";

    if (!hasAny) {
      if (panelEl) panelEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      if (noResultsEl) noResultsEl.hidden = true;
      if (countEl) countEl.textContent = "0";
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (panelEl) panelEl.hidden = false;
    if (countEl) countEl.textContent = String(allIds.length);

    if (!items.length) {
      if (noResultsEl) noResultsEl.hidden = false;
    } else {
      if (noResultsEl) noResultsEl.hidden = true;
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "fav-list__row";
        li.innerHTML = buildItemHtml(item);
        fragment.appendChild(li);
      });
      listEl.appendChild(fragment);
    }

    syncViewToggle();
  }

  function readControlsFromDom() {
    const searchEl = document.querySelector("[data-favorites-search]");
    const typeEl = document.querySelector("[data-favorites-type-filter]");
    const sortEl = document.querySelector("[data-favorites-sort]");
    if (searchEl) state.search = searchEl.value;
    if (typeEl) state.typeFilter = typeEl.value;
    if (sortEl) state.sort = sortEl.value;
  }

  function bindControls() {
    const searchEl = document.querySelector("[data-favorites-search]");
    const typeEl = document.querySelector("[data-favorites-type-filter]");
    const sortEl = document.querySelector("[data-favorites-sort]");
    const clearAllBtn = document.querySelector("[data-favorites-clear-all]");

    if (searchEl) {
      searchEl.addEventListener("input", () => {
        state.search = searchEl.value;
        renderFavorites();
      });
    }
    if (typeEl) {
      typeEl.addEventListener("change", () => {
        state.typeFilter = typeEl.value;
        renderFavorites();
      });
    }
    if (sortEl) {
      sortEl.addEventListener("change", () => {
        state.sort = sortEl.value;
        renderFavorites();
      });
    }

    document.querySelectorAll("[data-favorites-view-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.view = btn.getAttribute("data-favorites-view-btn") || "list";
        syncViewToggle();
      });
    });

    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        if (!getFavoriteIds().length) return;
        if (!window.confirm("お気に入りをすべて削除しますか？")) return;
        clearAllFavorites();
        renderFavorites();
      });
    }

    document.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-favorites-remove]");
      if (!btn) return;
      event.preventDefault();
      const id = btn.getAttribute("data-listing-id") || "";
      removeFavorite(id);
      readControlsFromDom();
      renderFavorites();
    });
  }

  function onStorageSync(event) {
    if (event.key === STORAGE_KEY || event.key === META_STORAGE_KEY) {
      renderFavorites();
    }
  }

  function start() {
    removeSelfReloadFrames();
    readControlsFromDom();
    bindControls();
    renderFavorites();
    window.addEventListener("storage", onStorageSync);
  }

  window.TasuFavoritesList = {
    STORAGE_KEY,
    META_STORAGE_KEY,
    getFavoriteIds,
    removeFavorite,
    clearAllFavorites,
    resolveFavoriteItem,
    renderFavorites,
  };

  window.loadFavorites = renderFavorites;
  window.renderFavorites = renderFavorites;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

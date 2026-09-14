/**
 * TASFUL Materials — Video-first primary category list (COMMON_CATEGORY_SHELL).
 * Visual baseline: materials-image-list.js (mat-img-*). Behavior: materials-vf-category-config.js.
 */
(function (global) {
  "use strict";

  const Config = () => global.TasuMaterialsVfCategoryConfig;
  const Filters = () => global.TasuMaterialsVfCategoryFilters;
  const PAGE_SIZE = () => (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;

  let activeCategoryId = "";

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function enrichItem(raw) {
    const data = global.TasuMaterialsData;
    return data?.enrichDetail ? data.enrichDetail(raw) || raw : raw;
  }

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  function renderPagination(page, totalPages) {
    if (totalPages <= 1) {
      return `<nav class="mat-img-pager" aria-label="ページネーション" data-vf-pager></nav>`;
    }
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-img-pager__btn" data-vf-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const pushPage = (p) => {
      buttons.push(
        `<button type="button" class="mat-img-pager__btn${p === page ? " is-active" : ""}" data-vf-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
      );
    };
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      pushPage(1);
      if (start > 2) buttons.push(`<span class="mat-img-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) pushPage(p);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-img-pager__ellipsis">…</span>`);
      pushPage(totalPages);
    }
    buttons.push(
      `<button type="button" class="mat-img-pager__btn" data-vf-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    return `<nav class="mat-img-pager" aria-label="ページネーション" data-vf-pager>${buttons.join("")}</nav>`;
  }

  function renderCatalogEmpty(label) {
    return (
      `<div class="materials-list-empty materials-list-empty--catalog" data-materials-empty="catalog">` +
      `<p class="materials-list-empty__title">${escapeHtml(label)}の公開素材はまだありません。</p>` +
      `<p class="materials-list-empty__text">在庫は0件です。仮の素材は表示しません。</p>` +
      `</div>`
    );
  }

  function renderShell(cfg, opts) {
    const { q, sort, state, options, resultCount, page, totalPages, bodyHtml, tagEntries, catalogEmpty } = opts;
    const categoryId = cfg.id;
    const displayLabel = cfg.displayLabel();

    const activeFilters = [];
    activeFilters.push(`<span class="mat-img-chip-active">${escapeHtml(displayLabel)}</span>`);
    if (sort === "newest") activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">新着順</span>`);
    else activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--accent">人気順</span>`);
    if (q) activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const chips = listCategoryChips()
      .map((c) => {
        const active = c.id === categoryId;
        const href = c.id ? `list.html?category=${encodeURIComponent(c.id)}` : "list.html";
        return `<a class="mat-img-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
      })
      .join("");

    const popularTags = (tagEntries || [])
      .slice(0, 10)
      .map(
        ([tag, count]) =>
          `<button type="button" class="mat-img-popular-tag" data-vf-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span>${count}</span></button>`
      )
      .join("");

    const filterBar = Filters().renderFilterBar(cfg.filterProfile, cfg.categoryId, options, state);

    const promo = cfg.promo || {};

    return (
      `<div class="mat-img-layout" data-vf-category="${escapeHtml(categoryId)}">` +
      `<div class="mat-img-main">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-img-head">` +
      `<h1 class="mat-img-head__title">${escapeHtml(cfg.title)}</h1>` +
      `<p class="mat-img-head__lead">${escapeHtml(cfg.lead)}</p>` +
      `</div>` +
      `<form class="mat-img-search" data-vf-search role="search">` +
      `<div class="mat-img-search__field">` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="${escapeHtml(cfg.searchPlaceholder)}" aria-label="キーワードで検索" data-vf-q>` +
      `</div>` +
      `<button type="submit" class="mat-img-search__btn">検索</button>` +
      `<label class="mat-img-sort">` +
      `<span class="visually-hidden">並び順</span>` +
      `<select data-vf-sort aria-label="並び順">` +
      `<option value="popular"${sort === "popular" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `</select>` +
      `</label>` +
      `</form>` +
      `<div class="mat-img-cat-chips mat-list-m-chips" data-vf-chips>${chips}</div>` +
      `<div class="mat-img-filters mat-list-m-filters" data-vf-filters>` +
      filterBar +
      `<button type="button" class="mat-img-clear" data-vf-clear>すべてクリア</button>` +
      `<span class="mat-img-result-count" data-vf-count>検索結果：<strong>${resultCount}</strong>件</span>` +
      `</div>` +
      (catalogEmpty
        ? `<div class="mat-img-grid" data-vf-grid>${bodyHtml}</div>`
        : bodyHtml
          ? `<div class="mat-img-grid" data-vf-grid>${bodyHtml}</div>`
          : `<p class="mat-img-empty">${escapeHtml(cfg.emptyFilter)}</p>`) +
      renderPagination(page, totalPages) +
      `<div class="mat-img-promo">` +
      `<div class="mat-img-promo__icon" aria-hidden="true"></div>` +
      `<div class="mat-img-promo__body">` +
      `<h3>${escapeHtml(promo.title || "")}</h3>` +
      `<p>${escapeHtml(promo.body || "")}</p>` +
      `</div>` +
      `<a class="mat-img-promo__cta" href="/login.html">無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `<aside class="mat-img-sidebar" aria-label="絞り込みサイドバー">` +
      `<div class="mat-img-side-card">` +
      `<h3 class="mat-img-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-img-side-active">${activeFilters.join("")}` +
      `<button type="button" class="mat-img-side-clear" data-vf-clear>すべてクリア</button>` +
      `</div></div>` +
      `<div class="mat-img-side-card">` +
      `<h3 class="mat-img-side-card__title">カテゴリ</h3>` +
      (global.TasuMaterialsListSidebar?.renderNav?.({ activeId: cfg.categoryId }) || "") +
      `</div>` +
      (popularTags
        ? `<div class="mat-img-side-card"><h3 class="mat-img-side-card__title">人気タグ</h3><div class="mat-img-popular-tags">${popularTags}</div></div>`
        : "") +
      `<div class="mat-img-side-card mat-img-side-card--fav">` +
      `<div class="mat-img-side-fav"><div class="mat-img-side-fav__icon" aria-hidden="true"></div>` +
      `<div><h3 class="mat-img-side-card__title">お気に入りに保存</h3>` +
      `<p>気になる素材を保存して後からまとめてダウンロードできます</p></div></div>` +
      `<a class="mat-img-side-fav__link" href="/materials/mypage.html#favorites">ダッシュボードのお気に入り</a>` +
      `</div></aside>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  function renderGenericMotionCard(item) {
    const card = global.TasuMaterialsDownloadCard;
    if (card?.renderDownloadCard) return card.renderDownloadCard(item, { variant: "list" });
    return "";
  }

  function renderCard(cfg, item) {
    const delegate = Config().listDelegateModule(cfg);
    if (delegate?.renderCard) {
      let html = delegate.renderCard(item);
      if (cfg.cardVariant === "audio" && cfg.categoryId === "bgm") {
        html = `<div class="mat-all-card-host" data-bgm-list data-mat-all-host="bgm">${html}</div>`;
      }
      return html;
    }
    if (cfg.cardVariant === "motion") return renderGenericMotionCard(item);
    const imageList = global.TasuMaterialsImageList;
    if (imageList?.renderCard) return imageList.renderCard(item);
    return renderGenericMotionCard(item);
  }

  function wireCard(cfg, card, item) {
    const delegate = Config().listDelegateModule(cfg);
    if (delegate?.wireCard) {
      delegate.wireCard(card, item);
      return;
    }
    global.TasuMaterialsDownload?.wireDownloadAndFavorite?.(card, item);
    global.TasuMaterialsFavorites?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
  }

  async function loadBaseItems(cfg, urlState) {
    const repo = global.TasuMaterialsData?.repository;
    if (!repo) return [];
    const categoryId = cfg.categoryId;
    let items;
    if (urlState.q) {
      items = await repo.searchItems(urlState.q);
      items = (items || []).filter((i) => i.category_id === categoryId);
      if (urlState.sort === "newest") {
        items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      const sort = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchItemsByCategory(categoryId);
      if (!items || !items.length) {
        items = (await repo.fetchAllItems(sort)).filter((i) => i.category_id === categoryId);
      }
      items = items.slice().sort((a, b) => {
        if (sort === "newest") return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        return (Number(b.download_count) || 0) - (Number(a.download_count) || 0);
      });
    }
    return (items || []).map(enrichItem);
  }

  function hideLegacySpecialtyMounts() {
    [
      "classic",
      "sfx",
      "bgm",
      "image",
      "illustration",
      "background",
      "icon",
      "web",
      "code",
      "document",
      "presentation",
      "template",
    ].forEach((key) => {
      const el =
        key === "classic"
          ? document.querySelector("[data-materials-list-classic]")
          : document.querySelector(`[data-materials-list-${key}]`);
      if (!el) return;
      el.hidden = true;
      if (key !== "classic") el.innerHTML = "";
      el.setAttribute("aria-hidden", "true");
      if ("inert" in el) el.inert = true;
    });
    global.TasuMaterialsSfxList?.hide?.();
    global.TasuMaterialsBgmList?.hide?.();
    global.TasuMaterialsImageList?.hide?.();
    global.TasuMaterialsIllustrationList?.hide?.();
    global.TasuMaterialsBackgroundList?.hide?.();
    global.TasuMaterialsIconList?.hide?.();
    global.TasuMaterialsWebList?.hide?.();
    global.TasuMaterialsCodeList?.hide?.();
    global.TasuMaterialsDocumentList?.hide?.();
    global.TasuMaterialsPresentationList?.hide?.();
    global.TasuMaterialsTemplateList?.hide?.();
  }

  function showVfRoot(root) {
    hideLegacySpecialtyMounts();
    root.hidden = false;
    root.removeAttribute("aria-hidden");
    if ("inert" in root) root.inert = false;
  }

  function readFiltersFromDom(root, profile, state) {
    const next = { ...state };
    root.querySelectorAll("[data-vf-filter]").forEach((sel) => {
      const name = sel.getAttribute("data-vf-filter");
      if (name) next[name] = sel.value || "";
    });
    return next;
  }

  function clearedState(profile) {
    const state = Filters().readState(profile, activeCategoryId);
    Object.keys(state).forEach((k) => {
      if (k === "sort") state[k] = "popular";
      else if (k === "page") state[k] = 1;
      else state[k] = "";
    });
    return state;
  }

  function wireInteractions(root, cfg, allItems, urlState) {
    const profile = cfg.filterProfile;
    const F = Filters();

    root.querySelector("[data-vf-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-vf-q]")?.value || "";
      const next = { ...urlState, q: String(q).trim(), page: 1 };
      F.writeState(profile, cfg.categoryId, next, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-vf-sort]")?.addEventListener("change", (ev) => {
      const sort = ev.target.value === "newest" ? "newest" : "popular";
      F.writeState(profile, cfg.categoryId, { ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-vf-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = readFiltersFromDom(root, profile, { ...urlState, page: 1 });
        F.writeState(profile, cfg.categoryId, next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-vf-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cleared = { ...clearedState(profile), q: "", sort: "popular", page: 1 };
        Object.keys(cleared).forEach((k) => {
          if (!["q", "sort", "page"].includes(k)) cleared[k] = "";
        });
        F.writeState(profile, cfg.categoryId, cleared, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-vf-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-vf-tag") || "";
        F.writeState(profile, cfg.categoryId, { ...urlState, q: tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-vf-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-vf-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-vf-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      F.writeState(profile, cfg.categoryId, { ...urlState, page }, false);
      refresh().catch(() => {});
    });

    const itemById = new Map(allItems.map((i) => [i.id, i]));
    root.querySelectorAll("[data-item-id]").forEach((card) => {
      const item = itemById.get(card.getAttribute("data-item-id"));
      if (item) wireCard(cfg, card, item);
    });
  }

  async function refresh() {
    const root = document.querySelector("[data-materials-list-vf]");
    if (!root) return;

    const params = new URLSearchParams(global.location.search);
    const categoryQuery = params.get("category") || "";
    const cfg = Config()?.getVfCategoryConfig(categoryQuery);
    if (!cfg) {
      hide();
      return;
    }
    activeCategoryId = cfg.id;
    showVfRoot(root);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const F = Filters();
    const urlState = F.readState(cfg.filterProfile, cfg.categoryId);
    const baseItems = await loadBaseItems(cfg, urlState);
    const options = F.collectOptions(cfg.filterProfile, cfg.categoryId, baseItems);
    const filtered = F.applyFilters(cfg.filterProfile, cfg.categoryId, baseItems, urlState);

    const data = global.TasuMaterialsData;
    const inventory =
      typeof data?.countPublishedInventoryByCategory === "function" ? data.countPublishedInventoryByCategory() : {};
    const inventoryCount = Number(inventory[cfg.categoryId] || 0);
    const hasExtra = F.hasActiveFilters(cfg.filterProfile, urlState);
    const catalogEmpty = inventoryCount === 0 && !hasExtra;

    const pageSize = PAGE_SIZE();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
    const page = Math.min(urlState.page, totalPages);
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    const tagEntries = [...(options.tags || new Map()).entries()].sort((a, b) => b[1] - a[1]);

    let bodyHtml = "";
    if (catalogEmpty) {
      bodyHtml = renderCatalogEmpty(cfg.displayLabel());
    } else if (pageItems.length) {
      bodyHtml = pageItems.map((item) => renderCard(cfg, item)).join("");
    }

    root.innerHTML = renderShell(cfg, {
      q: urlState.q,
      sort: urlState.sort,
      state: urlState,
      options,
      resultCount: catalogEmpty ? 0 : filtered.length,
      page,
      totalPages: filtered.length ? totalPages : 1,
      bodyHtml,
      tagEntries,
      catalogEmpty,
    });

    wireInteractions(root, cfg, pageItems, { ...urlState, page });

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: cfg.categoryId,
            result_count: filtered.length,
          })
        ).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  function hide() {
    activeCategoryId = "";
    const root = document.querySelector("[data-materials-list-vf]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      if ("inert" in root) root.inert = true;
    }
    global.TasuMaterialsSfxList?.stopAudio?.();
    global.TasuMaterialsBgmList?.stopAudio?.();
  }

  function isPrimaryCategory(categoryId) {
    const ids = Config()?.primaryCategoryIds() || [];
    return ids.includes(String(categoryId || ""));
  }

  async function mount(categoryId) {
    const id = String(categoryId || new URLSearchParams(global.location.search).get("category") || "");
    if (!isPrimaryCategory(id)) {
      hide();
      return false;
    }
    await refresh();
    return true;
  }

  global.TasuMaterialsVfCategoryList = {
    mount,
    refresh,
    hide,
    isPrimaryCategory,
    renderCard,
    wireCard,
  };
})(typeof window !== "undefined" ? window : globalThis);

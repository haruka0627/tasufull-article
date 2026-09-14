/**
 * TASFUL Materials — 素材一覧ページ
 * Video-first chips / URL SSOT: TasuMaterialsData.LIST_CATEGORY_CHIPS + LIST_VALID_QUERY_IDS.
 * 透過 filter is DEFERRED (public index has no transparency metadata).
 */
(function (global) {
  "use strict";

  const FALLBACK_VALID_CATEGORIES = Object.freeze([
    "bgm",
    "sfx",
    "image",
    "illustration",
    "background",
    "icon",
    "overlay",
    "frame",
    "telop",
    "transition",
    "template",
    "web",
    "code",
    "text",
    "tool",
    "presentation",
  ]);

  /** チップ URL カテゴリ → データ上の category_id（文章 = document） */
  const CATEGORY_FILTER_MAP = Object.freeze({
    text: "document",
  });

  function validCategorySet() {
    const ids = global.TasuMaterialsData && global.TasuMaterialsData.LIST_VALID_QUERY_IDS;
    return new Set(Array.isArray(ids) && ids.length ? ids : FALLBACK_VALID_CATEGORIES);
  }

  function normalizeCategory(raw) {
    const category = String(raw || "").trim();
    return validCategorySet().has(category) ? category : "";
  }

  function isClassicListCategory(category) {
    if (category === "tool") return true;
    const emptyIds = global.TasuMaterialsData && global.TasuMaterialsData.VIDEO_FIRST_EMPTY_CATEGORY_IDS;
    return Array.isArray(emptyIds) && emptyIds.includes(category);
  }

  function listChipLabel(queryId) {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    if (Array.isArray(chips)) {
      const hit = chips.find((c) => (c.id || "") === (queryId || ""));
      if (hit && hit.label) return hit.label;
    }
    const labels = global.TasuMaterialsData && global.TasuMaterialsData.LIST_UI_LABELS;
    if (labels && queryId && labels[queryId]) return labels[queryId];
    const cat = global.TasuMaterialsData && global.TasuMaterialsData.categoryById
      ? global.TasuMaterialsData.categoryById(CATEGORY_FILTER_MAP[queryId] || queryId)
      : null;
    return (cat && cat.name) || queryId || "このカテゴリ";
  }

  function categoryToFilterId(chipCategory) {
    if (!chipCategory) return "";
    return CATEGORY_FILTER_MAP[chipCategory] || chipCategory;
  }

  function readListParams() {
    const params = new URLSearchParams(global.location.search);
    const sortRaw = params.get("sort") || "";
    return {
      q: params.get("q") || "",
      sort: sortRaw === "newest" ? "newest" : sortRaw === "popular" ? "popular" : "",
      category: normalizeCategory(params.get("category")),
      usage: params.get("usage") || "",
      format: params.get("format") || "",
      style: params.get("style") || "",
      color: params.get("color") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeClassicUrlState(next, replace) {
    const url = new URL(global.location.href);
    const setOrDel = function (key, val) {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    if (next.category) url.searchParams.set("category", next.category);
    else url.searchParams.delete("category");
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    setOrDel("format", next.format);
    setOrDel("style", next.style);
    setOrDel("color", next.color);
    url.searchParams.delete("tag");
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    [
      "length",
      "mood",
      "tempo",
      "genre",
      "sub",
      "orientation",
      "people",
      "size",
      "pattern",
      "brightness",
      "stroke",
      "shape",
      "cat",
      "layout",
      "industry",
      "pages",
      "ratio",
      "lang",
      "license",
      "framework",
      "qa_fixture",
    ].forEach(function (key) {
      url.searchParams.delete(key);
    });
    if (replace) global.history.replaceState({ materialsListClassic: true }, "", url);
    else global.history.pushState({ materialsListClassic: true }, "", url);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Cross-category ALL filters: exact real fields only. Genre ≠ Use Case ≠ Style ≠ Color ≠ Tag. */
  function pickExactField(item, field) {
    return String((item && item[field]) || "").trim();
  }

  function applyCommonFilters(items, params) {
    const usage = String(params.usage || "").trim();
    const format = String(params.format || "").trim().toUpperCase();
    const style = String(params.style || "").trim();
    const color = String(params.color || "").trim();
    return items.filter(function (item) {
      if (usage && pickExactField(item, "use_case") !== usage) return false;
      if (format) {
        const formats = (item.file_formats || []).map(function (f) {
          return String(f).toUpperCase();
        });
        if (!formats.includes(format)) return false;
      }
      if (style && pickExactField(item, "style") !== style) return false;
      if (color && pickExactField(item, "color_family") !== color) return false;
      return true;
    });
  }

  function collectCommonFilterOptions(items) {
    const usages = new Map();
    const formats = new Map();
    const styles = new Map();
    const colors = new Map();
    items.forEach(function (item) {
      const usage = pickExactField(item, "use_case");
      if (usage) usages.set(usage, (usages.get(usage) || 0) + 1);
      (item.file_formats || []).forEach(function (f) {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
      const style = pickExactField(item, "style");
      if (style) styles.set(style, (styles.get(style) || 0) + 1);
      const color = pickExactField(item, "color_family");
      if (color) colors.set(color, (colors.get(color) || 0) + 1);
    });
    return { usages, formats, styles, colors };
  }

  function sortItems(items, sort) {
    const list = items.slice();
    if (sort === "newest") {
      return list.sort(function (a, b) {
        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      });
    }
    return list.sort(function (a, b) {
      return (Number(b.download_count) || 0) - (Number(a.download_count) || 0);
    });
  }

  function fillFilterSelect(select, label, optionsMap, selected) {
    if (!select) return;
    const entries = [...optionsMap.entries()].sort(function (a, b) {
      return b[1] - a[1];
    });
    if (!entries.length) {
      select.innerHTML = `<option value="">${escapeHtml(label)}</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML =
      `<option value="">${escapeHtml(label)}</option>` +
      entries
        .map(function (entry) {
          const value = entry[0];
          const count = entry[1];
          const sel = selected === value ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(value)} (${count})</option>`;
        })
        .join("");
  }

  function syncClassicControls(params, options, resultCount) {
    const classic = document.querySelector("[data-materials-list-classic]");
    if (!classic || classic.hidden) return;
    const qInput = classic.querySelector("[data-materials-all-q]");
    const sortSel = classic.querySelector("[data-materials-all-sort]");
    if (qInput && qInput.value !== params.q) qInput.value = params.q;
    if (sortSel) {
      const sortValue = params.sort === "newest" ? "newest" : "popular";
      if (sortSel.value !== sortValue) sortSel.value = sortValue;
    }
    fillFilterSelect(classic.querySelector('[data-materials-all-filter="usage"]'), "用途", options.usages, params.usage);
    fillFilterSelect(classic.querySelector('[data-materials-all-filter="format"]'), "形式", options.formats, params.format);
    fillFilterSelect(classic.querySelector('[data-materials-all-filter="style"]'), "スタイル", options.styles, params.style);
    fillFilterSelect(classic.querySelector('[data-materials-all-filter="color"]'), "カラー", options.colors, params.color);
    const countEl = classic.querySelector("[data-materials-all-count]");
    if (countEl) {
      countEl.innerHTML = `検索結果：<strong>${Number(resultCount) || 0}</strong>件`;
    }
  }

  function restrictAllDiscovery(items) {
    const data = global.TasuMaterialsData;
    if (typeof data?.filterPrimaryDiscoveryItems === "function") {
      return data.filterPrimaryDiscoveryItems(items);
    }
    const allowed = new Set(data && data.LIST_PRIMARY_CATEGORY_IDS);
    if (!allowed.size) return items || [];
    return (items || []).filter(function (item) {
      return allowed.has(item && item.category_id);
    });
  }

  async function fetchListItems(repo, params) {
    const { q, sort, category } = params;
    const filterId = categoryToFilterId(category);
    const sortKey = sort === "newest" ? "newest" : "popular";
    let items;

    if (q) {
      items = await repo.searchItems(q);
      if (filterId) {
        items = items.filter(function (item) {
          return item.category_id === filterId;
        });
      } else {
        // すべて + search: primary discovery only. Legacy stays on ?category=template etc.
        items = restrictAllDiscovery(items);
      }
      items = sortItems(items, sortKey);
    } else if (filterId) {
      items = await repo.fetchItemsByCategory(filterId);
      items = sortItems(items, sortKey);
    } else {
      items = restrictAllDiscovery(await repo.fetchAllItems(sortKey));
    }

    const options = collectCommonFilterOptions(items || []);
    const filtered = applyCommonFilters(items || [], params);
    return { items: filtered, options };
  }

  function listPageSize() {
    const n = Number(global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE);
    return Number.isFinite(n) && n > 0 ? n : 12;
  }

  function renderClassicChips(category) {
    const nav = document.querySelector("[data-materials-list-chips]");
    if (!nav) return;
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    if (!Array.isArray(chips) || !chips.length) return;
    const activeCategory = category || "";
    nav.innerHTML = chips
      .map(function (c) {
        const id = c.id || "";
        const active = id === activeCategory;
        return (
          `<button type="button" class="materials-list-chip${active ? " is-active" : ""}" data-materials-list-chip data-category="${escapeHtml(id)}"${active ? ' aria-current="true"' : ""}>${escapeHtml(c.label)}</button>`
        );
      })
      .join("");
  }

  function syncChipState(category) {
    renderClassicChips(category);
  }

  function renderClassicPager(page, totalPages) {
    const nav = document.querySelector("[data-materials-all-pager]");
    if (!nav) return;
    if (totalPages <= 1) {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }
    nav.hidden = false;
    const buttons = [];
    buttons.push(
      `<button type="button" class="materials-all-pager__btn" data-materials-all-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      buttons.push(`<button type="button" class="materials-all-pager__btn" data-materials-all-page="1">1</button>`);
      if (start > 2) buttons.push(`<span class="materials-all-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(
        `<button type="button" class="materials-all-pager__btn${p === page ? " is-active" : ""}" data-materials-all-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
      );
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="materials-all-pager__ellipsis">…</span>`);
      buttons.push(
        `<button type="button" class="materials-all-pager__btn" data-materials-all-page="${totalPages}">${totalPages}</button>`
      );
    }
    buttons.push(
      `<button type="button" class="materials-all-pager__btn" data-materials-all-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    nav.innerHTML = buttons.join("");
  }

  function resolveCategoryRenderer(categoryId) {
    const map = {
      template: global.TasuMaterialsTemplateList,
      bgm: global.TasuMaterialsBgmList,
      sfx: global.TasuMaterialsSfxList,
      image: global.TasuMaterialsImageList,
      illustration: global.TasuMaterialsIllustrationList,
      background: global.TasuMaterialsBackgroundList,
      icon: global.TasuMaterialsIconList,
      web: global.TasuMaterialsWebList,
      code: global.TasuMaterialsCodeList,
      document: global.TasuMaterialsDocumentList,
      presentation: global.TasuMaterialsPresentationList,
    };
    return map[categoryId] || null;
  }

  function renderCategoryCard(item) {
    const specialty = resolveCategoryRenderer(item.category_id);
    if (specialty?.renderCard) {
      const html = specialty.renderCard(item);
      // BGM utilities are scoped under [data-bgm-list]; host enables reuse in mixed grid.
      if (item.category_id === "bgm") {
        return `<div class="mat-all-card-host" data-bgm-list data-mat-all-host="bgm">${html}</div>`;
      }
      return html;
    }
    // tool（専用一覧未移植）など — 現行ツール一覧と同じ DownloadCard
    const card = global.TasuMaterialsDownloadCard;
    return card ? card.renderDownloadCard(item, { variant: "list" }) : "";
  }

  function wireMixedListContracts(root, items) {
    if (!root || !items?.length) return;
    const byId = new Map(items.map(function (it) {
      return [it.id, it];
    }));
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;

    root.querySelectorAll("[data-item-id]").forEach(function (card) {
      const id = card.getAttribute("data-item-id");
      const item = byId.get(id);
      if (!item) return;
      const specialty = resolveCategoryRenderer(item.category_id);
      if (specialty?.wireCard) {
        specialty.wireCard(card, item);
        return;
      }
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function renderEmptyState(kind, label) {
    if (kind === "catalog") {
      return (
        `<div class="materials-list-empty materials-list-empty--catalog" data-materials-empty="catalog">` +
        `<p class="materials-list-empty__title">${escapeHtml(label)}の公開素材はまだありません。</p>` +
        `<p class="materials-list-empty__text">在庫は0件です。仮の素材は表示しません。</p>` +
        `</div>`
      );
    }
    return '<p class="materials-list-empty" data-materials-empty="filter">該当する素材がありません。</p>';
  }

  function renderGrid(root, items, emptyKind, emptyLabel) {
    if (!root) return;
    if (!items.length) {
      root.innerHTML = renderEmptyState(emptyKind, emptyLabel);
      return;
    }
    root.innerHTML =
      '<div class="materials-all-card-grid" data-materials-all-grid>' +
      items
        .map(function (item) {
          return renderCategoryCard(item);
        })
        .join("") +
      "</div>";
    wireMixedListContracts(root, items);
  }

  function setCategoryInUrl(category) {
    const url = new URL(global.location.href);
    if (category) {
      url.searchParams.set("category", category);
    } else {
      url.searchParams.delete("category");
    }
    // Leaving specialty Option4 clears specialty-only query keys so classic list stays clean.
    if (
      category !== "sfx" &&
      category !== "bgm" &&
      category !== "image" &&
      category !== "illustration" &&
      category !== "background" &&
      category !== "icon" &&
      category !== "web" &&
      category !== "code" &&
      category !== "text" &&
      category !== "presentation" &&
      category !== "template"
    ) {
      [
        "usage",
        "length",
        "format",
        "tag",
        "mood",
        "tempo",
        "genre",
        "sub",
        "orientation",
        "color",
        "people",
        "size",
        "style",
        "pattern",
        "brightness",
        "stroke",
        "shape",
        "cat",
        "layout",
        "page",
        "qa_fixture",
      ].forEach(function (key) {
        url.searchParams.delete(key);
      });
    } else if (category === "sfx") {
      ["mood", "tempo", "genre", "sub", "orientation", "color", "people", "size", "style", "pattern", "brightness", "stroke", "shape", "cat", "qa_fixture"].forEach(
        function (key) {
          url.searchParams.delete(key);
        }
      );
    } else if (category === "bgm") {
      ["tag", "sub", "orientation", "color", "people", "size", "style", "pattern", "brightness", "stroke", "shape", "cat", "qa_fixture"].forEach(function (key) {
        url.searchParams.delete(key);
      });
    } else if (category === "image") {
      ["mood", "tempo", "genre", "length", "style", "pattern", "brightness", "stroke", "shape", "cat", "qa_fixture"].forEach(function (key) {
        url.searchParams.delete(key);
      });
    } else if (category === "illustration") {
      ["mood", "tempo", "genre", "length", "sub", "size", "pattern", "brightness", "stroke", "shape", "cat", "qa_fixture"].forEach(function (key) {
        url.searchParams.delete(key);
      });
    } else if (category === "background") {
      ["mood", "tempo", "genre", "length", "people", "size", "stroke", "shape", "cat"].forEach(function (key) {
        url.searchParams.delete(key);
      });
    } else if (category === "icon") {
      ["mood", "tempo", "genre", "length", "people", "orientation", "pattern", "brightness", "layout", "qa_fixture"].forEach(function (key) {
        url.searchParams.delete(key);
      });
    } else if (category === "web") {
      ["mood", "tempo", "genre", "length", "people", "orientation", "pattern", "brightness", "stroke", "shape", "qa_fixture"].forEach(
        function (key) {
          url.searchParams.delete(key);
        }
      );
    } else if (category === "code") {
      ["mood", "tempo", "genre", "length", "people", "orientation", "pattern", "brightness", "stroke", "shape", "style", "size", "layout", "qa_fixture"].forEach(
        function (key) {
          url.searchParams.delete(key);
        }
      );
    } else if (category === "text") {
      ["mood", "tempo", "genre", "people", "orientation", "pattern", "brightness", "stroke", "shape", "style", "size", "layout", "framework", "license", "lang", "format"].forEach(
        function (key) {
          url.searchParams.delete(key);
        }
      );
    } else if (category === "presentation") {
      ["mood", "tempo", "genre", "length", "people", "orientation", "pattern", "brightness", "stroke", "shape", "layout", "framework", "license", "lang", "qa_fixture"].forEach(
        function (key) {
          url.searchParams.delete(key);
        }
      );
    } else if (category === "template") {
      ["mood", "tempo", "genre", "length", "people", "orientation", "pattern", "brightness", "stroke", "shape", "layout", "framework", "license", "lang", "size", "cat", "qa_fixture"].forEach(
        function (key) {
          url.searchParams.delete(key);
        }
      );
    }
    global.history.pushState({ materialsListCategory: category }, "", url);
  }

  function wireCategoryChips(refresh) {
    const nav = document.querySelector("[data-materials-list-chips]");
    if (!nav) return;

    nav.addEventListener("click", function (event) {
      const btn = event.target.closest("[data-materials-list-chip]");
      if (!btn || !nav.contains(btn)) return;

      const category = normalizeCategory(btn.getAttribute("data-category"));
      const current = readListParams().category;
      if (category === current) return;

      setCategoryInUrl(category);
      refresh().catch(function () {});
    });
  }

  function wireClassicSearchFilters(refresh) {
    const classic = document.querySelector("[data-materials-list-classic]");
    if (!classic || classic.dataset.allToolsWired === "1") return;
    classic.dataset.allToolsWired = "1";

    function classicOnlyCategory(current) {
      // tool + video-first empty categories share the classic list mount.
      return isClassicListCategory(current.category) ? current.category : "";
    }

    classic.querySelector("[data-materials-all-search]")?.addEventListener("submit", function (ev) {
      ev.preventDefault();
      const current = readListParams();
      const q = classic.querySelector("[data-materials-all-q]")?.value || "";
      writeClassicUrlState(
        {
          ...current,
          category: classicOnlyCategory(current),
          q: String(q).trim(),
          sort: current.sort === "newest" ? "newest" : "popular",
          page: 1,
        },
        false
      );
      refresh().catch(function () {});
    });

    classic.querySelector("[data-materials-all-sort]")?.addEventListener("change", function (ev) {
      const current = readListParams();
      const sort = ev.target.value === "newest" ? "newest" : "popular";
      writeClassicUrlState({ ...current, category: classicOnlyCategory(current), sort, page: 1 }, false);
      refresh().catch(function () {});
    });

    classic.querySelector("[data-materials-all-filters]")?.addEventListener("change", function (ev) {
      const target = ev.target.closest("[data-materials-all-filter]");
      if (!target) return;
      const current = readListParams();
      writeClassicUrlState(
        {
          ...current,
          category: classicOnlyCategory(current),
          usage: classic.querySelector('[data-materials-all-filter="usage"]')?.value || "",
          format: classic.querySelector('[data-materials-all-filter="format"]')?.value || "",
          style: classic.querySelector('[data-materials-all-filter="style"]')?.value || "",
          color: classic.querySelector('[data-materials-all-filter="color"]')?.value || "",
          page: 1,
        },
        false
      );
      refresh().catch(function () {});
    });

    classic.querySelector("[data-materials-all-clear]")?.addEventListener("click", function () {
      const current = readListParams();
      writeClassicUrlState(
        {
          category: classicOnlyCategory(current),
          q: "",
          sort: "popular",
          usage: "",
          format: "",
          style: "",
          color: "",
          page: 1,
        },
        false
      );
      refresh().catch(function () {});
    });

    classic.querySelector("[data-materials-all-pager]")?.addEventListener("click", function (ev) {
      const btn = ev.target.closest("[data-materials-all-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-materials-all-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      const current = readListParams();
      writeClassicUrlState({ ...current, category: classicOnlyCategory(current), page }, false);
      refresh().catch(function () {});
    });
  }

  async function refreshListPage() {
    const SfxList = global.TasuMaterialsSfxList;
    const BgmList = global.TasuMaterialsBgmList;
    const ImageList = global.TasuMaterialsImageList;
    const IllustrationList = global.TasuMaterialsIllustrationList;
    const BackgroundList = global.TasuMaterialsBackgroundList;
    const IconList = global.TasuMaterialsIconList;
    const WebList = global.TasuMaterialsWebList;
    const CodeList = global.TasuMaterialsCodeList;
    const DocumentList = global.TasuMaterialsDocumentList;
    const PresentationList = global.TasuMaterialsPresentationList;
    const TemplateList = global.TasuMaterialsTemplateList;
    const params = readListParams();

    function hideAllSpecialtyExcept(keep) {
      if (keep !== "sfx") SfxList?.hide?.();
      if (keep !== "bgm") BgmList?.hide?.();
      if (keep !== "image") ImageList?.hide?.();
      if (keep !== "illustration") IllustrationList?.hide?.();
      if (keep !== "background") BackgroundList?.hide?.();
      if (keep !== "icon") IconList?.hide?.();
      if (keep !== "web") WebList?.hide?.();
      if (keep !== "code") CodeList?.hide?.();
      if (keep !== "document") DocumentList?.hide?.();
      if (keep !== "presentation") PresentationList?.hide?.();
      if (keep !== "template") TemplateList?.hide?.();
    }

    if (params.category === "sfx" && SfxList?.mount) {
      hideAllSpecialtyExcept("sfx");
      await SfxList.mount();
      return;
    }

    if (params.category === "bgm" && BgmList?.mount) {
      hideAllSpecialtyExcept("bgm");
      await BgmList.mount();
      return;
    }

    if (params.category === "image" && ImageList?.mount) {
      hideAllSpecialtyExcept("image");
      await ImageList.mount();
      return;
    }

    if (params.category === "illustration" && IllustrationList?.mount) {
      hideAllSpecialtyExcept("illustration");
      await IllustrationList.mount();
      return;
    }

    if (params.category === "background" && BackgroundList?.mount) {
      hideAllSpecialtyExcept("background");
      await BackgroundList.mount();
      return;
    }

    if (params.category === "icon" && IconList?.mount) {
      hideAllSpecialtyExcept("icon");
      await IconList.mount();
      return;
    }

    if (params.category === "web" && WebList?.mount) {
      hideAllSpecialtyExcept("web");
      await WebList.mount();
      return;
    }

    if (params.category === "code" && CodeList?.mount) {
      hideAllSpecialtyExcept("code");
      await CodeList.mount();
      return;
    }

    if (params.category === "text" && DocumentList?.mount) {
      hideAllSpecialtyExcept("document");
      await DocumentList.mount();
      return;
    }

    if (params.category === "presentation" && PresentationList?.mount) {
      hideAllSpecialtyExcept("presentation");
      await PresentationList.mount();
      return;
    }

    if (params.category === "template" && TemplateList?.mount) {
      hideAllSpecialtyExcept("template");
      await TemplateList.mount();
      return;
    }

    hideAllSpecialtyExcept(null);

    const classic = document.querySelector("[data-materials-list-classic]");
    if (classic) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }

    const data = global.TasuMaterialsData;
    const root = document.querySelector("[data-materials-list-grid]");
    if (!data || !root) return;

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* metrics optional */
    }

    // Stop audio when leaving specialty audio lists for「すべて」/tool classic.
    global.TasuMaterialsSfxList?.stopAudio?.();
    global.TasuMaterialsBgmList?.stopAudio?.();

    syncChipState(params.category);
    const fetched = await fetchListItems(data.repository, params);
    const items = fetched.items || [];
    syncClassicControls(params, fetched.options || { usages: new Map(), formats: new Map(), tags: new Map() }, items.length);
    const pageSize = listPageSize();
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
    const page = Math.min(Math.max(1, params.page || 1), totalPages);
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    const filterId = categoryToFilterId(params.category);
    const inventory = typeof data.countPublishedInventoryByCategory === "function"
      ? data.countPublishedInventoryByCategory()
      : {};
    const inventoryCount = filterId ? Number(inventory[filterId] || 0) : -1;
    const hasExtraFilters = Boolean(
      params.q || params.usage || params.format || params.style || params.color
    );
    const emptyKind = filterId && inventoryCount === 0 && !hasExtraFilters ? "catalog" : "filter";
    renderGrid(root, pageItems, emptyKind, listChipLabel(params.category));
    renderClassicPager(page, items.length ? totalPages : 1);

    // Confirmed text search execution (covers keyword links / shared URLs)
    try {
      const q = String(params.q || "").trim();
      if (q.length >= 2) {
        const filterId = categoryToFilterId(params.category);
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: filterId || null,
            result_count: items.length,
          }),
        ).catch(function () {});
      }
    } catch {
      /* analytics failure != search failure */
    }
  }

  async function mountListPage() {
    wireCategoryChips(refreshListPage);
    wireClassicSearchFilters(refreshListPage);
    global.addEventListener("popstate", function () {
      refreshListPage().catch(function () {});
    });
    await refreshListPage();
  }

  global.TasuMaterialsListPage = {
    mountListPage,
    readListParams,
    normalizeCategory,
    isClassicListCategory,
    listChipLabel,
    resolveCategoryRenderer,
    renderCategoryCard,
    wireMixedListContracts,
  };

  if (document.body && document.body.getAttribute("data-page") === "materials_list") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        mountListPage().catch(function () {});
      });
    } else {
      mountListPage().catch(function () {});
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

/**
 * TASFUL Materials — テンプレート一覧 STC Exact Transplant
 * Source: user STC HTML（presentation-list shell）→ category=template Inventory 再接続
 * Search / Sort / Filter / Clear / Favorite / Download / Detail / Pagination — 既存 Contract
 * schema / API / Store 変更なし。Platform Header は list.html 側を維持（STC Header は入れない）。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "テンプレート";
  const QUERY_CATEGORY = "template";
  const DATA_CATEGORY = "template";
  const ACCENT = "#4f46e5";

  const GENERIC_TAGS = new Set([
    "template",
    "テンプレート",
    "ja",
    "xlsx",
    "xls",
    "pdf",
    "ai",
    "psd",
  ]);

  const SIDE_CATS = Object.freeze([
    { key: "名刺", id: "BUSINESS_CARD", tag: "名刺", icon: "far fa-address-card" },
    { key: "POP", id: "POP", tag: "POP", icon: "far fa-rectangle-ad" },
    { key: "チラシ", id: "FLYER", tag: "チラシ", icon: "far fa-newspaper" },
    { key: "メニュー・料金表", id: "MENU_PRICE_LIST", tag: "料金表", icon: "far fa-rectangle-list" },
    { key: "ショップカード", id: "SHOP_CARD", tag: "ショップカード", icon: "far fa-id-card" },
    { key: "提案書・企画書", tag: "提案", icon: "far fa-file-alt" },
    { key: "会社紹介・IR", tag: "会社紹介", icon: "far fa-building", uiOnly: true },
    { key: "ピッチデッキ", tag: "ピッチ", icon: "far fa-chart-bar", uiOnly: true },
    { key: "セミナー・講演", tag: "セミナー", icon: "far fa-comment-alt", uiOnly: true },
    { key: "事業計画・戦略", tag: "事業計画", icon: "far fa-lightbulb", uiOnly: true },
    { key: "マーケティング", tag: "マーケティング", icon: "far fa-paper-plane", uiOnly: true },
    { key: "報告書・レポート", tag: "報告書", icon: "far fa-clipboard", uiOnly: true },
    { key: "教育・研修", tag: "教育", icon: "fas fa-graduation-cap", uiOnly: true },
    { key: "請求書・経理", tag: "請求書", icon: "far fa-file-alt" },
  ]);

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickStr(...vals) {
    for (let i = 0; i < vals.length; i += 1) {
      const s = String(vals[i] ?? "").trim();
      if (s) return s;
    }
    return "";
  }

  function formatCount(n) {
    return (Number(n) || 0).toLocaleString("ja-JP");
  }

  function enrichItem(raw) {
    const data = global.TasuMaterialsData;
    if (data?.enrichDetail) return data.enrichDetail(raw) || raw;
    return raw;
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }

  function resolveThumbSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    const first = images[0];
    const fromPreview = pickStr(first && (first.src || first.url || first), typeof first === "string" ? first : "");
    const candidates = [
      fromPreview,
      item.thumbnail_url,
      item.preview_image,
      item.preview_url,
      item.image_url,
      item.image,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const u = pickStr(candidates[i]);
      if (u && isImageUrl(u)) return u;
    }
    return "";
  }

  function thumbStyleClass(item) {
    const style = pickStr(item.thumbnail_style, "template-card");
    return `materials-card__thumb--${style}`;
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function listHref(category) {
    if (!category) return "/materials/list.html";
    return `/materials/list.html?category=${encodeURIComponent(category)}`;
  }

  function detailHref(item) {
    return `/materials/detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    const sortRaw = params.get("sort") || "popular";
    const sort = sortRaw === "newest" || sortRaw === "downloads" ? sortRaw : "popular";
    return {
      q: params.get("q") || "",
      sort,
      usage: params.get("usage") || "",
      industry: params.get("industry") || "",
      style: params.get("style") || "",
      color: params.get("color") || "",
      format: params.get("format") || "",
      genre: params.get("genre") || params.get("sub") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", QUERY_CATEGORY);
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    url.searchParams.delete("kind");
    setOrDel("usage", next.usage);
    setOrDel("industry", next.industry);
    setOrDel("style", next.style);
    setOrDel("color", next.color);
    url.searchParams.delete("pages");
    url.searchParams.delete("ratio");
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    if (next.page > 1) url.searchParams.set("page", String(next.page));
    else url.searchParams.delete("page");
    const method = replace ? "replaceState" : "pushState";
    global.history[method]({ materialsListCategory: QUERY_CATEGORY }, "", url);
  }

  function sortLabel(sort) {
    if (sort === "newest") return "新着順";
    if (sort === "downloads") return "ダウンロード順";
    return "人気順";
  }

  function collectFilterOptions(items) {
    const usages = new Map();
    const styles = new Map();
    const industries = new Map();
    const colors = new Map();
    const formats = new Map();
    const tags = new Map();
    items.forEach((item) => {
      const usage = pickStr(item.use_case);
      if (usage) usages.set(usage, (usages.get(usage) || 0) + 1);
      const style = pickStr(item.style);
      if (style) styles.set(style, (styles.get(style) || 0) + 1);
      const industry = pickStr(item.industry);
      if (industry) industries.set(industry, (industries.get(industry) || 0) + 1);
      const color = pickStr(item.color_family);
      if (color) colors.set(color, (colors.get(color) || 0) + 1);
      itemTags(item).forEach((t) => {
        tags.set(t, (tags.get(t) || 0) + 1);
      });
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
    });
    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts
      ? GF.collectDemandCounts(items, "template")
      : Object.fromEntries(SIDE_CATS.map((cat) => [cat.key, countBySideKey(items, cat.key)]));
    return { usages, styles, industries, colors, formats, tags, genreCounts };
  }

  function metadataHaystack(item) {
    return [
      ...(item.tags || []),
      ...(item.search_keywords || []),
      item.title,
      item.description,
      item.subcategory,
      item.slug,
      item.category,
      item.use_case,
      item.industry,
      item.style,
      item.layout,
      item.orientation,
      item.color_family,
      item.season,
      item.target,
      item.size,
      ...(Array.isArray(item.feature) ? item.feature : [item.feature]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function applyFilters(items, filters) {
    return items.filter((item) => {
      const hay = metadataHaystack(item);
      if (filters.kind && pickStr(item.subcategory) !== filters.kind) return false;
      if (filters.usage) {
        if (pickStr(item.use_case) !== filters.usage) return false;
      }
      if (filters.style && pickStr(item.style) !== filters.style) return false;
      if (filters.industry && pickStr(item.industry) !== filters.industry) return false;
      if (filters.color && pickStr(item.color_family) !== filters.color) return false;
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.tag && !hay.includes(String(filters.tag).toLowerCase())) return false;
      const genreKey = filters.genre || filters.sub;
      if (genreKey) {
        if (global.TasuMaterialsGenreFilter?.matchListGenre) {
          if (!global.TasuMaterialsGenreFilter.matchListGenre(item, "template", genreKey)) return false;
        } else {
          const cat = SIDE_CATS.find((c) => c.key === genreKey);
          if (cat?.id && String(item.category || "") !== cat.id) return false;
          if (!cat?.id && cat?.tag && !hay.includes(String(cat.tag).toLowerCase())) return false;
          if (cat?.uiOnly) return false;
        }
      }
      return true;
    });
  }

  function countBySideKey(items, key) {
    const cat = SIDE_CATS.find((c) => c.key === key);
    if (!cat || cat.uiOnly || !cat.tag) return 0;
    return items.filter((item) => {
      if (cat.id) return String(item.category || "") === cat.id;
      return metadataHaystack(item).includes(String(cat.tag).toLowerCase());
    }).length;
  }

  function renderFilterSelect(key, label, optionsMap, selected, disabled, widthClass) {
    const entries = [...optionsMap.entries()].sort((a, b) => b[1] - a[1]);
    const isDisabled = !!disabled || entries.length === 0;
    const opts = entries
      .map(([val]) => `<option value="${escapeHtml(val)}"${selected === val ? " selected" : ""}>${escapeHtml(val)}</option>`)
      .join("");
    return (
      `<div class="mat-tpl-filter ${widthClass || ""}">` +
      `<select data-tpl-filter="${escapeHtml(key)}" aria-label="${escapeHtml(label)}"${isDisabled ? " disabled" : ""}>` +
      `<option value="">${escapeHtml(label)}</option>` +
      opts +
      `</select>` +
      `<i class="fas fa-chevron-down mat-tpl-filter__chev" aria-hidden="true"></i>` +
      `</div>`
    );
  }

  function renderPager(page, totalPages) {
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-tpl-pager__btn" data-tpl-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>`
    );
    if (totalPages <= 1) {
      buttons.push(`<button type="button" class="mat-tpl-pager__btn is-active" disabled>1</button>`);
    } else {
      const maxShow = 5;
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, start + maxShow - 1);
      start = Math.max(1, end - maxShow + 1);
      for (let i = start; i <= end; i += 1) {
        buttons.push(
          `<button type="button" class="mat-tpl-pager__btn${i === page ? " is-active" : ""}" data-tpl-page="${i}">${i}</button>`
        );
      }
      if (end < totalPages) {
        buttons.push(`<span class="mat-tpl-pager__ellipsis">…</span>`);
        buttons.push(`<button type="button" class="mat-tpl-pager__btn" data-tpl-page="${totalPages}">${totalPages}</button>`);
      }
    }
    buttons.push(
      `<button type="button" class="mat-tpl-pager__btn" data-tpl-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>`
    );
    return `<div class="mat-tpl-pager" data-tpl-pager>${buttons.join("")}</div>`;
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = !!Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const tags = itemTags(item).slice(0, 3);
    const desc = pickStr(item.description);
    const free = item.is_free !== false;

    return (
      `<article class="mat-tpl-card" data-tpl-card data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mat-tpl-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (free ? `<span class="mat-tpl-card__free">無料</span>` : "") +
      (thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-tpl-card__placeholder ${escapeHtml(thumbStyleClass(item))}" aria-hidden="true">` +
          `<i class="fas fa-desktop"></i>` +
          `<span>プレビュー準備中</span>` +
          `</span>`) +
      `</a>` +
      `<div class="mat-tpl-card__body">` +
      `<h3 class="mat-tpl-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-tpl-card__desc">${escapeHtml(desc || " ")}</p>` +
      `<div class="mat-tpl-card__tags">` +
      tags.map((t) => `<span class="mat-tpl-card__tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-tpl-card__foot">` +
      `<span class="mat-tpl-card__stat"><i class="fas fa-star" aria-hidden="true"></i>${rating}</span>` +
      `<span class="mat-tpl-card__stat"><i class="fas fa-download" aria-hidden="true"></i>${dl}</span>` +
      `<div class="mat-tpl-card__actions">` +
      `<button type="button" class="mat-tpl-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<i class="${favOn ? "fas" : "far"} fa-heart" aria-hidden="true"></i>` +
      `</button>` +
      `<button type="button" class="mat-tpl-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<i class="fas fa-download" aria-hidden="true"></i>` +
      `</button>` +
      `</div></div></div></article>`
    );
  }

  function renderShell(ctx) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, baseItems } = ctx;

    const chips = listCategoryChips().map((c) => {
      const active = c.id === QUERY_CATEGORY;
      return `<a class="mat-tpl-chip${active ? " is-active" : ""}" href="${listHref(c.id)}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(c.label)}</a>`;
    }).join("");

    const activeFilters = [
      `<span class="mat-tpl-active-chip">テンプレート <button type="button" class="mat-tpl-active-chip__x" data-tpl-clear aria-label="解除"><i class="fas fa-times" aria-hidden="true"></i></button></span>`,
      `<span class="mat-tpl-active-chip mat-tpl-active-chip--rose">${escapeHtml(sortLabel(sort))} <button type="button" class="mat-tpl-active-chip__x" data-tpl-clear-sort aria-label="解除"><i class="fas fa-times" aria-hidden="true"></i></button></span>`,
    ];
    if (filters.genre) activeFilters.push(`<span class="mat-tpl-active-chip">${escapeHtml(filters.genre)}</span>`);
    if (filters.usage) activeFilters.push(`<span class="mat-tpl-active-chip">${escapeHtml(filters.usage)}</span>`);
    if (filters.style) activeFilters.push(`<span class="mat-tpl-active-chip">${escapeHtml(filters.style)}</span>`);
    if (q) activeFilters.push(`<span class="mat-tpl-active-chip">「${escapeHtml(q)}」</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: DATA_CATEGORY }) || "";

    const usageEntries = [...options.usages.entries()].sort((a, b) => b[1] - a[1]);
    const tagEntries = [...options.tags.entries()].sort((a, b) => b[1] - a[1]);
    const popularUses =
      (usageEntries.length ? usageEntries : tagEntries)
        .slice(0, 8)
        .map(([tag, count]) => {
          const attr = usageEntries.length ? "data-tpl-usage-tag" : "data-tpl-tag";
          return (
            `<button type="button" class="mat-tpl-popular" ${attr}="${escapeHtml(tag)}">` +
            `<span class="mat-tpl-popular__label">${escapeHtml(tag)}</span>` +
            `<span class="mat-tpl-popular__n">${formatCount(count)}</span>` +
            `</button>`
          );
        })
        .join("") || `<p class="mat-tpl-side-empty">用途データはまだありません。</p>`;

    return (
      `<div class="mat-tpl-layout" data-tpl-list style="--mat-tpl-ops:${ACCENT}">` +
      `<div class="mat-tpl-main">` +
      `<div class="mat-tpl-panel">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-tpl-head">` +
      `<div class="mat-tpl-head__ico" aria-hidden="true"><i class="fas fa-desktop"></i></div>` +
      `<h1 class="mat-tpl-head__title">テンプレート一覧</h1>` +
      `<p class="mat-tpl-head__lead">名刺・請求書・チラシなど、すぐに使えるテンプレートを探せます</p>` +
      `</div>` +
      `<form class="mat-tpl-search" data-tpl-search role="search">` +
      `<div class="mat-tpl-search__field">` +
      `<i class="fas fa-search mat-tpl-search__ico" aria-hidden="true"></i>` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：請求書、名刺、チラシ、ビジネス）" data-tpl-q aria-label="テンプレートを検索">` +
      `</div>` +
      `<button type="submit" class="mat-tpl-search__btn">検索</button>` +
      `<div class="mat-tpl-sort">` +
      `<select data-tpl-sort aria-label="並び替え">` +
      `<option value="popular"${sort === "popular" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `<option value="downloads"${sort === "downloads" ? " selected" : ""}>ダウンロード順</option>` +
      `</select>` +
      `<i class="fas fa-chevron-down" aria-hidden="true"></i>` +
      `</div>` +
      `</form>` +
      `<div class="mat-tpl-chips mat-list-m-chips">${chips}</div>` +
      `<div class="mat-tpl-filters mat-list-m-filters" data-tpl-filters>` +
      `<div class="mat-tpl-filter mat-tpl-filter--sm">${
        global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
          categoryId: "template",
          selected: filters.genre,
          counts: options.genreCounts,
          dataAttr: "data-tpl-filter",
          includeZero: true,
          label: "ジャンル",
        }) || ""
      }</div>` +
      renderFilterSelect("usage", "用途", options.usages, filters.usage, options.usages.size === 0, "mat-tpl-filter--sm") +
      renderFilterSelect("industry", "業種", options.industries, filters.industry, options.industries.size === 0, "mat-tpl-filter--sm") +
      renderFilterSelect("style", "スタイル", options.styles, filters.style, options.styles.size === 0, "mat-tpl-filter--lg") +
      renderFilterSelect("color", "カラー", options.colors, filters.color, options.colors.size === 0, "mat-tpl-filter--sm") +
      renderFilterSelect("format", "形式", options.formats, filters.format, options.formats.size === 0, "mat-tpl-filter--sm") +
      `<button type="button" class="mat-tpl-clear" data-tpl-clear>すべてクリア</button>` +
      `<span class="mat-tpl-count">検索結果：${formatCount(resultCount)}件</span>` +
      `</div>` +
      `<div class="mat-tpl-grid" data-tpl-grid>` +
      (cardsHtml || `<p class="mat-tpl-empty">該当するテンプレートがありません。</p>`) +
      `</div>` +
      renderPager(page, totalPages) +
      `<div class="mat-tpl-cta">` +
      `<div class="mat-tpl-cta__ico" aria-hidden="true"><i class="far fa-credit-card"></i></div>` +
      `<div class="mat-tpl-cta__copy">` +
      `<h2>高品質なテンプレートを無料でダウンロード</h2>` +
      `<p>商用利用OK・クレジット表記不要のテンプレートを無料でダウンロードできます。</p>` +
      `<p>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-tpl-cta__btn" href="/login.html">無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<aside class="mat-tpl-aside" aria-label="絞り込みサイドバー">` +
      `<div class="mat-tpl-side-card">` +
      `<h3 class="mat-tpl-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-tpl-side-active">${activeFilters.join("")}` +
      `<button type="button" class="mat-tpl-side-clear" data-tpl-clear>すべてクリア</button>` +
      `</div></div>` +
      `<div class="mat-tpl-side-card">` +
      `<h3 class="mat-tpl-side-card__title">カテゴリ</h3>` +
      `<div class="mat-tpl-side-cats">${sideCats}</div>` +
      `<a class="mat-tpl-side-more" href="${global.TasuMaterialsListSidebar?.listHref?.("") || "list.html"}">すべてのカテゴリを見る <i class="fas fa-chevron-right" aria-hidden="true"></i></a>` +
      `</div>` +
      `<div class="mat-tpl-side-card">` +
      `<h3 class="mat-tpl-side-card__title">人気の用途</h3>` +
      `<div class="mat-tpl-popular-wrap">${popularUses}</div>` +
      `<a class="mat-tpl-side-more" href="${listHref(QUERY_CATEGORY)}">すべての用途を見る <i class="fas fa-chevron-right" aria-hidden="true"></i></a>` +
      `</div>` +
      `<div class="mat-tpl-side-card">` +
      `<div class="mat-tpl-side-fav">` +
      `<div class="mat-tpl-side-fav__ico" aria-hidden="true"><i class="far fa-heart"></i></div>` +
      `<div>` +
      `<h3>お気に入りに保存</h3>` +
      `<p>気になる素材を保存して<br>後からまとめてダウンロードできます</p>` +
      `</div></div>` +
      `<div class="mat-tpl-side-fav__foot">` +
      `<span class="mat-tpl-side-fav__swatch" aria-hidden="true"></span>` +
      `<a class="mat-tpl-side-howto" href="/materials/">使い方を見る</a>` +
      `</div></div>` +
      `</aside>` +
      `</div>`
    );
  }

  async function loadBaseItems(urlState) {
    const repo = global.TasuMaterialsData?.repository;
    if (!repo) return [];
    let items;
    if (urlState.q) {
      items = await repo.searchItems(urlState.q);
      items = (items || []).filter((i) => i.category_id === DATA_CATEGORY);
    } else {
      const sortKey = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchAllItems(sortKey);
      items = (items || []).filter((i) => i.category_id === DATA_CATEGORY);
    }
    items = (items || []).map((raw) => enrichItem(raw));
    if (urlState.sort === "downloads") {
      items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
    } else if (urlState.sort === "newest") {
      items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    } else {
      items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
    }
    return items;
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-tpl-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-tpl-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-tpl-sort]")?.addEventListener("change", (ev) => {
      const v = ev.target.value;
      const sort = v === "newest" || v === "downloads" ? v : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-tpl-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        writeUrlState(
          {
            ...urlState,
            genre: root.querySelector('[data-tpl-filter="genre"]')?.value || "",
            usage: root.querySelector('[data-tpl-filter="usage"]')?.value || "",
            industry: root.querySelector('[data-tpl-filter="industry"]')?.value || "",
            style: root.querySelector('[data-tpl-filter="style"]')?.value || "",
            color: root.querySelector('[data-tpl-filter="color"]')?.value || "",
            format: root.querySelector('[data-tpl-filter="format"]')?.value || "",
            page: 1,
          },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-tpl-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          {
            q: "",
            sort: "popular",
            genre: "",
            usage: "",
            industry: "",
            style: "",
            color: "",
            format: "",
            tag: "",
            page: 1,
          },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-tpl-clear-sort]")?.addEventListener("click", () => {
      writeUrlState({ ...urlState, sort: "popular", page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-tpl-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const sub = btn.getAttribute("data-tpl-sub") || "";
        writeUrlState({ ...urlState, genre: urlState.genre === sub ? "" : sub, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-tpl-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-tpl-tag") || "";
        writeUrlState({ ...urlState, tag: urlState.tag === tag ? "" : tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-tpl-usage-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const usage = btn.getAttribute("data-tpl-usage-tag") || "";
        writeUrlState({ ...urlState, usage: urlState.usage === usage ? "" : usage, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-tpl-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-tpl-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-tpl-page") || 1);
      if (!page || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-tpl-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showRoot(root, classic) {
    if (classic) {
      classic.hidden = true;
      classic.setAttribute("aria-hidden", "true");
      if ("inert" in classic) classic.inert = true;
    }
    root.hidden = false;
    root.removeAttribute("aria-hidden");
    if ("inert" in root) root.inert = false;
  }

  function hideOtherSpecialty() {
    ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "code", "document", "presentation"].forEach((key) => {
      const el = document.querySelector(`[data-materials-list-${key}]`);
      if (el) {
        el.hidden = true;
        el.innerHTML = "";
      }
    });
    global.TasuMaterialsSfxList?.stopAudio?.();
    global.TasuMaterialsBgmList?.stopAudio?.();
  }

  async function refresh() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-template]");
    if (!root) return;

    hideOtherSpecialty();
    showRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    const filters = {
      usage: urlState.usage,
      industry: urlState.industry,
      style: urlState.style,
      color: urlState.color,
      format: urlState.format,
      genre: urlState.genre,
      tag: urlState.tag,
    };
    const options = collectFilterOptions(baseItems);
    const filtered = applyFilters(baseItems, filters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
    const page = Math.min(urlState.page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    root.innerHTML = renderShell({
      q: urlState.q,
      sort: urlState.sort,
      filters,
      options,
      resultCount: filtered.length,
      page,
      totalPages: filtered.length ? totalPages : 1,
      cardsHtml: pageItems.map(renderCard).join(""),
      baseItems,
    });

    wireInteractions(root, pageItems, { ...urlState, page });
    document.title = "テンプレート一覧 | TASFUL Materials";

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: DATA_CATEGORY,
            result_count: filtered.length,
          })
        ).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  function hide() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-template]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const keys = ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "code", "document", "presentation"];
    const otherOn = keys.some((k) => {
      const el = document.querySelector(`[data-materials-list-${k}]`);
      return el && !el.hidden;
    });
    if (classic && !otherOn) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }
  }

  function isActive() {
    return new URLSearchParams(global.location.search).get("category") === QUERY_CATEGORY;
  }

  async function mount() {
    if (!isActive()) {
      hide();
      return false;
    }
    await refresh();
    return true;
  }

  global.TasuMaterialsTemplateList = {
    renderCard,
    
    mount,
    hide,
    refresh,
    isActive,
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * TASFUL Materials — プレゼンテンプレート一覧 Option 4 UI
 * URL query: category=presentation / 内部 category_id: presentation
 * 公開表示名「プレゼンテンプレート」（CATEGORIES.name「プレゼン資料」は変更しない）
 * Search / Sort / Download / Favorite は既存接続。schema / Index 追加なし。
 * Preview 画像が無い場合は thumbnail_style プレースホルダのみ（生成 pipeline 禁止）。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "プレゼンテンプレート";
  const CHIP_LABEL = "プレゼン";
  const QUERY_CATEGORY = "presentation";
  const DATA_CATEGORY = "presentation";
  const ACCENT = "#4f46e5";

  const GENERIC_TAGS = new Set([
    "presentation",
    "プレゼン",
    "プレゼン資料",
    "プレゼンテンプレート",
    "pptx",
    "ppt",
  ]);

  /** enrichDetail の CATEGORY_META_DEFAULTS プレースホルダ（フィルタ捏造回避） */
  const META_PLACEHOLDERS = Object.freeze({
    meta_pages: "10枚",
    meta_size: "16:9",
    file_size: "約 2.1 MB",
  });

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  const SIDE_CATS = Object.freeze([
    { key: "提案書・企画書", tag: "提案", icon: "📄" },
    { key: "会社紹介・IR", tag: "会社紹介", icon: "🏢", uiOnly: true },
    { key: "ピッチデッキ", tag: "ピッチ", icon: "📊", uiOnly: true },
    { key: "セミナー・講演", tag: "セミナー", icon: "💬", uiOnly: true },
    { key: "事業計画・戦略", tag: "事業計画", icon: "💡", uiOnly: true },
    { key: "マーケティング", tag: "マーケティング", icon: "✈", uiOnly: true },
    { key: "報告書・レポート", tag: "報告書", icon: "📋", uiOnly: true },
    { key: "教育・研修", tag: "教育", icon: "🎓", uiOnly: true },
    { key: "営業資料", tag: "営業資料", icon: "📁" },
    { key: "その他", tag: "", icon: "▦", uiOnly: true },
  ]);

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

  function realMeta(value, placeholderKey) {
    const s = pickStr(value);
    if (!s || s === "—") return "";
    const ph = META_PLACEHOLDERS[placeholderKey];
    if (ph && s === ph) return "";
    if (Object.values(META_PLACEHOLDERS).includes(s)) return "";
    return s;
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }

  function resolveThumbSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    const first = images[0];
    const fromPreview = pickStr(
      first && (first.src || first.url || first),
      typeof first === "string" ? first : ""
    );
    const slides = Array.isArray(item.presentation_slides) ? item.presentation_slides : [];
    const slide0 = slides[0];
    const fromSlide = pickStr(
      slide0 && (slide0.src || slide0.url || slide0.image || slide0.thumbnail),
      typeof slide0 === "string" ? slide0 : ""
    );
    const candidates = [
      fromPreview,
      fromSlide,
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
    const style = pickStr(item.thumbnail_style, "presentation");
    return `materials-card__thumb--${style}`;
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function formatLabel(item) {
    const formats = item.file_formats || [];
    if (formats.length) return formats.map((f) => String(f).toUpperCase()).join(" / ");
    return "";
  }

  function usageLabel(item) {
    return pickStr(item.presentation_usage, item.meta_presentation_usage, item.subcategory);
  }

  function listHref(category) {
    if (!category) return "/materials/list.html";
    return `/materials/list.html?category=${encodeURIComponent(category)}`;
  }

  function detailHref(item) {
    return `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: params.get("q") || "",
      sort: params.get("sort") === "newest" ? "newest" : "popular",
      usage: params.get("usage") || "",
      style: params.get("style") || "",
      format: params.get("format") || "",
      color: params.get("color") || "",
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
    url.searchParams.delete("industry");
    setOrDel("style", next.style);
    url.searchParams.delete("usage");
    setOrDel("color", next.color);
    url.searchParams.delete("pages");
    url.searchParams.delete("ratio");
    url.searchParams.delete("slide_type");
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    if (next.page > 1) url.searchParams.set("page", String(next.page));
    else url.searchParams.delete("page");
    if (replace) global.history.replaceState({ materialsListCategory: QUERY_CATEGORY }, "", url);
    else global.history.pushState({ materialsListCategory: QUERY_CATEGORY }, "", url);
  }

  function collectFilterOptions(items) {
    const usages = new Map();
    const styles = new Map();
    const formats = new Map();
    const colors = new Map();
    const tags = new Map();

    items.forEach((item) => {
      const usage = usageLabel(item);
      if (usage) usages.set(usage, (usages.get(usage) || 0) + 1);
      const layout = pickStr(item.layout);
      if (layout) styles.set(layout, (styles.get(layout) || 0) + 1);
      const color = pickStr(item.color_family);
      if (color) colors.set(color, (colors.get(color) || 0) + 1);
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
    });

    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts ? GF.collectDemandCounts(items, "presentation") : {};
    return { usages, styles, formats, colors, tags, genreCounts };
  }

  function applyFilters(items, filters) {
    return items.filter((item) => {
      if (filters.style) {
        if (pickStr(item.layout) !== filters.style) {
          return false;
        }
      }
      if (filters.format) {
        const ok = (item.file_formats || []).some((f) => String(f).toUpperCase() === filters.format);
        if (!ok) return false;
      }
      const genreKey = filters.genre || filters.sub;
      if (genreKey) {
        const ok = global.TasuMaterialsGenreFilter?.matchListGenre
          ? global.TasuMaterialsGenreFilter.matchListGenre(item, "presentation", genreKey)
          : false;
        if (!ok) {
          const cat = SIDE_CATS.find((c) => c.key === genreKey);
          if (!cat || cat.uiOnly || !cat.tag) return false;
          const hay = `${(item.tags || []).join(" ")} ${usageLabel(item)} ${item.title || ""}`.toLowerCase();
          if (!hay.includes(String(cat.tag).toLowerCase())) return false;
        }
      }
      if (filters.tag) {
        if (!itemTags(item).includes(filters.tag)) return false;
      }
      if (filters.color) {
        if (pickStr(item.color_family) !== filters.color) return false;
      }
      return true;
    });
  }

  function countBySideKey(items, key) {
    const cat = SIDE_CATS.find((c) => c.key === key);
    if (!cat || cat.uiOnly || !cat.tag) return 0;
    return items.filter((item) => {
      const hay = `${(item.tags || []).join(" ")} ${usageLabel(item)} ${item.title || ""}`.toLowerCase();
      return hay.includes(String(cat.tag).toLowerCase());
    }).length;
  }

  function renderFilterSelect(key, label, optionsMap, selected, disabled) {
    const entries = [...optionsMap.entries()].sort((a, b) => b[1] - a[1]);
    const isDisabled = !!disabled || entries.length === 0;
    const opts = entries
      .map(
        ([val]) =>
          `<option value="${escapeHtml(val)}"${selected === val ? " selected" : ""}>${escapeHtml(val)}</option>`
      )
      .join("");
    return (
      `<label class="mat-pres-filter">` +
      `<span class="visually-hidden">${escapeHtml(label)}</span>` +
      `<select data-pres-filter="${escapeHtml(key)}" aria-label="${escapeHtml(label)}"${isDisabled ? " disabled" : ""}>` +
      `<option value="">${escapeHtml(label)}</option>` +
      opts +
      `</select>` +
      `</label>`
    );
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) {
      return (
        `<div class="mat-pres-pager" data-pres-pager>` +
        `<button type="button" class="mat-pres-pager__btn is-active" disabled>1</button>` +
        `</div>`
      );
    }
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-pres-pager__btn" data-pres-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const maxShow = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxShow - 1);
    start = Math.max(1, end - maxShow + 1);
    for (let i = start; i <= end; i += 1) {
      buttons.push(
        `<button type="button" class="mat-pres-pager__btn${i === page ? " is-active" : ""}" data-pres-page="${i}">${i}</button>`
      );
    }
    if (end < totalPages) {
      buttons.push(`<span class="mat-pres-pager__ellipsis">…</span>`);
      buttons.push(
        `<button type="button" class="mat-pres-pager__btn" data-pres-page="${totalPages}">${totalPages}</button>`
      );
    }
    buttons.push(
      `<button type="button" class="mat-pres-pager__btn" data-pres-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    return `<div class="mat-pres-pager" data-pres-pager>${buttons.join("")}</div>`;
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const tags = itemTags(item).slice(0, 3);
    const formats = formatLabel(item);
    const pages = realMeta(item.meta_pages, "meta_pages");
    const desc = pickStr(item.description);

    return (
      `<article class="mat-pres-card" data-pres-card data-item-id="${escapeHtml(item.id)}">` +
      `<a class="mat-pres-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img class="mat-pres-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-pres-card__placeholder ${escapeHtml(thumbStyleClass(item))}" aria-hidden="true">` +
          `<span class="mat-pres-card__placeholder-ico">▣</span>` +
          `<span class="mat-pres-card__placeholder-label">プレビュー準備中</span>` +
          `</span>`) +
      (formats ? `<span class="mat-pres-card__fmt">${escapeHtml(formats)}</span>` : "") +
      `</a>` +
      `<div class="mat-pres-card__body">` +
      `<h3 class="mat-pres-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-pres-card__desc">${escapeHtml(desc || " ")}</p>` +
      `<div class="mat-pres-card__meta-row">` +
      `<span class="mat-pres-card__cat">${DISPLAY_NAME}</span>` +
      (pages ? `<span class="mat-pres-card__pages">${escapeHtml(pages)}</span>` : "") +
      `</div>` +
      `<div class="mat-pres-card__tags">` +
      tags.map((t) => `<span class="mat-pres-card__tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-pres-card__foot">` +
      `<span class="mat-pres-card__stat"><span class="mat-pres-card__star" aria-hidden="true">★</span>${rating}</span>` +
      `<span class="mat-pres-card__stat"><span aria-hidden="true">↓</span>${dl}</span>` +
      `<div class="mat-pres-card__actions">` +
      `<button type="button" class="mat-pres-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<span class="mat-pres-card__heart" aria-hidden="true"></span>` +
      `</button>` +
      `<button type="button" class="mat-pres-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span aria-hidden="true">↓</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderShell(ctx) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, baseItems } = ctx;

    const chips = listCategoryChips()
      .map((c) => {
        const active = c.id === QUERY_CATEGORY;
        return `<a class="mat-pres-cat-chip${active ? " is-active" : ""}" href="${listHref(c.id)}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(c.label)}</a>`;
      })
      .join("");

    const activeFilters = [`<span class="mat-pres-chip-active">${CHIP_LABEL}</span>`];
    if (sort === "newest") activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--rose">新着順</span>`);
    else activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--rose">人気順</span>`);
    if (filters.usage) activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--accent">${escapeHtml(filters.usage)}</span>`);
    if (filters.style) activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--accent">${escapeHtml(filters.style)}</span>`);
    if (filters.format) activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--accent">${escapeHtml(filters.format)}</span>`);
    if (filters.genre) activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--accent">${escapeHtml(filters.genre)}</span>`);
    if (filters.tag) activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--accent">${escapeHtml(filters.tag)}</span>`);
    if (q) activeFilters.push(`<span class="mat-pres-chip-active mat-pres-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: DATA_CATEGORY }) || "";

    const usageEntries = [...options.usages.entries()].sort((a, b) => b[1] - a[1]);
    const popularUses =
      usageEntries.length > 0
        ? usageEntries
            .slice(0, 8)
            .map(
              ([tag, count]) =>
                `<button type="button" class="mat-pres-popular-tag" data-pres-usage-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span> <span class="mat-pres-popular-tag__n">${formatCount(count)}</span></button>`
            )
            .join("")
        : [...options.tags.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(
              ([tag, count]) =>
                `<button type="button" class="mat-pres-popular-tag" data-pres-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span> <span class="mat-pres-popular-tag__n">${formatCount(count)}</span></button>`
            )
            .join("") ||
          `<p class="mat-pres-side-empty">用途データはまだありません。</p>`;

    return (
      `<div class="mat-pres-layout" data-pres-list style="--mat-pres-ops:${ACCENT}">` +
      `<div class="mat-pres-main">` +
      `<div class="mat-pres-panel">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-pres-head">` +
      `<span class="mat-pres-head__ico" aria-hidden="true">▣</span>` +
      `<h1 class="mat-pres-head__title">プレゼンテンプレート一覧</h1>` +
      `<p class="mat-pres-head__lead">ビジネス提案・企画書・セミナー資料など、すぐに使えるプレゼンテンプレートを探せます</p>` +
      `</div>` +
      `<form class="mat-pres-search" data-pres-search role="search">` +
      `<div class="mat-pres-search__field">` +
      `<span class="mat-pres-search__ico" aria-hidden="true">⌕</span>` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：企画書、提案書、ピッチ、会社紹介）" data-pres-q aria-label="プレゼンテンプレートを検索">` +
      `</div>` +
      `<button type="submit" class="mat-pres-search__btn">検索</button>` +
      `<label class="mat-pres-sort">` +
      `<span class="visually-hidden">並び替え</span>` +
      `<select data-pres-sort aria-label="並び替え">` +
      `<option value="popular"${sort !== "newest" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `</select>` +
      `</label>` +
      `</form>` +
      `<div class="mat-pres-cat-chips mat-list-m-chips">${chips}</div>` +
      `<div class="mat-pres-filters mat-list-m-filters" data-pres-filters>` +
      (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
        categoryId: "presentation",
        selected: filters.genre,
        counts: options.genreCounts,
        dataAttr: "data-pres-filter",
        wrapTag: "label",
        wrapClass: "mat-pres-filter",
        includeZero: true,
      }) || renderFilterSelect("genre", "ジャンル", new Map(), filters.genre, false)) +
      renderFilterSelect("style", "デザイン", options.styles, filters.style, options.styles.size === 0) +
      renderFilterSelect("color", "カラー", options.colors || new Map(), filters.color, !(options.colors && options.colors.size)) +
      renderFilterSelect("format", "形式", options.formats, filters.format, false) +
      `<button type="button" class="mat-pres-clear" data-pres-clear>すべてクリア</button>` +
      `<span class="mat-pres-count">検索結果：<b data-pres-count>${formatCount(resultCount)}</b>件</span>` +
      `</div>` +
      `<div class="mat-pres-grid" data-pres-grid>` +
      (cardsHtml || `<p class="mat-pres-empty">該当するプレゼンテンプレートがありません。</p>`) +
      `</div>` +
      renderPager(page, totalPages) +
      `<div class="mat-pres-cta">` +
      `<div class="mat-pres-cta__ico" aria-hidden="true">💳</div>` +
      `<div class="mat-pres-cta__copy">` +
      `<h2>高品質なプレゼンテンプレートを無料でダウンロード</h2>` +
      `<p>商用利用OK・クレジット表記不要のプレゼンテンプレートを無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-pres-cta__btn" href="/materials/index.html">無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `<aside class="mat-pres-aside" aria-label="絞り込みサイドバー">` +
      `<div class="mat-pres-side-card">` +
      `<h3 class="mat-pres-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-pres-side-active">${activeFilters.join("")}</div>` +
      `<button type="button" class="mat-pres-side-clear" data-pres-clear>すべてクリア</button>` +
      `</div>` +
      `<div class="mat-pres-side-card">` +
      `<h3 class="mat-pres-side-card__title">カテゴリ</h3>` +
      `<div class="mat-pres-side-cats">${sideCats}</div>` +
      `<a class="mat-pres-side-more" href="${global.TasuMaterialsListSidebar?.listHref?.("") || "list.html"}">すべてのカテゴリを見る ›</a>` +
      `</div>` +
      `<div class="mat-pres-side-card">` +
      `<h3 class="mat-pres-side-card__title">人気の用途</h3>` +
      `<div class="mat-pres-popular">${popularUses}</div>` +
      `<a class="mat-pres-side-more" href="${listHref(QUERY_CATEGORY)}">すべての用途を見る ›</a>` +
      `</div>` +
      `<div class="mat-pres-side-card mat-pres-side-card--fav">` +
      `<div class="mat-pres-side-fav">` +
      `<span class="mat-pres-side-fav__ico" aria-hidden="true">♡</span>` +
      `<div>` +
      `<h3>お気に入りに保存</h3>` +
      `<p>気になる素材を保存して<br>後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<a class="mat-pres-side-howto" href="/materials/index.html">使い方を見る</a>` +
      `</div>` +
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
      if (urlState.sort === "newest") {
        items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      const sort = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchAllItems(sort);
      items = (items || []).filter((i) => i.category_id === DATA_CATEGORY);
    }
    return (items || []).map((raw) => enrichItem(raw));
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-pres-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-pres-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-pres-sort]")?.addEventListener("change", (ev) => {
      const sort = ev.target.value === "newest" ? "newest" : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-pres-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-pres-filter="genre"]')?.value || "",
          style: root.querySelector('[data-pres-filter="style"]')?.value || "",
          color: root.querySelector('[data-pres-filter="color"]')?.value || "",
          format: root.querySelector('[data-pres-filter="format"]')?.value || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-pres-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          {
            q: "",
            sort: "popular",
            genre: "",
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

    root.querySelectorAll("[data-pres-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const sub = btn.getAttribute("data-pres-sub") || "";
        writeUrlState({ ...urlState, genre: urlState.genre === sub ? "" : sub, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-pres-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-pres-tag") || "";
        writeUrlState({ ...urlState, tag: urlState.tag === tag ? "" : tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-pres-usage-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const usage = btn.getAttribute("data-pres-usage-tag") || "";
        writeUrlState({ ...urlState, usage: urlState.usage === usage ? "" : usage, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-pres-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-pres-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-pres-page") || 1);
      if (!page || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-pres-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showPresRoot(root, classic) {
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
    ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "code", "document", "template"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-presentation]");
    if (!root) return;

    hideOtherSpecialty();
    showPresRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    const filters = {
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
    document.title = "プレゼンテンプレート一覧 | TASFUL Materials";

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
    const root = document.querySelector("[data-materials-list-presentation]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const keys = ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "code", "document", "template"];
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

  global.TasuMaterialsPresentationList = {
    renderCard,
    
    mount,
    hide,
    refresh,
    isActive,
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);

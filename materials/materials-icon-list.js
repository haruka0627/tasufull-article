/**
 * TASFUL Materials — アイコン素材一覧 STC Full Retransplant
 * Source: reports/materials-stc-audit/canonical/icon-list.html
 * 公開表示名「アイコン素材」。操作=青。プレビューは object-contain + 透過確認用チェッカー背景。
 * Search / Sort / Filter / Download / Favorite / Related Contract は既存接続。schema 追加なし。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "アイコン素材";
  const GENERIC_TAGS = new Set(["icon", "アイコン", "アイコン素材", "png", "jpg", "jpeg", "webp", "svg"]);

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  const SIDE_CATS = Object.freeze([
    { key: "ビジネス・仕事", tag: "ビジネス", icon: "▣" },
    { key: "UI・操作", tag: "UI", icon: "▸" },
    { key: "SNS・コミュニケーション", tag: "SNS", icon: "✉" },
    { key: "デバイス・テクノロジー", tag: "デバイス", icon: "▦" },
    { key: "生活・日用品", tag: "生活", icon: "⌂" },
    { key: "教育・学習", tag: "教育", icon: "✎" },
    { key: "医療・健康", tag: "医療", icon: "♥" },
    { key: "乗り物・交通", tag: "交通", icon: "➤" },
    { key: "スポーツ・趣味", tag: "スポーツ", icon: "✦" },
    { key: "その他", tag: "その他", icon: "…" },
  ]);

  const CAROUSEL_CATS = Object.freeze([
    { key: "ビジネス・仕事", tag: "ビジネス" },
    { key: "UI・操作", tag: "UI" },
    { key: "SNS・コミュニケーション", tag: "SNS" },
    { key: "デバイス・テクノロジー", tag: "デバイス" },
    { key: "生活・日用品", tag: "生活" },
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
    return data?.enrichDetail ? data.enrichDetail(raw) || raw : raw;
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(url || ""));
  }

  function resolveThumbSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    if (images[0]?.src && isImageUrl(images[0].src)) return String(images[0].src);
    const set = item.icon_set;
    if (set && Array.isArray(set.preview_urls)) {
      const fromSet = set.preview_urls.find((u) => isImageUrl(u));
      if (fromSet) return String(fromSet);
    }
    if (set && Array.isArray(set.icons) && set.icons[0]?.src && isImageUrl(set.icons[0].src)) {
      return String(set.icons[0].src);
    }
    const candidates = [
      item.thumbnail_url,
      item.preview_image,
      item.preview_url,
      item.image_url,
      item.image,
      item.download_url,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const src = pickStr(candidates[i]);
      if (src && isImageUrl(src)) return src;
    }
    return "";
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => !GENERIC_TAGS.has(String(t).toLowerCase()) && !GENERIC_TAGS.has(String(t)));
  }

  function styleSubtitle(item) {
    const tags = itemTags(item);
    if (tags.length) return tags.slice(0, 2).join("・");
    return pickStr(item.subcategory, item.meta_style, "");
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
      stroke: params.get("stroke") || "",
      color: params.get("color") || "",
      format: params.get("format") || "",
      genre: params.get("genre") || params.get("sub") || "",
      fill: params.get("fill") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "icon");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    setOrDel("style", next.style);
    url.searchParams.delete("cat");
    setOrDel("stroke", next.stroke);
    url.searchParams.delete("shape");
    setOrDel("fill", next.fill);
    setOrDel("color", next.color);
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsIconList: true }, "", url);
    else global.history.pushState({ materialsIconList: true }, "", url);
  }

  function matchSubOrTag(item, key) {
    if (!key) return true;
    const hay = [...(item.tags || []), ...(item.search_keywords || []), item.subcategory, item.title, item.description, item.slug].map((x) => String(x || "")).join(" ");
    const cat = SIDE_CATS.find((c) => c.key === key);
    if (cat && hay.includes(cat.tag)) return true;
    return hay.includes(key);
  }

  function countBySideKey(items, key) {
    return items.filter((item) => matchSubOrTag(item, key)).length;
  }

  /* ---------- Card (canonical grid tile) ---------- */
  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const recommended = Number(item.download_count || 0) >= 20;
    const sub = styleSubtitle(item);

    return (
      `<article class="mat-icon-card" data-icon-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
        `<div class="mat-icon-card__preview">` +
          (recommended
            ? `<span class="mat-icon-card__badge mat-icon-card__badge--rec">おすすめ</span>`
            : item.is_free !== false
              ? `<span class="mat-icon-card__badge mat-icon-card__badge--free">無料</span>`
              : `<span class="mat-icon-card__cat">${DISPLAY_NAME}</span>`) +
          `<button type="button" class="mat-icon-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
            `<span class="mat-icon-card__heart" aria-hidden="true"></span>` +
          `</button>` +
          `<a class="mat-icon-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
            (thumb
              ? `<img class="mat-icon-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
              : `<span class="mat-icon-card__img mat-icon-card__img--fallback" aria-hidden="true"></span>`) +
          `</a>` +
        `</div>` +
        `<div class="mat-icon-card__body">` +
          `<h3 class="mat-icon-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
          `<p class="mat-icon-card__sub">${sub ? escapeHtml(sub) : "&nbsp;"}</p>` +
          `<div class="mat-icon-card__formats">` +
            (formats.length
              ? formats.slice(0, 3).map((f) => `<span class="mat-icon-card__fmt">${escapeHtml(f)}</span>`).join("")
              : "") +
          `</div>` +
          `<div class="mat-icon-card__foot">` +
            `<span class="mat-icon-card__meta"><span class="mat-icon-card__star" aria-hidden="true">★</span>${rating}</span>` +
            `<span class="mat-icon-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
            `<button type="button" class="mat-icon-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
              `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
            `</button>` +
          `</div>` +
        `</div>` +
      `</article>`
    );
  }

  function applyFilters(items, filters) {
    return items.filter((item) => {
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.tag) {
        const tags = (item.tags || []).map((t) => String(t));
        if (!tags.includes(filters.tag) && !matchSubOrTag(item, filters.tag)) return false;
      }
      if ((filters.genre || filters.sub) && !(global.TasuMaterialsGenreFilter?.matchListGenre
        ? global.TasuMaterialsGenreFilter.matchListGenre(item, "icon", filters.genre || filters.sub)
        : matchSubOrTag(item, filters.genre || filters.sub))) return false;
      if (filters.style || filters.stroke || filters.color || filters.usage || filters.fill) return false;
      return true;
    });
  }

  function collectFilterOptions(items) {
    const formats = new Map();
    const tags = new Map();
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
    });
    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts ? GF.collectDemandCounts(items, "icon") : {};
    return { formats, tags, genreCounts };
  }

  function renderFilterSelect(name, label, entries, selected, disabled) {
    if (disabled) {
      return (
        `<label class="mat-icon-filter">` +
          `<span class="visually-hidden">${escapeHtml(label)}</span>` +
          `<select data-icon-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}（未接続）">` +
            `<option value="">${escapeHtml(label)}</option>` +
            
          `</select>` +
        `</label>`
      );
    }
    const opts = [`<option value="">${escapeHtml(label)}</option>`]
      .concat(
        [...entries.entries()]
          .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "ja"))
          .map(([key, count]) => {
            const sel = selected === key ? " selected" : "";
            return `<option value="${escapeHtml(key)}"${sel}>${escapeHtml(key)}（${count}）</option>`;
          })
      )
      .join("");
    return (
      `<label class="mat-icon-filter">` +
        `<span class="visually-hidden">${escapeHtml(label)}</span>` +
        `<select data-icon-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">${opts}</select>` +
      `</label>`
    );
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) return `<nav class="mat-icon-pager" aria-label="ページネーション" data-icon-pager></nav>`;
    const buttons = [];
    buttons.push(`<button type="button" class="mat-icon-pager__btn" data-icon-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`);
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      buttons.push(`<button type="button" class="mat-icon-pager__btn" data-icon-page="1">1</button>`);
      if (start > 2) buttons.push(`<span class="mat-icon-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(`<button type="button" class="mat-icon-pager__btn${p === page ? " is-active" : ""}" data-icon-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-icon-pager__ellipsis">…</span>`);
      buttons.push(`<button type="button" class="mat-icon-pager__btn" data-icon-page="${totalPages}">${totalPages}</button>`);
    }
    buttons.push(`<button type="button" class="mat-icon-pager__btn" data-icon-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`);
    return `<nav class="mat-icon-pager" aria-label="ページネーション" data-icon-pager>${buttons.join("")}</nav>`;
  }

  function carouselPreviewSrcs(baseItems, key) {
    const seen = new Set();
    const srcs = [];
    (baseItems || []).forEach((item) => {
      if (srcs.length >= 6) return;
      if (!matchSubOrTag(item, key)) return;
      const src = resolveThumbSrc(item);
      if (!src || seen.has(src)) return;
      seen.add(src);
      srcs.push(src);
    });
    return srcs;
  }

  function renderCarousel(baseItems, filters) {
    return CAROUSEL_CATS.map((c) => {
      const count = countBySideKey(baseItems, c.key);
      const active = filters.genre === c.key;
      const previews = carouselPreviewSrcs(baseItems, c.key);
      const glyphs = Array.from({ length: 6 }, (_, idx) => {
        const src = previews[idx];
        if (!src) return "<span></span>";
        return (
          `<span class="mat-icon-carousel__glyph is-filled">` +
          `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">` +
          `</span>`
        );
      }).join("");
      return (
        `<button type="button" class="mat-icon-carousel__card${active ? " is-active" : ""}" data-icon-sub="${escapeHtml(c.key)}">` +
          `<div class="mat-icon-carousel__glyphs" aria-hidden="true">${glyphs}</div>` +
          `<div class="mat-icon-carousel__name">${escapeHtml(c.key)}</div>` +
          `<div class="mat-icon-carousel__meta"><span>${count}点のアイコン</span><span aria-hidden="true">›</span></div>` +
        `</button>`
      );
    }).join("");
  }

  function renderShell(ctx) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, tagEntries, baseItems } = ctx;

    const chips = listCategoryChips().map((c) => {
      const href = c.id ? `/materials/list.html?category=${encodeURIComponent(c.id)}` : "/materials/list.html";
      const active = c.id === "icon";
      return `<a class="mat-icon-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
    }).join("");

    const activeFilters = [`<span class="mat-icon-chip-active">${DISPLAY_NAME}</span>`];
    activeFilters.push(
      sort === "newest"
        ? `<span class="mat-icon-chip-active mat-icon-chip-active--accent">新着順</span>`
        : `<span class="mat-icon-chip-active mat-icon-chip-active--accent">人気順</span>`
    );
    if (filters.genre) activeFilters.push(`<span class="mat-icon-chip-active mat-icon-chip-active--muted">${escapeHtml(filters.genre)}</span>`);
    if (filters.format) activeFilters.push(`<span class="mat-icon-chip-active mat-icon-chip-active--muted">${escapeHtml(filters.format)}</span>`);
    if (filters.tag) activeFilters.push(`<span class="mat-icon-chip-active mat-icon-chip-active--muted">${escapeHtml(filters.tag)}</span>`);
    if (q) activeFilters.push(`<span class="mat-icon-chip-active mat-icon-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "icon" }) || "";

    const popularStyles = tagEntries.length
      ? tagEntries
          .slice(0, 8)
          .map(([tag, count]) => `<button type="button" class="mat-icon-popular-tag" data-icon-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span>${count}</span></button>`)
          .join("")
      : "";

    return (
      `<div class="mat-icon-layout" data-icon-list>` +
        `<div class="mat-icon-main">` +
          (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
          `<div class="mat-icon-head">` +
            `<h1 class="mat-icon-head__title">アイコン一覧</h1>` +
            `<p class="mat-icon-head__lead">Web・アプリ・資料に使える高品質アイコン素材を探せます</p>` +
          `</div>` +
          `<form class="mat-icon-search" data-icon-search role="search">` +
            `<div class="mat-icon-search__field">` +
              `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：ホーム、電話、SNS、ビジネス）" data-icon-q aria-label="アイコン素材を検索">` +
            `</div>` +
            `<button type="submit" class="mat-icon-search__btn">検索</button>` +
            `<label class="mat-icon-sort">` +
              `<span class="visually-hidden">並び替え</span>` +
              `<select data-icon-sort aria-label="並び替え">` +
                `<option value="popular"${sort !== "newest" ? " selected" : ""}>人気順</option>` +
                `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
              `</select>` +
            `</label>` +
          `</form>` +
          `<div class="mat-icon-cat-chips mat-list-m-chips">${chips}</div>` +
          `<div class="mat-icon-filters mat-list-m-filters" data-icon-filters>` +
            (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
              categoryId: "icon",
              selected: filters.genre,
              counts: options.genreCounts,
              dataAttr: "data-icon-filter",
              wrapTag: "label",
              wrapClass: "mat-icon-filter",
              includeZero: true,
            }) || renderFilterSelect("genre", "ジャンル", new Map(), filters.genre, true)) +
            renderFilterSelect("usage", "用途", new Map(), filters.usage, true) +
            renderFilterSelect("style", "スタイル", new Map(), filters.style, true) +
            renderFilterSelect("stroke", "線", new Map(), filters.stroke, true) +
            renderFilterSelect("fill", "塗り", new Map(), filters.fill, true) +
            renderFilterSelect("color", "色", new Map(), filters.color, true) +
            renderFilterSelect("format", "形式", options.formats, filters.format, options.formats.size === 0) +
            `<button type="button" class="mat-icon-clear" data-icon-clear>すべてクリア</button>` +
            `<span class="mat-icon-result-count" data-icon-count>検索結果：${formatCount(resultCount)}件</span>` +
          `</div>` +
          `<div class="mat-icon-carousel" data-icon-carousel>${renderCarousel(baseItems, filters)}</div>` +
          (cardsHtml ? `<div class="mat-icon-grid" data-icon-grid>${cardsHtml}</div>` : `<p class="mat-icon-empty">該当する${DISPLAY_NAME}がありません。</p>`) +
          renderPager(page, totalPages) +
          `<section class="mat-icon-cta">` +
            `<div class="mat-icon-cta__icon" aria-hidden="true">▣</div>` +
            `<div class="mat-icon-cta__copy">` +
              `<h2>高品質な${DISPLAY_NAME}を無料でダウンロード</h2>` +
              `<p>商用利用OK・クレジット表記不要の${DISPLAY_NAME}を無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
            `</div>` +
            `<a class="mat-icon-cta__btn" href="/login.html">無料会員登録する</a>` +
          `</section>` +
        `</div>` +
        `<aside class="mat-icon-side" aria-label="${DISPLAY_NAME}サイドバー">` +
          `<div class="mat-icon-side-card">` +
            `<h3 class="mat-icon-side-card__title">現在の絞り込み</h3>` +
            `<div class="mat-icon-side-chips">${activeFilters.join("")}<button type="button" class="mat-icon-side-clear" data-icon-clear>すべてクリア</button></div>` +
          `</div>` +
          `<div class="mat-icon-side-card">` +
            `<h3 class="mat-icon-side-card__title">カテゴリ</h3>` +
            `<div class="mat-icon-side-cats">${sideCats}</div>` +
          `</div>` +
          `<div class="mat-icon-side-card">` +
            `<h3 class="mat-icon-side-card__title">人気のスタイル・テイスト</h3>` +
            `<div class="mat-icon-popular-tags">${popularStyles}</div>` +
          `</div>` +
          `<div class="mat-icon-side-card">` +
            `<div class="mat-icon-side-fav">` +
              `<div class="mat-icon-side-fav__icon" aria-hidden="true"></div>` +
              `<div>` +
                `<h3 class="mat-icon-side-card__title">お気に入りに保存</h3>` +
                `<p>気になる素材を保存して後からまとめてダウンロードできます</p>` +
              `</div>` +
            `</div>` +
            `<a class="mat-icon-side-fav__link" href="/materials/mypage.html#favorites">使い方を見る</a>` +
          `</div>` +
        `</aside>` +
        `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
    );
  }

  async function loadBaseItems(urlState) {
    const repo = global.TasuMaterialsData?.repository;
    if (!repo) return [];
    let items;
    if (urlState.q) {
      items = await repo.searchItems(urlState.q);
      items = (items || []).filter((i) => i.category_id === "icon");
      items = urlState.sort === "newest"
        ? items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
        : items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
    } else {
      items = await repo.fetchAllItems(urlState.sort === "newest" ? "newest" : "popular");
      items = (items || []).filter((i) => i.category_id === "icon");
    }
    return (items || []).map((raw) => enrichItem(raw));
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-icon-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-icon-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-icon-sort]")?.addEventListener("change", (ev) => {
      writeUrlState({ ...urlState, sort: ev.target.value === "newest" ? "newest" : "popular", page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-icon-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-icon-filter="genre"]')?.value || "",
          usage: root.querySelector('[data-icon-filter="usage"]')?.value || "",
          style: root.querySelector('[data-icon-filter="style"]')?.value || "",
          stroke: root.querySelector('[data-icon-filter="stroke"]')?.value || "",
          fill: root.querySelector('[data-icon-filter="fill"]')?.value || "",
          color: root.querySelector('[data-icon-filter="color"]')?.value || "",
          format: root.querySelector('[data-icon-filter="format"]')?.value || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-icon-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          { q: "", sort: "popular", usage: "", style: "", stroke: "", fill: "", color: "", format: "", genre: "", tag: "", page: 1 },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-icon-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = btn.getAttribute("data-icon-sub") || "";
        writeUrlState({ ...urlState, genre: urlState.genre === sub ? "" : sub, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-icon-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-icon-tag") || "";
        writeUrlState({ ...urlState, tag: urlState.tag === tag ? "" : tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-icon-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-icon-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-icon-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-icon-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showIconRoot(root, classic) {
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
    ["sfx", "bgm", "image", "illustration", "background", "web", "code", "document", "presentation", "template"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-icon]");
    if (!root) return;

    hideOtherSpecialty();
    showIconRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* metrics optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    const filters = {
      usage: urlState.usage,
      style: urlState.style,
      stroke: urlState.stroke,
      fill: urlState.fill,
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
    const tagEntries = [...options.tags.entries()].sort((a, b) => b[1] - a[1]);

    root.innerHTML = renderShell({
      q: urlState.q,
      sort: urlState.sort,
      filters,
      options,
      resultCount: filtered.length,
      page,
      totalPages: filtered.length ? totalPages : 1,
      cardsHtml: pageItems.map(renderCard).join(""),
      tagEntries,
      baseItems,
    });

    wireInteractions(root, pageItems, { ...urlState, page });

    document.title = "アイコン一覧 | TASFUL Materials";

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, { category_id: "icon", result_count: filtered.length })
        ).catch(() => {});
      }
    } catch {
      /* analytics failure != search failure */
    }
  }

  function hide() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-icon]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const otherOn = ["sfx", "bgm", "image", "illustration", "background", "web", "code", "document", "presentation", "template"].some((key) => {
      const el = document.querySelector(`[data-materials-list-${key}]`);
      return el && !el.hidden;
    });
    if (classic && !otherOn) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }
  }

  function isActive() {
    const root = document.querySelector("[data-materials-list-icon]");
    return !!(root && !root.hidden);
  }

  async function mount() {
    await refresh();
    return true;
  }

  global.TasuMaterialsIconList = {
    renderCard,
    
    mount,
    refresh,
    hide,
    isActive,
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);

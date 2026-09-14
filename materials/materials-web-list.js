/**
 * TASFUL Materials — Web素材一覧 STC Full Retransplant
 * Source: reports/materials-stc-audit/canonical/web-list.html
 * 公開表示名「Web素材」。操作=青。
 * Search / Sort / Filter / Download / Favorite / Related Contract は既存接続。schema 追加なし。
 * Preview 画像が無い場合は既存 thumbnail_style プレースホルダのみ（生成 pipeline 禁止）。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "Web素材";
  const GENERIC_TAGS = new Set(["web", "web-material", "web素材", "ja", "html", "css", "js", "javascript"]);

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  /** Option 4 サイドカテゴリ。tag があるものだけ既存 tags で件数・絞り込み接続 */
  const SIDE_CATS = Object.freeze([
    { key: "バナー・ヘッダー", tag: "", icon: "▢", uiOnly: true },
    { key: "ランディングページ", tag: "landing", icon: "▦" },
    { key: "UIパーツ・要素", tag: "", icon: "▣", uiOnly: true },
    { key: "フレーム・囲み枠", tag: "", icon: "▭", uiOnly: true },
    { key: "ボタン", tag: "", icon: "▮", uiOnly: true },
    { key: "吹き出し・マーカー", tag: "", icon: "💬", uiOnly: true },
    { key: "区切り線・装飾", tag: "", icon: "━", uiOnly: true },
    { key: "グラフ・チャート", tag: "", icon: "▥", uiOnly: true },
    { key: "ヒーロー", tag: "hero", icon: "◆" },
    { key: "その他", tag: "", icon: "…", uiOnly: true },
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
    const first = images[0];
    const fromPreview = pickStr(first && (first.src || first.url || first), typeof first === "string" ? first : "");
    const candidates = [fromPreview, item.thumbnail_url, item.preview_image, item.preview_url, item.image_url, item.image];
    for (let i = 0; i < candidates.length; i += 1) {
      const u = pickStr(candidates[i]);
      if (u && isImageUrl(u)) return u;
    }
    return "";
  }

  function thumbStyleClass(item) {
    return `materials-card__thumb--${pickStr(item.thumbnail_style, "web-hamburger")}`;
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function typeLabel(item) {
    const tags = itemTags(item);
    if (tags.includes("landing")) return "ランディング";
    if (tags.includes("hero")) return "ヒーロー";
    if (tags.includes("banner") || tags.includes("バナー")) return "バナー";
    return tags.find((t) => !/^(png|jpg|jpeg|webp|svg|html|css|js)$/i.test(t)) || "";
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
      layout: params.get("layout") || "",
      theme: params.get("theme") || "",
      format: params.get("format") || "",
      genre: params.get("genre") || params.get("sub") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "web");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    setOrDel("style", next.style);
    url.searchParams.delete("cat");
    url.searchParams.delete("color");
    setOrDel("layout", next.layout);
    setOrDel("theme", next.theme);
    url.searchParams.delete("size");
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsWebList: true }, "", url);
    else global.history.pushState({ materialsWebList: true }, "", url);
  }

  function matchSideKey(item, key) {
    if (!key) return true;
    const cat = SIDE_CATS.find((c) => c.key === key);
    if (!cat || cat.uiOnly || !cat.tag) return false;
    return (item.tags || []).some((t) => String(t) === cat.tag || String(t).toLowerCase() === cat.tag.toLowerCase());
  }

  function countBySideKey(items, key) {
    return items.filter((item) => matchSideKey(item, key)).length;
  }

  function collectFilterOptions(items) {
    const formats = new Map();
    const tags = new Map();
    const layouts = new Map();
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
      const layout = pickStr(item.layout);
      if (layout) layouts.set(layout, (layouts.get(layout) || 0) + 1);
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
    });
    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts ? GF.collectDemandCounts(items, "web") : {};
    return { formats, tags, layouts, genreCounts };
  }

  function applyFilters(items, filters) {
    return items.filter((item) => {
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if ((filters.genre || filters.sub) && !(global.TasuMaterialsGenreFilter?.matchListGenre
        ? global.TasuMaterialsGenreFilter.matchListGenre(item, "web", filters.genre || filters.sub)
        : matchSideKey(item, filters.genre || filters.sub))) return false;
      if (filters.tag) {
        const tags = item.tags || [];
        if (!tags.some((t) => String(t) === filters.tag)) return false;
      }
      if (filters.layout && pickStr(item.layout) !== filters.layout) return false;
      if (filters.style || filters.usage || filters.theme) return false;
      return true;
    });
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
    const type = typeLabel(item);
    const desc = pickStr(item.description, "");

    return (
      `<article class="mat-web-card" data-web-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
        `<div class="mat-web-card__preview">` +
          (item.is_free !== false ? `<span class="mat-web-card__badge mat-web-card__badge--free">無料</span>` : "") +
          (type
            ? `<span class="mat-web-card__type">${escapeHtml(type)}</span>`
            : `<span class="mat-web-card__type mat-web-card__type--cat">${DISPLAY_NAME}</span>`) +
          `<a class="mat-web-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
            (thumb
              ? `<img class="mat-web-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
              : `<span class="mat-web-card__placeholder ${escapeHtml(thumbStyleClass(item))}" aria-hidden="true"><span class="mat-web-card__placeholder-label">Web</span></span>`) +
          `</a>` +
        `</div>` +
        `<div class="mat-web-card__body">` +
          `<h3 class="mat-web-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
          `<p class="mat-web-card__desc">${escapeHtml(desc || " ")}</p>` +
          `<div class="mat-web-card__formats">` +
            (formats.length
              ? formats.slice(0, 3).map((f) => `<span class="mat-web-card__fmt">${escapeHtml(f)}</span>`).join("")
              : "") +
          `</div>` +
          `<div class="mat-web-card__foot">` +
            `<span class="mat-web-card__meta"><span class="mat-web-card__star" aria-hidden="true">★</span>${rating}</span>` +
            `<span class="mat-web-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
            `<div class="mat-web-card__actions">` +
              `<button type="button" class="mat-web-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
                `<span class="mat-web-card__heart" aria-hidden="true"></span>` +
              `</button>` +
              `<button type="button" class="mat-web-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
                `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
              `</button>` +
            `</div>` +
          `</div>` +
        `</div>` +
      `</article>`
    );
  }

  function renderFilterSelect(name, label, optionsMap, selected, disabled) {
    if (disabled) {
      return (
        `<label class="mat-web-filter">` +
          `<span class="visually-hidden">${escapeHtml(label)}</span>` +
          `<select data-web-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}（未接続）"><option value="">${escapeHtml(label)}</option></select>` +
        `</label>`
      );
    }
    const opts = [`<option value="">${escapeHtml(label)}</option>`]
      .concat(
        [...optionsMap.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
          .map(([val]) => `<option value="${escapeHtml(val)}"${selected === val ? " selected" : ""}>${escapeHtml(val)}</option>`)
      )
      .join("");
    return (
      `<label class="mat-web-filter">` +
        `<span class="visually-hidden">${escapeHtml(label)}</span>` +
        `<select data-web-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">${opts}</select>` +
      `</label>`
    );
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) return `<nav class="mat-web-pager" aria-label="ページネーション" data-web-pager></nav>`;
    const buttons = [];
    buttons.push(`<button type="button" class="mat-web-pager__btn" data-web-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`);
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      buttons.push(`<button type="button" class="mat-web-pager__btn" data-web-page="1">1</button>`);
      if (start > 2) buttons.push(`<span class="mat-web-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(`<button type="button" class="mat-web-pager__btn${p === page ? " is-active" : ""}" data-web-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-web-pager__ellipsis">…</span>`);
      buttons.push(`<button type="button" class="mat-web-pager__btn" data-web-page="${totalPages}">${totalPages}</button>`);
    }
    buttons.push(`<button type="button" class="mat-web-pager__btn" data-web-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`);
    return `<nav class="mat-web-pager" aria-label="ページネーション" data-web-pager>${buttons.join("")}</nav>`;
  }

  function renderShell(ctx) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, tagEntries, baseItems } = ctx;

    const chips = listCategoryChips().map((c) => {
      const href = c.id ? `/materials/list.html?category=${encodeURIComponent(c.id)}` : "/materials/list.html";
      const active = c.id === "web";
      return `<a class="mat-web-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
    }).join("");

    const activeFilters = [`<span class="mat-web-chip-active">${DISPLAY_NAME}</span>`];
    activeFilters.push(
      sort === "newest"
        ? `<span class="mat-web-chip-active mat-web-chip-active--accent">新着順</span>`
        : `<span class="mat-web-chip-active mat-web-chip-active--rose">人気順</span>`
    );
    if (filters.genre) activeFilters.push(`<span class="mat-web-chip-active mat-web-chip-active--muted">${escapeHtml(filters.genre)}</span>`);
    if (filters.format) activeFilters.push(`<span class="mat-web-chip-active mat-web-chip-active--muted">${escapeHtml(filters.format)}</span>`);
    if (filters.tag) activeFilters.push(`<span class="mat-web-chip-active mat-web-chip-active--muted">${escapeHtml(filters.tag)}</span>`);
    if (filters.style) activeFilters.push(`<span class="mat-web-chip-active mat-web-chip-active--muted">${escapeHtml(filters.style)}</span>`);
    if (q) activeFilters.push(`<span class="mat-web-chip-active mat-web-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "web" }) || "";

    const popularStyles = tagEntries.length
      ? tagEntries
          .slice(0, 8)
          .map(([tag, count]) => `<button type="button" class="mat-web-popular-tag" data-web-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span class="mat-web-popular-tag__n">${formatCount(count)}</span></button>`)
          .join("")
      : "";

    const styleOptions = new Map(tagEntries);

    return (
      `<div class="mat-web-layout" data-web-list>` +
        `<div class="mat-web-main">` +
          (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
          `<div class="mat-web-head">` +
            `<h1 class="mat-web-head__title">${DISPLAY_NAME}一覧</h1>` +
            `<p class="mat-web-head__lead">WebサイトやLP、バナー制作に使えるデザイン素材を探せます</p>` +
          `</div>` +
          `<form class="mat-web-search" data-web-search role="search">` +
            `<div class="mat-web-search__field">` +
              `<span class="mat-web-search__ico" aria-hidden="true">⌕</span>` +
              `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：バナー、フレーム、ボタン、吹き出し）" data-web-q aria-label="Web素材を検索">` +
            `</div>` +
            `<button type="submit" class="mat-web-search__btn">検索</button>` +
            `<label class="mat-web-sort">` +
              `<span class="visually-hidden">並び替え</span>` +
              `<select data-web-sort aria-label="並び替え">` +
                `<option value="popular"${sort !== "newest" ? " selected" : ""}>人気順</option>` +
                `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
              `</select>` +
            `</label>` +
          `</form>` +
          `<div class="mat-web-cat-chips mat-list-m-chips">${chips}</div>` +
          `<div class="mat-web-filters mat-list-m-filters" data-web-filters>` +
            (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
              categoryId: "web",
              selected: filters.genre,
              counts: options.genreCounts,
              dataAttr: "data-web-filter",
              wrapTag: "label",
              wrapClass: "mat-web-filter",
              includeZero: true,
            }) || renderFilterSelect("genre", "ジャンル", new Map(), filters.genre, true)) +
            renderFilterSelect("usage", "用途", new Map(), filters.usage, true) +
            renderFilterSelect("style", "スタイル", new Map(), filters.style, true) +
            renderFilterSelect("layout", "レイアウト", options.layouts, filters.layout, options.layouts.size === 0) +
            renderFilterSelect("theme", "テーマ", new Map(), filters.theme, true) +
            renderFilterSelect("format", "形式", options.formats, filters.format, options.formats.size === 0) +
            `<button type="button" class="mat-web-clear" data-web-clear>すべてクリア</button>` +
            `<span class="mat-web-result-count" data-web-count>検索結果：${formatCount(resultCount)}件</span>` +
          `</div>` +
          (cardsHtml ? `<div class="mat-web-grid" data-web-grid>${cardsHtml}</div>` : `<p class="mat-web-empty">該当する${DISPLAY_NAME}がありません。</p>`) +
          renderPager(page, totalPages) +
          `<section class="mat-web-cta">` +
            `<div class="mat-web-cta__icon" aria-hidden="true">◎</div>` +
            `<div class="mat-web-cta__copy">` +
              `<h2>高品質な${DISPLAY_NAME}を無料でダウンロード</h2>` +
              `<p>商用利用OK・クレジット表記不要の${DISPLAY_NAME}を無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
            `</div>` +
            `<a class="mat-web-cta__btn" href="/login.html">無料会員登録する</a>` +
          `</section>` +
        `</div>` +
        `<aside class="mat-web-side" aria-label="${DISPLAY_NAME}サイドバー">` +
          `<div class="mat-web-side-card">` +
            `<h3 class="mat-web-side-card__title">現在の絞り込み</h3>` +
            `<div class="mat-web-side-chips">${activeFilters.join("")}<button type="button" class="mat-web-side-clear" data-web-clear>すべてクリア</button></div>` +
          `</div>` +
          `<div class="mat-web-side-card">` +
            `<h3 class="mat-web-side-card__title">カテゴリ</h3>` +
            `<div class="mat-web-side-cats">${sideCats}</div>` +
          `</div>` +
          `<div class="mat-web-side-card">` +
            `<h3 class="mat-web-side-card__title">人気のスタイル・テイスト</h3>` +
            `<div class="mat-web-popular-tags">${popularStyles}</div>` +
          `</div>` +
          `<div class="mat-web-side-card mat-web-side-card--fav">` +
            `<div class="mat-web-side-fav">` +
              `<div class="mat-web-side-fav__icon" aria-hidden="true"></div>` +
              `<div>` +
                `<h3 class="mat-web-side-card__title">お気に入りに保存</h3>` +
                `<p>気になる素材を保存して後からまとめてダウンロードできます</p>` +
              `</div>` +
            `</div>` +
            `<a class="mat-web-side-fav__link" href="/materials/mypage.html#favorites">使い方を見る</a>` +
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
      items = (items || []).filter((i) => i.category_id === "web");
      items = urlState.sort === "newest"
        ? items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
        : items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
    } else {
      items = await repo.fetchAllItems(urlState.sort === "newest" ? "newest" : "popular");
      items = (items || []).filter((i) => i.category_id === "web");
    }
    return (items || []).map((raw) => enrichItem(raw));
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-web-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-web-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-web-sort]")?.addEventListener("change", (ev) => {
      writeUrlState({ ...urlState, sort: ev.target.value === "newest" ? "newest" : "popular", page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-web-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-web-filter="genre"]')?.value || "",
          usage: root.querySelector('[data-web-filter="usage"]')?.value || "",
          style: root.querySelector('[data-web-filter="style"]')?.value || "",
          layout: root.querySelector('[data-web-filter="layout"]')?.value || "",
          theme: root.querySelector('[data-web-filter="theme"]')?.value || "",
          format: root.querySelector('[data-web-filter="format"]')?.value || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-web-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          { q: "", sort: "popular", usage: "", style: "", layout: "", theme: "", format: "", genre: "", tag: "", page: 1 },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-web-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const sub = btn.getAttribute("data-web-sub") || "";
        writeUrlState({ ...urlState, genre: urlState.genre === sub ? "" : sub, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-web-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-web-tag") || "";
        writeUrlState({ ...urlState, tag: urlState.tag === tag ? "" : tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-web-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-web-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-web-page") || 1);
      if (!page || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-web-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showWebRoot(root, classic) {
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
    ["sfx", "bgm", "image", "illustration", "background", "icon", "code", "document", "presentation", "template"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-web]");
    if (!root) return;

    hideOtherSpecialty();
    showWebRoot(root, classic);

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
      layout: urlState.layout,
      theme: urlState.theme,
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

    document.title = `${DISPLAY_NAME}一覧 | TASFUL Materials`;

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, { category_id: "web", result_count: filtered.length })
        ).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  function hide() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-web]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const otherOn = ["sfx", "bgm", "image", "illustration", "background", "icon", "code", "document", "presentation", "template"].some((key) => {
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
    const root = document.querySelector("[data-materials-list-web]");
    return !!(root && !root.hidden);
  }

  async function mount() {
    await refresh();
  }

  global.TasuMaterialsWebList = {
    renderCard,
    
    mount,
    hide,
    refresh,
    isActive,
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);

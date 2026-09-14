/**
 * TASFUL Materials — 画像素材一覧 Option 4 UI（category=image のみ）
 * 既存 Search / Sort / Download / Favorite Contract を接続。SFX/BGM・他カテゴリUIは変更しない。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const GENERIC_TAGS = new Set(["image", "png", "jpg", "jpeg", "webp", "画像", "画像素材"]);

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

  function genreFilter() {
    return global.TasuMaterialsGenreFilter;
  }

  function formatCount(n) {
    const num = Number(n) || 0;
    if (num >= 10000) return `${(num / 10000).toFixed(1).replace(/\.0$/, "")}万`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(num);
  }

  function enrichItem(raw) {
    const data = global.TasuMaterialsData;
    if (data?.enrichDetail) return data.enrichDetail(raw) || raw;
    return raw;
  }

  function resolveThumbSrc(item) {
    const images = Array.isArray(item.preview_images) ? item.preview_images : [];
    if (images[0]?.src) return String(images[0].src);
    return pickStr(item.thumbnail_url, item.preview_image, item.image, item.download_url);
  }

  function resolveSizeLabel(item) {
    return pickStr(item.meta_resolution, item.meta_size);
  }

  function resolveOrientation(item) {
    const res = pickStr(item.meta_resolution);
    const m = res.match(/(\d+)\s*[×xX]\s*(\d+)/);
    if (m) {
      const w = Number(m[1]);
      const h = Number(m[2]);
      if (w > h) return "landscape";
      if (h > w) return "portrait";
      return "square";
    }
    const size = pickStr(item.meta_size);
    if (/^16\s*:\s*9$/i.test(size) || /^4\s*:\s*3$/i.test(size) || /^3\s*:\s*2$/i.test(size)) return "landscape";
    if (/^9\s*:\s*16$/i.test(size) || /^3\s*:\s*4$/i.test(size) || /^2\s*:\s*3$/i.test(size)) return "portrait";
    if (/^1\s*:\s*1$/i.test(size)) return "square";
    return "";
  }

  function orientationLabel(key) {
    if (key === "landscape") return "横長";
    if (key === "portrait") return "縦長";
    if (key === "square") return "正方形";
    return key;
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => !GENERIC_TAGS.has(String(t).toLowerCase()));
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: params.get("q") || "",
      sort: params.get("sort") === "newest" ? "newest" : "popular",
      genre: params.get("genre") || "",
      usage: params.get("usage") || "",
      orientation: params.get("orientation") || "",
      color: params.get("color") || "",
      people: params.get("people") || "",
      style: params.get("style") || "",
      format: params.get("format") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "image");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("genre", next.genre);
    setOrDel("usage", next.usage);
    setOrDel("orientation", next.orientation);
    setOrDel("color", next.color);
    setOrDel("people", next.people);
    setOrDel("style", next.style);
    setOrDel("format", next.format);
    url.searchParams.delete("sub");
    url.searchParams.delete("size");
    url.searchParams.delete("tag");
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsImageList: true }, "", url);
    else global.history.pushState({ materialsImageList: true }, "", url);
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = `detail.html?slug=${encodeURIComponent(item.slug || item.id)}`;
    const tags = itemTags(item).slice(0, 5);
    const formats = item.file_formats || [];
    const formatLabel = formats[0] || "";
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const sizeLabel = resolveSizeLabel(item);

    return (
      `<article class="mat-img-card" data-img-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
      `<a class="mat-img-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img class="mat-img-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-img-card__img mat-img-card__img--fallback" aria-hidden="true"></span>`) +
      (item.is_free !== false ? `<span class="mat-img-card__free">無料</span>` : "") +
      (sizeLabel
        ? `<span class="mat-img-card__size"><span class="mat-img-card__size-ico" aria-hidden="true"></span>${escapeHtml(sizeLabel)}</span>`
        : "") +
      (formatLabel ? `<span class="mat-img-card__fmt">${escapeHtml(formatLabel)}</span>` : "") +
      `</a>` +
      `<div class="mat-img-card__body">` +
      `<h3 class="mat-img-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-img-card__desc">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-img-card__tags">` +
      tags.map((t) => `<span class="mat-img-card__tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-img-card__foot">` +
      `<span class="mat-img-card__meta"><span class="mat-img-card__star" aria-hidden="true">★</span>${rating}</span>` +
      `<span class="mat-img-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
      `<div class="mat-img-card__actions">` +
      `<button type="button" class="mat-img-card__icon-btn${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<span class="mat-img-card__heart" aria-hidden="true"></span>` +
      `</button>` +
      `<button type="button" class="mat-img-card__icon-btn mat-img-card__icon-btn--dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span class="mat-img-card__dl" aria-hidden="true"></span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function applyFilters(items, filters) {
    const GF = genreFilter();
    return items.filter((item) => {
      if (filters.genre && !(GF && GF.matchGenre(item, "image", filters.genre))) return false;
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.orientation) {
        if (resolveOrientation(item) !== filters.orientation) return false;
      }
      if (filters.usage) {
        if (!GF || !GF.fieldExact(item, "use_case", filters.usage)) return false;
      }
      if (filters.people) {
        if (!GF || !GF.fieldExact(item, "people_presence", filters.people)) return false;
      }
      if (filters.color) {
        if (!GF || !GF.fieldExact(item, "color_family", filters.color)) return false;
      }
      if (filters.style) {
        if (!GF || !GF.fieldExact(item, "style", filters.style)) return false;
      }
      return true;
    });
  }

  function collectFilterOptions(items) {
    const GF = genreFilter();
    const formats = new Map();
    const orientations = new Map();
    const tags = new Map();
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        formats.set(key, (formats.get(key) || 0) + 1);
      });
      const ori = resolveOrientation(item);
      if (ori) orientations.set(ori, (orientations.get(ori) || 0) + 1);
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
    });
    return {
      genreCounts: GF ? GF.collectDemandCounts(items, "image") : {},
      usageCounts: GF ? GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.imageUseCases) : {},
      peopleCounts: GF ? GF.collectFieldCounts(items, "people_presence", GF.PAYLOAD.imagePeople) : {},
      colorCounts: GF ? GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.imageColors) : {},
      styleCounts: GF ? GF.collectFieldCounts(items, "style", GF.PAYLOAD.imageStyles || []) : {},
      orientations,
      formats,
      tags,
    };
  }

  function renderSelect(name, label, optionsMap, selected) {
    const entries = [...optionsMap.entries()];
    if (!entries.length) {
      return (
        `<select class="mat-img-filter" data-img-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}">` +
        `<option value="">${escapeHtml(label)}</option>` +
        `</select>`
      );
    }
    return (
      `<select class="mat-img-filter" data-img-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">` +
      `<option value="">${escapeHtml(label)}</option>` +
      entries
        .map(([value, count]) => {
          const text = name === "orientation" ? orientationLabel(value) : value;
          const sel = selected === value ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(text)} (${count})</option>`;
        })
        .join("") +
      `</select>`
    );
  }

  function renderPagination(page, totalPages) {
    if (totalPages <= 1) {
      return `<nav class="mat-img-pager" aria-label="ページネーション" data-img-pager></nav>`;
    }
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-img-pager__btn" data-img-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const pushPage = (p) => {
      buttons.push(
        `<button type="button" class="mat-img-pager__btn${p === page ? " is-active" : ""}" data-img-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
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
      `<button type="button" class="mat-img-pager__btn" data-img-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    return `<nav class="mat-img-pager" aria-label="ページネーション" data-img-pager>${buttons.join("")}</nav>`;
  }

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  function renderShell(opts) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, tagEntries } =
      opts;
    const activeFilters = [];
    activeFilters.push(`<span class="mat-img-chip-active">画像素材</span>`);
    if (sort === "newest") activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">新着順</span>`);
    else activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--accent">人気順</span>`);
    if (filters.genre) {
      const GF = genreFilter();
      activeFilters.push(
        `<span class="mat-img-chip-active mat-img-chip-active--muted">${escapeHtml((GF && GF.genreLabel("image", filters.genre)) || filters.genre)}</span>`
      );
    }
    if (filters.usage) {
      const GF = genreFilter();
      const row = (GF?.PAYLOAD?.imageUseCases || []).find((u) => u.id === filters.usage);
      activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">${escapeHtml(row?.label || filters.usage)}</span>`);
    }
    if (filters.people) activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">${escapeHtml(filters.people === "present" ? "人物あり" : filters.people === "absent" ? "人物なし" : filters.people)}</span>`);
    if (filters.color) activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">${escapeHtml(filters.color)}</span>`);
    if (filters.orientation) activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">${escapeHtml(orientationLabel(filters.orientation))}</span>`);
    if (filters.format) activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">${escapeHtml(filters.format)}</span>`);
    if (q) activeFilters.push(`<span class="mat-img-chip-active mat-img-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const chips = listCategoryChips()
      .map((c) => {
        const active = c.id === "image";
        const href = c.id ? `list.html?category=${encodeURIComponent(c.id)}` : "list.html";
        return `<a class="mat-img-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
      })
      .join("");

    const popularTags = tagEntries
      .slice(0, 10)
      .map(
        ([tag, count]) =>
          `<button type="button" class="mat-img-popular-tag" data-img-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span>${count}</span></button>`
      )
      .join("");

    return (
      `<div class="mat-img-layout">` +
      `<div class="mat-img-main">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-img-head">` +
      `<h1 class="mat-img-head__title">画像素材一覧</h1>` +
      `<p class="mat-img-head__lead">商用利用OKの高品質な画像素材を探せます</p>` +
      `</div>` +
      `<form class="mat-img-search" data-img-search role="search">` +
      `<div class="mat-img-search__field">` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：ビジネス、自然、人物、食べ物）" aria-label="キーワードで検索" data-img-q>` +
      `</div>` +
      `<button type="submit" class="mat-img-search__btn">検索</button>` +
      `<label class="mat-img-sort">` +
      `<span class="visually-hidden">並び順</span>` +
      `<select data-img-sort aria-label="並び順">` +
      `<option value="popular"${sort === "popular" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `</select>` +
      `</label>` +
      `</form>` +
      `<div class="mat-img-cat-chips mat-list-m-chips" data-img-chips>${chips}</div>` +
      `<div class="mat-img-filters mat-list-m-filters" data-img-filters>` +
      (genreFilter()?.renderGenreSelect?.({
        categoryId: "image",
        selected: filters.genre,
        counts: options.genreCounts,
        className: "mat-img-filter",
        dataAttr: "data-img-filter",
      }) || renderSelect("genre", "ジャンル", new Map(), filters.genre)) +
      (genreFilter()?.renderSelect?.({
        name: "usage",
        label: "用途",
        className: "mat-img-filter",
        dataAttr: "data-img-filter",
        selected: filters.usage,
        catalog: genreFilter().PAYLOAD.imageUseCases,
        counts: options.usageCounts,
      }) || renderSelect("usage", "用途", new Map(), filters.usage)) +
      (genreFilter()?.renderSelect?.({
        name: "people",
        label: "人物",
        className: "mat-img-filter",
        dataAttr: "data-img-filter",
        selected: filters.people,
        catalog: genreFilter().PAYLOAD.imagePeople,
        counts: options.peopleCounts,
      }) || renderSelect("people", "人物", new Map(), filters.people)) +
      renderSelect("orientation", "向き", options.orientations, filters.orientation) +
      (genreFilter()?.renderSelect?.({
        name: "color",
        label: "色",
        className: "mat-img-filter",
        dataAttr: "data-img-filter",
        selected: filters.color,
        catalog: genreFilter().PAYLOAD.imageColors,
        counts: options.colorCounts,
      }) || renderSelect("color", "色", new Map(), filters.color)) +
      (genreFilter()?.renderSelect?.({
        name: "style",
        label: "スタイル",
        className: "mat-img-filter",
        dataAttr: "data-img-filter",
        selected: filters.style,
        catalog: genreFilter().PAYLOAD.imageStyles || [],
        counts: options.styleCounts,
      }) || renderSelect("style", "スタイル", new Map(), filters.style)) +
      renderSelect("format", "形式", options.formats, filters.format) +
      `<button type="button" class="mat-img-clear" data-img-clear>すべてクリア</button>` +
      `<span class="mat-img-result-count" data-img-count>検索結果：<strong>${resultCount}</strong>件</span>` +
      `</div>` +
      (cardsHtml
        ? `<div class="mat-img-grid" data-img-grid>${cardsHtml}</div>`
        : `<p class="mat-img-empty">該当する画像素材がありません。</p>`) +
      renderPagination(page, totalPages) +
      `<div class="mat-img-promo">` +
      `<div class="mat-img-promo__icon" aria-hidden="true"></div>` +
      `<div class="mat-img-promo__body">` +
      `<h3>高品質な画像素材を無料でダウンロード</h3>` +
      `<p>商用利用OK・クレジット表記不要の画像素材を無料でダウンロードできます。</p>` +
      `<p>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-img-promo__cta" href="/login.html">無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `<aside class="mat-img-sidebar" aria-label="絞り込みサイドバー">` +
      `<div class="mat-img-side-card">` +
      `<h3 class="mat-img-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-img-side-active">${activeFilters.join("")}` +
      `<button type="button" class="mat-img-side-clear" data-img-clear>すべてクリア</button>` +
      `</div>` +
      `</div>` +
      `<div class="mat-img-side-card">` +
      `<h3 class="mat-img-side-card__title">カテゴリ</h3>` +
      (global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "image" }) || "") +
      `</div>` +
      (popularTags
        ? `<div class="mat-img-side-card">` +
          `<h3 class="mat-img-side-card__title">人気タグ</h3>` +
          `<div class="mat-img-popular-tags">${popularTags}</div>` +
          `</div>`
        : "") +
      `<div class="mat-img-side-card mat-img-side-card--fav">` +
      `<div class="mat-img-side-fav">` +
      `<div class="mat-img-side-fav__icon" aria-hidden="true"></div>` +
      `<div>` +
      `<h3 class="mat-img-side-card__title">お気に入りに保存</h3>` +
      `<p>気になる素材を保存して後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<a class="mat-img-side-fav__link" href="/materials/mypage.html#favorites">ダッシュボードのお気に入り</a>` +
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
      items = (items || []).filter((i) => i.category_id === "image");
      if (urlState.sort === "newest") {
        items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      const sort = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchAllItems(sort);
      items = (items || []).filter((i) => i.category_id === "image");
    }
    return (items || []).map((raw) => enrichItem(raw));
  }

  function wireInteractions(root, allItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(allItems.map((i) => [i.id, i]));

    root.querySelector("[data-img-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-img-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-img-sort]")?.addEventListener("change", (ev) => {
      const sort = ev.target.value === "newest" ? "newest" : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-img-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-img-filter="genre"]')?.value || "",
          usage: root.querySelector('[data-img-filter="usage"]')?.value || "",
          orientation: root.querySelector('[data-img-filter="orientation"]')?.value || "",
          color: root.querySelector('[data-img-filter="color"]')?.value || "",
          people: root.querySelector('[data-img-filter="people"]')?.value || "",
          style: root.querySelector('[data-img-filter="style"]')?.value || "",
          format: root.querySelector('[data-img-filter="format"]')?.value || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-img-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          {
            q: "",
            sort: "popular",
            genre: "",
            usage: "",
            orientation: "",
            color: "",
            people: "",
            style: "",
            format: "",
            page: 1,
          },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-img-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-img-tag") || "";
        writeUrlState({ ...urlState, tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-img-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-img-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-img-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-img-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showImageRoot(root, classic) {
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
    const bg = document.querySelector("[data-materials-list-background]");
    if (bg) {
      bg.hidden = true;
      bg.innerHTML = "";
    }
    const icon = document.querySelector("[data-materials-list-icon]");
    if (icon) {
      icon.hidden = true;
      icon.innerHTML = "";
    }
    const web = document.querySelector("[data-materials-list-web]");
    if (web) {
      web.hidden = true;
      web.innerHTML = "";
    }
    const code = document.querySelector("[data-materials-list-code]");
    if (code) {
      code.hidden = true;
      code.innerHTML = "";
    }
    ["sfx", "bgm", "illustration"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-image]");
    if (!root) return;

    hideOtherSpecialty();
    showImageRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    const filters = {
      genre: urlState.genre,
      usage: urlState.usage,
      orientation: urlState.orientation,
      color: urlState.color,
      people: urlState.people,
      style: urlState.style,
      format: urlState.format,
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
    });

    wireInteractions(root, pageItems, { ...urlState, page });

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: "image",
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
    const root = document.querySelector("[data-materials-list-image]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const sfxOn = document.querySelector("[data-materials-list-sfx]") && !document.querySelector("[data-materials-list-sfx]").hidden;
    const bgmOn = document.querySelector("[data-materials-list-bgm]") && !document.querySelector("[data-materials-list-bgm]").hidden;
    const illOn = document.querySelector("[data-materials-list-illustration]") && !document.querySelector("[data-materials-list-illustration]").hidden;
    const bgOn = document.querySelector("[data-materials-list-background]") && !document.querySelector("[data-materials-list-background]").hidden;
    const iconOn = document.querySelector("[data-materials-list-icon]") && !document.querySelector("[data-materials-list-icon]").hidden;
    const webOn = document.querySelector("[data-materials-list-web]") && !document.querySelector("[data-materials-list-web]").hidden;
    const codeOn = document.querySelector("[data-materials-list-code]") && !document.querySelector("[data-materials-list-code]").hidden;
    if (classic && !sfxOn && !bgmOn && !illOn && !bgOn && !iconOn && !webOn && !codeOn) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }
  }

  function isActive() {
    return new URLSearchParams(global.location.search).get("category") === "image";
  }

  async function mount() {
    if (!isActive()) {
      hide();
      return false;
    }
    global.TasuMaterialsSfxList?.hide?.();
    global.TasuMaterialsBgmList?.hide?.();
    global.TasuMaterialsIllustrationList?.hide?.();
    global.TasuMaterialsBackgroundList?.hide?.();
    global.TasuMaterialsIconList?.hide?.();
    await refresh();
    return true;
  }

  global.TasuMaterialsImageList = {
    renderCard,
    
    mount,
    refresh,
    hide,
    isActive,
  };
})(typeof window !== "undefined" ? window : globalThis);

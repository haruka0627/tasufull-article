/**
 * TASFUL Materials — イラスト素材一覧 Option 4 UI（category=illustration のみ）
 * 既存 Search / Sort / Download / Favorite Contract を接続。他カテゴリUIは変更しない。
 * 公開 Inventory 0件時は ?qa_fixture=1 の未コミット fixture のみ（正式 Index 非登録 · Production 非影響）。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const GENERIC_TAGS = new Set([
    "illustration",
    "イラスト",
    "イラスト素材",
    "png",
    "jpg",
    "jpeg",
    "svg",
    "webp",
  ]);

  const QA_PREVIEW_OFFICE = "/materials/images/previews/illustration-office-worker.svg";
  const QA_PREVIEW_CHAR = "/materials/images/previews/illustration-simple-character.svg";
  const QA_PREVIEW_MEDICAL = "/materials/images/previews/illustration-medical-staff.svg";
  const QA_PREVIEW_CAT = "/materials/images/previews/illustration-cute-cat.svg";
  const QA_PREVIEW_SPRING = "/materials/images/previews/illustration-seasonal-spring.svg";

  /** Uncommitted QA fixtures only — never written to Index/Inventory. */
  const QA_FIXTURES = Object.freeze([
    {
      id: "qa-fixture-illustration-office-worker",
      slug: "illustration-office-worker",
      title: "パソコンを使う会社員イラスト",
      category_id: "illustration",
      description: "ビジネス記事や資料向けの会社員イラスト素材です。",
      tags: ["ビジネス", "会社員", "人物"],
      file_formats: ["PNG", "SVG"],
      download_count: 1280,
      rating: 4.6,
      rating_count: 84,
      updated_at: "2026-06-21T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_OFFICE,
      preview_images: [{ id: "main", src: QA_PREVIEW_OFFICE, alt: "パソコンを使う会社員イラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-office-worker-qa.svg",
      image_usage: "ビジネス記事・資料",
      meta_resolution: "2400 × 1800 px",
      meta_transparent: "あり（PNG）",
      _qa_fixture: true,
    },
    {
      id: "qa-fixture-illustration-simple-character",
      slug: "illustration-simple-character",
      title: "シンプルキャラクターイラスト",
      category_id: "illustration",
      description: "SNSやLP向けのシンプルなキャラクターイラストです。",
      tags: ["キャラクター", "シンプル", "SNS"],
      file_formats: ["PNG", "SVG"],
      download_count: 980,
      rating: 4.7,
      rating_count: 62,
      updated_at: "2026-06-20T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_CHAR,
      preview_images: [{ id: "main", src: QA_PREVIEW_CHAR, alt: "シンプルキャラクターイラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-simple-character-qa.svg",
      image_usage: "SNS・LP",
      meta_resolution: "2000 × 2000 px",
      meta_transparent: "あり（PNG / SVG）",
      _qa_fixture: true,
    },
    {
      id: "qa-fixture-illustration-medical-staff",
      slug: "illustration-medical-staff",
      title: "医療スタッフイラスト",
      category_id: "illustration",
      description: "病院・クリニックの案内や記事向けの医療スタッフイラストです。",
      tags: ["医療", "人物", "ビジネス"],
      file_formats: ["PNG", "SVG"],
      download_count: 640,
      rating: 4.5,
      rating_count: 41,
      updated_at: "2026-06-18T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_MEDICAL,
      preview_images: [{ id: "main", src: QA_PREVIEW_MEDICAL, alt: "医療スタッフイラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-medical-staff-qa.svg",
      image_usage: "医療・ヘルスケア",
      meta_resolution: "2000 × 1500 px",
      meta_transparent: "あり（PNG）",
      _qa_fixture: true,
    },
    {
      id: "qa-fixture-illustration-cute-cat",
      slug: "illustration-cute-cat",
      title: "かわいい猫イラスト",
      category_id: "illustration",
      description: "ブログやSNS向けのかわいい猫イラスト素材です。",
      tags: ["猫", "かわいい", "動物"],
      file_formats: ["PNG", "SVG"],
      download_count: 2100,
      rating: 4.9,
      rating_count: 156,
      updated_at: "2026-06-22T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_CAT,
      preview_images: [{ id: "main", src: QA_PREVIEW_CAT, alt: "かわいい猫イラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-cute-cat-qa.svg",
      image_usage: "ブログ・SNS",
      meta_resolution: "1800 × 1800 px",
      meta_transparent: "あり（PNG / SVG）",
      _qa_fixture: true,
    },
    {
      id: "qa-fixture-illustration-seasonal-spring",
      slug: "illustration-seasonal-spring",
      title: "春の季節イラスト",
      category_id: "illustration",
      description: "春のキャンペーンや季節記事向けのイラスト素材です。",
      tags: ["季節", "春", "キャンペーン"],
      file_formats: ["PNG", "SVG"],
      download_count: 520,
      rating: 4.4,
      rating_count: 33,
      updated_at: "2026-06-15T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      download_url: QA_PREVIEW_SPRING,
      preview_images: [{ id: "main", src: QA_PREVIEW_SPRING, alt: "春の季節イラスト" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "illustration-seasonal-spring-qa.svg",
      image_usage: "季節・キャンペーン",
      meta_resolution: "2400 × 1500 px",
      meta_transparent: "なし",
      _qa_fixture: true,
    },
  ]);

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
  }

  function resolveQaItems() {
    if (!isQaFixtureMode()) return [];
    return QA_FIXTURES.map((raw) => {
      const enriched = enrichItem({ ...raw });
      return {
        ...enriched,
        preview_images: raw.preview_images,
        download_url: raw.download_url,
        downloadable: raw.downloadable !== false,
        download_kind: raw.download_kind || "file",
        download_filename: raw.download_filename || enriched.download_filename,
        image_usage: raw.image_usage || enriched.image_usage,
        meta_resolution: raw.meta_resolution || enriched.meta_resolution,
        meta_transparent: raw.meta_transparent || enriched.meta_transparent,
        _qa_fixture: true,
      };
    });
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

  function resolveUsage(item) {
    return pickStr(item.image_usage, item.meta_usage, item.usage);
  }

  function resolveTransparentLabel(item) {
    const raw = pickStr(item.image_transparent, item.meta_transparent);
    if (!raw) return "";
    if (/あり|透過|transparent/i.test(raw)) return "透過PNG";
    return "";
  }

  function resolveBackgroundKey(item) {
    const raw = pickStr(item.image_transparent, item.meta_transparent);
    if (!raw) return "";
    if (/あり|透過|transparent/i.test(raw)) return "transparent";
    if (/なし|none/i.test(raw)) return "opaque";
    return raw;
  }

  function backgroundLabel(key) {
    if (key === "transparent") return "透過あり";
    if (key === "opaque") return "透過なし";
    return key;
  }

  function resolveOrientation(item) {
    const res = pickStr(item.meta_resolution, item.meta_size);
    const m = res.match(/(\d+)\s*[×xX]\s*(\d+)/);
    if (m) {
      const w = Number(m[1]);
      const h = Number(m[2]);
      if (w > h) return "landscape";
      if (h > w) return "portrait";
      return "square";
    }
    return "";
  }

  function orientationLabel(key) {
    if (key === "landscape") return "横長";
    if (key === "portrait") return "縦長";
    if (key === "square") return "正方形";
    return key;
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => !GENERIC_TAGS.has(String(t).toLowerCase()) && !GENERIC_TAGS.has(String(t)));
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    const sortRaw = params.get("sort") || "popular";
    const sort =
      sortRaw === "newest" ? "newest" : sortRaw === "downloads" ? "downloads" : "popular";
    return {
      q: params.get("q") || "",
      sort,
      genre: params.get("genre") || "",
      usage: params.get("usage") || "",
      style: params.get("style") || "",
      people: params.get("people") || "",
      background: params.get("background") || "",
      format: params.get("format") || "",
      color: params.get("color") || "",
      orientation: params.get("orientation") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "illustration");
    if (isQaFixtureMode()) url.searchParams.set("qa_fixture", "1");
    else url.searchParams.delete("qa_fixture");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("genre", next.genre);
    setOrDel("usage", next.usage);
    setOrDel("style", next.style);
    setOrDel("people", next.people);
    setOrDel("color", next.color);
    setOrDel("background", next.background);
    setOrDel("format", next.format);
    setOrDel("orientation", next.orientation);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsIllustrationList: true }, "", url);
    else global.history.pushState({ materialsIllustrationList: true }, "", url);
  }

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const tags = itemTags(item).slice(0, 3);
    const formats = item.file_formats || [];
    const formatLabel = formats[0] || "";
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const transparent = resolveTransparentLabel(item);

    return (
      `<article class="mat-ill-card" data-ill-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
      `<a class="mat-ill-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (thumb
        ? `<img class="mat-ill-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
        : `<span class="mat-ill-card__img mat-ill-card__img--fallback" aria-hidden="true"></span>`) +
      (item.is_free !== false
        ? `<span class="mat-ill-card__badge mat-ill-card__badge--free">無料</span>`
        : "") +
      (transparent
        ? `<span class="mat-ill-card__transparent">${escapeHtml(transparent)}</span>`
        : "") +
      `</a>` +
      `<div class="mat-ill-card__body">` +
      `<h3 class="mat-ill-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-ill-card__desc">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-ill-card__tags">` +
      tags.map((t) => `<span class="mat-ill-card__tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-ill-card__foot">` +
      `<span class="mat-ill-card__meta"><span class="mat-ill-card__star" aria-hidden="true">★</span><b>${rating}</b></span>` +
      `<span class="mat-ill-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
      (formatLabel ? `<span class="mat-ill-card__fmt">${escapeHtml(formatLabel)}</span>` : "") +
      `<div class="mat-ill-card__actions">` +
      `<button type="button" class="mat-ill-card__icon-btn${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<span class="mat-ill-card__heart" aria-hidden="true"></span>` +
      `</button>` +
      `<button type="button" class="mat-ill-card__icon-btn mat-ill-card__icon-btn--dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span class="mat-ill-card__dl" aria-hidden="true"></span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function applyFilters(items, filters) {
    const GF = global.TasuMaterialsGenreFilter;
    return items.filter((item) => {
      if (filters.genre && !(GF && GF.matchGenre(item, "illustration", filters.genre))) return false;
      if (filters.usage) {
        if (!GF || !GF.fieldExact(item, "use_case", filters.usage)) return false;
      }
      if (filters.style) {
        if (!GF || !GF.fieldExact(item, "style", filters.style)) return false;
      }
      if (filters.people) {
        if (!GF || !GF.fieldExact(item, "people_presence", filters.people)) return false;
      }
      if (filters.color) {
        if (!GF || !GF.fieldExact(item, "color_family", filters.color)) return false;
      }
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.orientation && resolveOrientation(item) !== filters.orientation) return false;
      if (filters.background && resolveBackgroundKey(item) !== filters.background) return false;
      if (filters.tag) {
        const tags = (item.tags || []).map((t) => String(t));
        if (!tags.includes(filters.tag)) return false;
      }
      return true;
    });
  }

  function collectFilterOptions(items) {
    const formats = new Map();
    const orientations = new Map();
    const backgrounds = new Map();
    const tags = new Map();
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        formats.set(key, (formats.get(key) || 0) + 1);
      });
      const ori = resolveOrientation(item);
      if (ori) orientations.set(ori, (orientations.get(ori) || 0) + 1);
      const bg = resolveBackgroundKey(item);
      if (bg) backgrounds.set(bg, (backgrounds.get(bg) || 0) + 1);
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
    });
    const GF = global.TasuMaterialsGenreFilter;
    return {
      genreCounts: GF ? GF.collectDemandCounts(items, "illustration") : {},
      usageCounts: GF?.PAYLOAD?.illustrationUseCases
        ? GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.illustrationUseCases)
        : {},
      styleCounts: GF?.PAYLOAD?.illustrationStyles
        ? GF.collectFieldCounts(items, "style", GF.PAYLOAD.illustrationStyles)
        : {},
      peopleCounts: GF?.PAYLOAD?.imagePeople
        ? GF.collectFieldCounts(items, "people_presence", GF.PAYLOAD.imagePeople)
        : {},
      colorCounts: GF?.PAYLOAD?.imageColors
        ? GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.imageColors)
        : {},
      backgrounds,
      formats,
      orientations,
      tags,
    };
  }

  function renderSelect(name, label, optionsMap, selected) {
    const entries = [...optionsMap.entries()];
    if (!entries.length) {
      return (
        `<select class="mat-ill-filter" data-ill-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}">` +
        `<option value="">${escapeHtml(label)}</option>` +
        `</select>`
      );
    }
    return (
      `<select class="mat-ill-filter" data-ill-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">` +
      `<option value="">${escapeHtml(label)}</option>` +
      entries
        .map(([value, count]) => {
          let text = value;
          if (name === "orientation") text = orientationLabel(value);
          if (name === "background") text = backgroundLabel(value);
          const sel = selected === value ? " selected" : "";
          return `<option value="${escapeHtml(value)}"${sel}>${escapeHtml(text)} (${count})</option>`;
        })
        .join("") +
      `</select>`
    );
  }

  function renderPagination(page, totalPages) {
    if (totalPages <= 1) {
      return `<nav class="mat-ill-pager" aria-label="ページネーション" data-ill-pager></nav>`;
    }
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-ill-pager__btn" data-ill-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const pushPage = (p) => {
      buttons.push(
        `<button type="button" class="mat-ill-pager__btn${p === page ? " is-active" : ""}" data-ill-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
      );
    };
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      pushPage(1);
      if (start > 2) buttons.push(`<span class="mat-ill-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) pushPage(p);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-ill-pager__ellipsis">…</span>`);
      pushPage(totalPages);
    }
    buttons.push(
      `<button type="button" class="mat-ill-pager__btn" data-ill-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    return `<nav class="mat-ill-pager" aria-label="ページネーション" data-ill-pager>${buttons.join("")}</nav>`;
  }

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  function renderShell(opts) {
    const {
      q,
      sort,
      filters,
      options,
      resultCount,
      page,
      totalPages,
      cardsHtml,
      styleEntries,
      inventoryEmpty,
    } = opts;
    const activeFilters = [];
    activeFilters.push(`<span class="mat-ill-chip-active">イラスト素材</span>`);
    if (sort === "newest") {
      activeFilters.push(`<span class="mat-ill-chip-active mat-ill-chip-active--muted">新着順</span>`);
    } else if (sort === "downloads") {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--accent">ダウンロード数順</span>`
      );
    } else {
      activeFilters.push(`<span class="mat-ill-chip-active mat-ill-chip-active--accent">人気順</span>`);
    }
    if (filters.usage) {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--muted">${escapeHtml(filters.usage)}</span>`
      );
    }
    if (filters.background) {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--muted">${escapeHtml(backgroundLabel(filters.background))}</span>`
      );
    }
    if (filters.format) {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--muted">${escapeHtml(filters.format)}</span>`
      );
    }
    if (filters.orientation) {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--muted">${escapeHtml(orientationLabel(filters.orientation))}</span>`
      );
    }
    if (filters.tag) {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--muted">${escapeHtml(filters.tag)}</span>`
      );
    }
    if (q) {
      activeFilters.push(
        `<span class="mat-ill-chip-active mat-ill-chip-active--muted">「${escapeHtml(q)}」</span>`
      );
    }

    const chips = listCategoryChips()
      .map((c) => {
        const active = c.id === "illustration";
        const href = c.id ? `list.html?category=${encodeURIComponent(c.id)}` : "list.html";
        return (
          `<a class="mat-ill-cat-chip${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>${escapeHtml(c.label)}</a>`
        );
      })
      .join("");

    const styleChips = styleEntries.length
      ? styleEntries
          .slice(0, 8)
          .map(
            ([name, count]) =>
              `<button type="button" class="mat-ill-style${filters.tag === name ? " is-active" : ""}" data-ill-tag="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><span class="mat-ill-style__count">${count}</span></button>`
          )
          .join("")
      : `<p class="mat-ill-side-empty">スタイルデータはまだありません</p>`;

    return (
      `<div class="mat-ill-layout">` +
      `<div class="mat-ill-main">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-ill-head">` +
      `<h1 class="mat-ill-head__title">イラスト一覧</h1>` +
      `<p class="mat-ill-head__lead">商用利用OKの高品質なイラスト素材を探せます</p>` +
      `</div>` +
      `<form class="mat-ill-search" data-ill-search role="search">` +
      `<div class="mat-ill-search__field">` +
      `<label class="visually-hidden" for="mat-ill-q">キーワード検索</label>` +
      `<input id="mat-ill-q" type="search" name="q" data-ill-q placeholder="キーワードで検索（例：ビジネス、人物、猫、医療、季節）" value="${escapeHtml(q)}">` +
      `</div>` +
      `<button type="submit" class="mat-ill-search__btn">検索</button>` +
      `<div class="mat-ill-sort">` +
      `<label class="visually-hidden" for="mat-ill-sort">並び順</label>` +
      `<select id="mat-ill-sort" data-ill-sort>` +
      `<option value="popular"${sort === "popular" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `<option value="downloads"${sort === "downloads" ? " selected" : ""}>ダウンロード数順</option>` +
      `</select>` +
      `</div>` +
      `</form>` +
      `<div class="mat-ill-cat-chips mat-list-m-chips" aria-label="カテゴリ">${chips}</div>` +
      `<div class="mat-ill-filters mat-list-m-filters">` +
      (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
        categoryId: "illustration",
        selected: filters.genre,
        counts: options.genreCounts,
        className: "mat-ill-filter",
        dataAttr: "data-ill-filter",
      }) || renderSelect("genre", "ジャンル", new Map(), filters.genre)) +
      (global.TasuMaterialsGenreFilter?.renderSelect?.({
        name: "usage",
        label: "用途",
        className: "mat-ill-filter",
        dataAttr: "data-ill-filter",
        selected: filters.usage,
        catalog: global.TasuMaterialsGenreFilter.PAYLOAD.illustrationUseCases,
        counts: options.usageCounts,
      }) || renderSelect("usage", "用途", new Map(), filters.usage)) +
      (global.TasuMaterialsGenreFilter?.renderSelect?.({
        name: "style",
        label: "スタイル",
        className: "mat-ill-filter",
        dataAttr: "data-ill-filter",
        selected: filters.style,
        catalog: global.TasuMaterialsGenreFilter.PAYLOAD.illustrationStyles,
        counts: options.styleCounts,
      }) || renderSelect("style", "スタイル", new Map(), filters.style)) +
      (global.TasuMaterialsGenreFilter?.renderSelect?.({
        name: "people",
        label: "人物",
        className: "mat-ill-filter",
        dataAttr: "data-ill-filter",
        selected: filters.people,
        catalog: global.TasuMaterialsGenreFilter.PAYLOAD.imagePeople,
        counts: options.peopleCounts,
      }) || renderSelect("people", "人物", new Map(), filters.people)) +
      renderSelect("background", "背景", options.backgrounds, filters.background) +
      (global.TasuMaterialsGenreFilter?.renderSelect?.({
        name: "color",
        label: "色",
        className: "mat-ill-filter",
        dataAttr: "data-ill-filter",
        selected: filters.color,
        catalog: global.TasuMaterialsGenreFilter.PAYLOAD.imageColors,
        counts: options.colorCounts,
      }) || renderSelect("color", "色", new Map(), filters.color)) +
      renderSelect("format", "形式", options.formats, filters.format) +
      `<button type="button" class="mat-ill-clear" data-ill-clear>すべてクリア</button>` +
      `<span class="mat-ill-result-count">検索結果：<strong>${resultCount.toLocaleString("ja-JP")}件</strong></span>` +
      `</div>` +
      (inventoryEmpty
        ? `<p class="mat-ill-inventory-note">${
            isQaFixtureMode()
              ? "公開Inventoryは0件です。QA fixture で表示中（Index未登録・Production非影響）。"
              : "公開Inventoryは0件です。操作確認は ?qa_fixture=1 を付与してください。"
          }</p>`
        : "") +
      (cardsHtml
        ? `<div class="mat-ill-grid" data-ill-grid>${cardsHtml}</div>`
        : `<p class="mat-ill-empty">該当するイラスト素材がありません。</p>`) +
      renderPagination(page, totalPages) +
      `<div class="mat-ill-promo">` +
      `<div class="mat-ill-promo__icon" aria-hidden="true"></div>` +
      `<div class="mat-ill-promo__body">` +
      `<h3>高品質なイラスト素材を無料でダウンロード</h3>` +
      `<p>商用利用OK・クレジット表記不要のイラスト素材を無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-ill-promo__cta" href="/login.html">無料会員登録する</a>` +
      `</div>` +
      `</div>` +
      `<aside class="mat-ill-sidebar">` +
      `<div class="mat-ill-side-card">` +
      `<h3 class="mat-ill-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-ill-side-active">${activeFilters.join("")}` +
      `<button type="button" class="mat-ill-side-clear" data-ill-clear>すべてクリア</button>` +
      `</div>` +
      `</div>` +
      `<div class="mat-ill-side-card">` +
      `<h3 class="mat-ill-side-card__title">カテゴリ</h3>` +
      (global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "illustration" }) || "") +
      `<div class="mat-ill-side-more"><a href="list.html">すべてのカテゴリを見る ›</a></div>` +
      `</div>` +
      `<div class="mat-ill-side-card">` +
      `<h3 class="mat-ill-side-card__title">人気のスタイル・テイスト</h3>` +
      `<div class="mat-ill-styles">${styleChips}</div>` +
      `</div>` +
      `<div class="mat-ill-side-card mat-ill-side-card--fav">` +
      `<div class="mat-ill-side-fav">` +
      `<span class="mat-ill-side-fav__ico" aria-hidden="true"></span>` +
      `<div>` +
      `<h3 class="mat-ill-side-card__title">お気に入りに保存</h3>` +
      `<p>気になる素材を保存して<br>後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<a class="mat-ill-side-fav__btn" href="/help/">使い方を見る</a>` +
      `</div>` +
      `</aside>` +
      `</div>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>`
    );
  }

  async function loadBaseItems(urlState) {
    const repo = global.TasuMaterialsData?.repository;
    let items = [];
    let inventoryEmpty = true;

    if (repo) {
      try {
        if (urlState.q) {
          items = await repo.searchItems(urlState.q);
          items = (items || []).filter((i) => i.category_id === "illustration");
          if (urlState.sort === "newest") {
            items = items
              .slice()
              .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
          } else {
            items = items
              .slice()
              .sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
          }
        } else if (urlState.sort === "newest") {
          items = await repo.fetchAllItems("newest");
          items = (items || []).filter((i) => i.category_id === "illustration");
        } else {
          items = await repo.fetchAllItems("popular");
          items = (items || []).filter((i) => i.category_id === "illustration");
          if (urlState.sort === "downloads") {
            items = items
              .slice()
              .sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
          }
        }
      } catch {
        items = [];
      }
    }

    inventoryEmpty = !(items && items.length);
    if (inventoryEmpty && isQaFixtureMode()) {
      items = resolveQaItems();
      if (urlState.q) {
        const q = String(urlState.q).toLowerCase();
        items = items.filter(
          (i) =>
            String(i.title || "").toLowerCase().includes(q) ||
            String(i.description || "").toLowerCase().includes(q) ||
            String(i.slug || "").toLowerCase().includes(q) ||
            (i.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
            (i.search_keywords || []).some((t) => String(t).toLowerCase().includes(q))
        );
      }
      if (urlState.sort === "newest") {
        items = items
          .slice()
          .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items
          .slice()
          .sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      items = (items || []).map((raw) => enrichItem(raw));
    }

    return { items: items || [], inventoryEmpty };
  }

  function wireInteractions(root, allItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(allItems.map((i) => [i.id, i]));

    root.querySelector("[data-ill-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-ill-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-ill-sort]")?.addEventListener("change", (ev) => {
      const val = ev.target.value;
      const sort = val === "newest" ? "newest" : val === "downloads" ? "downloads" : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-ill-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-ill-filter="genre"]')?.value || "",
          usage: root.querySelector('[data-ill-filter="usage"]')?.value || "",
          style: root.querySelector('[data-ill-filter="style"]')?.value || "",
          people: root.querySelector('[data-ill-filter="people"]')?.value || "",
          color: root.querySelector('[data-ill-filter="color"]')?.value || "",
          background: root.querySelector('[data-ill-filter="background"]')?.value || "",
          format: root.querySelector('[data-ill-filter="format"]')?.value || "",
          orientation: urlState.orientation,
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-ill-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          {
            q: "",
            sort: "popular",
            genre: "",
            usage: "",
            style: "",
            people: "",
            color: "",
            background: "",
            format: "",
            orientation: "",
            tag: "",
            page: 1,
          },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-ill-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-ill-tag") || "";
        writeUrlState({ ...urlState, tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-ill-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-ill-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-ill-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-ill-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showIllustrationRoot(root, classic) {
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
    ["sfx", "bgm", "image", "background", "icon", "web", "code"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-illustration]");
    if (!root) return;

    hideOtherSpecialty();
    showIllustrationRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const loaded = await loadBaseItems(urlState);
    const baseItems = loaded.items || [];
    const inventoryEmpty = !!loaded.inventoryEmpty;
    const filters = {
      genre: urlState.genre,
      usage: urlState.usage,
      style: urlState.style,
      people: urlState.people,
      color: urlState.color,
      background: urlState.background,
      format: urlState.format,
      orientation: urlState.orientation,
      tag: urlState.tag,
    };
    const options = collectFilterOptions(baseItems);
    const filtered = applyFilters(baseItems, filters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
    const page = Math.min(urlState.page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    const styleEntries = [...options.tags.entries()].sort((a, b) => b[1] - a[1]);

    root.innerHTML = renderShell({
      q: urlState.q,
      sort: urlState.sort,
      filters,
      options,
      resultCount: filtered.length,
      page,
      totalPages: filtered.length ? totalPages : 1,
      cardsHtml: pageItems.map(renderCard).join(""),
      styleEntries,
      inventoryEmpty,
    });

    wireInteractions(root, pageItems, { ...urlState, page });

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: "illustration",
            result_count: filtered.length,
          })
        ).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  function isSpecialtyVisible(key) {
    const el = document.querySelector(`[data-materials-list-${key}]`);
    return !!(el && !el.hidden);
  }

  function hide() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-illustration]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const otherOn =
      isSpecialtyVisible("sfx") ||
      isSpecialtyVisible("bgm") ||
      isSpecialtyVisible("image") ||
      isSpecialtyVisible("background") ||
      isSpecialtyVisible("icon") ||
      isSpecialtyVisible("web") ||
      isSpecialtyVisible("code");
    if (classic && !otherOn) {
      classic.hidden = false;
      classic.removeAttribute("aria-hidden");
      if ("inert" in classic) classic.inert = false;
    }
  }

  function isActive() {
    return new URLSearchParams(global.location.search).get("category") === "illustration";
  }

  async function mount() {
    if (!isActive()) {
      hide();
      return false;
    }
    global.TasuMaterialsSfxList?.hide?.();
    global.TasuMaterialsBgmList?.hide?.();
    global.TasuMaterialsImageList?.hide?.();
    global.TasuMaterialsBackgroundList?.hide?.();
    global.TasuMaterialsIconList?.hide?.();
    await refresh();
    return true;
  }

  global.TasuMaterialsIllustrationList = {
    renderCard,
    
    mount,
    refresh,
    hide,
    isActive,
  };
})(typeof window !== "undefined" ? window : globalThis);

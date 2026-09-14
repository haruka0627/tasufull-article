/**
 * TASFUL Materials — 背景素材一覧 STC Full Retransplant
 * Source: reports/materials-stc-audit/canonical/background-list.html
 * 公開表示名「背景素材」。操作=青 / おすすめ=紫 / 無料=緑。
 * Search / Sort / Filter / Download / Favorite / Related Contract は既存接続。schema 追加なし。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "背景素材";
  const GENERIC_TAGS = new Set(["background", "背景", "背景素材", "png", "jpg", "jpeg", "webp", "svg"]);

  function listCategoryChips() {
    const chips = global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS;
    return Array.isArray(chips) ? chips : [];
  }

  const SIDE_CATS = [
    { key: "グラデーション", icon: "▦", color: "blue" },
    { key: "テクスチャ", icon: "▩", color: "purple" },
    { key: "自然・風景", icon: "✿", color: "green" },
    { key: "抽象・パターン", icon: "◈", color: "pink" },
    { key: "ビジネス・シンプル", icon: "▣", color: "navy" },
    { key: "季節・イベント", icon: "❀", color: "orange" },
    { key: "宇宙・空・星", icon: "✦", color: "indigo" },
    { key: "その他", icon: "…", color: "gray" },
  ];

  const SIDE_CAT_TO_DEMAND = Object.freeze({
    グラデーション: "gradient",
    テクスチャ: "texture",
    "自然・風景": "nature",
    "季節・イベント": "seasonal",
    "宇宙・空・星": "space",
  });

  function normalizeBackgroundGenre(key) {
    if (!key) return "";
    if (SIDE_CAT_TO_DEMAND[key]) return SIDE_CAT_TO_DEMAND[key];
    return key;
  }

  const PATTERN_KEYS = ["グラデーション", "テクスチャ", "パターン", "ボケ", "宇宙", "自然"];

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
    const size = pickStr(item.meta_size, item.meta_ratio);
    if (/^16\s*:\s*9$/i.test(size) || /^4\s*:\s*3$/i.test(size) || /^3\s*:\s*2$/i.test(size)) return "landscape";
    if (/^9\s*:\s*16$/i.test(size) || /^3\s*:\s*4$/i.test(size)) return "portrait";
    if (/^1\s*:\s*1$/i.test(size)) return "square";
    return "";
  }

  function orientationLabel(key) {
    if (key === "landscape") return "横向き";
    if (key === "portrait") return "縦向き";
    if (key === "square") return "正方形";
    return key;
  }

  function itemTags(item) {
    return (item.tags || []).filter((t) => !GENERIC_TAGS.has(String(t).toLowerCase()) && !GENERIC_TAGS.has(String(t)));
  }

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
  }

  /** Uncommitted QA fixtures only — never written to Index/Inventory. Used only when the
   * public inventory has zero background items so contract QA can still exercise the UI. */
  const QA_FIXTURES = Object.freeze([
    {
      id: "qa-fixture-background-gradient-soft",
      slug: "background-gradient-soft",
      title: "ソフトグラデーション背景",
      category_id: "background",
      description: "Webやサムネイル向けのソフトなグラデーション背景素材です。",
      tags: ["背景", "グラデーション", "パステル"],
      file_formats: ["JPG", "PNG"],
      download_count: 1840,
      rating: 4.8,
      rating_count: 96,
      updated_at: "2026-06-22T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "グラデーション",
      download_url: "/materials/images/previews/background-gradient-soft.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-gradient-soft.svg", alt: "ソフトグラデーション背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-gradient-soft-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 2.4 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-cafe",
      slug: "background-cafe",
      title: "お洒落なカフェ背景",
      category_id: "background",
      description: "Webや動画の背景に使えるお洒落なカフェ写真素材です。",
      tags: ["背景", "カフェ", "写真", "テクスチャ"],
      file_formats: ["JPG", "PNG"],
      download_count: 1260,
      rating: 4.5,
      rating_count: 63,
      updated_at: "2026-06-29T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "テクスチャ",
      download_url: "/materials/images/previews/background-cafe.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-cafe.svg", alt: "お洒落なカフェ背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-cafe-qa.svg",
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      file_size: "約 4.1 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-nature-forest",
      slug: "background-nature-forest",
      title: "森の自然風景背景",
      category_id: "background",
      description: "動画・ブログ・LP向けの森の自然風景背景素材です。",
      tags: ["背景", "自然", "風景", "森"],
      file_formats: ["JPG", "PNG"],
      download_count: 980,
      rating: 4.6,
      rating_count: 54,
      updated_at: "2026-06-25T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "自然・風景",
      download_url: "/materials/images/previews/background-nature-forest.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-nature-forest.svg", alt: "森の自然風景背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-nature-forest-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 3.2 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-abstract-pattern",
      slug: "background-abstract-pattern",
      title: "抽象幾何パターン背景",
      category_id: "background",
      description: "テック系・クリエイティブ向けの抽象幾何パターン背景です。",
      tags: ["背景", "抽象", "パターン", "幾何"],
      file_formats: ["JPG", "PNG", "SVG"],
      download_count: 760,
      rating: 4.4,
      rating_count: 38,
      updated_at: "2026-06-18T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "抽象・パターン",
      download_url: "/materials/images/previews/background-abstract-pattern.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-abstract-pattern.svg", alt: "抽象幾何パターン背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-abstract-pattern-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 1.8 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-business-minimal",
      slug: "background-business-minimal",
      title: "ビジネスシンプル背景",
      category_id: "background",
      description: "資料・プレゼン・コーポレートサイト向けのシンプル背景です。",
      tags: ["背景", "ビジネス", "シンプル", "資料"],
      file_formats: ["JPG", "PNG"],
      download_count: 1520,
      rating: 4.7,
      rating_count: 88,
      updated_at: "2026-06-27T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "ビジネス・シンプル",
      download_url: "/materials/images/previews/background-business-minimal.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-business-minimal.svg", alt: "ビジネスシンプル背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-business-minimal-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 1.2 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-seasonal-autumn",
      slug: "background-seasonal-autumn",
      title: "秋の季節イベント背景",
      category_id: "background",
      description: "秋のキャンペーンや季節特集向けのイベント背景素材です。",
      tags: ["背景", "季節", "秋", "イベント"],
      file_formats: ["JPG", "PNG"],
      download_count: 640,
      rating: 4.5,
      rating_count: 41,
      updated_at: "2026-06-12T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "季節・イベント",
      download_url: "/materials/images/previews/background-seasonal-autumn.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-seasonal-autumn.svg", alt: "秋の季節イベント背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-seasonal-autumn-qa.svg",
      meta_resolution: "3840 × 2160 px",
      meta_size: "16:9",
      file_size: "約 2.1 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-starry-sky",
      slug: "background-starry-sky",
      title: "星空・宇宙背景",
      category_id: "background",
      description: "夜空・宇宙・幻想系コンテンツ向けの星空背景素材です。",
      tags: ["背景", "宇宙", "空", "星"],
      file_formats: ["JPG", "PNG"],
      download_count: 2100,
      rating: 4.9,
      rating_count: 132,
      updated_at: "2026-06-30T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "宇宙・空・星",
      download_url: "/materials/images/previews/background-starry-sky.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-starry-sky.svg", alt: "星空・宇宙背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-starry-sky-qa.svg",
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      file_size: "約 3.6 MB",
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-background-cyberpunk-room",
      slug: "background-cyberpunk-room",
      title: "サイバーパンク部屋背景",
      category_id: "background",
      description: "ゲームやSF系コンテンツ向けのサイバーパンク部屋背景です。",
      tags: ["背景", "サイバーパンク", "部屋", "近未来"],
      file_formats: ["JPG", "PNG"],
      download_count: 1180,
      rating: 4.7,
      rating_count: 71,
      updated_at: "2026-06-20T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      subcategory: "抽象・パターン",
      download_url: "/materials/images/previews/background-cyberpunk-room.svg",
      preview_images: [{ id: "main", src: "/materials/images/previews/background-cyberpunk-room.svg", alt: "サイバーパンク部屋背景" }],
      downloadable: true,
      download_kind: "file",
      download_filename: "background-cyberpunk-room-qa.svg",
      meta_resolution: "5760 × 3240 px",
      meta_size: "16:9",
      file_size: "約 4.5 MB",
      _qa_fixture: true,
      _recommended: true,
    },
  ]);

  function resolveQaItems() {
    if (!isQaFixtureMode()) return [];
    return QA_FIXTURES.map((raw) => {
      const enriched = enrichItem({ ...raw });
      return {
        ...enriched,
        preview_images: raw.preview_images,
        download_url: raw.download_url,
        downloadable: true,
        download_kind: raw.download_kind,
        download_filename: raw.download_filename,
        meta_resolution: raw.meta_resolution || enriched.meta_resolution,
        meta_size: raw.meta_size || enriched.meta_size,
        file_size: raw.file_size || enriched.file_size,
        subcategory: raw.subcategory || enriched.subcategory,
        _qa_fixture: true,
        _recommended: !!raw._recommended,
      };
    });
  }

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: params.get("q") || "",
      sort: params.get("sort") === "newest" ? "newest" : "popular",
      usage: params.get("usage") || "",
      style: params.get("style") || "",
      color: params.get("color") || "",
      brightness: params.get("brightness") || "",
      orientation: params.get("orientation") || "",
      format: params.get("format") || "",
      genre: normalizeBackgroundGenre(params.get("genre") || params.get("sub") || ""),
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "background");
    if (isQaFixtureMode()) url.searchParams.set("qa_fixture", "1");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    setOrDel("style", next.style);
    setOrDel("color", next.color);
    url.searchParams.delete("pattern");
    setOrDel("brightness", next.brightness);
    setOrDel("orientation", next.orientation);
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsBackgroundList: true }, "", url);
    else global.history.pushState({ materialsBackgroundList: true }, "", url);
  }

  function matchSideKey(item, key) {
    if (!key) return true;
    if (String(item.subcategory || "") === key) return true;
    const hay = [...(item.tags || []), ...(item.search_keywords || []), item.title, item.description, item.slug].map((x) => String(x || "")).join(" ");
    return hay.includes(key);
  }

  function countBySideKey(items, key) {
    return items.filter((item) => matchSideKey(item, key)).length;
  }

  /* ---------- Card (canonical grid tile) ---------- */
  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const tags = itemTags(item).slice(0, 3);
    const formats = item.file_formats || [];
    const formatLabel = formats[0] ? String(formats[0]).toUpperCase() : "";
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const sizeLabel = resolveSizeLabel(item);
    const recommended = item._recommended || Number(item.download_count || 0) >= 15;

    return (
      `<article class="mat-bg-card" data-bg-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
        `<a class="mat-bg-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">` +
          (thumb
            ? `<img class="mat-bg-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`
            : `<span class="mat-bg-card__img mat-bg-card__img--fallback" aria-hidden="true"></span>`) +
          `<div class="mat-bg-card__badges-tl">` +
            (recommended ? `<span class="mat-bg-card__badge mat-bg-card__badge--rec">おすすめ</span>` : "") +
            `<span class="mat-bg-card__badge mat-bg-card__badge--cat">${DISPLAY_NAME}</span>` +
          `</div>` +
          (item.is_free !== false ? `<span class="mat-bg-card__free">無料</span>` : "") +
          (sizeLabel ? `<span class="mat-bg-card__size"><span aria-hidden="true">▣</span> ${escapeHtml(sizeLabel)}</span>` : "") +
          (formatLabel ? `<span class="mat-bg-card__fmt">${escapeHtml(formatLabel)}</span>` : "") +
        `</a>` +
        `<div class="mat-bg-card__body">` +
          `<h3 class="mat-bg-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
          `<p class="mat-bg-card__desc">${escapeHtml(item.description || "")}</p>` +
          `<div class="mat-bg-card__tags">${tags.map((t) => `<span class="mat-bg-card__tag">${escapeHtml(t)}</span>`).join("")}</div>` +
          `<div class="mat-bg-card__foot">` +
            `<div class="mat-bg-card__meta">` +
              `<span><span class="mat-bg-card__star" aria-hidden="true">★</span>${rating}</span>` +
              `<span><span aria-hidden="true">↓</span>${dl}</span>` +
            `</div>` +
            `<div class="mat-bg-card__actions">` +
              `<button type="button" class="mat-bg-card__icon-btn${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
                `<span class="mat-bg-card__heart" aria-hidden="true"></span>` +
              `</button>` +
              `<button type="button" class="mat-bg-card__icon-btn mat-bg-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
                `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
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
      const genreKey = normalizeBackgroundGenre(filters.genre || filters.sub);
      if (genreKey && !(GF && GF.matchGenre(item, "background", genreKey))) return false;
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.orientation && resolveOrientation(item) !== filters.orientation) return false;
      if (filters.tag) {
        const tags = (item.tags || []).map((t) => String(t));
        if (!tags.includes(filters.tag)) return false;
      }
      if (filters.usage && !(GF && GF.fieldExact(item, "use_case", filters.usage))) return false;
      if (filters.style && !(GF && GF.fieldExact(item, "style", filters.style))) return false;
      if (filters.color && !(GF && GF.fieldExact(item, "color_family", filters.color))) return false;
      if (filters.brightness && !(GF && GF.fieldExact(item, "brightness", filters.brightness))) return false;
      return true;
    });
  }

  function collectFilterOptions(items) {
    const subs = new Map();
    const formats = new Map();
    const orientations = new Map();
    const tags = new Map();
    const patterns = new Map();
    items.forEach((item) => {
      const sub = pickStr(item.subcategory);
      if (sub) subs.set(sub, (subs.get(sub) || 0) + 1);
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (key) formats.set(key, (formats.get(key) || 0) + 1);
      });
      const ori = resolveOrientation(item);
      if (ori) orientations.set(ori, (orientations.get(ori) || 0) + 1);
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
      const hay = [...(item.tags || []), item.subcategory, item.title].join(" ");
      PATTERN_KEYS.forEach((p) => {
        if (hay.includes(p)) patterns.set(p, (patterns.get(p) || 0) + 1);
      });
    });
    const GF = global.TasuMaterialsGenreFilter;
    return { subs, formats, orientations, tags, patterns, genre: genreOptionsMap(items),
      usageCounts: GF ? GF.collectFieldCounts(items, "use_case", GF.PAYLOAD.backgroundUseCases || []) : {},
      styleCounts: GF ? GF.collectFieldCounts(items, "style", GF.PAYLOAD.backgroundStyles || []) : {},
      colorCounts: GF ? GF.collectFieldCounts(items, "color_family", GF.PAYLOAD.backgroundColors || []) : {},
      brightnessCounts: GF ? GF.collectFieldCounts(items, "brightness", GF.PAYLOAD.backgroundBrightness || []) : {},
    };
  }

  function genreOptionsMap(items) {
    const GF = global.TasuMaterialsGenreFilter;
    if (!GF?.collectDemandCounts) return new Map();
    return GF.mapFromCounts(GF.collectDemandCounts(items, "background"));
  }

  function renderFilterSelect(name, label, entries, selected, disabled) {
    if (disabled) {
      return (
        `<label class="mat-bg-filter">` +
          `<span class="visually-hidden">${escapeHtml(label)}</span>` +
          `<select data-bg-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}（未接続）">` +
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
            const display = name === "orientation" ? orientationLabel(key) : key;
            const sel = selected === key ? " selected" : "";
            return `<option value="${escapeHtml(key)}"${sel}>${escapeHtml(display)}（${count}）</option>`;
          })
      )
      .join("");
    return (
      `<label class="mat-bg-filter">` +
        `<span class="visually-hidden">${escapeHtml(label)}</span>` +
        `<select data-bg-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">${opts}</select>` +
      `</label>`
    );
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) return `<nav class="mat-bg-pager" aria-label="ページネーション" data-bg-pager></nav>`;
    const buttons = [];
    buttons.push(`<button type="button" class="mat-bg-pager__btn" data-bg-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`);
    const windowSize = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      buttons.push(`<button type="button" class="mat-bg-pager__btn" data-bg-page="1">1</button>`);
      if (start > 2) buttons.push(`<span class="mat-bg-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(`<button type="button" class="mat-bg-pager__btn${p === page ? " is-active" : ""}" data-bg-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-bg-pager__ellipsis">…</span>`);
      buttons.push(`<button type="button" class="mat-bg-pager__btn" data-bg-page="${totalPages}">${totalPages}</button>`);
    }
    buttons.push(`<button type="button" class="mat-bg-pager__btn" data-bg-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`);
    return `<nav class="mat-bg-pager" aria-label="ページネーション" data-bg-pager>${buttons.join("")}</nav>`;
  }

  function renderShell(ctx) {
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, tagEntries, inventoryEmpty } = ctx;

    const chips = listCategoryChips().map((c) => {
      const href = c.id ? `/materials/list.html?category=${encodeURIComponent(c.id)}` : "/materials/list.html";
      const active = c.id === "background";
      return `<a class="mat-bg-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
    }).join("");

    const activeFilters = [`<span class="mat-bg-chip-active">${DISPLAY_NAME}</span>`];
    activeFilters.push(
      sort === "newest"
        ? `<span class="mat-bg-chip-active mat-bg-chip-active--muted">新着順</span>`
        : `<span class="mat-bg-chip-active mat-bg-chip-active--accent">人気順</span>`
    );
    if (filters.genre) activeFilters.push(`<span class="mat-bg-chip-active mat-bg-chip-active--muted">${escapeHtml(global.TasuMaterialsGenreFilter?.genreLabel?.("background", filters.genre) || filters.genre)}</span>`);
    if (filters.orientation) activeFilters.push(`<span class="mat-bg-chip-active mat-bg-chip-active--muted">${escapeHtml(orientationLabel(filters.orientation))}</span>`);
    if (filters.format) activeFilters.push(`<span class="mat-bg-chip-active mat-bg-chip-active--muted">${escapeHtml(filters.format)}</span>`);
    if (filters.pattern) activeFilters.push(`<span class="mat-bg-chip-active mat-bg-chip-active--muted">${escapeHtml(filters.pattern)}</span>`);
    if (filters.tag) activeFilters.push(`<span class="mat-bg-chip-active mat-bg-chip-active--muted">${escapeHtml(filters.tag)}</span>`);
    if (q) activeFilters.push(`<span class="mat-bg-chip-active mat-bg-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "background" }) || "";

    const popularStyles = tagEntries.length
      ? tagEntries
          .slice(0, 8)
          .map(([tag, count]) => `<button type="button" class="mat-bg-popular-tag" data-bg-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><span>${count}</span></button>`)
          .join("")
      : "";

    return (
      `<div class="mat-bg-layout" data-bg-list>` +
        `<div class="mat-bg-main">` +
          (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
          `<div class="mat-bg-head">` +
            `<h1 class="mat-bg-head__title">${DISPLAY_NAME}一覧</h1>` +
            `<p class="mat-bg-head__lead">Webサイトや動画、デザインの背景に使える高品質な背景素材を探せます</p>` +
          `</div>` +
          `<form class="mat-bg-search" data-bg-search role="search">` +
            `<div class="mat-bg-search__field">` +
              `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例: グラデーション、テクスチャ、青空）" data-bg-q aria-label="背景素材を検索">` +
            `</div>` +
            `<button type="submit" class="mat-bg-search__btn">検索</button>` +
            `<label class="mat-bg-sort">` +
              `<span class="visually-hidden">並び替え</span>` +
              `<select data-bg-sort aria-label="並び替え">` +
                `<option value="popular"${sort !== "newest" ? " selected" : ""}>人気順</option>` +
                `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
              `</select>` +
            `</label>` +
          `</form>` +
          `<div class="mat-bg-cat-chips mat-list-m-chips">${chips}</div>` +
          `<div class="mat-bg-filters mat-list-m-filters" data-bg-filters>` +
            (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
              categoryId: "background",
              selected: filters.genre,
              counts: Object.fromEntries(options.genre || []),
              dataAttr: "data-bg-filter",
              wrapTag: "label",
              wrapClass: "mat-bg-filter",
            }) || renderFilterSelect("genre", "ジャンル", options.genre, filters.genre, !options.genre || options.genre.size === 0)) +
            (global.TasuMaterialsGenreFilter?.renderSelect?.({
              name: "usage",
              label: "用途",
              selected: filters.usage,
              catalog: global.TasuMaterialsGenreFilter.PAYLOAD.backgroundUseCases || [],
              counts: options.usageCounts,
              dataAttr: "data-bg-filter",
              wrapTag: "label",
              wrapClass: "mat-bg-filter",
            }) || renderFilterSelect("usage", "用途", new Map(), filters.usage, true)) +
            (global.TasuMaterialsGenreFilter?.renderSelect?.({
              name: "style",
              label: "スタイル",
              selected: filters.style,
              catalog: global.TasuMaterialsGenreFilter.PAYLOAD.backgroundStyles || [],
              counts: options.styleCounts,
              dataAttr: "data-bg-filter",
              wrapTag: "label",
              wrapClass: "mat-bg-filter",
            }) || renderFilterSelect("style", "スタイル", new Map(), filters.style, true)) +
            (global.TasuMaterialsGenreFilter?.renderSelect?.({
              name: "color",
              label: "色",
              selected: filters.color,
              catalog: global.TasuMaterialsGenreFilter.PAYLOAD.backgroundColors || [],
              counts: options.colorCounts,
              dataAttr: "data-bg-filter",
              wrapTag: "label",
              wrapClass: "mat-bg-filter",
            }) || renderFilterSelect("color", "色", new Map(), filters.color, true)) +
            (global.TasuMaterialsGenreFilter?.renderSelect?.({
              name: "brightness",
              label: "明るさ",
              selected: filters.brightness,
              catalog: global.TasuMaterialsGenreFilter.PAYLOAD.backgroundBrightness || [],
              counts: options.brightnessCounts,
              dataAttr: "data-bg-filter",
              wrapTag: "label",
              wrapClass: "mat-bg-filter",
            }) || renderFilterSelect("brightness", "明るさ", new Map(), filters.brightness, true)) +
            renderFilterSelect("orientation", "向き", options.orientations, filters.orientation, options.orientations.size === 0) +
            renderFilterSelect("format", "形式", options.formats, filters.format, options.formats.size === 0) +
            `<button type="button" class="mat-bg-clear" data-bg-clear>すべてクリア</button>` +
            `<span class="mat-bg-result-count" data-bg-count>検索結果：<strong>${formatCount(resultCount)}</strong>件</span>` +
          `</div>` +
          (inventoryEmpty
            ? `<p class="mat-bg-inventory-note">公開Inventoryは0件です。${isQaFixtureMode() ? "QA fixture で表示中（Index未登録・Production非影響）。" : "操作確認は ?qa_fixture=1 を付与してください。"}</p>`
            : "") +
          (cardsHtml ? `<div class="mat-bg-grid" data-bg-grid>${cardsHtml}</div>` : `<p class="mat-bg-empty">該当する${DISPLAY_NAME}がありません。</p>`) +
          renderPager(page, totalPages) +
          `<section class="mat-bg-cta">` +
            `<div class="mat-bg-cta__inner">` +
              `<div class="mat-bg-cta__copy">` +
                `<div class="mat-bg-cta__icon" aria-hidden="true">▣</div>` +
                `<div>` +
                  `<h2>高品質な${DISPLAY_NAME}を無料でダウンロード</h2>` +
                  `<p>商用利用OK・クレジット表記不要の${DISPLAY_NAME}を無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
                `</div>` +
              `</div>` +
              `<a class="mat-bg-cta__btn" href="/login.html">無料会員登録する</a>` +
            `</div>` +
          `</section>` +
        `</div>` +
        `<aside class="mat-bg-side" aria-label="${DISPLAY_NAME}サイドバー">` +
          `<div class="mat-bg-side-card">` +
            `<h3 class="mat-bg-side-card__title">現在の絞り込み</h3>` +
            `<div class="mat-bg-side-chips">${activeFilters.join("")}</div>` +
            `<button type="button" class="mat-bg-side-clear" data-bg-clear>すべてクリア</button>` +
          `</div>` +
          `<div class="mat-bg-side-card">` +
            `<h3 class="mat-bg-side-card__title">カテゴリ</h3>` +
            `<div class="mat-bg-side-cats">${sideCats}</div>` +
          `</div>` +
          `<div class="mat-bg-side-card">` +
            `<h3 class="mat-bg-side-card__title">人気のスタイル・テイスト</h3>` +
            `<div class="mat-bg-popular-tags">${popularStyles}</div>` +
          `</div>` +
          `<div class="mat-bg-side-card">` +
            `<div class="mat-bg-side-fav">` +
              `<div class="mat-bg-side-fav__icon" aria-hidden="true"></div>` +
              `<div>` +
                `<h3 class="mat-bg-side-card__title">お気に入りに保存</h3>` +
                `<p>気になる素材を保存して後からまとめてダウンロードできます</p>` +
              `</div>` +
            `</div>` +
            `<a class="mat-bg-side-fav__link" href="/materials/mypage.html#favorites">使い方を見る</a>` +
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
      items = (items || []).filter((i) => i.category_id === "background");
      items = urlState.sort === "newest"
        ? items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
        : items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
    } else {
      items = await repo.fetchAllItems(urlState.sort === "newest" ? "newest" : "popular");
      items = (items || []).filter((i) => i.category_id === "background");
    }
    items = (items || []).map((raw) => enrichItem(raw));
    if (!items.length && isQaFixtureMode()) {
      items = resolveQaItems();
      if (urlState.q) {
        const q = String(urlState.q).toLowerCase();
        items = items.filter((item) => [item.title, item.description, item.slug, ...(item.tags || []), ...(item.search_keywords || [])].join(" ").toLowerCase().includes(q));
      }
      items = urlState.sort === "newest"
        ? items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
        : items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
    }
    return items;
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-bg-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-bg-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-bg-sort]")?.addEventListener("change", (ev) => {
      writeUrlState({ ...urlState, sort: ev.target.value === "newest" ? "newest" : "popular", page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-bg-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-bg-filter="genre"]')?.value || "",
          usage: root.querySelector('[data-bg-filter="usage"]')?.value || "",
          style: root.querySelector('[data-bg-filter="style"]')?.value || "",
          color: root.querySelector('[data-bg-filter="color"]')?.value || "",
          brightness: root.querySelector('[data-bg-filter="brightness"]')?.value || "",
          orientation: root.querySelector('[data-bg-filter="orientation"]')?.value || "",
          format: root.querySelector('[data-bg-filter="format"]')?.value || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-bg-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          { q: "", sort: "popular", usage: "", style: "", color: "", brightness: "", orientation: "", format: "", genre: "", tag: "", page: 1 },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-bg-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = btn.getAttribute("data-bg-sub") || "";
        const mapped = normalizeBackgroundGenre(sub);
        writeUrlState({ ...urlState, genre: urlState.genre === mapped ? "" : mapped, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-bg-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-bg-tag") || "";
        writeUrlState({ ...urlState, tag: urlState.tag === tag ? "" : tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-bg-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-bg-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-bg-page") || 1);
      if (!Number.isFinite(page) || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-bg-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showBackgroundRoot(root, classic) {
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
    ["sfx", "bgm", "image", "illustration", "icon", "web", "code", "document", "presentation", "template"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-background]");
    if (!root) return;

    hideOtherSpecialty();
    showBackgroundRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* metrics optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    let inventoryEmpty = true;
    try {
      const published = await global.TasuMaterialsData?.repository?.fetchItemsByCategory?.("background");
      inventoryEmpty = !(published && published.length);
    } catch {
      inventoryEmpty = true;
    }
    const filters = {
      usage: urlState.usage,
      style: urlState.style,
      color: urlState.color,
      brightness: urlState.brightness,
      orientation: urlState.orientation,
      format: urlState.format,
      genre: urlState.genre,
      tag: urlState.tag,
    };
    const options = collectFilterOptions(baseItems);
    options._baseItems = baseItems;
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
      inventoryEmpty,
    });

    wireInteractions(root, pageItems, { ...urlState, page });

    document.title = `${DISPLAY_NAME}一覧 | TASFUL Materials`;

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, { category_id: "background", result_count: filtered.length })
        ).catch(() => {});
      }
    } catch {
      /* analytics failure != search failure */
    }
  }

  function hide() {
    const classic = document.querySelector("[data-materials-list-classic]");
    const root = document.querySelector("[data-materials-list-background]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const otherOn = ["sfx", "bgm", "image", "illustration", "icon", "web", "code", "document", "presentation", "template"].some((key) => {
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
    const root = document.querySelector("[data-materials-list-background]");
    return !!(root && !root.hidden);
  }

  async function mount() {
    await refresh();
    return true;
  }

  global.TasuMaterialsBackgroundList = {
    renderCard,
    
    mount,
    refresh,
    hide,
    isActive,
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * TASFUL Materials — コード素材一覧 Option 4 UI（category=code のみ）
 * 公開表示名「コード素材」（CATEGORIES.name「コードスニペット」は変更しない）。
 * Search / Sort / Download / Favorite Contract は既存接続。schema 追加なし。
 * 言語は既存 tags / file_formats / meta_language のみ。本文からの言語推測禁止。
 * 実行 sandbox / 自動実行は追加しない。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "コード素材";
  const CHIP_LABEL = "コード";
  const GENERIC_TAGS = new Set([
    "code",
    "code-material",
    "コード",
    "コード素材",
    "スニペット",
  ]);

  /** 既存 format コード → 表示ラベル（推測ではなく既知コードの表示正規化） */
  const FORMAT_LABELS = Object.freeze({
    PY: "Python",
    PYTHON: "Python",
    JS: "JavaScript",
    TS: "TypeScript",
    HTML: "HTML",
    CSS: "CSS",
    SQL: "SQL",
    JSON: "JSON",
    SH: "Shell",
    SHELL: "Shell",
    PHP: "PHP",
    CSV: "CSV",
  });

  /** Option 4 サイドカテゴリ。接続可能な tag があるものだけ絞り込み可 */
  const SIDE_CATS = Object.freeze([
    { key: "フロントエンド", tag: "", icon: "💻", uiOnly: true },
    { key: "バックエンド", tag: "python", icon: "▤" },
    { key: "データベース", tag: "csv", icon: "🗄" },
    { key: "UI・コンポーネント", tag: "", icon: "▣", uiOnly: true },
    { key: "API・通信", tag: "", icon: "⇄", uiOnly: true },
    { key: "認証・セキュリティ", tag: "", icon: "🛡", uiOnly: true },
    { key: "ユーティリティ", tag: "file", icon: "⚙" },
    { key: "その他", tag: "data", icon: "…" },
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
    const num = Number(n) || 0;
    return num.toLocaleString("ja-JP");
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
    const fromPreview = pickStr(
      first && (first.src || first.url || first),
      typeof first === "string" ? first : ""
    );
    const candidates = [fromPreview, item.thumbnail_url, item.preview_image, item.preview_url, item.image_url, item.image];
    for (let i = 0; i < candidates.length; i += 1) {
      const u = pickStr(candidates[i]);
      if (u && isImageUrl(u)) return u;
    }
    return "";
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  function formatLabel(fmt) {
    const key = String(fmt || "").toUpperCase();
    return FORMAT_LABELS[key] || key;
  }

  /** Inventory file_formats / known language tags を優先。CATEGORY_META_DEFAULTS のプレースホルダは使わない。 */
  function languageBadge(item) {
    const formats = item.file_formats || [];
    if (formats.length) {
      return formats
        .slice(0, 2)
        .map((f) => formatLabel(f))
        .join(" / ");
    }
    const tags = itemTags(item);
    const langTag = tags.find((t) => FORMAT_LABELS[String(t).toUpperCase()] || /^(python|javascript|typescript|react|php|html|css)$/i.test(t));
    if (langTag) return FORMAT_LABELS[String(langTag).toUpperCase()] || langTag;
    const meta = pickStr(item.meta_language);
    if (meta && meta !== "—" && meta !== "HTML / CSS / JS") {
      const first = meta.split(/[/·,]/)[0].trim();
      if (first) return formatLabel(first);
    }
    return "";
  }

  function languageLabelsForItem(item) {
    const set = new Set();
    (item.file_formats || []).forEach((f) => {
      const label = formatLabel(f);
      if (label) set.add(label);
    });
    itemTags(item).forEach((t) => {
      const upper = String(t).toUpperCase();
      if (FORMAT_LABELS[upper]) set.add(FORMAT_LABELS[upper]);
      else if (/^(python|javascript|typescript|react|php|html|css|vue\.?js|next\.?js|node\.?js|tailwind)$/i.test(t)) {
        set.add(t);
      }
    });
    return [...set];
  }

  function collectLanguages(items) {
    const map = new Map();
    items.forEach((item) => {
      languageLabelsForItem(item).forEach((label) => {
        map.set(label, (map.get(label) || 0) + 1);
      });
    });
    return map;
  }

  function snippetText(item) {
    const code = pickStr(item.code_preview);
    if (!code) return "";
    const lines = code.split(/\r?\n/).slice(0, 6);
    let text = lines.join("\n");
    if (text.length > 220) text = text.slice(0, 220) + "…";
    return text;
  }

  function licenseLabel(item) {
    return pickStr(item.license, item.meta_license, item.license_type);
  }

  /** 実データ（rating / download_count / updated_at）のみから導出する表示用リボン。捏造データではない。 */
  function badgeFor(item) {
    const rating = Number(item.rating || 0);
    if (rating >= 4.8) return { label: "おすすめ", mod: "rec" };
    if (Number(item.download_count || 0) >= 1000) return { label: "人気", mod: "hot" };
    const updated = Date.parse(item.updated_at || "");
    if (!Number.isNaN(updated) && Date.now() - updated <= 30 * 24 * 60 * 60 * 1000) {
      return { label: "新着", mod: "new" };
    }
    return null;
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
      lang: params.get("lang") || "",
      runtime: params.get("runtime") || "",
      license: params.get("license") || "",
      format: params.get("format") || "",
      genre: params.get("genre") || params.get("sub") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", "code");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    setOrDel("lang", next.lang);
    url.searchParams.delete("cat");
    url.searchParams.delete("framework");
    setOrDel("license", next.license);
    setOrDel("runtime", next.runtime);
    setOrDel("format", next.format);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsCodeList: true }, "", url);
    else global.history.pushState({ materialsCodeList: true }, "", url);
  }

  function matchSideKey(item, key) {
    if (!key) return true;
    const cat = SIDE_CATS.find((c) => c.key === key);
    if (!cat || cat.uiOnly || !cat.tag) return false;
    return (item.tags || []).some((t) => String(t).toLowerCase() === String(cat.tag).toLowerCase());
  }

  function countBySideKey(items, key) {
    return items.filter((item) => matchSideKey(item, key)).length;
  }

  function matchLanguage(item, lang) {
    if (!lang) return true;
    const badge = languageBadge(item);
    if (badge && badge.toLowerCase().includes(String(lang).toLowerCase())) return true;
    const formats = (item.file_formats || []).map((f) => formatLabel(f).toLowerCase());
    if (formats.some((f) => f === String(lang).toLowerCase())) return true;
    return (item.tags || []).some((t) => {
      const label = FORMAT_LABELS[String(t).toUpperCase()] || t;
      return String(label).toLowerCase() === String(lang).toLowerCase();
    });
  }

  function collectFilterOptions(items) {
    const formats = new Map();
    const tags = new Map();
    const licenses = new Map();
    items.forEach((item) => {
      (item.file_formats || []).forEach((f) => {
        const key = String(f).toUpperCase();
        if (!key) return;
        formats.set(key, (formats.get(key) || 0) + 1);
      });
      itemTags(item).forEach((t) => {
        tags.set(t, (tags.get(t) || 0) + 1);
      });
      const lic = licenseLabel(item);
      if (lic) licenses.set(lic, (licenses.get(lic) || 0) + 1);
    });
    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts ? GF.collectDemandCounts(items, "code") : {};
    return { formats, tags, licenses, languages: collectLanguages(items), genreCounts };
  }

  function matchCodeGenre(item, key) {
    if (!key) return true;
    const GF = global.TasuMaterialsGenreFilter;
    if (GF?.matchListGenre) return GF.matchListGenre(item, "code", key);
    return false;
  }

  function applyFilters(items, filters) {
    return items.filter((item) => {
      if (filters.format) {
        const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
        if (!formats.includes(String(filters.format).toUpperCase())) return false;
      }
      if (filters.lang && !matchLanguage(item, filters.lang)) return false;
      if (filters.genre || filters.sub) {
        if (!matchCodeGenre(item, filters.genre || filters.sub)) return false;
      }
      if (filters.tag) {
        if (!(item.tags || []).some((t) => String(t) === filters.tag)) return false;
      }
      if (filters.runtime) return false;
      if (filters.usage) return false;
      if (filters.license && licenseLabel(item) !== filters.license) return false;
      return true;
    });
  }

  function renderFilterSelect(name, label, optionsMap, selected, disabled) {
    if (disabled) {
      return (
        `<label class="mat-code-filter">` +
        `<span>${escapeHtml(label)}</span>` +
        `<select data-code-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}（未接続）">` +
        `<option value="">${escapeHtml(label)}</option>` +
        `</select></label>`
      );
    }
    const opts = [`<option value="">${escapeHtml(label)}</option>`]
      .concat(
        [...optionsMap.entries()]
          .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "ja"))
          .map(([val]) => {
            const sel = selected === val ? " selected" : "";
            return `<option value="${escapeHtml(val)}"${sel}>${escapeHtml(val)}</option>`;
          })
      )
      .join("");
    return (
      `<label class="mat-code-filter">` +
      `<span class="visually-hidden">${escapeHtml(label)}</span>` +
      `<select data-code-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">${opts}</select>` +
      `</label>`
    );
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) return `<nav class="mat-code-pager" aria-label="ページネーション" data-code-pager></nav>`;
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-code-pager__btn" data-code-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      buttons.push(`<button type="button" class="mat-code-pager__btn" data-code-page="1">1</button>`);
      if (start > 2) buttons.push(`<span class="mat-code-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(
        `<button type="button" class="mat-code-pager__btn${p === page ? " is-active" : ""}" data-code-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
      );
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-code-pager__ellipsis">…</span>`);
      buttons.push(
        `<button type="button" class="mat-code-pager__btn" data-code-page="${totalPages}">${totalPages}</button>`
      );
    }
    buttons.push(
      `<button type="button" class="mat-code-pager__btn" data-code-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    return `<nav class="mat-code-pager" aria-label="ページネーション" data-code-pager>${buttons.join("")}</nav>`;
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const formats = (item.file_formats || []).map((f) => String(f).toUpperCase());
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const thumb = resolveThumbSrc(item);
    const lang = languageBadge(item);
    const desc = pickStr(item.description, "");
    const snippet = snippetText(item);
    const license = licenseLabel(item);
    const tags = itemTags(item).filter((t) => !/^py$/i.test(t));
    const badge = badgeFor(item);

    let previewHtml;
    if (thumb) {
      previewHtml = `<img class="mat-code-card__img" src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async">`;
    } else if (snippet) {
      previewHtml =
        `<pre class="mat-code-card__snippet" tabindex="0"><code>${escapeHtml(snippet)}</code></pre>`;
    } else {
      previewHtml =
        `<span class="mat-code-card__placeholder" aria-hidden="true">` +
        `<span class="mat-code-card__placeholder-label">&lt;/&gt;</span>` +
        `<span class="mat-code-card__placeholder-note">プレビュー準備中</span>` +
        `</span>`;
    }

    return (
      `<article class="mat-code-card" data-code-card data-item-id="${escapeHtml(item.id)}" data-slug="${escapeHtml(item.slug || "")}">` +
      `<div class="mat-code-card__preview">` +
      (badge
        ? `<span class="mat-code-card__ribbon mat-code-card__ribbon--${escapeHtml(badge.mod)}">${escapeHtml(badge.label)}</span>`
        : item.is_free !== false
          ? `<span class="mat-code-card__badge mat-code-card__badge--free">無料</span>`
          : "") +
      (lang
        ? `<span class="mat-code-card__lang">${escapeHtml(lang)}</span>`
        : `<span class="mat-code-card__lang mat-code-card__lang--cat">${DISPLAY_NAME}</span>`) +
      `<a class="mat-code-card__media" href="${href}" aria-label="${escapeHtml(item.title)}">${previewHtml}</a>` +
      `</div>` +
      `<div class="mat-code-card__body">` +
      `<h3 class="mat-code-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-code-card__desc">${escapeHtml(desc || " ")}</p>` +
      `<div class="mat-code-card__tags">` +
      (formats.length
        ? formats
            .slice(0, 3)
            .map((f) => `<span class="mat-code-card__tag">${escapeHtml(formatLabel(f))}</span>`)
            .join("")
        : "") +
      tags
        .slice(0, 3)
        .map((t) => `<span class="mat-code-card__tag">${escapeHtml(t)}</span>`)
        .join("") +
      `</div>` +
      `<div class="mat-code-card__foot">` +
      `<div class="mat-code-card__metas">` +
      `<span class="mat-code-card__meta"><span class="mat-code-card__star" aria-hidden="true">★</span>${rating}</span>` +
      `<span class="mat-code-card__meta"><span aria-hidden="true">↓</span>${dl}</span>` +
      (license
        ? `<span class="mat-code-card__meta" title="ライセンス"><span aria-hidden="true">©</span>${escapeHtml(license)}</span>`
        : "") +
      `</div>` +
      `<div class="mat-code-card__actions">` +
      `<button type="button" class="mat-code-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<span class="mat-code-card__heart" aria-hidden="true"></span>` +
      `</button>` +
      `<button type="button" class="mat-code-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
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
    const { q, sort, filters, options, resultCount, page, totalPages, cardsHtml, langEntries, baseItems } = ctx;

    const chips = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS
      ? global.TasuMaterialsData.LIST_CATEGORY_CHIPS
      : [])
      .map((c) => {
        const href = c.id ? `/materials/list.html?category=${encodeURIComponent(c.id)}` : "/materials/list.html";
        const active = c.id === "code";
        return `<a class="mat-code-cat-chip${active ? " is-active" : ""}" href="${href}" ${active ? 'aria-current="true"' : ""}>${escapeHtml(c.label)}</a>`;
      })
      .join("");

    const activeFilters = [`<span class="mat-code-chip-active">${CHIP_LABEL}</span>`];
    if (sort === "newest") activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--accent">新着順</span>`);
    else activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--rose">人気順</span>`);
    if (filters.genre) activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--muted">${escapeHtml(filters.genre)}</span>`);
    if (filters.lang) activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--muted">${escapeHtml(filters.lang)}</span>`);
    if (filters.format) activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--muted">${escapeHtml(filters.format)}</span>`);
    if (filters.tag) activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--muted">${escapeHtml(filters.tag)}</span>`);
    if (q) activeFilters.push(`<span class="mat-code-chip-active mat-code-chip-active--muted">「${escapeHtml(q)}」</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: "code" }) || "";

    const popularLangs =
      langEntries.length > 0
        ? langEntries
            .slice(0, 10)
            .map(
              ([lang, count]) =>
                `<button type="button" class="mat-code-popular-tag" data-code-lang="${escapeHtml(lang)}"><span>${escapeHtml(lang)}</span> <span class="mat-code-popular-tag__n">${formatCount(count)}</span></button>`
            )
            .join("")
        : `<p class="mat-code-side-empty">言語データはまだありません。</p>`;

    return (
      `<div class="mat-code-layout" data-code-list>` +
      `<div class="mat-code-main">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-code-head">` +
      `<div class="mat-code-head__icon" aria-hidden="true">&lt;/&gt;</div>` +
      `<div>` +
      `<h1 class="mat-code-head__title">コード素材一覧</h1>` +
      `<p class="mat-code-head__lead">Webサイトやアプリ開発に使えるコード・スニペットを探せます</p>` +
      `</div>` +
      `</div>` +
      `<form class="mat-code-search" data-code-search role="search">` +
      `<div class="mat-code-search__field">` +
      `<span class="mat-code-search__ico" aria-hidden="true">⌕</span>` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：レスポンシブ、ナビゲーション、フォーム）" data-code-q aria-label="コード素材を検索">` +
      `</div>` +
      `<button type="submit" class="mat-code-search__btn">検索</button>` +
      `<label class="mat-code-sort">` +
      `<span class="visually-hidden">並び替え</span>` +
      `<select data-code-sort aria-label="並び替え">` +
      `<option value="popular"${sort !== "newest" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `</select>` +
      `</label>` +
      `</form>` +
      `<div class="mat-code-cat-chips mat-list-m-chips">${chips}</div>` +
      `<div class="mat-code-filters mat-list-m-filters" data-code-filters>` +
      (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
        categoryId: "code",
        selected: filters.genre,
        counts: options.genreCounts,
        dataAttr: "data-code-filter",
        wrapTag: "label",
        wrapClass: "mat-code-filter",
        includeZero: true,
      }) || renderFilterSelect("genre", "ジャンル", new Map(), filters.genre, true)) +
      renderFilterSelect("lang", "言語", options.languages, filters.lang, options.languages.size === 0) +
      renderFilterSelect("runtime", "Runtime / FW", new Map(), filters.runtime, true) +
      renderFilterSelect("usage", "用途", new Map(), filters.usage, true) +
      renderFilterSelect("format", "形式", options.formats, filters.format, options.formats.size === 0) +
      renderFilterSelect("license", "ライセンス", options.licenses, filters.license, options.licenses.size === 0) +
      `<button type="button" class="mat-code-clear" data-code-clear>すべてクリア</button>` +
      `<span class="mat-code-result-count" data-code-count>検索結果：${formatCount(resultCount)}件</span>` +
      `</div>` +
      (cardsHtml
        ? `<div class="mat-code-grid" data-code-grid>${cardsHtml}</div>`
        : `<p class="mat-code-empty">該当するコード素材がありません。</p>`) +
      renderPager(page, totalPages) +
      `<section class="mat-code-cta">` +
      `<div class="mat-code-cta__icon" aria-hidden="true">&lt;/&gt;</div>` +
      `<div class="mat-code-cta__copy">` +
      `<h2>高品質なコード素材を無料でダウンロード</h2>` +
      `<p>商用利用OK・クレジット表記不要のコード素材を無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-code-cta__btn" href="/login.html">無料会員登録する</a>` +
      `</section>` +
      `</div>` +
      `<aside class="mat-code-side" aria-label="コード素材サイドバー">` +
      `<div class="mat-code-side-card">` +
      `<h3 class="mat-code-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-code-side-chips">${activeFilters.join("")}` +
      `<button type="button" class="mat-code-side-clear" data-code-clear>すべてクリア</button>` +
      `</div>` +
      `</div>` +
      `<div class="mat-code-side-card">` +
      `<h3 class="mat-code-side-card__title">カテゴリ</h3>` +
      `<div class="mat-code-side-cats">${sideCats}</div>` +
      `</div>` +
      `<div class="mat-code-side-card">` +
      `<h3 class="mat-code-side-card__title">人気の言語・技術</h3>` +
      `<div class="mat-code-popular-tags">${popularLangs}</div>` +
      `</div>` +
      `<div class="mat-code-side-card mat-code-side-card--fav">` +
      `<div class="mat-code-side-fav">` +
      `<div class="mat-code-side-fav__icon" aria-hidden="true"></div>` +
      `<div>` +
      `<h3 class="mat-code-side-card__title">お気に入りに保存</h3>` +
      `<p>気になる素材を保存して後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<a class="mat-code-side-fav__link" href="/materials/mypage.html#favorites">使い方を見る</a>` +
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
      items = (items || []).filter((i) => i.category_id === "code");
      if (urlState.sort === "newest") {
        items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      const sort = urlState.sort === "newest" ? "newest" : "popular";
      items = await repo.fetchAllItems(sort);
      items = (items || []).filter((i) => i.category_id === "code");
    }
    return (items || []).map((raw) => enrichItem(raw));
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-code-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-code-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-code-sort]")?.addEventListener("change", (ev) => {
      const sort = ev.target.value === "newest" ? "newest" : "popular";
      writeUrlState({ ...urlState, sort, page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-code-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = {
          ...urlState,
          genre: root.querySelector('[data-code-filter="genre"]')?.value || "",
          lang: root.querySelector('[data-code-filter="lang"]')?.value || "",
          runtime: root.querySelector('[data-code-filter="runtime"]')?.value || "",
          usage: root.querySelector('[data-code-filter="usage"]')?.value || "",
          format: root.querySelector('[data-code-filter="format"]')?.value || "",
          license: root.querySelector('[data-code-filter="license"]')?.value || "",
          page: 1,
        };
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-code-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          {
            q: "",
            sort: "popular",
            genre: "",
            usage: "",
            lang: "",
            runtime: "",
            format: "",
            license: "",
            tag: "",
            page: 1,
          },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-code-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const sub = btn.getAttribute("data-code-sub") || "";
        writeUrlState({ ...urlState, sub: urlState.genre === sub ? "" : sub, genre: urlState.genre === sub ? "" : sub, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-code-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-code-lang") || "";
        writeUrlState({ ...urlState, lang: urlState.lang === lang ? "" : lang, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelector("[data-code-pager]")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-code-page]");
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute("data-code-page") || 1);
      if (!page || page < 1) return;
      writeUrlState({ ...urlState, page }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-code-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showCodeRoot(root, classic) {
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
    ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "document", "presentation", "template"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-code]");
    if (!root) return;

    hideOtherSpecialty();
    showCodeRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const baseItems = await loadBaseItems(urlState);
    const filters = {
      usage: urlState.usage,
      lang: urlState.lang,
      runtime: urlState.runtime,
      format: urlState.format,
      license: urlState.license,
      genre: urlState.genre,
      tag: urlState.tag,
    };
    const options = collectFilterOptions(baseItems);
    const filtered = applyFilters(baseItems, filters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
    const page = Math.min(urlState.page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);
    const langEntries = [...options.languages.entries()].sort((a, b) => b[1] - a[1]);

    root.innerHTML = renderShell({
      q: urlState.q,
      sort: urlState.sort,
      filters,
      options,
      resultCount: filtered.length,
      page,
      totalPages: filtered.length ? totalPages : 1,
      cardsHtml: pageItems.map(renderCard).join(""),
      langEntries,
      baseItems,
    });

    wireInteractions(root, pageItems, { ...urlState, page });
    document.title = "コード素材一覧 | TASFUL Materials";

    try {
      const q = String(urlState.q || "").trim();
      if (q.length >= 2) {
        Promise.resolve(
          global.TasuMaterialsSearchMetrics?.recordSearchEvent?.(q, {
            category_id: "code",
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
    const root = document.querySelector("[data-materials-list-code]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const keys = ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "document", "presentation", "template"];
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
    const root = document.querySelector("[data-materials-list-code]");
    return !!(root && !root.hidden);
  }

  async function mount() {
    await refresh();
  }

  global.TasuMaterialsCodeList = {
    renderCard,
    
    mount,
    hide,
    refresh,
    isActive,
    DISPLAY_NAME,
  };
})(typeof window !== "undefined" ? window : globalThis);

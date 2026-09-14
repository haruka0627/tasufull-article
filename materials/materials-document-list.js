/**
 * TASFUL Materials — 文章素材一覧 Option 4 UI
 * URL query: category=text（チップ） / 内部 category_id: document
 * 公開表示名「文例・文章テンプレート」（CATEGORIES.name「文書テンプレート」と query id は変更しない）
 * Search / Sort / Download / Favorite は既存接続。schema / Index 追加なし。
 * 公開 Inventory 0件時は ?qa_fixture=1 の未コミット fixture のみ（正式 Index 非登録）。
 */
(function (global) {
  "use strict";

  const PAGE_SIZE = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_PAGE_SIZE) || 12;
  const DISPLAY_NAME = "文例・文章テンプレート";
  const CHIP_LABEL = "文例・文章テンプレート";
  const QUERY_CATEGORY = "text";
  const DATA_CATEGORY = "document";
  const GENERIC_TAGS = new Set([
    "document",
    "文書",
    "文書テンプレート",
    "文章",
    "文章素材",
    "text",
  ]);

  const SIDE_CATS = Object.freeze([
    { key: "ビジネス文書", tag: "ビジネス", icon: "📄" },
    { key: "メール文例", tag: "メール", icon: "✉" },
    { key: "お知らせ・案内", tag: "お知らせ", icon: "🔔" },
    { key: "自己紹介・プロフィール", tag: "自己紹介", icon: "👤" },
    { key: "お礼・お詫び", tag: "お礼", icon: "☺" },
    { key: "SNS・投稿文", tag: "SNS", icon: "💬", uiOnly: true },
    { key: "キャッチコピー", tag: "キャッチコピー", icon: "💡", uiOnly: true },
    { key: "契約・法務文書", tag: "契約", icon: "📑", uiOnly: true },
    { key: "プレスリリース", tag: "プレス", icon: "📰", uiOnly: true },
    { key: "その他", tag: "文書", icon: "▦" },
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

  function isQaFixtureMode() {
    return new URLSearchParams(global.location.search).get("qa_fixture") === "1";
  }

  /** Uncommitted QA fixtures only — never written to Index/Inventory. */
  const QA_FIXTURES = Object.freeze([
    {
      id: "qa-fixture-document-business-email",
      slug: "qa-document-business-email",
      title: "ビジネスメール（基本）",
      category_id: DATA_CATEGORY,
      description: "社外向けの丁寧なビジネスメール文例",
      tags: ["ビジネス", "メール", "文書"],
      file_formats: ["DOCX", "TXT"],
      download_count: 12,
      rating: 4.8,
      rating_count: 40,
      updated_at: "2026-07-01T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-business-email.txt",
      download_url: "/materials/generated/downloads/document/qa-business-email.txt",
      document_usage: "ビジネスメール",
      meta_char_count: "約320文字",
      document_preview: {
        layout: "email",
        greeting: "いつもお世話になっております。",
        body: "株式会社〇〇の〇〇です。平素より格別のご高配を賜り、誠にありがとうございます。先日お話しした件につきまして、下記の通りご連絡いたします。",
        signoff: "何卒よろしくお願いいたします。",
      },
      _qa_fixture: true,
      _recommended: true,
    },
    {
      id: "qa-fixture-document-interview-mail",
      slug: "qa-document-interview-mail",
      title: "面接日程のご案内メール",
      category_id: DATA_CATEGORY,
      description: "応募者への面接日程調整メール",
      tags: ["採用", "メール", "案内"],
      file_formats: ["DOCX", "TXT"],
      download_count: 20,
      rating: 4.9,
      rating_count: 55,
      updated_at: "2026-07-05T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-interview-mail.txt",
      download_url: "/materials/generated/downloads/document/qa-interview-mail.txt",
      document_usage: "採用メール",
      meta_char_count: "約280文字",
      document_preview: {
        greeting: "このたびは〇〇にご応募いただき、誠にありがとうございます。",
        body: "書類選考の結果、ぜひ一度面接にてお話を伺いたくご連絡いたしました。ご都合の良い日程を2〜3候補ご返信ください。",
      },
      _qa_fixture: true,
      _popular: true,
    },
    {
      id: "qa-fixture-document-thanks-meeting",
      slug: "qa-document-thanks-meeting",
      title: "打ち合わせ後のお礼メール",
      category_id: DATA_CATEGORY,
      description: "商談・打ち合わせ後のお礼文例",
      tags: ["ビジネス", "お礼", "メール"],
      file_formats: ["TXT"],
      download_count: 8,
      rating: 4.7,
      rating_count: 22,
      updated_at: "2026-07-10T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-thanks-meeting.txt",
      download_url: "/materials/generated/downloads/document/qa-thanks-meeting.txt",
      document_usage: "お礼メール",
      meta_char_count: "約210文字",
      document_preview: {
        greeting: "先日はお忙しい中お時間をいただき、ありがとうございました。",
        body: "大変参考になるお話を伺うことができ、今後の参考とさせていただきます。引き続きどうぞよろしくお願いいたします。",
      },
      _qa_fixture: true,
      _new: true,
    },
    {
      id: "qa-fixture-document-self-intro",
      slug: "qa-document-self-intro",
      title: "自己紹介文（プロフィール用）",
      category_id: DATA_CATEGORY,
      description: "SNS・ブログ・プロフィール向け自己紹介",
      tags: ["自己紹介", "プロフィール", "文書"],
      file_formats: ["TXT", "MD"],
      download_count: 25,
      rating: 4.9,
      rating_count: 80,
      updated_at: "2026-07-12T00:00:00.000Z",
      is_free: true,
      is_ad_supported: true,
      button_label: "無料ダウンロード",
      downloadable: true,
      download_kind: "file",
      download_filename: "qa-self-intro.txt",
      download_url: "/materials/generated/downloads/document/qa-self-intro.txt",
      document_usage: "自己紹介",
      meta_char_count: "約180文字",
      document_preview: {
        body: "はじめまして！〇〇と申します。このたびはプロフィールをご覧いただき、ありがとうございます。私は〇〇を専門としており、わかりやすい伝え方を大切にしています。",
      },
      _qa_fixture: true,
      _popular: true,
    },
  ]);

  function resolveQaItems() {
    if (!isQaFixtureMode()) return [];
    return QA_FIXTURES.map((raw) => {
      const enriched = enrichItem({ ...raw });
      return {
        ...enriched,
        document_preview: raw.document_preview || enriched.document_preview || {},
        document_usage: raw.document_usage || enriched.document_usage,
        meta_char_count: raw.meta_char_count || enriched.meta_char_count,
        download_url: raw.download_url,
        downloadable: true,
        download_kind: raw.download_kind,
        download_filename: raw.download_filename,
        _qa_fixture: true,
        _recommended: !!raw._recommended,
        _popular: !!raw._popular,
        _new: !!raw._new,
      };
    });
  }

  function itemTags(item) {
    return (item.tags || [])
      .map((t) => String(t).trim())
      .filter((t) => t && !GENERIC_TAGS.has(t.toLowerCase()) && !GENERIC_TAGS.has(t));
  }

  /** 表示用プレビュー（一覧用）。本文 Contract を書き換えず、安全に短縮表示するだけ。 */
  function textPreview(item) {
    const doc = item.document_preview || {};
    const chunks = [];
    if (pickStr(doc.greeting)) chunks.push(pickStr(doc.greeting));
    if (pickStr(doc.body)) chunks.push(pickStr(doc.body));
    if (Array.isArray(doc.bullets)) {
      doc.bullets.forEach((b) => {
        const s = pickStr(b);
        if (s) chunks.push(s);
      });
    }
    if (pickStr(doc.signoff)) chunks.push(pickStr(doc.signoff));
    if (!chunks.length) {
      const fallback = pickStr(item.long_description, item.description);
      if (fallback) chunks.push(fallback);
    }
    let text = chunks.join("\n").replace(/<[^>]*>/g, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 4);
    text = lines.join("\n");
    if (text.length > 160) text = text.slice(0, 157) + "…";
    return text;
  }

  function badgeFor(item) {
    if (item._recommended) return { label: "おすすめ", mod: "rec" };
    if (item._popular || Number(item.download_count || 0) >= 20) return { label: "人気", mod: "hot" };
    if (item._new) return { label: "新着", mod: "new" };
    const usage = pickStr(item.document_usage);
    if (usage) return { label: usage, mod: "usage" };
    return null;
  }

  function detailHref(item) {
    const qs = new URLSearchParams();
    qs.set("slug", String(item.slug || item.id || ""));
    if (isQaFixtureMode() || item._qa_fixture) qs.set("qa_fixture", "1");
    return `detail.html?${qs.toString()}`;
  }

  function listHref(category) {
    if (!category) return "/materials/list.html";
    return `/materials/list.html?category=${encodeURIComponent(category)}`;
  }

  function readUrlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: params.get("q") || "",
      sort: params.get("sort") === "newest" ? "newest" : "popular",
      usage: params.get("usage") || "",
      tone: params.get("tone") || "",
      length: params.get("length") || "",
      lang: params.get("lang") || "",
      genre: params.get("genre") || params.get("sub") || "",
      tag: params.get("tag") || "",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };
  }

  function writeUrlState(next, replace) {
    const url = new URL(global.location.href);
    url.searchParams.set("category", QUERY_CATEGORY);
    if (isQaFixtureMode()) url.searchParams.set("qa_fixture", "1");
    const setOrDel = (key, val) => {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    };
    setOrDel("q", next.q);
    setOrDel("sort", next.sort && next.sort !== "popular" ? next.sort : "");
    setOrDel("usage", next.usage);
    url.searchParams.delete("scene");
    setOrDel("tone", next.tone);
    setOrDel("length", next.length);
    setOrDel("lang", next.lang);
    setOrDel("genre", next.genre);
    setOrDel("sub", next.genre);
    setOrDel("tag", next.tag);
    setOrDel("page", next.page > 1 ? String(next.page) : "");
    if (replace) global.history.replaceState({ materialsDocumentList: true }, "", url);
    else global.history.pushState({ materialsDocumentList: true }, "", url);
  }

  function matchSideKey(item, key) {
    if (!key) return true;
    const cat = SIDE_CATS.find((c) => c.key === key);
    if (!cat || cat.uiOnly || !cat.tag) return false;
    return (item.tags || []).some((t) => String(t).toLowerCase().includes(String(cat.tag).toLowerCase()));
  }

  function countBySideKey(items, key) {
    return items.filter((item) => matchSideKey(item, key)).length;
  }

  function collectFilterOptions(items) {
    const usages = new Map();
    const lengths = new Map();
    const tags = new Map();
    items.forEach((item) => {
      const usage = pickStr(item.document_usage);
      if (usage && usage !== "—") usages.set(usage, (usages.get(usage) || 0) + 1);
      const len = pickStr(item.meta_char_count);
      if (len && len !== "—") lengths.set(len, (lengths.get(len) || 0) + 1);
      itemTags(item).forEach((t) => tags.set(t, (tags.get(t) || 0) + 1));
    });
    const GF = global.TasuMaterialsGenreFilter;
    const genreCounts = GF?.collectDemandCounts ? GF.collectDemandCounts(items, "document") : {};
    return { usages, lengths, tags, genreCounts };
  }

  function applyFilters(items, filters) {
    return items.filter((item) => {
      if (filters.usage) {
        if (pickStr(item.document_usage) !== filters.usage) return false;
      }
      if (filters.length) {
        if (pickStr(item.meta_char_count) !== filters.length) return false;
      }
      if ((filters.genre || filters.sub) && !(global.TasuMaterialsGenreFilter?.matchListGenre
        ? global.TasuMaterialsGenreFilter.matchListGenre(item, "document", filters.genre || filters.sub)
        : matchSideKey(item, filters.genre || filters.sub))) return false;
      if (filters.tag) {
        if (!(item.tags || []).some((t) => String(t) === filters.tag)) return false;
      }
      if (filters.scene || filters.tone || filters.lang) {
        return false;
      }
      return true;
    });
  }

  function renderFilterSelect(name, label, optionsMap, selected, disabled) {
    if (disabled) {
      return (
        `<label class="mat-doc-filter">` +
        `<span>${escapeHtml(label)}</span>` +
        `<select data-doc-filter="${escapeHtml(name)}" disabled aria-label="${escapeHtml(label)}（未接続）">` +
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
      `<label class="mat-doc-filter">` +
      `<span class="visually-hidden">${escapeHtml(label)}</span>` +
      `<select data-doc-filter="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">${opts}</select>` +
      `</label>`
    );
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) return `<nav class="mat-doc-pager" aria-label="ページネーション" data-doc-pager></nav>`;
    const buttons = [];
    buttons.push(
      `<button type="button" class="mat-doc-pager__btn" data-doc-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="前へ">‹</button>`
    );
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) {
      buttons.push(`<button type="button" class="mat-doc-pager__btn" data-doc-page="1">1</button>`);
      if (start > 2) buttons.push(`<span class="mat-doc-pager__ellipsis">…</span>`);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(
        `<button type="button" class="mat-doc-pager__btn${p === page ? " is-active" : ""}" data-doc-page="${p}" ${p === page ? 'aria-current="page"' : ""}>${p}</button>`
      );
    }
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push(`<span class="mat-doc-pager__ellipsis">…</span>`);
      buttons.push(
        `<button type="button" class="mat-doc-pager__btn" data-doc-page="${totalPages}">${totalPages}</button>`
      );
    }
    buttons.push(
      `<button type="button" class="mat-doc-pager__btn" data-doc-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="次へ">›</button>`
    );
    return `<nav class="mat-doc-pager" aria-label="ページネーション" data-doc-pager>${buttons.join("")}</nav>`;
  }

  function renderCard(item) {
    const Fav = global.TasuMaterialsFavorites;
    const href = detailHref(item);
    const rating = Number(item.rating || 0).toFixed(1);
    const dl = formatCount(item.download_count);
    const favOn = Fav?.isFavorited?.(item.id);
    const preview = textPreview(item);
    const tags = itemTags(item).slice(0, 3);
    const badge = badgeFor(item);
    const charLabel = pickStr(item.meta_char_count);
    const hasPreview = !!preview;

    return (
      `<article class="mat-doc-card" data-doc-card data-item-id="${escapeHtml(item.id)}">` +
      `<div class="mat-doc-card__top">` +
      (badge
        ? `<span class="mat-doc-card__badge mat-doc-card__badge--${escapeHtml(badge.mod)}">${escapeHtml(badge.label)}</span>`
        : `<span class="mat-doc-card__badge mat-doc-card__badge--cat">${DISPLAY_NAME}</span>`) +
      (charLabel && charLabel !== "—"
        ? `<span class="mat-doc-card__chars">${escapeHtml(charLabel)}</span>`
        : "") +
      `</div>` +
      `<a class="mat-doc-card__preview" href="${href}" aria-label="${escapeHtml(item.title)}">` +
      (hasPreview
        ? `<p class="mat-doc-card__excerpt">${escapeHtml(preview).replace(/\n/g, "<br>")}</p>`
        : `<p class="mat-doc-card__excerpt mat-doc-card__excerpt--empty">プレビュー準備中</p>`) +
      `</a>` +
      `<h3 class="mat-doc-card__title"><a href="${href}">${escapeHtml(item.title)}</a></h3>` +
      `<p class="mat-doc-card__desc">${escapeHtml(item.description || "")}</p>` +
      `<div class="mat-doc-card__tags">` +
      tags.map((t) => `<span class="mat-doc-card__tag">${escapeHtml(t)}</span>`).join("") +
      `</div>` +
      `<div class="mat-doc-card__foot">` +
      `<div class="mat-doc-card__metas">` +
      `<span class="mat-doc-card__meta"><span class="mat-doc-card__star" aria-hidden="true">★</span> ${rating}</span>` +
      `<span class="mat-doc-card__meta"><span aria-hidden="true">↓</span> ${dl}</span>` +
      `</div>` +
      `<div class="mat-doc-card__actions">` +
      `<button type="button" class="mat-doc-card__fav${favOn ? " is-favorited" : ""}" data-mat-favorite-btn data-mat-id="${escapeHtml(item.id)}" aria-pressed="${favOn ? "true" : "false"}" aria-label="${favOn ? "お気に入りから削除" : "お気に入りに追加"}">` +
      `<span class="mat-doc-card__heart" aria-hidden="true"></span>` +
      `</button>` +
      `<button type="button" class="mat-doc-card__copy" disabled aria-label="コピー（未接続）">コピー</button>` +
      `<button type="button" class="mat-doc-card__dl" data-mat-download-btn data-mat-id="${escapeHtml(item.id)}" aria-label="ダウンロード">` +
      `<span class="visually-hidden" data-mat-download-label>ダウンロード</span>` +
      `<span aria-hidden="true">↓</span>` +
      `</button>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  function renderShell(state) {
    const {
      q,
      sort,
      filters,
      options,
      resultCount,
      page,
      totalPages,
      cardsHtml,
      baseItems,
      inventoryEmpty,
    } = state;

    const chips = (global.TasuMaterialsData && global.TasuMaterialsData.LIST_CATEGORY_CHIPS
      ? global.TasuMaterialsData.LIST_CATEGORY_CHIPS
      : [])
      .map((c) => {
        const active = c.id === QUERY_CATEGORY;
        return (
          `<a class="mat-doc-cat-chip${active ? " is-active" : ""}" href="${listHref(c.id)}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(c.label)}</a>`
        );
      })
      .join("");

    const activeFilters = [];
    activeFilters.push(`<span class="mat-doc-chip-active">${escapeHtml(CHIP_LABEL)}</span>`);
    if (sort === "newest") activeFilters.push(`<span class="mat-doc-chip-active mat-doc-chip-active--rose">新着順</span>`);
    else activeFilters.push(`<span class="mat-doc-chip-active mat-doc-chip-active--rose">人気順</span>`);
    if (filters.usage) activeFilters.push(`<span class="mat-doc-chip-active mat-doc-chip-active--accent">${escapeHtml(filters.usage)}</span>`);
    if (filters.length) activeFilters.push(`<span class="mat-doc-chip-active mat-doc-chip-active--accent">${escapeHtml(filters.length)}</span>`);
    if (filters.genre) activeFilters.push(`<span class="mat-doc-chip-active mat-doc-chip-active--accent">${escapeHtml(filters.genre)}</span>`);
    if (filters.tag) activeFilters.push(`<span class="mat-doc-chip-active mat-doc-chip-active--accent">${escapeHtml(filters.tag)}</span>`);

    const sideCats = global.TasuMaterialsListSidebar?.renderNav?.({ activeId: DATA_CATEGORY }) || "";

    const toneEntries = [...options.tags.entries()]
      .filter(([t]) => /丁寧|フォーマル|カジュアル|フレンドリー|シンプル|親しみ|誠実|熱意|ビジネス|メール|お礼|自己紹介|案内|採用/.test(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const popularTones = toneEntries.length
      ? toneEntries
          .map(
            ([tag, count]) =>
              `<button type="button" class="mat-doc-popular-tag" data-doc-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span> <span class="mat-doc-popular-tag__n">${formatCount(count)}</span></button>`
          )
          .join("")
      : `<p class="mat-doc-side-empty">文体データはまだありません。</p>`;

    return (
      `<div class="mat-doc-layout" data-doc-list>` +
      `<div class="mat-doc-main">` +
      (global.TasuMaterialsListTopBack?.renderHtml?.() || "") +
      `<div class="mat-doc-head">` +
      `<div class="mat-doc-head__icon" aria-hidden="true">文</div>` +
      `<div>` +
      `<h1 class="mat-doc-head__title">${DISPLAY_NAME}一覧</h1>` +
      `<p class="mat-doc-head__lead">メール・SNS・ビジネス文書など、すぐに使える文章テンプレートを探せます</p>` +
      `</div>` +
      `</div>` +
      (inventoryEmpty
        ? `<p class="mat-doc-inventory-note">公開Inventoryは0件です。${isQaFixtureMode() ? "QA fixture で表示中（Index未登録）。" : "操作確認は ?qa_fixture=1 を付与してください。"}</p>`
        : "") +
      `<form class="mat-doc-search" data-doc-search role="search">` +
      `<div class="mat-doc-search__field">` +
      `<span class="mat-doc-search__ico" aria-hidden="true">⌕</span>` +
      `<input type="search" name="q" value="${escapeHtml(q)}" placeholder="キーワードで検索（例：お礼メール、自己紹介、案内文、キャッチコピー）" data-doc-q aria-label="${DISPLAY_NAME}を検索">` +
      `</div>` +
      `<button type="submit" class="mat-doc-search__btn">検索</button>` +
      `<label class="mat-doc-sort">` +
      `<span class="visually-hidden">並び替え</span>` +
      `<select data-doc-sort aria-label="並び替え">` +
      `<option value="popular"${sort !== "newest" ? " selected" : ""}>人気順</option>` +
      `<option value="newest"${sort === "newest" ? " selected" : ""}>新着順</option>` +
      `</select>` +
      `</label>` +
      `</form>` +
      `<div class="mat-doc-cat-chips mat-list-m-chips">${chips}</div>` +
      `<div class="mat-doc-filters mat-list-m-filters" data-doc-filters>` +
      (global.TasuMaterialsGenreFilter?.renderGenreSelect?.({
        categoryId: "document",
        selected: filters.genre,
        counts: options.genreCounts,
        dataAttr: "data-doc-filter",
        wrapTag: "label",
        wrapClass: "mat-doc-filter",
        includeZero: true,
      }) || renderFilterSelect("genre", "ジャンル", new Map(), filters.genre, true)) +
      renderFilterSelect("usage", "用途", options.usages, filters.usage, options.usages.size === 0) +
      renderFilterSelect("tone", "文体・トーン", new Map(), filters.tone, true) +
      renderFilterSelect("length", "長さ", options.lengths, filters.length, options.lengths.size === 0) +
      renderFilterSelect("lang", "言語", new Map(), filters.lang, true) +
      `<button type="button" class="mat-doc-clear" data-doc-clear>すべてクリア</button>` +
      `<span class="mat-doc-result-count" data-doc-count>検索結果：${formatCount(resultCount)}件</span>` +
      `</div>` +
      (cardsHtml
        ? `<div class="mat-doc-grid" data-doc-grid>${cardsHtml}</div>`
        : `<p class="mat-doc-empty">該当する${DISPLAY_NAME}がありません。</p>`) +
      renderPager(page, totalPages) +
      `<section class="mat-doc-cta">` +
      `<div class="mat-doc-cta__icon" aria-hidden="true">文</div>` +
      `<div class="mat-doc-cta__copy">` +
      `<h2>高品質な${DISPLAY_NAME}を無料でダウンロード</h2>` +
      `<p>商用利用OK・クレジット表記不要の${DISPLAY_NAME}を無料でダウンロードできます。<br>会員登録でお気に入り保存やダウンロード履歴の管理がさらに便利に。</p>` +
      `</div>` +
      `<a class="mat-doc-cta__btn" href="/login.html">無料会員登録する</a>` +
      `</section>` +
      `</div>` +
      `<aside class="mat-doc-side" aria-label="${DISPLAY_NAME}サイドバー">` +
      `<div class="mat-doc-side-card">` +
      `<h3 class="mat-doc-side-card__title">現在の絞り込み</h3>` +
      `<div class="mat-doc-side-chips">${activeFilters.join("")}` +
      `<button type="button" class="mat-doc-side-clear" data-doc-clear>すべてクリア</button>` +
      `</div>` +
      `</div>` +
      `<div class="mat-doc-side-card">` +
      `<h3 class="mat-doc-side-card__title">カテゴリ</h3>` +
      `<div class="mat-doc-side-cats">${sideCats}</div>` +
      `</div>` +
      `<div class="mat-doc-side-card">` +
      `<h3 class="mat-doc-side-card__title">人気の文体・トーン</h3>` +
      `<div class="mat-doc-popular-tags">${popularTones}</div>` +
      `</div>` +
      `<div class="mat-doc-side-card mat-doc-side-card--fav">` +
      `<div class="mat-doc-side-fav">` +
      `<div class="mat-doc-side-fav__icon" aria-hidden="true"></div>` +
      `<div>` +
      `<h3 class="mat-doc-side-card__title">お気に入りに保存</h3>` +
      `<p>気になる${DISPLAY_NAME}を保存して後からまとめてダウンロードできます</p>` +
      `</div>` +
      `</div>` +
      `<a class="mat-doc-side-fav__link" href="/materials/mypage.html#favorites">使い方を見る</a>` +
      `</div>` +
      `</aside>` +
      `<p class="mat-detail-toast" data-mat-toast hidden role="status"></p>` +
      `</div>`
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
          items = (items || []).filter((i) => i.category_id === DATA_CATEGORY);
        } else {
          const sort = urlState.sort === "newest" ? "newest" : "popular";
          items = await repo.fetchAllItems(sort);
          items = (items || []).filter((i) => i.category_id === DATA_CATEGORY);
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
        items = items.slice().sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      } else {
        items = items.slice().sort((a, b) => (Number(b.download_count) || 0) - (Number(a.download_count) || 0));
      }
    } else {
      items = (items || []).map((raw) => enrichItem(raw));
    }

    return { items: items || [], inventoryEmpty };
  }

  function wireInteractions(root, pageItems, urlState) {
    const Download = global.TasuMaterialsDownload;
    const Fav = global.TasuMaterialsFavorites;
    const itemById = new Map(pageItems.map((i) => [i.id, i]));

    root.querySelector("[data-doc-search]")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = root.querySelector("[data-doc-q]")?.value || "";
      writeUrlState({ ...urlState, q: String(q).trim(), page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelector("[data-doc-sort]")?.addEventListener("change", (ev) => {
      writeUrlState({ ...urlState, sort: ev.target.value === "newest" ? "newest" : "popular", page: 1 }, false);
      refresh().catch(() => {});
    });

    root.querySelectorAll("[data-doc-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const next = { ...urlState, page: 1 };
        next[sel.getAttribute("data-doc-filter")] = sel.value || "";
        writeUrlState(next, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-doc-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        writeUrlState(
          {
            q: "",
            sort: "popular",
            genre: "",
            usage: "",
            tone: "",
            length: "",
            tag: "",
            page: 1,
          },
          false
        );
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-doc-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = Number(btn.getAttribute("data-doc-page") || 1);
        if (!p || btn.disabled) return;
        writeUrlState({ ...urlState, page: p }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-doc-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const key = btn.getAttribute("data-doc-sub") || "";
        writeUrlState({ ...urlState, genre: urlState.genre === key ? "" : key, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-doc-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-doc-tag") || "";
        writeUrlState({ ...urlState, tag: urlState.tag === tag ? "" : tag, page: 1 }, false);
        refresh().catch(() => {});
      });
    });

    root.querySelectorAll("[data-doc-card]").forEach((card) => {
      const id = card.getAttribute("data-item-id");
      const item = itemById.get(id);
      if (!item) return;
      Download?.wireDownloadAndFavorite?.(card, item);
      Fav?.updateButton?.(card.querySelector("[data-mat-favorite-btn]"), item);
    });
  }

  function showDocRoot(root, classic) {
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
    ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "code", "presentation", "template"].forEach((key) => {
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
    const root = document.querySelector("[data-materials-list-document]");
    if (!root) return;

    hideOtherSpecialty();
    showDocRoot(root, classic);

    try {
      await global.TasuMaterialsMetrics?.ensureLoaded?.();
    } catch {
      /* optional */
    }

    const urlState = readUrlState();
    const loaded = await loadBaseItems(urlState);
    const baseItems = loaded.items;
    const filters = {
      usage: urlState.usage,
      tone: urlState.tone,
      length: urlState.length,
      lang: urlState.lang,
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
      inventoryEmpty: loaded.inventoryEmpty,
    });

    wireInteractions(root, pageItems, { ...urlState, page });
    document.title = `${DISPLAY_NAME}一覧 | TASFUL Materials`;

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
    const root = document.querySelector("[data-materials-list-document]");
    if (root) {
      root.hidden = true;
      root.innerHTML = "";
      root.removeAttribute("aria-hidden");
      if ("inert" in root) root.inert = true;
    }
    const keys = ["sfx", "bgm", "image", "illustration", "background", "icon", "web", "code", "presentation", "template"];
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
    const root = document.querySelector("[data-materials-list-document]");
    return !!(root && !root.hidden);
  }

  async function mount() {
    await refresh();
  }

  global.TasuMaterialsDocumentList = {
    renderCard,
    
    mount,
    hide,
    refresh,
    isActive,
    DISPLAY_NAME,
    QUERY_CATEGORY,
    DATA_CATEGORY,
  };
})(typeof window !== "undefined" ? window : globalThis);

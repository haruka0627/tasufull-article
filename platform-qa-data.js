/**
 * TASFUL Platform QA — 静的マスタデータ（将来 DB/API 化の正本）
 * Articles: platform-qa-articles.generated.js
 * Keywords: platform-qa-keywords.generated.js（検索語は記事本体と分離）
 * @see docs/AI/TASFUL_AI_QA.md · AD-015
 */
(function (global) {
  "use strict";

  const QA_CATEGORIES = [
    { id: "all", label: "すべて", listLabel: "すべて", icon: "all" },
    { id: "account", label: "会員登録\nアカウント", listLabel: "会員登録・アカウント", icon: "account" },
    { id: "pricing", label: "料金\n・支払い", listLabel: "料金・支払い", icon: "pricing" },
    { id: "search", label: "検索\n・探す", listLabel: "検索・探す", icon: "search" },
    { id: "apply", label: "応募\n・取引", listLabel: "応募・取引", icon: "apply" },
    { id: "listing", label: "掲載\n・依頼", listLabel: "掲載・依頼", icon: "listing" },
    { id: "trading", label: "取引\nルール", listLabel: "取引ルール", icon: "trading" },
    { id: "trouble", label: "トラブル\nサポート", listLabel: "トラブル・サポート", icon: "trouble" },
    { id: "platform", label: "Platform", listLabel: "TASFUL Platform", icon: "platform" },
    { id: "ai", label: "TASFUL\nAI", listLabel: "TASFUL AI", icon: "ai" },
    { id: "tlv", label: "TLV\nLive", listLabel: "TLV Live", icon: "tlv" },
    { id: "talk", label: "TASFUL\nTalk", listLabel: "TASFUL Talk", icon: "talk" },
    { id: "material", label: "Material", listLabel: "Material", icon: "material" },
    { id: "security", label: "セキュリティ", listLabel: "セキュリティ", icon: "security" },
    { id: "legal", label: "規約\nプライバシー", listLabel: "利用規約・プライバシー", icon: "legal" },
    { id: "other", label: "その他", listLabel: "その他", icon: "other" },
  ];

  const QA_UI_REVIEW_SLUGS = [
    "signup",
    "pricing",
    "direct-trading",
    "search-no-results",
    "beginner",
    "apply",
    "contact-vendor",
    "faq",
    "password-reset",
    "account-delete",
    "listing-request",
    "trouble-support",
  ];

  const QA_FEATURED_SLUGS = [
    "signup",
    "pricing",
    "direct-trading",
    "search-no-results",
    "beginner",
    "ai-workspace-start",
    "tlv-start",
    "talk-start",
  ];

  const QA_ARTICLES = Array.isArray(global.PLATFORM_QA_ARTICLES_GENERATED)
    ? global.PLATFORM_QA_ARTICLES_GENERATED.slice()
    : [];

  const QA_SEARCH_KEYWORDS =
    global.PLATFORM_QA_SEARCH_KEYWORDS && typeof global.PLATFORM_QA_SEARCH_KEYWORDS === "object"
      ? global.PLATFORM_QA_SEARCH_KEYWORDS
      : {};

  const STORAGE_DELETED = "tasu_qa_deleted_slugs";
  const STORAGE_ARCHIVED = "tasu_qa_archived_slugs";
  const _searchIndexCache = new WeakMap();
  const _changeListeners = [];

  function isCurationActive() {
    const Config = global.PlatformQaAdminConfig;
    if (!Config?.isDevHost?.()) return false;
    return Config.isAdminUiEnabled?.() === true;
  }

  function loadDeletedSlugsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_DELETED);
      const list = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  const _deletedSlugs = new Set();
  const _archivedSlugs = new Set();
  let _deletedHydrated = false;
  let _archivedHydrated = false;

  function ensureArchivedHydrated() {
    if (_archivedHydrated) return;
    _archivedHydrated = true;
    if (!isCurationActive()) return;
    try {
      const raw = localStorage.getItem(STORAGE_ARCHIVED);
      const list = raw ? JSON.parse(raw) : [];
      for (const slug of Array.isArray(list) ? list.filter(Boolean) : []) _archivedSlugs.add(slug);
    } catch {
      /* ignore */
    }
  }

  function persistArchivedSlugs() {
    if (!isCurationActive()) return;
    try {
      localStorage.setItem(STORAGE_ARCHIVED, JSON.stringify([..._archivedSlugs]));
    } catch {
      /* ignore */
    }
  }

  function isArchived(slug) {
    if (!isCurationActive()) return false;
    ensureArchivedHydrated();
    return _archivedSlugs.has(slug);
  }

  function archiveArticle(slug) {
    if (global.PlatformQaAdminConfig?.isAdminUiEnabled?.() !== true) return false;
    ensureArchivedHydrated();
    if (!slug || isArchived(slug) || isDeleted(slug)) return false;
    if (!QA_ARTICLES.some((a) => a.slug === slug)) return false;
    _archivedSlugs.add(slug);
    persistArchivedSlugs();
    notifyChange();
    return true;
  }

  function unarchiveArticle(slug) {
    if (!isCurationActive()) return false;
    ensureArchivedHydrated();
    if (!slug || !isArchived(slug)) return false;
    _archivedSlugs.delete(slug);
    persistArchivedSlugs();
    notifyChange();
    return true;
  }

  function getArchivedSlugs() {
    if (!isCurationActive()) return [];
    ensureArchivedHydrated();
    return [..._archivedSlugs].sort();
  }

  function ensureDeletedHydrated() {
    if (_deletedHydrated) return;
    _deletedHydrated = true;
    if (!isCurationActive()) return;
    for (const slug of loadDeletedSlugsFromStorage()) _deletedSlugs.add(slug);
  }

  function persistDeletedSlugs() {
    if (!isCurationActive()) return;
    try {
      localStorage.setItem(STORAGE_DELETED, JSON.stringify([..._deletedSlugs]));
    } catch {
      /* ignore */
    }
  }

  function syncDeletedSlugsFromStorage() {
    _deletedSlugs.clear();
    _deletedHydrated = false;
    ensureDeletedHydrated();
  }

  function isDeleted(slug) {
    if (!isCurationActive()) return false;
    ensureDeletedHydrated();
    return _deletedSlugs.has(slug);
  }

  function onChange(fn) {
    if (typeof fn === "function") _changeListeners.push(fn);
  }

  function notifyChange() {
    for (const fn of _changeListeners) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  }

  function deleteArticle(slug) {
    if (global.PlatformQaAdminConfig?.isAdminUiEnabled?.() !== true) return false;
    ensureDeletedHydrated();
    if (!slug || isDeleted(slug)) return false;
    if (!QA_ARTICLES.some((a) => a.slug === slug)) return false;
    _deletedSlugs.add(slug);
    persistDeletedSlugs();
    notifyChange();
    return true;
  }

  function restoreArticle(slug) {
    if (!isCurationActive()) return false;
    if (!slug || !isDeleted(slug)) return false;
    _deletedSlugs.delete(slug);
    persistDeletedSlugs();
    notifyChange();
    return true;
  }

  function getDeletedSlugs() {
    if (!isCurationActive()) return [];
    ensureDeletedHydrated();
    return [..._deletedSlugs].sort();
  }

  function getDeletedCount() {
    if (!isCurationActive()) return 0;
    ensureDeletedHydrated();
    return _deletedSlugs.size;
  }

  /** @param {"lines" | "json"} [format] */
  function exportDeletedSlugs(format) {
    const slugs = getDeletedSlugs();
    if (format === "json") return JSON.stringify(slugs, null, 2);
    if (!slugs.length) return "";
    return `# tasu_qa_deleted_slugs (${slugs.length})\n` + slugs.join("\n");
  }

  function filterActive(articles) {
    return articles.filter((a) => a && !isDeleted(a.slug) && !isArchived(a.slug));
  }

  function getRawBySlug(slug) {
    return QA_ARTICLES.find((a) => a.slug === slug) || null;
  }

  function getCategoryLabel(categoryId) {
    return QA_CATEGORIES.find((c) => c.id === categoryId)?.listLabel || categoryId;
  }

  function getCategoryListLabel(categoryId) {
    return getCategoryLabel(categoryId);
  }

  function getSearchMeta(slug) {
    const meta = QA_SEARCH_KEYWORDS[slug];
    if (!meta) return { keywords: [], aliases: [], synonyms: [] };
    return {
      keywords: meta.keywords || [],
      aliases: meta.aliases || [],
      synonyms: meta.synonyms || [],
    };
  }

  function normalizeSearchText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeQuery(query) {
    return normalizeSearchText(query)
      .split(/[\s\u3000、。,.!?！？/]+/)
      .filter(Boolean);
  }

  function buildSearchHaystack(article) {
    const cached = _searchIndexCache.get(article);
    if (cached) return cached;

    const meta = getSearchMeta(article.slug);
    const parts = [
      article.title,
      article.question,
      article.summary,
      article.service,
      article.persona,
      getCategoryLabel(article.category),
      ...(article.intro || []),
      ...(article.paragraphs || []),
      ...(article.bullets || []),
      ...meta.keywords,
      ...meta.aliases,
      ...meta.synonyms,
    ];
    if (Array.isArray(article.steps)) {
      for (const step of article.steps) {
        if (typeof step === "string") parts.push(step);
        else {
          parts.push(step.title, step.desc);
        }
      }
    }
    const hay = normalizeSearchText(parts.filter(Boolean).join(" "));
    _searchIndexCache.set(article, hay);
    return hay;
  }

  function scoreArticle(article, tokens) {
    if (!tokens.length) return 0;
    const hay = buildSearchHaystack(article);
    const meta = getSearchMeta(article.slug);
    let score = 0;
    for (const t of tokens) {
      if (!hay.includes(t)) return -1;
      if (normalizeSearchText(article.question).includes(t)) score += 12;
      if (normalizeSearchText(article.title).includes(t)) score += 10;
      if (meta.keywords.some((k) => normalizeSearchText(k).includes(t))) score += 8;
      if (meta.aliases.some((k) => normalizeSearchText(k).includes(t))) score += 7;
      if (meta.synonyms.some((k) => normalizeSearchText(k).includes(t))) score += 6;
      if (normalizeSearchText(article.summary).includes(t)) score += 4;
      score += 1;
    }
    return score;
  }

  function sortArticles(articles, sortKey) {
    const list = articles.slice();
    if (sortKey === "relevance") return list;
    if (sortKey === "date-asc") {
      list.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
    } else {
      list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }
    return list;
  }

  function formatListDate(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    if (!y || !m || !d) return iso;
    return `${y}/${m}/${d}`;
  }

  function getBySlug(slug) {
    const article = QA_ARTICLES.find((a) => a.slug === slug) || null;
    if (!article || isDeleted(slug) || isArchived(slug)) return null;
    return article;
  }

  function getAll() {
    return filterActive(QA_ARTICLES);
  }

  function getFeatured() {
    return filterActive(QA_FEATURED_SLUGS.map((slug) => QA_ARTICLES.find((a) => a.slug === slug)).filter(Boolean));
  }

  function searchArticles(query, categoryId) {
    const tokens = tokenizeQuery(query);
    const cat = categoryId && categoryId !== "all" ? categoryId : "";

    const scored = [];
    for (const article of QA_ARTICLES) {
      if (isDeleted(article.slug) || isArchived(article.slug)) continue;
      if (cat && article.category !== cat) continue;
      const score = scoreArticle(article, tokens);
      if (score < 0) continue;
      scored.push({ article, score: tokens.length ? score : 0 });
    }

    scored.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, "ja"));
    return scored.map((row) => row.article);
  }

  function getNeighbors(slug) {
    const active = filterActive(QA_ARTICLES);
    const idx = active.findIndex((a) => a.slug === slug);
    if (idx < 0) return { prev: null, next: null };
    return {
      prev: idx > 0 ? active[idx - 1] : null,
      next: idx < active.length - 1 ? active[idx + 1] : null,
    };
  }

  function toReviewShape(article) {
    if (!article) return null;
    return {
      id: article.id,
      label: article.title,
      query: article.question,
      slug: article.slug,
      ...article,
    };
  }

  function listReviewArticles() {
    return QA_UI_REVIEW_SLUGS.map((slug) => toReviewShape(getBySlug(slug))).filter(Boolean);
  }

  function getStats() {
    let keywordCount = 0;
    let relatedCount = 0;
    const active = filterActive(QA_ARTICLES);
    for (const article of active) {
      const meta = getSearchMeta(article.slug);
      keywordCount += meta.keywords.length + meta.aliases.length + meta.synonyms.length;
      relatedCount += (article.relatedQaSlugs || []).length + (article.related || []).length;
    }
    return {
      articleCount: active.length,
      categoryCount: QA_CATEGORIES.filter((c) => c.id !== "all").length,
      keywordSlugCount: active.length,
      keywordCount,
      relatedLinkCount: relatedCount,
      deletedCount: getDeletedCount(),
    };
  }

  global.PlatformQaData = {
    QA_CATEGORIES,
    QA_FEATURED_SLUGS,
    QA_UI_REVIEW_SLUGS,
    QA_ARTICLES,
    QA_SEARCH_KEYWORDS,
    getCategoryLabel,
    getCategoryListLabel,
    getSearchMeta,
    sortArticles,
    formatListDate,
    getBySlug,
    getAll,
    getFeatured,
    searchArticles,
    getNeighbors,
    listReviewArticles,
    toReviewShape,
    getStats,
    isDeleted,
    deleteArticle,
    restoreArticle,
    getDeletedSlugs,
    getDeletedCount,
    exportDeletedSlugs,
    isCurationActive,
    isArchived,
    archiveArticle,
    unarchiveArticle,
    getArchivedSlugs,
    getRawBySlug,
    notifyChange,
    onChange,
    detailUrl(slug) {
      return `/help/${encodeURIComponent(slug)}/`;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);

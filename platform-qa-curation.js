/**
 * Q&A 整理・レビュー管理（開発モード専用 · localStorage）
 */
(function (global) {
  "use strict";

  const Data = () => global.PlatformQaData;
  const Config = () => global.PlatformQaAdminConfig;

  const STORAGE_REVIEW = "tasu_qa_review_status";
  const STORAGE_CATEGORY_OVR = "tasu_qa_category_overrides";

  const REVIEW_STATUS = Object.freeze({
    UNVERIFIED: "unverified",
    HOLD: "hold",
    ADOPTED: "adopted",
    DELETE_CANDIDATE: "delete-candidate",
  });

  const REVIEW_STATUS_LABELS = Object.freeze({
    [REVIEW_STATUS.UNVERIFIED]: "未確認",
    [REVIEW_STATUS.HOLD]: "保留",
    [REVIEW_STATUS.ADOPTED]: "採用",
    [REVIEW_STATUS.DELETE_CANDIDATE]: "削除候補",
  });

  const TABS = Object.freeze([
    { id: "duplicates", label: "重複候補" },
    { id: "low-quality", label: "低品質候補" },
    { id: "legal", label: "規約系" },
    { id: "pricing", label: "料金系" },
    { id: "trouble", label: "トラブル系" },
    { id: "security", label: "セキュリティ系" },
    { id: "popular", label: "人気候補" },
    { id: "all", label: "全件" },
  ]);

  const GENERIC_PHRASES = [
    "以下のポイントをご確認ください。",
    "不明点はヘルプ・Q&AまたはAI相談をご利用ください。",
    "最新情報は各サービスページでもご確認いただけます。",
    "の基本手順をご確認ください。",
    "についてのご案内です。",
  ];

  let _analysisCache = null;

  function isEnabled() {
    return Config()?.isAdminUiEnabled?.() === true;
  }

  function loadJson(key, fallback) {
    if (!isEnabled()) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    if (!isEnabled()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  function getReviewMap() {
    return loadJson(STORAGE_REVIEW, {});
  }

  function persistReviewMap(map) {
    saveJson(STORAGE_REVIEW, map);
    Data()?.notifyChange?.();
  }

  function getReviewStatus(slug) {
    const map = getReviewMap();
    return map[slug] || REVIEW_STATUS.UNVERIFIED;
  }

  function setReviewStatus(slug, status) {
    if (!isEnabled() || !slug) return false;
    const map = getReviewMap();
    map[slug] = status || REVIEW_STATUS.UNVERIFIED;
    persistReviewMap(map);
    return true;
  }

  function getCategoryOverrides() {
    return loadJson(STORAGE_CATEGORY_OVR, {});
  }

  function setCategoryOverride(slug, categoryId) {
    if (!isEnabled() || !slug) return false;
    const map = getCategoryOverrides();
    if (!categoryId) delete map[slug];
    else map[slug] = categoryId;
    saveJson(STORAGE_CATEGORY_OVR, map);
    Data()?.notifyChange?.();
    return true;
  }

  function getEffectiveCategory(article) {
    if (!article) return "";
    const ovr = getCategoryOverrides()[article.slug];
    return ovr || article.category || "";
  }

  function normalizeText(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[【】（）()［］\[\]「」『』]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripDecorators(s) {
    return String(s || "")
      .replace(/（[^）]*）/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/【[^】]*】/g, "")
      .replace(/^english:\s*/i, "")
      .trim();
  }

  function slugBase(slug) {
    return String(slug || "")
      .replace(/-q\d+$/i, "")
      .replace(/-(beginner|viewer|worker|business|streamer|creator|intermediate|ai-user)$/i, "");
  }

  function getBodyText(article) {
    const parts = [
      article.summary,
      ...(article.intro || []),
      ...(article.paragraphs || []),
      ...(article.bullets || []),
    ];
    if (Array.isArray(article.steps)) {
      for (const step of article.steps) {
        if (typeof step === "string") parts.push(step);
        else parts.push(step.title, step.desc);
      }
    }
    return parts.filter(Boolean).join(" ");
  }

  function keywordSignature(slug) {
    const meta = Data()?.getSearchMeta?.(slug) || {};
    const words = [...(meta.keywords || []), ...(meta.aliases || []), ...(meta.synonyms || [])]
      .map(normalizeText)
      .filter((w) => w.length >= 2)
      .sort();
    if (words.length < 2) return "";
    return words.slice(0, 6).join("|");
  }

  function addToGroup(map, key, slug, reason, groups) {
    if (!key || key.length < 3) return;
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(slug)) list.push(slug);
    if (list.length === 2) groups.push({ key, reason, slugs: list.slice() });
    else if (list.length > 2) {
      const g = groups.find((row) => row.key === key && row.reason === reason);
      if (g) g.slugs = list.slice();
    }
  }

  function buildDuplicateIndex() {
    const articles = Data()?.QA_ARTICLES || [];
    const titleMap = new Map();
    const questionMap = new Map();
    const keywordMap = new Map();
    const slugBaseMap = new Map();
    const groups = [];
    const slugReasons = new Map();

    for (const article of articles) {
      const slug = article.slug;
      addToGroup(titleMap, normalizeText(stripDecorators(article.title)), slug, "title", groups);
      addToGroup(questionMap, normalizeText(stripDecorators(article.question)), slug, "question", groups);
      const sig = keywordSignature(slug);
      if (sig) addToGroup(keywordMap, sig, slug, "keywords", groups);
      addToGroup(slugBaseMap, slugBase(slug), slug, "slug-base", groups);
    }

    for (const group of groups) {
      for (const slug of group.slugs) {
        if (!slugReasons.has(slug)) slugReasons.set(slug, new Set());
        slugReasons.get(slug).add(group.reason);
      }
    }

    const duplicateSlugs = new Set(slugReasons.keys());
    return { groups, slugReasons, duplicateSlugs };
  }

  function analyzeLowQuality(article) {
    const issues = [];
    const body = getBodyText(article);
    if (body.length < 80) issues.push("short-answer");

    let genericHits = 0;
    for (const phrase of GENERIC_PHRASES) {
      if (body.includes(phrase)) genericHits += 1;
    }
    if (genericHits >= 2) issues.push("generic-text");

    const bullets = article.bullets || [];
    const uniqueBullets = new Set(bullets.map(normalizeText));
    if (bullets.length >= 2 && uniqueBullets.size <= 1) issues.push("repetitive");

    const intro = (article.intro || []).join(" ");
    if (intro && body.split(intro).length > 2) issues.push("repetitive");

    if (!(article.relatedQaSlugs || []).length && !(article.related || []).length) {
      issues.push("no-related");
    }
    if (!article.cta && !article.ctaGroup) issues.push("no-cta");

    const title = String(article.title || "");
    const question = String(article.question || "");
    if (/（.+）/.test(title) || /【.+】/.test(title) || /^english:/i.test(title)) {
      issues.push("unnatural-title");
    }
    if (title.length > 48 && /（/.test(title)) issues.push("unnatural-title");
    if (question.length > 60) issues.push("unnatural-question");

    return issues;
  }

  function buildAnalysis() {
    if (_analysisCache) return _analysisCache;
    const dup = buildDuplicateIndex();
    const lowQuality = new Map();
    const lowQualityIssues = new Map();

    for (const article of Data()?.QA_ARTICLES || []) {
      const issues = analyzeLowQuality(article);
      if (issues.length) {
        lowQuality.set(article.slug, issues.length);
        lowQualityIssues.set(article.slug, issues);
      }
    }

    _analysisCache = {
      duplicateGroups: dup.groups,
      duplicateSlugs: dup.duplicateSlugs,
      duplicateReasons: dup.slugReasons,
      lowQualitySlugs: lowQuality,
      lowQualityIssues,
    };
    return _analysisCache;
  }

  function invalidateAnalysis() {
    _analysisCache = null;
  }

  function getDuplicateReasons(slug) {
    const analysis = buildAnalysis();
    const set = analysis.duplicateReasons.get(slug);
    return set ? [...set] : [];
  }

  function getLowQualityIssues(slug) {
    return buildAnalysis().lowQualityIssues.get(slug) || [];
  }

  function isPopularSlug(slug) {
    const featured = Data()?.QA_FEATURED_SLUGS || [];
    const reviewSlugs = Data()?.QA_UI_REVIEW_SLUGS || [];
    if (featured.includes(slug)) return true;
    return reviewSlugs.includes(slug);
  }

  function listForTab(tabId) {
    const analysis = buildAnalysis();
    const articles = Data()?.QA_ARTICLES || [];
    let list = articles.slice();

    if (tabId === "duplicates") {
      list = list.filter((a) => analysis.duplicateSlugs.has(a.slug));
    } else if (tabId === "low-quality") {
      list = list.filter((a) => analysis.lowQualitySlugs.has(a.slug));
    } else if (tabId === "legal") {
      list = list.filter((a) => getEffectiveCategory(a) === "legal");
    } else if (tabId === "pricing") {
      list = list.filter((a) => getEffectiveCategory(a) === "pricing");
    } else if (tabId === "trouble") {
      list = list.filter((a) => getEffectiveCategory(a) === "trouble");
    } else if (tabId === "security") {
      list = list.filter((a) => getEffectiveCategory(a) === "security");
    } else if (tabId === "popular") {
      list = list.filter((a) => isPopularSlug(a.slug));
    }

    return list
      .map((article) => ({
        article,
        reviewStatus: getReviewStatus(article.slug),
        duplicateReasons: getDuplicateReasons(article.slug),
        qualityIssues: getLowQualityIssues(article.slug),
        effectiveCategory: getEffectiveCategory(article),
        isDeleted: Data()?.isDeleted?.(article.slug) === true,
        isArchived: Data()?.isArchived?.(article.slug) === true,
      }))
      .sort((a, b) => {
        if (tabId === "duplicates") return b.duplicateReasons.length - a.duplicateReasons.length;
        if (tabId === "low-quality") return b.qualityIssues.length - a.qualityIssues.length;
        return a.article.title.localeCompare(b.article.title, "ja");
      });
  }

  function getTabCounts() {
    const counts = {};
    for (const tab of TABS) counts[tab.id] = listForTab(tab.id).length;
    return counts;
  }

  function bulkDelete(slugs) {
    if (!isEnabled()) return 0;
    let n = 0;
    for (const slug of slugs) {
      if (Data()?.deleteArticle?.(slug)) n += 1;
    }
    return n;
  }

  function bulkArchive(slugs) {
    if (!isEnabled()) return 0;
    let n = 0;
    for (const slug of slugs) {
      if (Data()?.archiveArticle?.(slug)) n += 1;
    }
    return n;
  }

  function bulkSetReviewStatus(slugs, status) {
    if (!isEnabled()) return 0;
    const map = getReviewMap();
    for (const slug of slugs) map[slug] = status;
    persistReviewMap(map);
    return slugs.length;
  }

  function bulkSetCategory(slugs, categoryId) {
    if (!isEnabled() || !categoryId) return 0;
    const map = getCategoryOverrides();
    for (const slug of slugs) map[slug] = categoryId;
    saveJson(STORAGE_CATEGORY_OVR, map);
    Data()?.notifyChange?.();
    return slugs.length;
  }

  global.PlatformQaCuration = {
    REVIEW_STATUS,
    REVIEW_STATUS_LABELS,
    TABS,
    isEnabled,
    buildAnalysis,
    invalidateAnalysis,
    listForTab,
    getTabCounts,
    getReviewStatus,
    setReviewStatus,
    getCategoryOverrides,
    setCategoryOverride,
    getEffectiveCategory,
    getDuplicateReasons,
    getLowQualityIssues,
    bulkDelete,
    bulkArchive,
    bulkSetReviewStatus,
    bulkSetCategory,
  };
})(typeof window !== "undefined" ? window : globalThis);

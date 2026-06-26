/**
 * TasuFull — 一覧検索（正規化・スコアリング）
 * 将来: サジェスト / 人気検索 / AIおすすめ / 最近の検索
 */
(function (global) {
  "use strict";

  const SCORE_WEIGHTS = {
    title: 100,
    tag: 80,
    category: 60,
    owner: 50,
    description: 30,
    keywords: 10,
  };

  /** 全トークン一致ボーナス（複数キーワード優先） */
  const ALL_TOKENS_BONUS = 50;

  const DATASET_LABELS = {
    condition: {
      new: "新品",
      used: "中古",
      unused: "未使用",
      mint: "美品",
      instant: "即対応",
      certified: "認定",
      popular: "人気",
      remote: "リモート",
      fulltime: "正社員",
      urgent: "急募",
    },
    shipping: {
      free: "送料無料",
      standard: "通常配送",
      pickup: "手渡し 受取",
    },
    speed: {
      instant: "即対応",
      normal: "通常",
    },
    certified: {
      yes: "認定あり",
      no: "認定なし",
    },
    employment: {
      fulltime: "正社員",
      parttime: "パート",
      contract: "業務委託",
    },
    remote: {
      yes: "リモート可",
      no: "出社",
    },
    urgent: {
      yes: "急募",
      no: "",
    },
    sameDay: {
      yes: "即日対応",
      no: "",
    },
    night: {
      yes: "深夜対応",
      no: "日中のみ",
    },
    hasCar: {
      yes: "車あり",
      no: "",
    },
    status: {
      available: "対応可能",
      open: "対応可能",
      recruiting: "募集中",
      busy: "対応中",
    },
  };

  /** @type {{ suggest?: Function, popular?: Function, recommend?: Function }} */
  const extensions = {};

  function normalizeSearchText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\u3000/g, " ")
      .replace(/\s+/g, " ");
  }

  function parseSearchQuery(raw) {
    const normalized = normalizeSearchText(raw);
    if (!normalized) {
      return [];
    }
    return normalized.split(" ").filter(Boolean);
  }

  function labelFromDataset(group, value) {
    if (!value || value === "all") {
      return "";
    }
    return DATASET_LABELS[group]?.[value] || String(value).replace(/-/g, " ");
  }

  function toArray(value) {
    if (value === null || value === undefined) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    return [value];
  }

  function collectKeywordParts(item) {
    const type = item.category || item.type || "";
    const tags = toArray(item.tags);

    const common = [
      item.title,
      item.description,
      item.category,
      item.categoryLabel,
      item.subcategory,
      ...tags,
      ...toArray(item.keywords),
      item.owner_name,
      item.account,
      ...toArray(item.badge),
      item.area,
    ];

    const byType = {
      product: [
        item.brand,
        item.condition,
        item.shipping_type,
        item.price,
        item.status,
        labelFromDataset("condition", item.conditionCode),
        labelFromDataset("shipping", item.shippingCode),
        labelFromDataset("status", item.statusCode),
      ],
      skill: [
        item.service_type,
        item.response_speed,
        item.verified,
        item.skill_name,
        item.delivery_time,
        labelFromDataset("speed", item.response_speed),
        labelFromDataset("certified", item.verified),
      ],
      job: [
        item.employment_type,
        item.remote_type,
        item.urgency,
        item.salary,
        item.job_type,
        labelFromDataset("employment", item.employment_type),
        labelFromDataset("remote", item.remote_type),
        labelFromDataset("urgent", item.urgency),
      ],
      worker: [
        item.name,
        item.skills,
        item.support_area,
        item.response_type,
        item.available_time,
        labelFromDataset("sameDay", item.sameDay),
        labelFromDataset("night", item.night),
        labelFromDataset("hasCar", item.hasCar),
      ],
    };

    return [...common, ...(byType[type] || [])]
      .flat()
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);
  }

  /**
   * @param {object} item
   */
  function buildSearchKeywords(item) {
    return collectKeywordParts(item).join(" ");
  }

  /**
   * @param {object} item
   */
  function enrichListingSearchFields(item) {
    const tags = toArray(item.tags);
    const badges = toArray(item.badge);

    item.searchKeywords = buildSearchKeywords(item);
    item.searchKeywordsNorm = normalizeSearchText(item.searchKeywords);

    item.searchTitleNorm = normalizeSearchText(item.title);
    item.searchTagsNorm = normalizeSearchText(tags.join(" "));
    item.searchCategoryNorm = normalizeSearchText(
      [item.category, item.categoryLabel, item.subcategory].filter(Boolean).join(" ")
    );
    item.searchOwnerNorm = normalizeSearchText(
      [item.owner_name, item.account, item.name, item.skill_name, item.brand]
        .filter(Boolean)
        .join(" ")
    );
    item.searchDescNorm = normalizeSearchText(item.description);

    return item;
  }

  /**
   * 1トークン分のスコア
   * @returns {{ score: number, matched: boolean }}
   */
  function scoreTokenAgainstListing(item, token) {
    if (!token) {
      return { score: 0, matched: false };
    }

    if (item.searchTitleNorm.includes(token)) {
      return { score: SCORE_WEIGHTS.title, matched: true };
    }
    if (item.searchTagsNorm.includes(token)) {
      return { score: SCORE_WEIGHTS.tag, matched: true };
    }
    if (item.searchCategoryNorm.includes(token)) {
      return { score: SCORE_WEIGHTS.category, matched: true };
    }
    if (item.searchOwnerNorm.includes(token)) {
      return { score: SCORE_WEIGHTS.owner, matched: true };
    }
    if (item.searchDescNorm.includes(token)) {
      return { score: SCORE_WEIGHTS.description, matched: true };
    }
    if (item.searchKeywordsNorm.includes(token)) {
      return { score: SCORE_WEIGHTS.keywords, matched: true };
    }

    return { score: 0, matched: false };
  }

  /**
   * @param {object} item
   * @param {string[]} tokens
   * @returns {number} -1 = 1件も不一致, 0+ = スコア
   */
  function scoreListing(item, tokens) {
    if (!tokens.length) {
      return 0;
    }

    let total = 0;
    let matchedCount = 0;

    tokens.forEach((token) => {
      const { score, matched } = scoreTokenAgainstListing(item, token);
      if (matched) {
        total += score;
        matchedCount += 1;
      }
    });

    if (matchedCount === 0) {
      return -1;
    }

    if (matchedCount === tokens.length) {
      total += ALL_TOKENS_BONUS * tokens.length;
    } else {
      const ratio = matchedCount / tokens.length;
      total = Math.floor(total * ratio);
    }

    return total;
  }

  /**
   * @param {object[]} items
   * @param {string} rawQuery
   */
  function filterAndScoreListings(items, rawQuery) {
    const keyword = normalizeSearchText(rawQuery);
    const tokens = parseSearchQuery(rawQuery);

    const results = items
      .map((item) => ({
        item,
        score: scoreListing(item, tokens),
      }))
      .filter((row) => (tokens.length ? row.score > 0 : true));

    return {
      keyword,
      tokens,
      results,
      matchedCount: results.length,
      total: items.length,
    };
  }

  function registerSearchExtension(name, handler) {
    if (name && typeof handler === "function") {
      extensions[name] = handler;
    }
  }

  const POPULAR_SEARCH_WORDS = [
    "外壁塗装",
    "AI",
    "ハウスクリーニング",
    "エアコン",
    "水道修理",
    "動画編集",
    "SNS",
    "ロゴ",
    "求人",
    "即日対応",
  ];

  /** サジェスト拡張（入力プレフィックス → 候補） */
  const SUGGEST_PREFIX_EXPANSIONS = Object.freeze({
    動画: ["動画編集", "動画制作", "動画撮影"],
    ai: ["AI", "AI画像生成", "AI相談"],
    外壁: ["外壁塗装", "外壁修理"],
    ハウス: ["ハウスクリーニング"],
    エアコン: ["エアコンクリーニング", "エアコン修理"],
    水道: ["水道修理"],
  });

  const SUGGESTION_FIELD_GETTERS = [
    (item) => item.title,
    (item) => item.tags,
    (item) => item.categoryLabel,
    (item) => item.subcategory,
    (item) => item.owner_name,
    (item) => item.name,
    (item) => item.skills,
    (item) => item.service_type,
    (item) => item.area,
  ];

  function pushSuggestionTerm(set, value) {
    const text = String(value ?? "").trim();
    if (!text) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushSuggestionTerm(set, entry));
      return;
    }
    set.add(text);
  }

  function collectSuggestionPool(listings) {
    const pool = new Set();
    POPULAR_SEARCH_WORDS.forEach((word) => pool.add(word));
    listings.forEach((item) => {
      SUGGESTION_FIELD_GETTERS.forEach((getter) => pushSuggestionTerm(pool, getter(item)));
    });
    return [...pool];
  }

  /**
   * @param {string} query
   * @param {object[]} listings
   * @param {number} [limit=5]
   */
  function getSearchSuggestions(query, listings, limit = 5) {
    if (typeof extensions.suggest === "function") {
      return extensions.suggest(query, listings, limit);
    }

    const normalized = normalizeSearchText(query);
    const pool = collectSuggestionPool(listings || []);

    const expanded = [];
    if (normalized) {
      Object.keys(SUGGEST_PREFIX_EXPANSIONS).forEach((prefix) => {
        if (normalized.startsWith(prefix) || prefix.startsWith(normalized)) {
          SUGGEST_PREFIX_EXPANSIONS[prefix].forEach((term) => expanded.push(term));
        }
      });
    }

    if (!normalized) {
      return [...expanded, ...pool].slice(0, limit);
    }

    const matched = pool.filter((candidate) => normalizeSearchText(candidate).includes(normalized));
    return [...expanded, ...matched].filter((v, i, a) => a.indexOf(v) === i).slice(0, limit);
  }

  /** 将来: 汎用サジェスト API */
  function getSuggestions(query, limit = 8) {
    return getSearchSuggestions(query, [], limit);
  }

  const LISTING_TITLE_KEYS = [
    "title",
    "listing_title",
    "service_name",
    "product_name",
    "job_title",
    "name",
  ];

  const DUMMY_TITLE_RE =
    /^(product|mug|skill|job|worker|director|featured|premium|featured\s*product|featured\s*skill|featured\s*job|premium\s*product|premium\s*skill|premium\s*job|fe\?+|web\?+|\?+)$/i;

  const PLACEHOLDER_BY_CATEGORY = {
    product: { bg: "f3ead4", fg: "967622", letter: "P" },
    skill: { bg: "e8efe4", fg: "5a6b4a", letter: "S" },
    job: { bg: "f0e6e0", fg: "6b4a3d", letter: "J" },
    worker: { bg: "fff6df", fg: "7a5710", letter: "W" },
  };

  const UNSET_TITLE_LABEL = "タイトル未設定";

  /** 表示しない掲載タイトル（テスト・旧ワーカーデモ等） */
  const BLOCKED_LISTING_TITLES = [
    "引越し前後の荷造り・家具移動を丁寧にサポート",
    "ご高齢の方の買い物・通院・お話相手まで安心サポート",
    "渋谷周辺で買い物代行・即日対応します",
    "フロントエンドエンジニア",
    "Webディレクター",
    "プロダクトマネージャー",
  ];

  function isBlockedListingTitle(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return false;
    }
    return BLOCKED_LISTING_TITLES.some(
      (blocked) => text === blocked || text.includes(blocked)
    );
  }

  function hasGarbledTitle(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return false;
    }
    if (/\?{2,}/.test(text) || /？{2,}/.test(text)) {
      return true;
    }
    if (/^[\?？]+$/.test(text)) {
      return true;
    }
    return false;
  }

  function isDummyDisplayName(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return false;
    }
    if (hasGarbledTitle(text)) {
      return true;
    }
    const normalized = normalizeSearchText(text);
    if (DUMMY_TITLE_RE.test(normalized)) {
      return true;
    }
    if (/^(featured|premium)\s/.test(normalized)) {
      return true;
    }
    if (/^(fe|web)\?+$/i.test(normalized.replace(/\s+/g, ""))) {
      return true;
    }
    return false;
  }

  function getPlaceholderTextFromSrc(src) {
    if (!src) {
      return "";
    }
    try {
      const url = new URL(src, "https://placehold.co");
      return decodeURIComponent(url.searchParams.get("text") || "");
    } catch {
      const match = String(src).match(/[?&]text=([^&]+)/i);
      return match ? decodeURIComponent(match[1]) : "";
    }
  }

  function isDummyPlaceholderText(text) {
    const token = String(text ?? "").trim();
    if (!token) {
      return false;
    }
    if (/^[PSJW]$/i.test(token)) {
      return false;
    }
    if (/%[0-9A-F]{2}/i.test(token)) {
      return true;
    }
    if (/\?/.test(token)) {
      return true;
    }
    return isDummyDisplayName(token);
  }

  /**
   * カード表示用タイトル（target_id は使わない）
   * @param {object} item
   */
  function resolveListingTitle(item) {
    for (const key of LISTING_TITLE_KEYS) {
      const value = String(item?.[key] ?? "").trim();
      if (
        value &&
        !isDummyDisplayName(value) &&
        !hasGarbledTitle(value) &&
        !isBlockedListingTitle(value)
      ) {
        return value;
      }
    }
    return UNSET_TITLE_LABEL;
  }

  /**
   * ダミー掲載か（表示対象から除外）
   * @param {object} item
   * @param {HTMLElement} [card]
   */
  function shouldExcludeListing(item, card) {
    const fields = [
      ...LISTING_TITLE_KEYS.map((key) => item?.[key]),
      item?.rawTitle,
      card?.dataset?.listingTitle,
      card?.dataset?.jobTitle,
      card?.dataset?.productName,
      card?.dataset?.serviceName,
    ];

    for (const field of fields) {
      if (field && (isDummyDisplayName(field) || isBlockedListingTitle(field))) {
        return true;
      }
    }

    const img = card?.querySelector?.(".card__image");
    if (img?.src && isDummyPlaceholderText(getPlaceholderTextFromSrc(img.src))) {
      return true;
    }

    return false;
  }

  /**
   * カテゴリ1文字プレースホルダー（文字化け防止）
   * @param {string} category
   * @param {number} [width=360]
   * @param {number} [height=240]
   */
  function getCategoryPlaceholderUrl(category, width = 360, height = 240) {
    const preset = PLACEHOLDER_BY_CATEGORY[category] || PLACEHOLDER_BY_CATEGORY.product;
    return `https://placehold.co/${width}x${height}/${preset.bg}/${preset.fg}?text=${preset.letter}`;
  }

  /**
   * 掲載タイプごとの詳細ページ URL
   * @param {object} item
   */
  function getDetailUrl(item) {
    const type = String(item?.target_type || item?.type || item?.category || "")
      .trim()
      .toLowerCase();
    const id = String(item?.target_id || item?.id || item?.listing_id || "").trim();

    if (!id) {
      console.warn("[detail-url] missing id", { type, item });
      return "#";
    }

    let href = "#";

    if (type === "product") {
      href = `detail-product.html?id=${encodeURIComponent(id)}`;
    } else if (type === "skill") {
      href = `detail-skill.html?id=${encodeURIComponent(id)}`;
    } else if (type === "job") {
      href = `detail-job.html?id=${encodeURIComponent(id)}`;
    } else if (type === "worker") {
      href = `detail-worker.html?id=${encodeURIComponent(id)}`;
    } else if (type === "business") {
      const bt =
        String(item?.business_type || item?.form_data?.business_type || "").trim() ||
        (window.TasuBusinessCategories?.getBusinessType?.(item) || "");
      if (bt === "shop_store") {
        href = `detail-shop-store.html?id=${encodeURIComponent(id)}`;
      } else {
        href = `detail-business-service.html?id=${encodeURIComponent(id)}`;
      }
    } else {
      console.warn("[detail-url] unknown type", { type, id, item });
      href = "#";
    }

    return href;
  }

  global.TasuSearch = {
    UNSET_TITLE_LABEL,
    SCORE_WEIGHTS,
    ALL_TOKENS_BONUS,
    POPULAR_SEARCH_WORDS,
    SUGGEST_PREFIX_EXPANSIONS,
    normalizeSearchText,
    parseSearchQuery,
    buildSearchKeywords,
    enrichListingSearchFields,
    scoreListing,
    scoreTokenAgainstListing,
    filterAndScoreListings,
    collectSuggestionPool,
    getSearchSuggestions,
    getDetailUrl,
    resolveListingTitle,
    isDummyDisplayName,
    shouldExcludeListing,
    getCategoryPlaceholderUrl,
    hasGarbledTitle,
    labelFromDataset,
    registerSearchExtension,
    getSuggestions,
    extensions,
  };
})(typeof window !== "undefined" ? window : globalThis);

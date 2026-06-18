/**
 * AIマッチング検索
 * business-search → business_listings
 * product-search → listings（商品投稿）+ shop_store_products（店舗・販売）
 * job-search → listings（求人掲載）
 * skill-search → listings（スキル掲載）
 * worker-search → listings（ワーカー掲載）
 */
(function (global) {
  "use strict";

  const MAX_RESULTS = 5;
  const FETCH_LIMIT = 100;

  const DISPLAY_FALLBACK = {
    category: "未分類",
    region: "—",
    description: "—",
    price: "—",
    rating: "—",
    title: {
      vendor: "掲載事業者",
      worker: "ワーカー",
      skill: "スキル出品",
      product: "商品",
      job: "求人",
      shop: "店舗",
      default: "掲載",
    },
  };

  const TEST_LISTING_ID_RE = /^(demo-|test-|e2e-|general-demo|shop-store-demo)/i;
  const TEST_LISTING_LABEL_RE = /テスト|^\s*test[\s_-]|e2e|デモ用|サンプル|dummy|placeholder/i;

  function isTestFacingListing(row) {
    if (!row || typeof row !== "object") return false;
    const id = String(
      row.id || row.demo_id || row.listing?.id || row.product?.id || ""
    ).trim();
    if (id && TEST_LISTING_ID_RE.test(id)) return true;
    const labels = [
      row.title,
      row.company_name,
      row.productName,
      row.workerName,
      row.worker_display_name,
      row.name,
      row.description,
      row.features,
    ];
    return labels.some((value) => {
      const text = String(value || "").trim();
      return text && TEST_LISTING_LABEL_RE.test(text);
    });
  }

  function preferUserFacingRanked(ranked) {
    if (!Array.isArray(ranked) || !ranked.length) return ranked || [];
    const clean = ranked.filter((row) => !isTestFacingListing(row));
    return clean.length ? clean : ranked;
  }

  function sanitizeUserFacingTitle(value, kind, id) {
    const fallback =
      DISPLAY_FALLBACK.title[kind] || DISPLAY_FALLBACK.title.default;
    const text = toDisplayLabel(value, "");
    if (id && TEST_LISTING_ID_RE.test(String(id))) return fallback;
    if (text && TEST_LISTING_LABEL_RE.test(text)) return fallback;
    return text || fallback;
  }

  function sanitizeUserFacingText(value, fallback = DISPLAY_FALLBACK.description) {
    const text = toDisplayLabel(value, "");
    if (text && TEST_LISTING_LABEL_RE.test(text)) return fallback;
    return text || fallback;
  }

  function toDisplayLabel(value, fallback = "") {
    if (value == null || value === "") return fallback;
    if (typeof value === "string") {
      const text = value.trim();
      if (!text || text === "[object Object]") return fallback;
      return text;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      const parts = value.map((item) => toDisplayLabel(item, "")).filter(Boolean);
      return parts.length ? parts.join("、") : fallback;
    }
    if (typeof value === "object") {
      const nested =
        value.label ??
        value.name ??
        value.title ??
        value.value ??
        value.category ??
        value.subcategory ??
        value.productCategory ??
        value.product_category;
      const label = toDisplayLabel(nested, "");
      if (label) return label;
      const id = toDisplayLabel(value.id, "");
      return id || fallback;
    }
    const text = String(value).trim();
    return text === "[object Object]" ? fallback : text || fallback;
  }

  function toDisplayJoin(values, separator = "、", fallback = "") {
    if (values == null || values === "") return fallback;
    if (!Array.isArray(values)) return toDisplayLabel(values, fallback);
    const parts = values.map((item) => toDisplayLabel(item, "")).filter(Boolean);
    return parts.length ? parts.join(separator) : fallback;
  }

  function normalizeSearchCard(card) {
    if (!card || typeof card !== "object") return card;
    const kind = String(card.kind || "");
    const mapKind =
      kind === "business_service"
        ? "vendor"
        : kind === "worker"
          ? "worker"
          : kind === "skill"
            ? "skill"
            : kind === "job"
              ? "job"
              : kind === "shop"
                ? "shop"
                : kind === "product" || kind === "shop_product"
                  ? "product"
                  : "default";
    return {
      ...card,
      title: sanitizeUserFacingTitle(card.title, mapKind, card.id),
      category: toDisplayLabel(card.category, DISPLAY_FALLBACK.category),
      region: toDisplayLabel(card.region, DISPLAY_FALLBACK.region),
      price: toDisplayLabel(card.price, DISPLAY_FALLBACK.price),
      rating: toDisplayLabel(card.rating, DISPLAY_FALLBACK.rating),
      description: sanitizeUserFacingText(card.description, DISPLAY_FALLBACK.description),
      shopName:
        card.shopName != null
          ? sanitizeUserFacingText(card.shopName, "店舗")
          : card.shopName,
    };
  }

  function getFieldMatch() {
    return global.TasuAiSearchFieldMatch || null;
  }

  function addWeightedFieldScore(score, fields, criteria, phraseKeys) {
    const fm = getFieldMatch();
    if (!fm || !fields) return score;
    score += fm.scoreFieldMatch(fields, fm.collectTerms(criteria));
    const keys = phraseKeys || ["requestContent", "requestText", "jobText", "productText"];
    keys.forEach((key) => {
      if (criteria?.[key]) score += fm.scorePhraseBonus(fields, criteria[key]);
    });
    return score;
  }

  const GARDEN_SERVICE_PATTERNS =
    /草刈|草刈り|除草|剪定|庭木|伐採|芝刈|芝生|ガーデニング|庭管理|枝切|植栽|木刈|抜根|落ち葉|庭師|造園|庭の手入れ|庭仕事/;

  const GARDEN_SUBCATEGORY_KEYWORDS = [
    { id: "lawn_care", patterns: /草刈|草刈り|除草|芝刈|芝生|庭の手入れ/ },
    { id: "lawn_care", patterns: /剪定|庭木|枝切|木刈|伐採|抜根/ },
    { id: "lawn_care", patterns: /庭管理|ガーデニング|造園|庭師|植栽/ },
  ];

  const INDOOR_CLEANING_PATTERNS = /ハウスクリーニング|室内清掃|エアコンクリーニング|水回り清掃|キッチン清掃/;
  const JUNK_REMOVAL_PATTERNS = /不用品回収|ゴミ片付け|遺品整理|廃棄物回収/;

  const CATEGORY_KEYWORDS = [
    {
      id: "cleaning",
      subcategoryId: "lawn_care",
      serviceProfile: "garden",
      patterns: GARDEN_SERVICE_PATTERNS,
    },
    { id: "cleaning", patterns: /清掃|片付け|不用品|ゴミ|ハウスクリーニング/ },
    { id: "repair_maintenance", patterns: /修理|メンテ|水道|電気|エアコン|設備|屋根|防水|雨漏り/ },
    { id: "construction", patterns: /建設|工事|内装|リフォーム|解体|外構/ },
    { id: "transport", patterns: /タクシー|送迎|運搬|配送|ハイヤー|貨物/ },
    { id: "life_support", patterns: /便利屋|暮らし|買い物代行|見守り/ },
    { id: "beauty_wellness", patterns: /美容|サロン|マッサージ|リラク/ },
    { id: "it_web", patterns: /IT|Web|ホームページ|システム開発/ },
    { id: "corporate_support", patterns: /法人サポート|経理|労務/ },
    { id: "shop_store", patterns: /店舗|販売|ショップ/ },
  ];

  async function search(ctx) {
    const mode = ctx.mode || global.TasuAiModes?.getMode(ctx.modeId);
    const handler = mode?.futureSearch?.handler;
    if (!handler || typeof api[handler] !== "function") {
      return null;
    }
    return api[handler](ctx);
  }

  function combineUserText(ctx) {
    const parts = (ctx.messages || [])
      .filter((m) => m.role === "user")
      .map((m) => String(m.content || "").trim())
      .filter(Boolean);
    const latest = String(ctx.userText || "").trim();
    if (latest) parts.push(latest);
    return parts.join("\n").trim();
  }

  function extractArea(text) {
    const m = text.match(
      /(東京都|東京23区|東京|大阪府|大阪市|大阪|神奈川県|神奈川|横浜|名古屋|愛知県|福岡県|福岡|北海道|札幌|京都府|京都|全国|[^\s、。]{1,10}(都|府|県|市|区|町|村))/
    );
    return m ? m[0].trim() : "";
  }

  function extractBudgetText(text) {
    return (
      text.match(/(\d+[\d,]*\s*円|\d+\s*万円?|予算\s*[\d,万円]+|〜\s*[\d,万円]+)/)?.[0] || ""
    );
  }

  function parseBudgetYen(text) {
    const budgetText = extractBudgetText(text);
    if (!budgetText) return null;
    const man = budgetText.match(/(\d+)\s*万/);
    if (man) return Number(man[1]) * 10000;
    const yen = budgetText.match(/([\d,]+)\s*円/);
    if (yen) return Number(yen[1].replace(/,/g, ""));
    return null;
  }

  function extractRequestContent(text, area, budgetText) {
    let content = text;
    if (area) content = content.replace(area, " ");
    if (budgetText) content = content.replace(budgetText, " ");
    content = content
      .replace(/法人対応|法人契約|法人のみ|即日対応|即日|受付中|対応可能/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return content.slice(0, 160);
  }

  function inferGardenServiceProfile(text) {
    if (!GARDEN_SERVICE_PATTERNS.test(text)) return null;
    return {
      categoryId: "cleaning",
      subcategoryId: "lawn_care",
      serviceProfile: "garden",
    };
  }

  function inferSubcategoryId(text, categoryId) {
    const garden = inferGardenServiceProfile(text);
    if (garden?.subcategoryId) return garden.subcategoryId;

    const cats = global.TasuBusinessCategories?.CATEGORIES;
    if (Array.isArray(cats)) {
      for (const cat of cats) {
        if (categoryId && cat.id !== categoryId) continue;
        for (const sub of cat.subcategories || []) {
          if (sub.label && text.includes(sub.label)) return sub.id;
        }
      }
    }

    for (const row of GARDEN_SUBCATEGORY_KEYWORDS) {
      if (row.patterns.test(text)) return row.id;
    }
    return "";
  }

  function inferCategoryId(text) {
    const garden = inferGardenServiceProfile(text);
    if (garden?.categoryId) return garden.categoryId;

    const cats = global.TasuBusinessCategories?.CATEGORIES;
    if (Array.isArray(cats)) {
      for (const cat of cats) {
        if (cat.label && text.includes(cat.label)) return cat.id;
        for (const sub of cat.subcategories || []) {
          if (sub.label && text.includes(sub.label)) return cat.id;
        }
      }
    }
    for (const row of CATEGORY_KEYWORDS) {
      if (row.patterns.test(text)) return row.id;
    }
    return "";
  }

  function applyServiceProfile(criteria) {
    const garden = inferGardenServiceProfile(criteria.text || "");
    if (garden) {
      criteria.categoryId = garden.categoryId;
      criteria.subcategoryId = garden.subcategoryId;
      criteria.serviceProfile = garden.serviceProfile;
      return;
    }
    if (!criteria.subcategoryId && criteria.categoryId) {
      criteria.subcategoryId = inferSubcategoryId(criteria.text || "", criteria.categoryId);
    }
  }

  function extractBusinessCriteria(ctx) {
    const text = combineUserText(ctx);
    const area = extractArea(text);
    const budgetText = extractBudgetText(text);
    const requestContent = extractRequestContent(text, area, budgetText);
    const categoryId = inferCategoryId(text);
    const subcategoryId = inferSubcategoryId(text, categoryId);
    const sameDay = /即日|今日中|本日中|至急|緊急/.test(text);
    const corporate = /法人対応|法人契約|法人のみ|法人向け|BtoB|ビジネス向け/.test(text);
    const acceptingOnly = /受付中|募集中|対応可能/.test(text);
    const minRating =
      ctx.searchIntent?.minRating ||
      ctx.intentHints?.minRating ||
      extractMinRatingFromText(text);
    const keywords = requestContent
      .split(/[\s、。・\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    return {
      text,
      area,
      requestContent,
      categoryId,
      subcategoryId,
      serviceProfile: inferGardenServiceProfile(text)?.serviceProfile || "",
      budgetText,
      budgetYen: parseBudgetYen(text),
      sameDay,
      corporate,
      acceptingOnly,
      minRating: minRating || null,
      keywords,
    };
  }

  function extractMinRatingFromText(text) {
    const parsed = global.TasuAiWorkspaceSearchIntent?.extractMinRating?.(text);
    return parsed || null;
  }

  function hasMinimumCriteria(criteria) {
    if (!criteria.text || criteria.text.length < 4) return false;
    return Boolean(
      criteria.area ||
        criteria.categoryId ||
        criteria.keywords.length >= 1 ||
        criteria.requestContent.length >= 6
    );
  }

  function buildAskMoreCriteria() {
    return (
      "次を教えてください：\n" +
      "・地域（例：東京都、大阪）\n" +
      "・依頼内容（例：エアコン清掃、内装工事）\n" +
      "・カテゴリ・予算目安\n" +
      "・希望条件（即日対応、法人対応、受付中 など）"
    );
  }

  function listingSubcategoryKey(item) {
    const fd = item?.form_data && typeof item.form_data === "object" ? item.form_data : {};
    return String(item.business_subcategory || fd.business_subcategory || "").trim();
  }

  function listingHaystack(item) {
    const subKey = listingSubcategoryKey(item);
    const subLabel =
      global.TasuBusinessCategories?.getSubcategoryLabel?.(item.business_category, subKey) ||
      "";
    const extra = item.category_extra || item.form_data?.category_extra || {};
    const cleaningTypes = extra.cleaning?.cleaning_types || "";
    const fm = getFieldMatch();
    const built = fm ? fm.buildBusinessServiceFields(item) : null;
    const fieldText = built
      ? [built.serviceMenu, built.qualifications, built.detail].join(" ")
      : "";
    return [
      item.company_name,
      item.title,
      item.description,
      item.service_area,
      item.categoryLabel,
      item.business_category,
      subKey,
      subLabel,
      cleaningTypes,
      item.budgetText,
      item.budgetLabel,
      item.licenseLine,
      item.license_info,
      (item.tags || []).join(" "),
      (item.service_tags || []).join(" "),
      (item.applicationConditions || []).join(" "),
      (item.conditionBadges || []).map((b) => b.label).join(" "),
      item.boardTrustShort,
      item.serviceSummary,
      fieldText,
    ]
      .join(" ")
      .toLowerCase();
  }

  function subcategoryMatches(item, subcategoryId) {
    if (!subcategoryId) return true;
    return listingSubcategoryKey(item) === subcategoryId;
  }

  function categoryMatches(item, categoryId) {
    if (!categoryId) return true;
    if (global.TasuBusinessCategories?.categoryMatches) {
      return global.TasuBusinessCategories.categoryMatches(
        item.business_category,
        categoryId
      );
    }
    return String(item.business_category || "") === categoryId;
  }

  function matchesArea(item, area) {
    if (!area) return true;
    const hay = `${item.service_area || ""} ${item.title || ""}`.toLowerCase();
    const needle = area.toLowerCase();
    if (hay.includes(needle)) return true;
    if (needle.includes("東京") && /東京|23区|都内/.test(hay)) return true;
    if (needle.includes("大阪") && /大阪/.test(hay)) return true;
    if (needle.includes("埼玉") && /埼玉/.test(hay)) return true;
    if (needle.includes("千葉") && /千葉/.test(hay)) return true;
    if (needle.includes("神奈川") && /神奈川|横浜/.test(hay)) return true;
    return false;
  }

  function parseListingRating(item) {
    const avg =
      item.rating_average ??
      item.review_average ??
      item.rating_avg ??
      item.form_data?.rating_average ??
      null;
    if (avg != null && !Number.isNaN(Number(avg))) return Number(avg);
    const trust = String(item.boardTrustShort || item.trust_label || "");
    const m = trust.match(/([\d.]+)/);
    if (m) return Number(m[1]);
    return 0;
  }

  function matchesMinRating(item, minRating) {
    if (!minRating) return true;
    return parseListingRating(item) >= Number(minRating);
  }

  function matchesSameDay(item) {
    const hay = listingHaystack(item);
    return Boolean(
      item.isStartSoon ||
        item.isUrgent ||
        /即日|すぐ開始|至急|急募/.test(hay)
    );
  }

  function matchesCorporate(item) {
    const hay = listingHaystack(item);
    if (/法人|corporate|BtoB/i.test(hay)) return true;
    if (item.isCorporateWelcome) return true;
    if (String(item.taxi_corporate_contract || "").toLowerCase() === "yes") return true;
    return (item.applicationConditions || []).some((c) => /法人/.test(c));
  }

  function matchesAccepting(item) {
    const label = String(item.recruitStatus || item.statusLabel || "");
    if (/受付|募集中|対応可能/.test(label)) return true;
    if (item.status === "available") return true;
    if (item.status === "busy" || item.status === "closed") return false;
    return /受付|募集中/.test(label);
  }

  function parseListingBudgetYen(item) {
    const raw = String(item.budgetText || item.budgetLabel || "");
    const man = raw.match(/(\d+)\s*万/);
    if (man) return Number(man[1]) * 10000;
    const yen = raw.match(/([\d,]+)\s*円/);
    if (yen) return Number(yen[1].replace(/,/g, ""));
    if (/要相談|見積/.test(raw)) return null;
    return null;
  }

  function passesHardFilters(item, criteria) {
    if (criteria.sameDay && !matchesSameDay(item)) return false;
    if (criteria.corporate && !matchesCorporate(item)) return false;
    if (criteria.acceptingOnly && !matchesAccepting(item)) return false;
    if (criteria.area && !matchesArea(item, criteria.area)) return false;
    if (criteria.categoryId && !categoryMatches(item, criteria.categoryId)) return false;
    if (criteria.minRating && !matchesMinRating(item, criteria.minRating)) return false;
    return true;
  }

  function scoreListing(item, criteria) {
    if (!passesHardFilters(item, criteria)) return -1;

    let score = 0;
    const hay = listingHaystack(item);

    if (criteria.area && matchesArea(item, criteria.area)) score += 4;
    if (criteria.categoryId && categoryMatches(item, criteria.categoryId)) score += 3;
    if (criteria.subcategoryId && subcategoryMatches(item, criteria.subcategoryId)) score += 8;

    if (criteria.serviceProfile === "garden" || criteria.subcategoryId === "lawn_care") {
      if (GARDEN_SERVICE_PATTERNS.test(hay)) score += 5;
      if (subcategoryMatches(item, "lawn_care")) score += 4;
      if (INDOOR_CLEANING_PATTERNS.test(hay) && !GARDEN_SERVICE_PATTERNS.test(hay)) score -= 7;
      if (JUNK_REMOVAL_PATTERNS.test(hay) && !GARDEN_SERVICE_PATTERNS.test(hay)) score -= 7;
    }

    const fm = getFieldMatch();
    if (fm) {
      score = addWeightedFieldScore(score, fm.buildBusinessServiceFields(item), criteria, [
        "requestContent",
        "text",
      ]);
    } else {
      criteria.keywords.forEach((kw) => {
        if (kw.length >= 2 && hay.includes(kw.toLowerCase())) score += 2;
      });
      if (criteria.requestContent.length >= 4) {
        const chunk = criteria.requestContent.slice(0, 24).toLowerCase();
        if (chunk.length >= 4 && hay.includes(chunk)) score += 3;
      }
    }

    if (criteria.budgetYen != null) {
      const listingYen = parseListingBudgetYen(item);
      if (listingYen != null) {
        if (listingYen <= criteria.budgetYen) score += 2;
        else if (listingYen <= criteria.budgetYen * 1.3) score += 1;
      } else if (/要相談|見積/.test(item.budgetText || "")) {
        score += 1;
      }
    }

    if (criteria.sameDay && matchesSameDay(item)) score += 2;
    if (criteria.corporate && matchesCorporate(item)) score += 2;
    if (criteria.acceptingOnly && matchesAccepting(item)) score += 2;
    else if (matchesAccepting(item)) score += 1;

    score += Number(item.priorityScore || 0) * 0.05;
    if (item.isPr || item.isFeatured) score += 0.5;

    return score;
  }

  function getDetailUrl(item) {
    if (global.TasuListingRenderer?.getDetailUrl) {
      return global.TasuListingRenderer.getDetailUrl(item);
    }
    const id = item.id || item.demo_id;
    return `detail-business-service.html?id=${encodeURIComponent(String(id || ""))}`;
  }

  function pickFeatures(item) {
    const badges = (item.conditionBadges || [])
      .map((b) => toDisplayLabel(typeof b === "object" ? b.label : b, ""))
      .filter(Boolean);
    if (badges.length) return badges.slice(0, 5).join("、");
    const tagText = toDisplayJoin(
      [].concat(item.tags || [], item.service_tags || []),
      "、",
      ""
    );
    if (tagText) {
      return tagText
        .split("、")
        .filter(Boolean)
        .slice(0, 5)
        .join("、");
    }
    const trust = toDisplayLabel(item.boardTrustShort, "");
    if (trust) return trust;
    const summary = toDisplayLabel(item.serviceSummary, "");
    if (summary) return summary;
    return DISPLAY_FALLBACK.description;
  }

  function formatCriteriaSummary(criteria) {
    let body = "【整理した条件】\n";
    if (criteria.area) body += "・地域: " + criteria.area + "\n";
    if (criteria.requestContent) body += "・依頼内容: " + criteria.requestContent + "\n";
    if (criteria.categoryId) {
      const label =
        global.TasuBusinessCategories?.getCategoryLabel?.(criteria.categoryId) ||
        criteria.categoryId;
      const subLabel = criteria.subcategoryId
        ? global.TasuBusinessCategories?.getSubcategoryLabel?.(
            criteria.categoryId,
            criteria.subcategoryId
          ) || criteria.subcategoryId
        : "";
      body += "・カテゴリ: " + (subLabel ? `${label} / ${subLabel}` : label) + "\n";
    }
    if (criteria.budgetText) body += "・予算目安: " + criteria.budgetText + "\n";
    const flags = [];
    if (criteria.sameDay) flags.push("即日対応");
    if (criteria.corporate) flags.push("法人対応");
    if (criteria.acceptingOnly) flags.push("受付中");
    if (criteria.minRating) flags.push(`評価${criteria.minRating}以上`);
    if (flags.length) body += "・希望条件: " + flags.join("、") + "\n";
    return body;
  }

  function formatCandidate(item, index) {
    const price =
      item.budgetLabel || item.budgetText || item.main_price_text || "見積要相談";
    const url = getDetailUrl(item);
    const absUrl =
      url.startsWith("http") || url.startsWith("/")
        ? url
        : new URL(url, global.location?.href || "").href;

    return (
      index +
      ". " +
      (item.company_name || item.title || "（事業者名未設定）") +
      "\n" +
      "   カテゴリ: " +
      (item.categoryLabel || item.business_category || "—") +
      "\n" +
      "   対応地域: " +
      (item.service_area || "—") +
      "\n" +
      "   料金目安: " +
      price +
      "\n" +
      "   特徴: " +
      pickFeatures(item) +
      "\n" +
      "   詳細: " +
      absUrl
    );
  }

  function formatResults(criteria, items) {
    let body = formatCriteriaSummary(criteria);
    body += "\n【おすすめ候補】（業務サービス掲載・" + items.length + "件）\n";
    items.forEach((item, i) => {
      body += formatCandidate(item, i + 1) + "\n";
    });
    body +=
      "\n【次の行動】\n" +
      "・一覧で絞り込み: business.html\n" +
      "・気になる候補の詳細ページから問い合わせできます";
    return body;
  }

  function formatNoResults(criteria) {
    let body = formatCriteriaSummary(criteria);
    body +=
      "\n【検索結果】\n" +
      "該当する業務サービス掲載が見つかりませんでした。\n\n" +
      "条件を少し広げてください。例：\n" +
      "・地域の表記を変える（「東京都23区」→「東京」など）\n" +
      "・「即日対応」「法人対応」「受付中」の条件を外す\n" +
      "・依頼内容のキーワードを減らす、またはカテゴリだけで探す\n\n" +
      "一覧でも探せます: business.html";
    return body;
  }

  async function fetchBusinessListings(criteria) {
    const store = global.TasuBusinessListings;
    if (!store?.fetchPublishedBusinessListings) {
      throw new Error("TasuBusinessListings が読み込まれていません");
    }

    const fetchOpts = {
      limit: FETCH_LIMIT,
      public_only: true,
      localFallback: true,
    };
    if (criteria.categoryId) {
      fetchOpts.business_category = criteria.categoryId;
    }

    let items = await store.fetchPublishedBusinessListings(fetchOpts);

    if (criteria.categoryId && items.length < 8) {
      const broader = await store.fetchPublishedBusinessListings({
        limit: FETCH_LIMIT,
        public_only: true,
        localFallback: true,
      });
      const seen = new Set(items.map((i) => i.id));
      broader.forEach((row) => {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          items.push(row);
        }
      });
    }

    return items.filter((item) => {
      const pub = item.publish_status || item.form_data?.publish_status;
      if (pub && pub !== "public") return false;
      return true;
    });
  }

  function rankListings(items, criteria) {
    const scored = items
      .map((item) => ({ item, score: scoreListing(item, criteria) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const pri = Number(b.item.priorityScore || 0) - Number(a.item.priorityScore || 0);
        if (pri !== 0) return pri;
        return String(b.item.created_at || "").localeCompare(String(a.item.created_at || ""));
      });

    return scored.slice(0, MAX_RESULTS).map((row) => row.item);
  }

  async function searchBusinessListings(ctx) {
    try {
      const criteria = extractBusinessCriteria(ctx);
      applyServiceProfile(criteria);

      if (!hasMinimumCriteria(criteria)) {
        return buildAskMoreCriteria();
      }

      if (!global.TasuBusinessListings?.fetchPublishedBusinessListings) {
        console.warn("[TasuAiSearch] business listings store unavailable");
        return null;
      }

      let items;
      try {
        items = await fetchBusinessListings(criteria);
      } catch (err) {
        console.warn("[TasuAiSearch] fetch failed:", err);
        return null;
      }

      const ranked = rankListings(items, criteria);
      if (!ranked.length) {
        return formatNoResults(criteria);
      }
      return formatResults(criteria, ranked);
    } catch (err) {
      console.warn("[TasuAiSearch] searchBusinessListings error:", err);
      return null;
    }
  }

  const SHOP_PRODUCT_CATEGORY_KEYWORDS = [
    { id: "restaurant", patterns: /飲食|カフェ|レストラン|コーヒー|メニュー/ },
    { id: "retail", patterns: /小売|物販|雑貨/ },
    { id: "vintage_brand", patterns: /古着|ブランド|ヴィンテージ/ },
    { id: "goods_interior", patterns: /インテリア|雑貨|家具/ },
    { id: "food_retail", patterns: /食品|スイーツ|お取り寄せ/ },
    { id: "hobby_anime", patterns: /ホビー|アニメ|トレカ|フィギュア/ },
    { id: "pet", patterns: /ペット|犬|猫/ },
    { id: "tools_equipment", patterns: /工具|機材|買取/ },
  ];

  function pickShopExtra(listing) {
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const extra = listing?.category_extra || fd.category_extra || {};
    return extra.shop_store || extra.store || extra.store_field_service || {};
  }

  function isShopStoreListing(listing) {
    const bt = String(listing?.business_type || listing?.form_data?.business_type || "").trim();
    if (bt === "shop_store") return true;
    if (global.TasuBusinessCategories?.getBusinessType) {
      return global.TasuBusinessCategories.getBusinessType(listing) === "shop_store";
    }
    return String(listing?.business_category || "") === "shop_store";
  }

  function buildShopProductDetailUrl(shopId, productId) {
    const shop = String(shopId || "").trim();
    const product = String(productId || "").trim();
    if (!shop || !product) return "detail-shop-product.html";
    return (
      "detail-shop-product.html?shopId=" +
      encodeURIComponent(shop) +
      "&productId=" +
      encodeURIComponent(product)
    );
  }

  function buildGeneralProductDetailUrl(listing) {
    if (global.TasuListingRenderer?.getProductDetailUrl) {
      return global.TasuListingRenderer.getProductDetailUrl(listing);
    }
    const id = String(listing?.id || "").trim();
    return id ? `detail-product.html?id=${encodeURIComponent(id)}` : "detail-product.html";
  }

  function formatPriceText(raw, priceAmount) {
    const text = String(raw || "").trim();
    if (text) return text;
    if (priceAmount != null && !Number.isNaN(Number(priceAmount))) {
      return "¥" + Number(priceAmount).toLocaleString("ja-JP");
    }
    return "要相談";
  }

  function parsePriceYen(raw, priceAmount) {
    const text = String(raw || "").trim();
    const man = text.match(/(\d+)\s*万/);
    if (man) return Number(man[1]) * 10000;
    const yen = text.match(/([\d,]+)\s*円/);
    if (yen) return Number(yen[1].replace(/,/g, ""));
    if (priceAmount != null && !Number.isNaN(Number(priceAmount))) {
      return Number(priceAmount);
    }
    return null;
  }

  function extractPurpose(text) {
    if (/ギフト|プレゼント|贈り物/.test(text)) return "ギフト";
    if (/業務用|法人用|オフィス用|店舗用/.test(text)) return "業務用";
    if (/家庭用|自宅|個人用/.test(text)) return "家庭用";
    if (/コレクション|趣味/.test(text)) return "コレクション";
    return "";
  }

  function extractShopName(text) {
    const m = text.match(/(?:店舗名?|お店|ショップ)[:：]?\s*([^\s、。]{2,24})/);
    if (m) return m[1].trim();
    return "";
  }

  function inferProductCategoryId(text) {
    for (const row of SHOP_PRODUCT_CATEGORY_KEYWORDS) {
      if (row.patterns.test(text)) return row.id;
    }
    if (/スキル|ハンドメイド|中古品|新品/.test(text) && !/店舗/.test(text)) {
      return "general_product";
    }
    return "";
  }

  function extractProductCriteria(ctx) {
    const text = combineUserText(ctx);
    const area = extractArea(text);
    const budgetText = extractBudgetText(text);
    const purpose = extractPurpose(text);
    const shopName = extractShopName(text);
    const categoryId = inferProductCategoryId(text);
    const deliveryRequired = /配送可|配送希望|配送あり|送料|発送|郵送/.test(text);
    const inStockOnly = /在庫あり|在庫のある|在庫がある/.test(text);
    const nearby =
      Boolean(ctx.searchIntent?.nearby) ||
      Boolean(ctx.intentHints?.nearby) ||
      /近く|近所|周辺|付近/.test(text);

    let productText = text;
    [area, budgetText, purpose, shopName].forEach((part) => {
      if (part) productText = productText.replace(part, " ");
    });
    productText = productText
      .replace(/配送可|配送希望|在庫あり|即日発送|店舗受取/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const productKeywords = productText
      .split(/[\s、。・\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    return {
      text,
      area,
      budgetText,
      budgetYen: parseBudgetYen(text),
      purpose,
      shopName,
      categoryId,
      deliveryRequired,
      inStockOnly,
      nearby,
      productKeywords,
      productText: productText.slice(0, 120),
    };
  }

  function hasMinimumProductCriteria(criteria) {
    if (!criteria.text || criteria.text.length < 3) return false;
    return Boolean(
      criteria.productKeywords.length >= 1 ||
        criteria.categoryId ||
        criteria.budgetText ||
        criteria.area ||
        criteria.shopName ||
        criteria.productText.length >= 4
    );
  }

  function buildAskMoreProductCriteria() {
    return (
      "次を教えてください：\n" +
      "・商品名またはカテゴリ\n" +
      "・用途（ギフト、業務用など）\n" +
      "・予算・地域\n" +
      "・店舗名（わかる場合）\n" +
      "・希望条件（配送可、在庫あり など）"
    );
  }

  function isPublishedListing(listing) {
    const pub = listing?.publish_status || listing?.form_data?.publish_status;
    return !pub || pub === "public";
  }

  function isActiveShopProduct(product) {
    if (!product) return false;
    if (product.is_active === false) return false;
    const name = String(product.title || product.product_name || "").trim();
    if (!name) return false;
    return true;
  }

  function matchesInStock(candidate) {
    const stock = String(candidate.stockLabel || "").trim();
    if (!stock) return true;
    return !/なし|売切|欠品|在庫切れ/i.test(stock);
  }

  function matchesDelivery(candidate) {
    const hay = `${candidate.regionDelivery || ""} ${candidate.features || ""}`.toLowerCase();
    return /配送|発送|送料|郵送|宅配|デリバリー|delivery|ship/.test(hay);
  }

  function generalListingToCandidate(listing) {
    const norm = global.TasuProductListingFields?.normalizeProductListing?.(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const seller =
      listing.company_name ||
      listing.account ||
      fd.seller_name ||
      fd.shop_name ||
      "出品者";
    const tags = norm?.tags || listing.tags || [];

    return {
      source: "general",
      productName: norm?.title || listing.title || listing.product_name || "",
      shopName: String(seller).trim(),
      category: toDisplayLabel(
        norm?.category || listing.category || listing.categoryLabel,
        "商品"
      ),
      price: formatPriceText(norm?.price?.text, listing.price_amount),
      priceYen: parsePriceYen(norm?.price?.text, listing.price_amount),
      regionDelivery: toDisplayJoin(
        [norm?.deliveryMethod, fd.service_area, fd.area, listing.service_area],
        " / ",
        "—"
      ),
      features: toDisplayJoin(tags, "、", "—")
        .split("、")
        .filter(Boolean)
        .slice(0, 5)
        .join("、"),
      stockLabel: String(norm?.stockCount || fd.stock_count || fd.stock_status || ""),
      detailUrl: buildGeneralProductDetailUrl(listing),
      listing,
      product: null,
    };
  }

  function shopProductToCandidate(shop, product) {
    const extra = pickShopExtra(shop);
    const shopName =
      extra.shop_name || shop.company_name || shop.title || shop.account || "店舗";
    const shopId = String(shop.id || "").trim();
    const productId = String(product.id || product.product_id || "").trim();
    const tags = [
      ...(shop.tags || []),
      ...(shop.service_tags || []),
      product.tag,
      product.category,
    ].filter(Boolean);
    const visitArea = extra.visit_area || shop.service_area || extra.address || "";
    const deliveryParts = [];
    if (visitArea) deliveryParts.push("対応地域: " + visitArea);
    if (product.fast_ship === "yes" || product.same_day_shipping) {
      deliveryParts.push("即日発送可");
    }
    if (/配送|発送|宅配/.test(tags.join(" "))) deliveryParts.push("配送可");
    if (/店舗受取|店頭/.test(tags.join(" "))) deliveryParts.push("店舗受取可");

    return {
      source: "shop_store",
      productName: product.title || product.product_name || "",
      shopName: String(shopName).trim(),
      category: toDisplayLabel(
        product.category || product.product_category || shop.categoryLabel,
        "店舗商品"
      ),
      price: formatPriceText(product.price, null),
      priceYen: parsePriceYen(product.price, null),
      regionDelivery: toDisplayJoin(deliveryParts, " / ", visitArea || "—"),
      features: toDisplayJoin(tags, "、", "—")
        .split("、")
        .filter(Boolean)
        .slice(0, 5)
        .join("、"),
      stockLabel: String(product.stock || product.stock_status || product.stock_quantity || ""),
      detailUrl: buildShopProductDetailUrl(shopId, productId),
      listing: shop,
      product,
      shopCategoryKey: getShopListingCategoryKey(shop),
    };
  }

  function getShopListingCategoryKey(listing) {
    const extra = pickShopExtra(listing);
    const fd = listing?.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    return (
      String(
        extra.shop_store_category ||
          extra.store_category ||
          fd.business_subcategory ||
          listing.business_subcategory ||
          ""
      ).trim() || ""
    );
  }

  function candidateHaystack(candidate) {
    const fm = getFieldMatch();
    const fieldText = fm ? Object.values(fm.buildProductFields(candidate)).join(" ") : "";
    return [
      candidate.productName,
      candidate.shopName,
      candidate.category,
      candidate.price,
      candidate.regionDelivery,
      candidate.features,
      candidate.stockLabel,
      candidate.listing?.description,
      candidate.listing?.title,
      candidate.product?.description,
      fieldText,
    ]
      .join(" ")
      .toLowerCase();
  }

  function matchesProductArea(candidate, area) {
    if (!area) return true;
    const hay = candidateHaystack(candidate);
    const needle = area.toLowerCase();
    if (hay.includes(needle)) return true;
    if (needle.includes("東京") && /東京|23区|都内/.test(hay)) return true;
    if (needle.includes("大阪") && /大阪/.test(hay)) return true;
    return false;
  }

  function matchesProductCategory(candidate, categoryId) {
    if (!categoryId || categoryId === "general_product") return true;
    const hay = candidateHaystack(candidate);
    const key = String(candidate.shopCategoryKey || "").toLowerCase();
    if (key && (key === categoryId || key.includes(categoryId))) return true;
    const labelMap = {
      restaurant: /飲食|カフェ|レストラン/,
      retail: /小売|物販/,
      vintage_brand: /古着|ブランド/,
      goods_interior: /雑貨|インテリア/,
      food_retail: /食品/,
      hobby_anime: /ホビー|アニメ|トレカ/,
      pet: /ペット/,
      tools_equipment: /工具|機材/,
    };
    const pattern = labelMap[categoryId];
    if (pattern && pattern.test(hay)) return true;
    return hay.includes(categoryId.replace(/_/g, " "));
  }

  function passesProductHardFilters(candidate, criteria) {
    if (criteria.deliveryRequired && !matchesDelivery(candidate)) return false;
    if (criteria.inStockOnly && !matchesInStock(candidate)) return false;
    if (criteria.area && !matchesProductArea(candidate, criteria.area)) return false;
    if (criteria.shopName) {
      const shop = candidate.shopName.toLowerCase();
      if (!shop.includes(criteria.shopName.toLowerCase())) return false;
    }
    if (criteria.categoryId && criteria.categoryId !== "general_product") {
      if (candidate.source === "shop_store" && !matchesProductCategory(candidate, criteria.categoryId)) {
        return false;
      }
    }
    return true;
  }

  function scoreProductCandidate(candidate, criteria) {
    if (!passesProductHardFilters(candidate, criteria)) return -1;

    let score = 0;
    const hay = candidateHaystack(candidate);
    const fm = getFieldMatch();

    if (fm) {
      score = addWeightedFieldScore(score, fm.buildProductFields(candidate), criteria, [
        "productText",
        "text",
      ]);
    } else {
      criteria.productKeywords.forEach((kw) => {
        if (kw.length >= 2 && hay.includes(kw.toLowerCase())) score += 3;
      });
      if (criteria.productText.length >= 3 && hay.includes(criteria.productText.slice(0, 12).toLowerCase())) {
        score += 2;
      }
    }

    if (criteria.categoryId && matchesProductCategory(candidate, criteria.categoryId)) score += 2;
    if (criteria.purpose && hay.includes(criteria.purpose.toLowerCase())) score += 2;
    if (criteria.area && matchesProductArea(candidate, criteria.area)) score += 2;
    if (criteria.shopName && candidate.shopName.toLowerCase().includes(criteria.shopName.toLowerCase())) {
      score += 3;
    }

    if (criteria.budgetYen != null && candidate.priceYen != null) {
      if (candidate.priceYen <= criteria.budgetYen) score += 2;
      else if (candidate.priceYen <= criteria.budgetYen * 1.25) score += 1;
    } else if (criteria.budgetYen != null && /要相談|見積/.test(candidate.price)) {
      score += 1;
    }

    if (criteria.deliveryRequired && matchesDelivery(candidate)) score += 2;
    if (criteria.inStockOnly && matchesInStock(candidate)) score += 2;
    else if (matchesInStock(candidate)) score += 1;
    if (criteria.nearby) score += 2;

    if (candidate.source === "shop_store") score += 0.25;

    return score;
  }

  async function fetchPublishedGeneralProducts() {
    const store = global.TasuListingStore;
    if (!store?.fetchPublishedListings) return [];
    const rows = await store.fetchPublishedListings({
      listing_type: "product",
      limit: FETCH_LIMIT,
      public_only: true,
      localFallback: true,
    });
    return rows.filter(isPublishedListing);
  }

  async function fetchPublishedShopListings() {
    const store = global.TasuBusinessListings;
    if (!store?.fetchPublishedBusinessListings) return [];
    const rows = await store.fetchPublishedBusinessListings({
      limit: FETCH_LIMIT,
      public_only: true,
      localFallback: true,
    });
    return rows.filter((row) => isPublishedListing(row) && isShopStoreListing(row));
  }

  async function fetchActiveShopProductRows(shops) {
    const shopMap = new Map(shops.map((s) => [String(s.id), s]));
    const pairs = [];
    const seen = new Set();

    function pushPair(shop, product) {
      if (!isActiveShopProduct(product)) return;
      const shopId = String(shop?.id || product?.listing_id || "").trim();
      const productId = String(product.id || product.product_id || "").trim();
      if (!shopId || !productId) return;
      const key = shopId + ":" + productId;
      if (seen.has(key)) return;
      seen.add(key);
      const shopRow = shopMap.get(shopId) || shop;
      if (!shopRow || !isShopStoreListing(shopRow)) return;
      pairs.push({ shop: shopRow, product });
    }

    const sb = global.TasuSupabase?.getClient?.();
    if (sb && global.location?.protocol !== "file:") {
      const run = async (withActive) => {
        let q = sb
          .from("shop_store_products")
          .select("*")
          .order("display_order", { ascending: true })
          .limit(FETCH_LIMIT);
        if (withActive) q = q.eq("is_active", true);
        return q;
      };
      let { data, error } = await run(true);
      if (error) ({ data, error } = await run(false));
      if (!error && Array.isArray(data)) {
        const mapRow = global.TasuShopStoreProductsDb?.mapDbRowToDetailProduct;
        data.forEach((row) => {
          const shop = shopMap.get(String(row.listing_id || ""));
          const product = mapRow ? mapRow(row) : row;
          if (shop) pushPair(shop, product);
        });
      }
    }

    try {
      const raw = localStorage.getItem("shop_store_products");
      const all = raw ? JSON.parse(raw) : {};
      Object.keys(all).forEach((listingId) => {
        const shop = shopMap.get(listingId);
        if (!shop) return;
        const mapRow = global.TasuShopStoreProductsDb?.mapDbRowToDetailProduct;
        (all[listingId] || []).forEach((row) => {
          pushPair(shop, mapRow ? mapRow(row) : row);
        });
      });
    } catch {
      /* ignore */
    }

    for (const shop of shops) {
      let listing = shop;
      if (
        global.TasuShopStoreProductsDb?.attachProductsToListing &&
        (!listing.products || !listing.products.length)
      ) {
        try {
          listing = await global.TasuShopStoreProductsDb.attachProductsToListing(shop);
        } catch {
          listing = shop;
        }
      }
      const products = listing.products || listing.form_data?.products || [];
      if (Array.isArray(products)) {
        products.forEach((p) => pushPair(listing, p));
      }
    }

    return pairs;
  }

  async function fetchAllProductCandidates() {
    const [generalListings, shops] = await Promise.all([
      fetchPublishedGeneralProducts(),
      fetchPublishedShopListings(),
    ]);

    const candidates = generalListings.map(generalListingToCandidate);

    const shopPairs = await fetchActiveShopProductRows(shops);
    shopPairs.forEach(({ shop, product }) => {
      candidates.push(shopProductToCandidate(shop, product));
    });

    return candidates;
  }

  function rankProductCandidates(candidates, criteria) {
    return candidates
      .map((item) => ({ item, score: scoreProductCandidate(item, criteria) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((row) => row.item);
  }

  function formatProductCriteriaSummary(criteria) {
    let body = "【整理した条件】\n";
    if (criteria.productText) body += "・商品名・内容: " + criteria.productText + "\n";
    if (criteria.categoryId && criteria.categoryId !== "general_product") {
      body += "・カテゴリ: " + criteria.categoryId + "\n";
    }
    if (criteria.purpose) body += "・用途: " + criteria.purpose + "\n";
    if (criteria.budgetText) body += "・予算: " + criteria.budgetText + "\n";
    if (criteria.area) body += "・地域: " + criteria.area + "\n";
    if (criteria.shopName) body += "・店舗名: " + criteria.shopName + "\n";
    const flags = [];
    if (criteria.deliveryRequired) flags.push("配送可");
    if (criteria.inStockOnly) flags.push("在庫あり");
    if (flags.length) body += "・希望条件: " + flags.join("、") + "\n";
    return body;
  }

  function formatProductCandidate(item, index) {
    const url = item.detailUrl.startsWith("http")
      ? item.detailUrl
      : new URL(item.detailUrl, global.location?.href || "").href;

    return (
      index +
      ". " +
      item.productName +
      "\n" +
      "   店舗名: " +
      item.shopName +
      "\n" +
      "   カテゴリ: " +
      item.category +
      "\n" +
      "   価格: " +
      item.price +
      "\n" +
      "   地域・配送: " +
      item.regionDelivery +
      "\n" +
      "   特徴: " +
      (item.features || "—") +
      "\n" +
      "   詳細: " +
      url
    );
  }

  function formatProductResults(criteria, items) {
    let body = formatProductCriteriaSummary(criteria);
    body += "\n【おすすめ候補】（商品・店舗掲載・" + items.length + "件）\n";
    items.forEach((item, i) => {
      body += formatProductCandidate(item, i + 1) + "\n";
    });
    body +=
      "\n【次の行動】\n" +
      "・店舗・販売一覧: shop-store.html\n" +
      "・一般商品一覧: index.html\n" +
      "・詳細ページから購入・問い合わせができます";
    return body;
  }

  function formatProductNoResults(criteria) {
    let body = formatProductCriteriaSummary(criteria);
    body +=
      "\n【検索結果】\n" +
      "該当する商品が見つかりませんでした。\n\n" +
      "条件を少し広げてください。例：\n" +
      "・予算を広げる\n" +
      "・カテゴリ指定を外す\n" +
      "・地域条件を外す\n" +
      "・「配送可」「在庫あり」の条件を外す\n" +
      "・商品名のキーワードを減らす\n\n" +
      "一覧でも探せます: shop-store.html";
    return body;
  }

  async function searchProductListings(ctx) {
    try {
      const criteria = extractProductCriteria(ctx);

      if (!hasMinimumProductCriteria(criteria)) {
        return buildAskMoreProductCriteria();
      }

      if (
        !global.TasuListingStore?.fetchPublishedListings &&
        !global.TasuBusinessListings?.fetchPublishedBusinessListings
      ) {
        console.warn("[TasuAiSearch] product data stores unavailable");
        return null;
      }

      let candidates;
      try {
        candidates = await fetchAllProductCandidates();
      } catch (err) {
        console.warn("[TasuAiSearch] product fetch failed:", err);
        return null;
      }

      const ranked = rankProductCandidates(candidates, criteria);
      if (!ranked.length) {
        return formatProductNoResults(criteria);
      }
      return formatProductResults(criteria, ranked);
    } catch (err) {
      console.warn("[TasuAiSearch] searchProductListings error:", err);
      return null;
    }
  }

  const BLOCKED_JOB_PATTERNS = [
    /アダルト|風俗|デリヘル|ソープ|キャバクラ|ホストクラブ|夜ワーク|ナイトワーク/i,
    /闇バイト|闇アルバイト|闇仕事|犯罪/i,
    /名義貸し|名義譲渡|口座売買|口座買取|口座譲渡/i,
    /違法配送|無許可運送|薬物|違法物/i,
  ];

  const JOB_INDUSTRY_KEYWORDS = [
    { label: "建設", patterns: /建設|工事|施工|現場作業|土木|内装/ },
    { label: "清掃", patterns: /清掃|クリーニング|ハウスクリーニング/ },
    { label: "配送", patterns: /配送|配達|物流|倉庫|ドライバー|運転/ },
    { label: "飲食", patterns: /飲食|厨房|ホール|カフェ|調理/ },
    { label: "事務", patterns: /事務|一般事務|データ入力/ },
    { label: "Web制作", patterns: /web|ホームページ|フロント|バックエンド/ },
    { label: "動画編集", patterns: /動画編集|映像|youtube|sns/ },
    { label: "デザイン", patterns: /デザイン|グラフィック|ui/ },
    { label: "IT", patterns: /it|エンジニア|プログラマ|開発/ },
    { label: "介護", patterns: /介護|福祉|看護|ヘルパー/ },
    { label: "販売", patterns: /販売|接客|店舗|レジ/ },
    { label: "製造", patterns: /製造|工場|組立|ライン/ },
  ];

  function isPublishedJobListing(listing) {
    const type = String(listing?.listing_type || listing?.type || "").trim();
    if (type !== "job") return false;
    const pub = String(listing?.publish_status || listing?.status || "public").toLowerCase();
    if (pub === "draft" || pub === "scheduled") return false;
    return true;
  }

  function isBlockedJobListing(listing, normalized) {
    const hay = [
      normalized?.title,
      normalized?.description,
      normalized?.category,
      (normalized?.tags || []).join(" "),
      listing?.description,
      listing?.company_name,
    ]
      .join(" ")
      .toLowerCase();
    return BLOCKED_JOB_PATTERNS.some((re) => re.test(hay));
  }

  function buildJobDetailUrl(listing) {
    if (global.TasuListingRenderer?.getDetailUrl) {
      const url = global.TasuListingRenderer.getDetailUrl({
        ...listing,
        type: "job",
        listing_type: "job",
      });
      if (url && url !== "#") return url;
    }
    const id = String(listing?.id || "").trim();
    return id ? `detail-job.html?id=${encodeURIComponent(id)}` : "detail-job.html";
  }

  function resolveJobRecruitStatus(listing, normalized) {
    const tags = (normalized?.tags || []).join(" ");
    const hay = `${tags} ${listing?.description || ""} ${normalized?.title || ""}`;
    if (/募集終了|終了|締切済|closed/i.test(hay)) {
      return { key: "closed", label: "募集終了" };
    }
    if (/急募/.test(hay)) {
      return { key: "urgent", label: "急募" };
    }
    if (/すぐ開始|即日|すぐに働ける/.test(hay)) {
      return { key: "soon", label: "すぐ開始" };
    }
    return { key: "open", label: "募集中" };
  }

  function extractEmploymentType(text) {
    if (/正社員|正職員/.test(text)) return "正社員";
    if (/派遣社員|派遣/.test(text)) return "派遣";
    if (/契約社員|契約社員|有期雇用/.test(text)) return "契約";
    if (/アルバイト|バイト/.test(text)) return "アルバイト";
    if (/パート/.test(text)) return "パート";
    if (/業務委託|フリーランス|委託/.test(text)) return "業務委託";
    return "";
  }

  function extractWorkDays(text) {
    const m = text.match(/週\s*(\d+)\s*日/);
    if (m) return `週${m[1]}日`;
    if (/週休2日/.test(text)) return "週休2日";
    if (/週休/.test(text)) return "週休";
    const w = text.match(/週[1-7]日/);
    return w ? w[0] : "";
  }

  function inferJobIndustry(text) {
    for (const row of JOB_INDUSTRY_KEYWORDS) {
      if (row.patterns.test(text)) return row.label;
    }
    return "";
  }

  function extractJobCriteria(ctx) {
    const text = combineUserText(ctx);
    const area = extractArea(text);
    const salaryText = extractBudgetText(text);
    const industry = inferJobIndustry(text);
    const employmentType = extractEmploymentType(text);
    const workDays = extractWorkDays(text);
    const acceptingOnly = /受付中|募集中/.test(text);

    let jobText = text;
    [area, salaryText, industry, employmentType, workDays].forEach((part) => {
      if (part) jobText = jobText.replace(part, " ");
    });
    jobText = jobText
      .replace(/正社員|アルバイト|パート|派遣|契約|業務委託|受付中|募集中/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const jobKeywords = jobText
      .split(/[\s、。・\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    return {
      text,
      area,
      salaryText,
      salaryYen: parseBudgetYen(text),
      industry,
      employmentType,
      workDays,
      acceptingOnly,
      jobKeywords,
      jobText: jobText.slice(0, 120),
    };
  }

  function hasMinimumJobCriteria(criteria) {
    if (!criteria.text || criteria.text.length < 3) return false;
    return Boolean(
      criteria.jobKeywords.length >= 1 ||
        criteria.industry ||
        criteria.area ||
        criteria.salaryText ||
        criteria.employmentType ||
        criteria.jobText.length >= 4
    );
  }

  function buildAskMoreJobCriteria() {
    return (
      "次を教えてください：\n" +
      "・希望職種または業種\n" +
      "・勤務地（都道府県・市区など）\n" +
      "・勤務日数（例：週5日）\n" +
      "・給与・時給の希望\n" +
      "・雇用形態（正社員、アルバイト、派遣など）"
    );
  }

  function jobListingToCandidate(listing) {
    const norm = global.TasuJobListingFields?.normalizeJobListing?.(listing) || {
      title: listing.title,
      tags: [],
      seller: { companyName: listing.company_name },
    };
    const status = resolveJobRecruitStatus(listing, norm);
    const salary =
      norm.price?.text ||
      norm.salary ||
      (listing.price_amount != null ? `¥${Number(listing.price_amount).toLocaleString("ja-JP")}` : "") ||
      "応相談";

    const recruitParts = [];
    if (norm.recruitmentCount) recruitParts.push(`募集人数: ${norm.recruitmentCount}名`);
    const req = norm.applicationRequirements || norm.requiredSkills || "";
    if (req) recruitParts.push(req.length > 60 ? req.slice(0, 60) + "…" : req);
    if (norm.welcomeSkills) {
      recruitParts.push(
        "歓迎: " + (norm.welcomeSkills.length > 40 ? norm.welcomeSkills.slice(0, 40) + "…" : norm.welcomeSkills)
      );
    }

    const salaryYen =
      norm.salaryAmount != null && !Number.isNaN(Number(norm.salaryAmount))
        ? Number(norm.salaryAmount)
        : parsePriceYen(salary, listing.salary_amount ?? listing.price_amount);

    return {
      id: listing.id,
      companyName: norm.seller?.companyName || listing.company_name || "—",
      title: norm.title || listing.title || "求人",
      category:
        toDisplayJoin([norm.category, norm.subcategory], " / ", "") || "求人",
      location: norm.location || "—",
      salary,
      salaryYen,
      recruitCount: norm.recruitmentCount || "",
      recruitConditions: recruitParts.join(" / ") || "—",
      recruitStatus: status.label,
      statusKey: status.key,
      employmentType: norm.employmentType || listing.employment_type || "",
      workingHours: norm.workingHours || "",
      workStyle: norm.workStyle || "",
      industryLabel: norm.category || listing.category || "",
      tags: norm.tags || [],
      detailUrl: buildJobDetailUrl(listing),
      listing,
      norm,
    };
  }

  function jobCandidateHaystack(candidate) {
    const fm = getFieldMatch();
    const fieldText = fm ? Object.values(fm.buildJobFields(candidate)).join(" ") : "";
    return [
      candidate.title,
      candidate.companyName,
      candidate.category,
      candidate.location,
      candidate.salary,
      candidate.employmentType,
      candidate.workingHours,
      candidate.workStyle,
      candidate.recruitConditions,
      (candidate.tags || []).join(" "),
      candidate.listing?.description,
      fieldText,
    ]
      .join(" ")
      .toLowerCase();
  }

  function matchesJobArea(candidate, area) {
    if (!area) return true;
    const hay = `${candidate.location || ""} ${jobCandidateHaystack(candidate)}`.toLowerCase();
    const needle = area.toLowerCase();
    if (hay.includes(needle)) return true;
    if (needle.includes("東京") && /東京|23区|都内/.test(hay)) return true;
    if (needle.includes("大阪") && /大阪/.test(hay)) return true;
    return false;
  }

  function matchesJobEmployment(candidate, employmentType) {
    if (!employmentType) return true;
    const hay = jobCandidateHaystack(candidate);
    const e = employmentType.toLowerCase();
    if (hay.includes(e)) return true;
    if (e === "アルバイト" && /バイト|パート/.test(hay)) return true;
    return false;
  }

  function matchesJobAccepting(candidate) {
    return candidate.statusKey !== "closed";
  }

  function matchesJobWorkDays(candidate, workDays) {
    if (!workDays) return true;
    const hay = `${candidate.workingHours || ""} ${jobCandidateHaystack(candidate)}`;
    return hay.includes(workDays);
  }

  function matchesJobIndustry(candidate, industry) {
    if (!industry) return true;
    const hay = jobCandidateHaystack(candidate);
    return hay.includes(industry.toLowerCase());
  }

  function passesJobHardFilters(candidate, criteria) {
    if (criteria.acceptingOnly && !matchesJobAccepting(candidate)) return false;
    return true;
  }

  function scoreJobCandidate(candidate, criteria) {
    if (!passesJobHardFilters(candidate, criteria)) return -1;

    let score = 0;
    const hay = jobCandidateHaystack(candidate);
    const fm = getFieldMatch();

    if (fm) {
      score = addWeightedFieldScore(score, fm.buildJobFields(candidate), criteria, ["jobText", "text"]);
    } else {
      criteria.jobKeywords.forEach((kw) => {
        if (kw.length >= 2 && hay.includes(kw.toLowerCase())) score += 3;
      });
      if (criteria.jobText.length >= 3 && hay.includes(criteria.jobText.slice(0, 12).toLowerCase())) {
        score += 2;
      }
    }

    if (criteria.industry && matchesJobIndustry(candidate, criteria.industry)) score += 4;
    else if (criteria.industry) score += 1;
    if (criteria.area && matchesJobArea(candidate, criteria.area)) score += 4;
    else if (criteria.area) score += 0.5;
    if (criteria.employmentType && matchesJobEmployment(candidate, criteria.employmentType)) score += 3;
    else if (criteria.employmentType) score += 0.5;
    if (criteria.workDays && matchesJobWorkDays(candidate, criteria.workDays)) score += 2;

    if (criteria.salaryYen != null && candidate.salaryYen != null) {
      if (candidate.salaryYen >= criteria.salaryYen * 0.85) score += 2;
      else if (candidate.salaryYen >= criteria.salaryYen * 0.7) score += 1;
    } else if (criteria.salaryText && /応相談|相談/.test(candidate.salary)) {
      score += 1;
    }

    if (criteria.acceptingOnly && matchesJobAccepting(candidate)) score += 2;
    else if (matchesJobAccepting(candidate)) score += 1;

    if (candidate.listing?.is_featured) score += 0.5;

    return score;
  }

  async function fetchPublishedJobListings() {
    const store = global.TasuListingStore;
    if (!store?.fetchPublishedListings) {
      throw new Error("TasuListingStore が読み込まれていません");
    }

    const rows = await store.fetchPublishedListings({
      listing_type: "job",
      limit: FETCH_LIMIT,
      public_only: true,
      localFallback: true,
    });

    return rows
      .filter(isPublishedJobListing)
      .filter((listing) => {
        const norm = global.TasuJobListingFields?.normalizeJobListing?.(listing);
        return !isBlockedJobListing(listing, norm || { title: listing.title, tags: [] });
      })
      .map(jobListingToCandidate);
  }

  function rankJobCandidates(candidates, criteria) {
    return candidates
      .map((item) => ({ item, score: scoreJobCandidate(item, criteria) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((row) => row.item);
  }

  function formatJobCriteriaSummary(criteria) {
    let body = "【整理した条件】\n";
    if (criteria.jobText) body += "・職種・キーワード: " + criteria.jobText + "\n";
    if (criteria.industry) body += "・業種: " + criteria.industry + "\n";
    if (criteria.area) body += "・勤務地: " + criteria.area + "\n";
    if (criteria.workDays) body += "・勤務日数: " + criteria.workDays + "\n";
    if (criteria.salaryText) body += "・給与条件: " + criteria.salaryText + "\n";
    if (criteria.employmentType) body += "・雇用形態: " + criteria.employmentType + "\n";
    if (criteria.acceptingOnly) body += "・募集ステータス: 受付中\n";
    return body;
  }

  function formatJobCandidate(item, index) {
    const url = item.detailUrl.startsWith("http")
      ? item.detailUrl
      : new URL(item.detailUrl, global.location?.href || "").href;

    return (
      index +
      ". " +
      item.title +
      "\n" +
      "   会社名: " +
      item.companyName +
      "\n" +
      "   カテゴリ: " +
      item.category +
      "\n" +
      "   勤務地: " +
      item.location +
      "\n" +
      "   給与: " +
      item.salary +
      "\n" +
      "   募集: " +
      (item.recruitCount ? item.recruitCount + "名 / " : "") +
      item.recruitConditions +
      "（" +
      item.recruitStatus +
      "）\n" +
      "   詳細: " +
      url
    );
  }

  function formatJobResults(criteria, items) {
    let body = formatJobCriteriaSummary(criteria);
    body += "\n【おすすめ候補】（求人掲載・" + items.length + "件）\n";
    items.forEach((item, i) => {
      body += formatJobCandidate(item, i + 1) + "\n";
    });
    body +=
      "\n【次の行動】\n" +
      "・求人一覧: job-top.html\n" +
      "・詳細ページから応募・問い合わせができます";
    return body;
  }

  function formatJobNoResults(criteria) {
    let body = formatJobCriteriaSummary(criteria);
    body +=
      "\n【検索結果】\n" +
      "該当する求人が見つかりませんでした。\n\n" +
      "条件を少し広げてください。例：\n" +
      "・給与条件を広げる\n" +
      "・職種・業種の指定を外す\n" +
      "・勤務地・地域条件を外す\n" +
      "・「受付中」の条件を外す\n" +
      "・雇用形態（正社員のみ等）を緩める\n\n" +
      "一覧でも探せます: job-top.html";
    return body;
  }

  async function searchJobListings(ctx) {
    try {
      const criteria = extractJobCriteria(ctx);

      if (!hasMinimumJobCriteria(criteria)) {
        return buildAskMoreJobCriteria();
      }

      if (!global.TasuListingStore?.fetchPublishedListings) {
        console.warn("[TasuAiSearch] job listings store unavailable");
        return null;
      }

      let candidates;
      try {
        candidates = await fetchPublishedJobListings();
      } catch (err) {
        console.warn("[TasuAiSearch] job fetch failed:", err);
        return null;
      }

      const ranked = rankJobCandidates(candidates, criteria);
      if (!ranked.length) {
        return formatJobNoResults(criteria);
      }
      return formatJobResults(criteria, ranked);
    } catch (err) {
      console.warn("[TasuAiSearch] searchJobListings error:", err);
      return null;
    }
  }

  const SKILL_CATEGORY_KEYWORDS = [
    { id: "video", patterns: /動画編集|映像|youtube|ショート動画|premiere/ },
    { id: "design", patterns: /デザイン|ロゴ|バナー|イラスト|figma/ },
    { id: "ai_it", patterns: /ai|it|画像生成|プログラム|開発|コーディング/ },
    { id: "writing", patterns: /ライティング|記事|コピー|ブログ/ },
    { id: "sns", patterns: /sns|運用|instagram|tiktok|x運用/ },
    { id: "consult", patterns: /相談|コンサル|カウンセリング/ },
    { id: "clerical", patterns: /事務|入力|代行/ },
  ];

  const SKILL_CATEGORY_LABELS = {
    video: "動画・映像",
    design: "デザイン",
    ai_it: "AI・IT",
    writing: "ライティング",
    sns: "SNS運用",
    consult: "相談",
    fortune: "占い",
    clerical: "事務代行",
    other: "その他",
  };

  const DELIVERY_TIME_LABELS = {
    same_day: "即日",
    within_3_days: "3日以内",
    within_1_week: "1週間以内",
    consult: "相談可",
  };

  const SERVICE_FORMAT_LABELS = {
    online: "オンライン",
    chat: "チャット",
    call: "通話",
    data_delivery: "データ納品",
    onsite: "対面・出張",
  };

  function parseFormDataSkill(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function pickSkillFormValue(fd, keys) {
    if (!fd || typeof fd !== "object") return "";
    for (let i = 0; i < keys.length; i += 1) {
      const v = fd[keys[i]];
      if (v == null || v === "") continue;
      const label = toDisplayLabel(v, "");
      if (label) return label;
    }
    return "";
  }

  function formatSkillCategoryLabel(raw) {
    const key = toDisplayLabel(raw, "");
    if (!key) return "スキル";
    return SKILL_CATEGORY_LABELS[key] || key;
  }

  function formatDeliveryTimeLabel(raw) {
    const key = String(raw || "").trim();
    return DELIVERY_TIME_LABELS[key] || key || "";
  }

  function formatServiceFormatLabel(raw) {
    const key = String(raw || "").trim().toLowerCase();
    if (!key) return "";
    if (SERVICE_FORMAT_LABELS[key]) return SERVICE_FORMAT_LABELS[key];
    if (/online|リモート/.test(key)) return "オンライン";
    if (/onsite|対面|出張/.test(key)) return "対面・出張";
    return raw;
  }

  function isPublishedSkillListing(listing) {
    const type = String(listing?.listing_type || listing?.type || "").trim();
    if (type !== "skill") return false;
    const pub = String(listing?.publish_status || listing?.status || "public").toLowerCase();
    if (pub === "draft" || pub === "scheduled" || pub === "closed") return false;
    return true;
  }

  function buildSkillDetailUrl(listing) {
    if (global.TasuListingRenderer?.getDetailUrl) {
      const url = global.TasuListingRenderer.getDetailUrl({
        ...listing,
        type: "skill",
        listing_type: "skill",
      });
      if (url && url !== "#") return url;
    }
    const id = String(listing?.id || "").trim();
    return id ? `detail-skill.html?id=${encodeURIComponent(id)}` : "detail-skill.html";
  }

  function normalizeSkillRow(row) {
    if (global.TasuListingRenderer?.normalizeGeneralRow) {
      return global.TasuListingRenderer.normalizeGeneralRow({
        ...row,
        listing_type: "skill",
        _source: row._source || "supabase",
      });
    }
    return {
      ...row,
      listing_type: "skill",
      type: "skill",
      form_data: parseFormDataSkill(row.form_data),
    };
  }

  function resolveSkillSellerName(listing, fd) {
    return (
      pickSkillFormValue(fd, ["seller_name", "display_name", "provider_name", "name"]) ||
      listing.name ||
      listing.account?.replace(/^@/, "") ||
      (listing.user_id ? `ユーザー ${String(listing.user_id).slice(0, 8)}` : "出品者")
    );
  }

  function resolveSkillRatingLine(listing, fd) {
    const parts = [];
    const avg =
      listing.review_average ??
      listing.rating_avg ??
      fd.review_average ??
      fd.rating_average ??
      null;
    const count =
      listing.review_count != null
        ? Number(listing.review_count)
        : fd.review_count != null
          ? Number(fd.review_count)
          : null;

    if (avg != null && !Number.isNaN(Number(avg))) {
      parts.push(`★${Number(avg).toFixed(1)}`);
    }
    if (count != null && !Number.isNaN(count) && count > 0) {
      parts.push(`レビュー${count}件`);
    }

    const deals =
      listing.deals_count ??
      listing.sales_count ??
      fd.deals_count ??
      fd.sales_count ??
      null;
    if (deals != null && Number(deals) > 0) {
      parts.push(`実績${Number(deals)}件`);
    }

    const achievements = pickSkillFormValue(fd, ["achievements", "track_record"]);
    if (achievements) {
      parts.push(achievements.length > 36 ? achievements.slice(0, 36) + "…" : achievements);
    }

    return parts.length ? parts.join(" / ") : "";
  }

  function skillListingToCandidate(row) {
    const listing = normalizeSkillRow(row);
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};

    const categoryRaw = pickSkillFormValue(fd, [
      "skill_category",
      "category_key",
      "category",
      "skillCategory",
    ]);
    const category = formatSkillCategoryLabel(categoryRaw);
    const serviceFormat = formatServiceFormatLabel(
      pickSkillFormValue(fd, ["service_format", "delivery_format", "format", "serviceFormat"])
    );
    const area = pickSkillFormValue(fd, [
      "service_area",
      "support_area",
      "location",
      "area",
      "region",
    ]);
    const deliveryTime = formatDeliveryTimeLabel(
      pickSkillFormValue(fd, ["delivery_time", "lead_time", "deadline", "deliveryTime"])
    );

    const formatParts = [];
    if (serviceFormat) formatParts.push(serviceFormat);
    if (area) formatParts.push(area);
    let formatRegion = formatParts.join(" / ") || "—";
    if (deliveryTime) formatRegion += `（納期目安: ${deliveryTime}）`;

    const price =
      listing.priceText ||
      (listing.price_amount != null && !Number.isNaN(Number(listing.price_amount))
        ? `¥${Number(listing.price_amount).toLocaleString("ja-JP")}`
        : pickSkillFormValue(fd, ["price", "price_text", "budget"]) || "要相談");

    const tags = listing.tags || listing.displayTags || [];
    const features =
      toDisplayJoin(tags, "、", "")
        .split("、")
        .filter(Boolean)
        .slice(0, 6)
        .join("、") || DISPLAY_FALLBACK.description;
    const ratingLine = resolveSkillRatingLine(listing, fd);

    const sellerName = resolveSkillSellerName(listing, fd);
    const account =
      listing.account ||
      (listing.user_id ? `@${String(listing.user_id).slice(0, 14)}` : "");

    return {
      id: listing.id,
      sellerName,
      account,
      title: listing.title || pickSkillFormValue(fd, ["service_name", "title"]) || "スキル",
      category,
      categoryKey: categoryRaw,
      price,
      priceYen: parsePriceYen(price, listing.price_amount),
      formatRegion,
      serviceFormat,
      area,
      deliveryTime,
      features,
      ratingLine,
      detailUrl: buildSkillDetailUrl(listing),
      recruitOpen: isPublishedSkillListing(listing),
      tags,
      listing,
    };
  }

  function inferSkillCategoryId(text) {
    for (const row of SKILL_CATEGORY_KEYWORDS) {
      if (row.patterns.test(text)) return row.id;
    }
    return "";
  }

  function extractSkillCriteria(ctx) {
    const text = combineUserText(ctx);
    const area = extractArea(text);
    const budgetText = extractBudgetText(text);
    const categoryId = inferSkillCategoryId(text);
    const purpose = extractPurpose(text);
    const onlineOnly = /オンライン|リモート|リモート可|online/i.test(text);
    const onsiteOnly = /対面|出張|現地|訪問/i.test(text);
    const deadlineText =
      text.match(/(納期|期限内|(\d+)\s*日以内|急ぎ|至急|早め)/)?.[0] || "";
    const ratingFocus = /評価|レビュー|実績|高評価|星/.test(text);
    const acceptingOnly = /受付中|募集中|掲載中/.test(text);

    let requestText = text;
    [area, budgetText, purpose, deadlineText, categoryId].forEach((part) => {
      if (part) requestText = requestText.replace(String(part), " ");
    });
    requestText = requestText
      .replace(/オンライン|リモート|対面|出張|受付中|評価|レビュー/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const requestKeywords = requestText
      .split(/[\s、。・\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    return {
      text,
      area,
      budgetText,
      budgetYen: parseBudgetYen(text),
      categoryId,
      purpose,
      onlineOnly,
      onsiteOnly,
      deadlineText,
      ratingFocus,
      acceptingOnly,
      requestKeywords,
      requestText: requestText.slice(0, 120),
    };
  }

  function hasMinimumSkillCriteria(criteria) {
    if (!criteria.text || criteria.text.length < 3) return false;
    return Boolean(
      criteria.requestKeywords.length >= 1 ||
        criteria.categoryId ||
        criteria.budgetText ||
        criteria.area ||
        criteria.requestText.length >= 4
    );
  }

  function buildAskMoreSkillCriteria() {
    return (
      "次を教えてください：\n" +
      "・依頼内容・必要なスキル\n" +
      "・カテゴリ（動画編集、デザイン、ITなど）\n" +
      "・予算・納期\n" +
      "・対応形式（オンライン / 対面）・地域\n" +
      "・評価・実績の希望があれば"
    );
  }

  function skillCandidateHaystack(candidate) {
    const fm = getFieldMatch();
    const fieldText = fm ? Object.values(fm.buildSkillFields(candidate)).join(" ") : "";
    return [
      candidate.title,
      candidate.sellerName,
      candidate.account,
      candidate.category,
      candidate.price,
      candidate.formatRegion,
      candidate.features,
      candidate.ratingLine,
      candidate.deliveryTime,
      candidate.serviceFormat,
      candidate.area,
      candidate.listing?.description,
      (candidate.tags || []).join(" "),
      fieldText,
    ]
      .join(" ")
      .toLowerCase();
  }

  function matchesSkillArea(candidate, area) {
    if (!area) return true;
    const hay = skillCandidateHaystack(candidate);
    const needle = area.toLowerCase();
    if (hay.includes(needle)) return true;
    if (needle.includes("東京") && /東京|23区|都内/.test(hay)) return true;
    if (needle.includes("大阪") && /大阪/.test(hay)) return true;
    return false;
  }

  function matchesSkillCategory(candidate, categoryId) {
    if (!categoryId) return true;
    const hay = skillCandidateHaystack(candidate);
    const keywords = {
      video: /動画|映像|youtube/,
      design: /デザイン|ロゴ|バナー/,
      ai_it: /ai|it|開発|プログラム/,
      writing: /ライティング|記事|コピー/,
      sns: /sns|運用/,
      consult: /相談|コンサル/,
      clerical: /事務|代行/,
    };
    if (candidate.categoryKey === categoryId) return true;
    const pattern = keywords[categoryId];
    if (pattern && pattern.test(hay)) return true;
    return hay.includes(categoryId);
  }

  function matchesSkillFormat(candidate, criteria) {
    const hay = skillCandidateHaystack(candidate);
    if (criteria.onlineOnly && !/オンライン|リモート|online|チャット|通話|データ納品/.test(hay)) {
      return false;
    }
    if (criteria.onsiteOnly && !/対面|出張|現地|訪問|onsite/.test(hay)) {
      return false;
    }
    return true;
  }

  function matchesSkillDeadline(candidate, deadlineText) {
    if (!deadlineText) return true;
    const hay = `${candidate.deliveryTime || ""} ${skillCandidateHaystack(candidate)}`;
    if (/急|至急|即日/.test(deadlineText)) {
      return /即日|3日|早|急/.test(hay);
    }
    if (/日以内/.test(deadlineText)) {
      const m = deadlineText.match(/(\d+)\s*日/);
      if (m) return hay.includes(m[1] + "日") || /即日|3日|1週間/.test(hay);
    }
    return hay.includes("納期") || hay.includes("日") || hay.includes("週");
  }

  function matchesSkillAccepting(candidate) {
    return candidate.recruitOpen !== false;
  }

  function passesSkillHardFilters(candidate, criteria) {
    if (criteria.acceptingOnly && !matchesSkillAccepting(candidate)) return false;
    return true;
  }

  function scoreSkillCandidate(candidate, criteria) {
    if (!passesSkillHardFilters(candidate, criteria)) return -1;

    let score = 0;
    const hay = skillCandidateHaystack(candidate);
    const fm = getFieldMatch();

    if (fm) {
      score = addWeightedFieldScore(score, fm.buildSkillFields(candidate), criteria, [
        "requestText",
        "text",
      ]);
    } else {
      criteria.requestKeywords.forEach((kw) => {
        if (kw.length >= 2 && hay.includes(kw.toLowerCase())) score += 3;
      });
      if (
        criteria.requestText.length >= 3 &&
        hay.includes(criteria.requestText.slice(0, 12).toLowerCase())
      ) {
        score += 2;
      }
    }

    if (criteria.categoryId && matchesSkillCategory(candidate, criteria.categoryId)) score += 4;
    else if (criteria.categoryId) score += 1;
    if (criteria.area && matchesSkillArea(candidate, criteria.area)) score += 3;
    else if (criteria.area) score += 0.5;
    if (criteria.purpose && hay.includes(criteria.purpose.toLowerCase())) score += 2;

    if (criteria.budgetYen != null && candidate.priceYen != null) {
      if (candidate.priceYen <= criteria.budgetYen) score += 2;
      else if (candidate.priceYen <= criteria.budgetYen * 1.3) score += 1;
    } else if (criteria.budgetText && /要相談|相談/.test(candidate.price)) {
      score += 1;
    }

    if (criteria.deadlineText && matchesSkillDeadline(candidate, criteria.deadlineText)) score += 2;
    else if (criteria.deadlineText) score -= 1;
    if (matchesSkillFormat(candidate, criteria)) {
      if (criteria.onlineOnly) score += 2;
      if (criteria.onsiteOnly) score += 2;
    } else if (criteria.onlineOnly || criteria.onsiteOnly) {
      score -= 1;
    }

    if (criteria.ratingFocus && candidate.ratingLine) {
      if (/★[4-5]/.test(candidate.ratingLine) || /実績|レビュー/.test(candidate.ratingLine)) {
        score += 2;
      }
    }

    if (criteria.acceptingOnly && matchesSkillAccepting(candidate)) score += 1;
    else if (matchesSkillAccepting(candidate)) score += 0.5;

    if (candidate.listing?.is_featured || candidate.listing?.isFeatured) score += 0.5;

    return score;
  }

  async function fetchPublishedSkillListings() {
    const store = global.TasuListingStore;
    if (!store?.fetchPublishedListings) {
      throw new Error("TasuListingStore が読み込まれていません");
    }

    const rows = await store.fetchPublishedListings({
      listing_type: "skill",
      limit: FETCH_LIMIT,
      public_only: true,
      localFallback: true,
    });

    return rows.filter(isPublishedSkillListing).map(skillListingToCandidate);
  }

  function rankSkillCandidates(candidates, criteria) {
    return candidates
      .map((item) => ({ item, score: scoreSkillCandidate(item, criteria) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((row) => row.item);
  }

  function formatSkillCriteriaSummary(criteria) {
    let body = "【整理した条件】\n";
    if (criteria.requestText) body += "・依頼内容: " + criteria.requestText + "\n";
    if (criteria.categoryId) {
      body += "・スキルカテゴリ: " + formatSkillCategoryLabel(criteria.categoryId) + "\n";
    }
    if (criteria.purpose) body += "・用途: " + criteria.purpose + "\n";
    if (criteria.budgetText) body += "・予算: " + criteria.budgetText + "\n";
    if (criteria.deadlineText) body += "・納期: " + criteria.deadlineText + "\n";
    if (criteria.area) body += "・地域: " + criteria.area + "\n";
    const flags = [];
    if (criteria.onlineOnly) flags.push("オンライン");
    if (criteria.onsiteOnly) flags.push("対面・出張");
    if (criteria.ratingFocus) flags.push("評価・実績重視");
    if (criteria.acceptingOnly) flags.push("受付中");
    if (flags.length) body += "・希望条件: " + flags.join("、") + "\n";
    return body;
  }

  function formatSkillCandidate(item, index) {
    const url = item.detailUrl.startsWith("http")
      ? item.detailUrl
      : new URL(item.detailUrl, global.location?.href || "").href;

    let block =
      index +
      ". " +
      item.title +
      "\n" +
      "   出品者: " +
      item.sellerName +
      (item.account ? "（" + item.account + "）" : "") +
      "\n" +
      "   カテゴリ: " +
      item.category +
      "\n" +
      "   料金: " +
      item.price +
      "\n" +
      "   対応形式・地域: " +
      item.formatRegion +
      "\n" +
      "   特徴: " +
      item.features;

    if (item.ratingLine) {
      block += "\n   評価・実績: " + item.ratingLine;
    }

    block += "\n   詳細: " + url;
    return block;
  }

  function formatSkillResults(criteria, items) {
    let body = formatSkillCriteriaSummary(criteria);
    body += "\n【おすすめ候補】（スキル掲載・" + items.length + "件）\n";
    items.forEach((item, i) => {
      body += formatSkillCandidate(item, i + 1) + "\n";
    });
    body +=
      "\n【次の行動】\n" +
      "・スキル一覧: index.html\n" +
      "・詳細ページから依頼・問い合わせができます";
    return body;
  }

  function formatSkillNoResults(criteria) {
    let body = formatSkillCriteriaSummary(criteria);
    body +=
      "\n【検索結果】\n" +
      "該当するスキル掲載が見つかりませんでした。\n\n" +
      "条件を少し広げてください。例：\n" +
      "・予算を広げる\n" +
      "・納期条件を外す\n" +
      "・カテゴリを広げる（またはキーワードだけで探す）\n" +
      "・地域・対応形式（オンラインのみ等）を緩める\n" +
      "・「受付中」「高評価」の条件を外す\n\n" +
      "一覧でも探せます: index.html";
    return body;
  }

  async function searchSkillListings(ctx) {
    try {
      const criteria = extractSkillCriteria(ctx);

      if (!hasMinimumSkillCriteria(criteria)) {
        return buildAskMoreSkillCriteria();
      }

      if (!global.TasuListingStore?.fetchPublishedListings) {
        console.warn("[TasuAiSearch] skill listings store unavailable");
        return null;
      }

      let candidates;
      try {
        candidates = await fetchPublishedSkillListings();
      } catch (err) {
        console.warn("[TasuAiSearch] skill fetch failed:", err);
        return null;
      }

      const ranked = rankSkillCandidates(candidates, criteria);
      if (!ranked.length) {
        return formatSkillNoResults(criteria);
      }
      return formatSkillResults(criteria, ranked);
    } catch (err) {
      console.warn("[TasuAiSearch] searchSkillListings error:", err);
      return null;
    }
  }

  const WORKER_TASK_KEYWORDS = [
    { id: "shopping", label: "買い物代行", patterns: /買い物代行|買い物|ショッピング/ },
    { id: "delivery", label: "配送・配達", patterns: /配送|配達|デリバリー|宅配/ },
    { id: "cleaning", label: "清掃", patterns: /清掃|掃除|ハウスクリーニング/ },
    { id: "light_work", label: "軽作業", patterns: /軽作業|単純作業|力仕事|搬入|搬出/ },
    { id: "companion", label: "話し相手・付き添い", patterns: /話し相手|付き添い|見守り/ },
    { id: "onsite", label: "出張・現場", patterns: /出張|現場作業|現場対応/ },
    { id: "office", label: "事務サポート", patterns: /事務|データ入力|オフィス/ },
  ];

  const WORKER_AREA_LABELS = {
    online: "オンライン",
    nationwide: "全国対応",
    nearby: "近隣エリア",
    onsite: "出張可",
  };

  const WORKER_TIME_LABELS = {
    same_day: "即日対応可",
    night: "深夜対応",
    weekend: "土日対応",
    weekday: "平日対応",
  };

  function formatWorkerTaskLabel(raw) {
    const key = toDisplayLabel(raw, "");
    if (!key) return "ワーカー";
    const found = WORKER_TASK_KEYWORDS.find((r) => r.id === key);
    if (found) return found.label;
    return key;
  }

  function formatWorkerAreaLabel(raw) {
    const key = toDisplayLabel(raw, "").toLowerCase();
    if (!key) return "";
    return WORKER_AREA_LABELS[key] || toDisplayLabel(raw, "");
  }

  function isPublishedWorkerListing(listing) {
    const type = String(listing?.listing_type || listing?.type || "").trim();
    if (type !== "worker") return false;
    const pub = String(listing?.publish_status || listing?.status || "public").toLowerCase();
    if (pub === "draft" || pub === "scheduled" || pub === "closed") return false;
    const hay = `${listing?.title || ""} ${listing?.description || ""}`.toLowerCase();
    if (/受付終了|募集終了|対応不可/.test(hay)) return false;
    return true;
  }

  function buildWorkerDetailUrl(listing) {
    if (global.TasuListingRenderer?.getDetailUrl) {
      const url = global.TasuListingRenderer.getDetailUrl({
        ...listing,
        type: "worker",
        listing_type: "worker",
      });
      if (url && url !== "#") return url;
    }
    const id = String(listing?.id || "").trim();
    return id ? `detail-worker.html?id=${encodeURIComponent(id)}` : "detail-worker.html";
  }

  function normalizeWorkerRow(row) {
    if (global.TasuListingRenderer?.normalizeGeneralRow) {
      return global.TasuListingRenderer.normalizeGeneralRow({
        ...row,
        listing_type: "worker",
        _source: row._source || "supabase",
      });
    }
    return {
      ...row,
      listing_type: "worker",
      type: "worker",
      form_data:
        row.form_data && typeof row.form_data === "object"
          ? row.form_data
          : global.TasuWorkerListingFields?.parseFormData?.(row.form_data) || {},
    };
  }

  function resolveWorkerRatingLine(listing, fd, norm) {
    const parts = [];
    const avg =
      listing.review_average ?? listing.rating_avg ?? fd.review_average ?? null;
    const count =
      listing.review_count != null
        ? Number(listing.review_count)
        : fd.review_count != null
          ? Number(fd.review_count)
          : null;
    if (avg != null && !Number.isNaN(Number(avg))) {
      parts.push(`★${Number(avg).toFixed(1)}`);
    }
    if (count != null && !Number.isNaN(count) && count > 0) {
      parts.push(`レビュー${count}件`);
    }
    const deals = listing.deals_count ?? listing.sales_count ?? fd.deals_count ?? null;
    if (deals != null && Number(deals) > 0) {
      parts.push(`実績${Number(deals)}件`);
    }
    if (norm?.experience) {
      const exp = norm.experience.length > 28 ? norm.experience.slice(0, 28) + "…" : norm.experience;
      parts.push(`経験: ${exp}`);
    }
    return parts.join(" / ");
  }

  function workerListingToCandidate(row) {
    const listing = normalizeWorkerRow(row);
    const fd =
      listing.form_data && typeof listing.form_data === "object"
        ? listing.form_data
        : global.TasuWorkerListingFields?.parseFormData?.(listing.form_data) || {};
    const norm = global.TasuWorkerListingFields?.normalizeWorkerListing?.(listing) || {
      displayName: listing.worker_display_name || listing.name || "",
      services: listing.worker_services || "",
      area: listing.worker_area || "",
      availability: listing.worker_availability || "",
      experience: listing.worker_experience || "",
      certifications: listing.worker_certifications || "",
      priceText: listing.priceText || "",
      supportTags: listing.worker_support_tags || "",
    };

    const taskRaw =
      pickSkillFormValue(fd, [
        "worker_task",
        "workerTask",
        "task_type",
        "workerCategory",
        "worker_category",
        "category",
      ]) || toDisplayLabel(listing.category, "");
    const taskCategory = formatWorkerTaskLabel(taskRaw);
    const areaRaw = norm.area || pickSkillFormValue(fd, ["worker_area", "service_area"]);
    const areaLabel = formatWorkerAreaLabel(areaRaw);
    const geoArea = pickSkillFormValue(fd, ["location", "region", "prefecture"]) || "";

    const serviceFormat = [];
    if (/online|オンライン|リモート/i.test(`${areaRaw} ${geoArea} ${(listing.tags || []).join(" ")}`)) {
      serviceFormat.push("オンライン");
    }
    if (/onsite|出張|現地|訪問/i.test(`${areaRaw} ${norm.services} ${(listing.tags || []).join(" ")}`)) {
      serviceFormat.push("出張・対面");
    }
    if (!serviceFormat.length && areaLabel) serviceFormat.push(areaLabel);

    const availabilityRaw = pickSkillFormValue(fd, ["worker_time", "worker_availability"]) || norm.availability;
    const availabilityLabel = WORKER_TIME_LABELS[availabilityRaw] || availabilityRaw || "";

    const regionDisplay =
      toDisplayJoin(
        [geoArea, areaLabel !== "オンライン" && areaLabel !== "全国対応" ? areaLabel : ""],
        " / ",
        ""
      ) ||
      areaLabel ||
      DISPLAY_FALLBACK.region;

    const tags = listing.tags || listing.displayTags || [];
    const supportTags = toDisplayJoin(norm.supportTags || "", "、", "")
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const tagItems = (Array.isArray(tags) ? tags : toDisplayLabel(tags, "").split(/[,、]/))
      .map((t) => toDisplayLabel(t, ""))
      .filter(Boolean);
    const allTags = [...new Set([...tagItems, ...supportTags])];
    const features =
      toDisplayJoin(allTags, "、", "")
        .split("、")
        .filter(Boolean)
        .slice(0, 6)
        .join("、") ||
      toDisplayLabel(norm.services, "").slice(0, 60) ||
      DISPLAY_FALLBACK.description;

    const workerName =
      norm.displayName ||
      listing.title ||
      listing.name ||
      (listing.user_id ? `ワーカー ${String(listing.user_id).slice(0, 8)}` : "ワーカー");
    const account =
      listing.account || (listing.user_id ? `@${String(listing.user_id).slice(0, 14)}` : "");

    const price =
      norm.priceText ||
      listing.priceText ||
      (listing.price_amount != null && !Number.isNaN(Number(listing.price_amount))
        ? `¥${Number(listing.price_amount).toLocaleString("ja-JP")}`
        : "要相談");

    return {
      id: listing.id,
      workerName,
      account,
      title: listing.title || workerName,
      taskCategory,
      taskKey: taskRaw,
      region: regionDisplay,
      areaRaw,
      price,
      priceYen: parsePriceYen(price, listing.worker_price_amount ?? listing.price_amount),
      payType: norm.priceType || pickSkillFormValue(fd, ["worker_price_type", "price_type"]),
      serviceFormat: serviceFormat.join("・") || "—",
      availability: availabilityLabel,
      experience: norm.experience || "",
      certifications: norm.certifications || "",
      features,
      ratingLine: resolveWorkerRatingLine(listing, fd, norm),
      connectSupported: Boolean(
        fd.connect_enabled ||
          fd.platform_connect ||
          /connect|コネクト/i.test(allTags.join(" "))
      ),
      detailUrl: buildWorkerDetailUrl(listing),
      recruitOpen: isPublishedWorkerListing(listing),
      tags: allTags,
      listing,
      norm,
    };
  }

  function inferWorkerTaskId(text) {
    for (const row of WORKER_TASK_KEYWORDS) {
      if (row.patterns.test(text)) return row.id;
    }
    return "";
  }

  function extractWorkerCriteria(ctx) {
    const text = combineUserText(ctx);
    const area = extractArea(text);
    const budgetText = extractBudgetText(text);
    const payType = /時給/.test(text) ? "時給" : /日給/.test(text) ? "日給" : "";
    const taskId = inferWorkerTaskId(text);
    const onlineOnly = /オンライン|リモート|remote/i.test(text);
    const onsiteOnly = /対面|出張|現地|訪問/i.test(text);
    const availableDays =
      text.match(/(土日|平日|即日|週末|夜間|深夜)/)?.[0] || "";
    const experienceYears = text.match(/(\d+)\s*年(?:以上|程度)?/)?.[0] || "";
    const certificationRequired =
      /有資格|資格必須|資格あり|免許必須|免許あり/.test(text) ||
      (/資格|免許|認定/.test(text) && !/資格不要|資格なし|免許不要|不要/.test(text));
    const ratingFocus = /評価|レビュー|実績|高評価|星/.test(text);
    const acceptingOnly = /受付中|対応可能|募集中/.test(text);
    const connectOnly =
      Boolean(ctx.searchIntent?.connectOnly) ||
      Boolean(ctx.intentHints?.connectOnly) ||
      /Connect|コネクト|connect対応/i.test(text);
    const minRating =
      ctx.searchIntent?.minRating || ctx.intentHints?.minRating || extractMinRatingFromText(text);

    let requestText = text;
    [area, budgetText, payType, taskId, availableDays, experienceYears].forEach((part) => {
      if (part) requestText = requestText.replace(String(part), " ");
    });
    requestText = requestText
      .replace(/オンライン|リモート|対面|出張|資格|受付中|時給|日給/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const requestKeywords = requestText
      .split(/[\s、。・\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    return {
      text,
      area,
      budgetText,
      budgetYen: parseBudgetYen(text),
      payType,
      taskId,
      onlineOnly,
      onsiteOnly,
      availableDays,
      experienceYears,
      certificationRequired,
      ratingFocus,
      acceptingOnly,
      connectOnly,
      minRating: minRating || null,
      requestKeywords,
      requestText: requestText.slice(0, 120),
    };
  }

  function hasMinimumWorkerCriteria(criteria) {
    if (!criteria.text || criteria.text.length < 3) return false;
    return Boolean(
      criteria.requestKeywords.length >= 1 ||
        criteria.taskId ||
        criteria.area ||
        criteria.budgetText ||
        criteria.requestText.length >= 4
    );
  }

  function buildAskMoreWorkerCriteria() {
    return (
      "次を教えてください：\n" +
      "・依頼内容・作業カテゴリ（清掃、軽作業、配送など）\n" +
      "・地域・対応形式（オンライン / 出張）\n" +
      "・予算・時給・日給\n" +
      "・対応可能日・資格の希望\n" +
      "・評価・実績の希望があれば"
    );
  }

  function workerCandidateHaystack(candidate) {
    const fm = getFieldMatch();
    const fieldText = fm ? Object.values(fm.buildWorkerFields(candidate)).join(" ") : "";
    return [
      candidate.title,
      candidate.workerName,
      candidate.account,
      candidate.taskCategory,
      candidate.region,
      candidate.price,
      candidate.payType,
      candidate.serviceFormat,
      candidate.availability,
      candidate.experience,
      candidate.certifications,
      candidate.features,
      candidate.ratingLine,
      candidate.norm?.services,
      candidate.norm?.profile,
      candidate.listing?.description,
      (candidate.tags || []).join(" "),
      fieldText,
    ]
      .join(" ")
      .toLowerCase();
  }

  function matchesWorkerArea(candidate, area) {
    if (!area) return true;
    const hay = workerCandidateHaystack(candidate);
    const needle = area.toLowerCase();
    if (hay.includes(needle)) return true;
    if (needle.includes("東京") && /東京|23区|都内/.test(hay)) return true;
    if (needle.includes("大阪") && /大阪/.test(hay)) return true;
    if (needle.includes("埼玉") && /埼玉/.test(hay)) return true;
    return false;
  }

  function matchesWorkerConnect(candidate, connectOnly) {
    if (!connectOnly) return true;
    const fd =
      candidate.listing?.form_data && typeof candidate.listing.form_data === "object"
        ? candidate.listing.form_data
        : {};
    if (fd.connect_enabled || fd.platform_connect || candidate.connectSupported) return true;
    const hay = workerCandidateHaystack(candidate);
    return /connect|コネクト|プラットフォーム決済|Connect対応/i.test(hay);
  }

  function matchesWorkerTask(candidate, taskId) {
    if (!taskId) return true;
    if (candidate.taskKey === taskId) return true;
    const hay = workerCandidateHaystack(candidate);
    const row = WORKER_TASK_KEYWORDS.find((r) => r.id === taskId);
    if (row && row.patterns.test(hay)) return true;
    return hay.includes(taskId);
  }

  function matchesWorkerFormat(candidate, criteria) {
    const hay = workerCandidateHaystack(candidate);
    if (criteria.onlineOnly && !/オンライン|リモート|online|全国/.test(hay)) return false;
    if (criteria.onsiteOnly && !/出張|対面|現地|訪問|onsite|近隣/.test(hay)) return false;
    return true;
  }

  function matchesWorkerAvailability(candidate, availableDays) {
    if (!availableDays) return true;
    const hay = `${candidate.availability || ""} ${workerCandidateHaystack(candidate)}`;
    return hay.includes(availableDays) || /即日|土日|平日|週末|深夜/.test(hay);
  }

  function matchesWorkerCertification(candidate, required) {
    if (!required) return true;
    const hay = `${candidate.certifications || ""} ${workerCandidateHaystack(candidate)}`;
    return /資格|免許|認定|証|保有/.test(hay);
  }

  function matchesWorkerExperience(candidate, experienceYears) {
    if (!experienceYears) return true;
    const hay = `${candidate.experience || ""} ${workerCandidateHaystack(candidate)}`;
    const want = experienceYears.match(/(\d+)/)?.[1];
    if (!want) return hay.includes("経験") || hay.includes("年");
    const have = hay.match(/(\d+)\s*年/);
    if (have) return Number(have[1]) >= Number(want);
    return hay.includes("経験");
  }

  function matchesWorkerAccepting(candidate) {
    return candidate.recruitOpen !== false;
  }

  function passesWorkerHardFilters(candidate, criteria) {
    if (criteria.acceptingOnly && !matchesWorkerAccepting(candidate)) return false;
    if (criteria.certificationRequired && !matchesWorkerCertification(candidate, true)) return false;
    if (criteria.connectOnly && !matchesWorkerConnect(candidate, true)) return false;
    if (criteria.minRating) {
      const line = String(candidate.ratingLine || "");
      const m = line.match(/★([\d.]+)/);
      if (m && Number(m[1]) < Number(criteria.minRating)) return false;
    }
    return true;
  }

  function scoreWorkerCandidate(candidate, criteria) {
    if (!passesWorkerHardFilters(candidate, criteria)) return -1;

    let score = 0;
    const hay = workerCandidateHaystack(candidate);
    const fm = getFieldMatch();

    if (fm) {
      score = addWeightedFieldScore(score, fm.buildWorkerFields(candidate), criteria, [
        "requestText",
        "text",
      ]);
    } else {
      criteria.requestKeywords.forEach((kw) => {
        if (kw.length >= 2 && hay.includes(kw.toLowerCase())) score += 4;
      });
      if (
        criteria.requestText.length >= 3 &&
        hay.includes(criteria.requestText.slice(0, 12).toLowerCase())
      ) {
        score += 3;
      }
    }

    if (criteria.taskId && matchesWorkerTask(candidate, criteria.taskId)) score += 4;
    else if (criteria.taskId) score += 1;
    if (criteria.area && matchesWorkerArea(candidate, criteria.area)) score += 4;
    else if (criteria.area) score += 1;
    if (!matchesWorkerFormat(candidate, criteria)) score -= 1;
    if (criteria.availableDays && matchesWorkerAvailability(candidate, criteria.availableDays)) {
      score += 3;
    } else if (criteria.availableDays) score += 0.5;
    if (criteria.payType) {
      const hay = workerCandidateHaystack(candidate);
      if (hay.includes(criteria.payType.toLowerCase())) score += 2;
      else score += 0.5;
    }
    if (criteria.certificationRequired && matchesWorkerCertification(candidate, true)) score += 3;
    if (criteria.experienceYears && matchesWorkerExperience(candidate, criteria.experienceYears)) {
      score += 2;
    }

    if (criteria.budgetYen != null && candidate.priceYen != null) {
      if (candidate.priceYen <= criteria.budgetYen) score += 2;
      else if (candidate.priceYen <= criteria.budgetYen * 1.35) score += 1;
    } else if (criteria.budgetText && /要相談|相談/.test(candidate.price)) {
      score += 1;
    }

    if (criteria.onlineOnly && /オンライン|リモート|online/.test(hay)) score += 2;
    if (criteria.onsiteOnly && /出張|対面|現地/.test(hay)) score += 2;

    if (criteria.ratingFocus && candidate.ratingLine) {
      if (/★[4-5]/.test(candidate.ratingLine) || /実績|レビュー/.test(candidate.ratingLine)) {
        score += 2;
      }
    }

    if (criteria.acceptingOnly && matchesWorkerAccepting(candidate)) score += 1;
    else if (matchesWorkerAccepting(candidate)) score += 0.5;

    if (candidate.listing?.is_featured) score += 0.5;

    return score;
  }

  function mergeConnectWorkerDemos(candidates, criteria) {
    const out = Array.isArray(candidates) ? [...candidates] : [];
    const seen = new Set(out.map((c) => String(c.id || "")));
    const catalog = global.TasuListingDemoCatalog;
    const extraIds = ["demo-worker-connect-001", "demo-worker-connect-002"];
    extraIds.forEach((id) => {
      const row = catalog?.getStoreListing?.(id);
      if (!row || seen.has(id)) return;
      if (criteria.connectOnly && !/connect|コネクト/i.test((row.tags || []).join(" "))) return;
      seen.add(id);
      out.push(workerListingToCandidate(row));
    });
    return out;
  }

  async function fetchPublishedWorkerListings() {
    const store = global.TasuListingStore;
    if (!store?.fetchPublishedListings) {
      throw new Error("TasuListingStore が読み込まれていません");
    }

    const rows = await store.fetchPublishedListings({
      listing_type: "worker",
      limit: FETCH_LIMIT,
      public_only: true,
      localFallback: true,
    });

    return rows.filter(isPublishedWorkerListing).map(workerListingToCandidate);
  }

  function rankWorkerCandidates(candidates, criteria) {
    return candidates
      .map((item) => ({ item, score: scoreWorkerCandidate(item, criteria) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((row) => row.item);
  }

  function formatWorkerCriteriaSummary(criteria) {
    let body = "【整理した条件】\n";
    if (criteria.requestText) body += "・依頼内容: " + criteria.requestText + "\n";
    if (criteria.taskId) {
      body += "・作業カテゴリ: " + formatWorkerTaskLabel(criteria.taskId) + "\n";
    }
    if (criteria.area) body += "・地域: " + criteria.area + "\n";
    if (criteria.budgetText) body += "・予算: " + criteria.budgetText + "\n";
    if (criteria.payType) body += "・単価形式: " + criteria.payType + "\n";
    if (criteria.availableDays) body += "・対応可能日: " + criteria.availableDays + "\n";
    if (criteria.experienceYears) body += "・経験: " + criteria.experienceYears + "\n";
    const flags = [];
    if (criteria.onlineOnly) flags.push("オンライン");
    if (criteria.onsiteOnly) flags.push("出張・対面");
    if (criteria.certificationRequired) flags.push("資格あり");
    if (criteria.ratingFocus) flags.push("評価・実績重視");
    if (criteria.acceptingOnly) flags.push("受付中");
    if (flags.length) body += "・希望条件: " + flags.join("、") + "\n";
    return body;
  }

  function formatWorkerCandidate(item, index) {
    const url = item.detailUrl.startsWith("http")
      ? item.detailUrl
      : new URL(item.detailUrl, global.location?.href || "").href;

    let block =
      index +
      ". " +
      item.title +
      "\n" +
      "   ワーカー名: " +
      item.workerName +
      (item.account ? "（" + item.account + "）" : "") +
      "\n" +
      "   対応カテゴリ: " +
      item.taskCategory +
      "\n" +
      "   対応地域: " +
      item.region +
      "\n" +
      "   料金目安: " +
      item.price +
      "\n" +
      "   対応形式: " +
      item.serviceFormat +
      (item.availability ? " / " + item.availability : "") +
      "\n" +
      "   経験: " +
      (item.experience || "—") +
      "\n" +
      "   資格: " +
      (item.certifications || "—") +
      "\n" +
      "   特徴: " +
      item.features;

    if (item.ratingLine) {
      block += "\n   評価・実績: " + item.ratingLine;
    }

    block += "\n   詳細: " + url;
    return block;
  }

  function formatWorkerResults(criteria, items) {
    let body = formatWorkerCriteriaSummary(criteria);
    body += "\n【おすすめ候補】（ワーカー掲載・" + items.length + "件）\n";
    items.forEach((item, i) => {
      body += formatWorkerCandidate(item, i + 1) + "\n";
    });
    body +=
      "\n【次の行動】\n" +
      "・ワーカー一覧: index.html\n" +
      "・詳細ページから依頼・問い合わせができます";
    return body;
  }

  function formatWorkerNoResults(criteria) {
    let body = formatWorkerCriteriaSummary(criteria);
    body +=
      "\n【検索結果】\n" +
      "該当するワーカー掲載が見つかりませんでした。\n\n" +
      "条件を少し広げてください。例：\n" +
      "・地域条件を広げる\n" +
      "・予算・時給・日給の条件を広げる\n" +
      "・対応形式（オンラインのみ等）を緩める\n" +
      "・資格条件を外す\n" +
      "・「受付中」「高評価」の条件を外す\n\n" +
      "一覧でも探せます: index.html";
    return body;
  }

  async function searchWorkerListings(ctx) {
    try {
      const criteria = extractWorkerCriteria(ctx);

      if (!hasMinimumWorkerCriteria(criteria)) {
        return buildAskMoreWorkerCriteria();
      }

      if (!global.TasuListingStore?.fetchPublishedListings) {
        console.warn("[TasuAiSearch] worker listings store unavailable");
        return null;
      }

      let candidates;
      try {
        candidates = await fetchPublishedWorkerListings();
      } catch (err) {
        console.warn("[TasuAiSearch] worker fetch failed:", err);
        return null;
      }

      const ranked = rankWorkerCandidates(candidates, criteria);
      if (!ranked.length) {
        return formatWorkerNoResults(criteria);
      }
      return formatWorkerResults(criteria, ranked);
    } catch (err) {
      console.warn("[TasuAiSearch] searchWorkerListings error:", err);
      return null;
    }
  }

  function ensureRelaxedCriteria(criteria) {
    if (!criteria || !criteria.text) return;
    const words = criteria.text
      .replace(/してほしい|したい|探して|教えて|ください|お願い|ある\?|いる\?/g, " ")
      .split(/[\s、。・\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);
    if (!criteria.keywords?.length && words.length) criteria.keywords = words;
    if (!criteria.requestKeywords?.length && words.length) criteria.requestKeywords = words;
    if (!criteria.jobKeywords?.length && words.length) criteria.jobKeywords = words;
    if (!criteria.productKeywords?.length && words.length) criteria.productKeywords = words;
    if (!criteria.requestContent && criteria.text.length >= 2) {
      criteria.requestContent = criteria.text.slice(0, 120);
    }
    if (!criteria.requestText && criteria.text.length >= 2) {
      criteria.requestText = criteria.text.slice(0, 120);
    }
    if (!criteria.productText && criteria.text.length >= 2) {
      criteria.productText = criteria.text.slice(0, 120);
    }
    if (!criteria.jobText && criteria.text.length >= 2) {
      criteria.jobText = criteria.text.slice(0, 120);
    }
  }

  function prioritizeGardenItems(items, criteria) {
    if (criteria.serviceProfile !== "garden" && criteria.subcategoryId !== "lawn_care") {
      return items;
    }
    const lawn = [];
    const gardenHay = [];
    const cleaning = [];
    const rest = [];
    items.forEach((item) => {
      if (subcategoryMatches(item, "lawn_care")) {
        lawn.push(item);
        return;
      }
      const hay = listingHaystack(item);
      if (GARDEN_SERVICE_PATTERNS.test(hay)) {
        gardenHay.push(item);
        return;
      }
      if (categoryMatches(item, criteria.categoryId || "cleaning")) {
        cleaning.push(item);
        return;
      }
      rest.push(item);
    });
    return [...lawn, ...gardenHay, ...cleaning, ...rest];
  }

  function isIndoorCleaningListing(item) {
    const hay = listingHaystack(item);
    const indoor =
      (INDOOR_CLEANING_PATTERNS.test(hay) || JUNK_REMOVAL_PATTERNS.test(hay)) &&
      !GARDEN_SERVICE_PATTERNS.test(hay);
    return indoor && !subcategoryMatches(item, "lawn_care");
  }

  function finalizeGardenRanking(ranked, pool, criteria) {
    if (criteria.serviceProfile !== "garden" && criteria.subcategoryId !== "lawn_care") {
      return ranked;
    }
    const seen = new Set();
    const lawn = [];
    const related = [];
    const other = [];
    const indoor = [];

    const pushUnique = (bucket, item) => {
      const id = String(item.id || item.demo_id || item.title || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      bucket.push(item);
    };

    ranked.forEach((item) => {
      if (subcategoryMatches(item, "lawn_care")) pushUnique(lawn, item);
      else if (isIndoorCleaningListing(item)) pushUnique(indoor, item);
      else if (GARDEN_SERVICE_PATTERNS.test(listingHaystack(item))) pushUnique(related, item);
      else pushUnique(other, item);
    });

    pool.forEach((item) => {
      if (subcategoryMatches(item, "lawn_care")) pushUnique(lawn, item);
    });

    return [...lawn, ...related, ...other, ...indoor].slice(0, MAX_RESULTS);
  }

  function rankListingsWithFallback(items, criteria) {
    const pool = prioritizeGardenItems(items, criteria);
    const ranked = rankListings(pool, criteria);
    if (ranked.length) return finalizeGardenRanking(ranked, pool, criteria);

    if (criteria.serviceProfile === "garden" || criteria.subcategoryId === "lawn_care") {
      const lawnOnly = pool.filter((item) => subcategoryMatches(item, "lawn_care"));
      if (lawnOnly.length) return lawnOnly.slice(0, MAX_RESULTS);
      const gardenHay = pool.filter((item) => GARDEN_SERVICE_PATTERNS.test(listingHaystack(item)));
      if (gardenHay.length) return gardenHay.slice(0, MAX_RESULTS);
    }

    if (criteria.categoryId) {
      const catOnly = pool.filter((item) => categoryMatches(item, criteria.categoryId));
      if (catOnly.length) return finalizeGardenRanking(catOnly, pool, criteria);
    }

    return finalizeGardenRanking(pool.slice(0, MAX_RESULTS), pool, criteria);
  }

  function rankProductWithFallback(candidates, criteria) {
    const ranked = rankProductCandidates(candidates, criteria);
    if (ranked.length) return ranked;
    return candidates.slice(0, MAX_RESULTS);
  }

  function rankJobWithFallback(candidates, criteria) {
    const ranked = rankJobCandidates(candidates, criteria);
    if (ranked.length) return ranked;
    return candidates.slice(0, MAX_RESULTS);
  }

  function rankSkillWithFallback(candidates, criteria) {
    const ranked = rankSkillCandidates(candidates, criteria);
    if (ranked.length) return ranked;
    return candidates.slice(0, MAX_RESULTS);
  }

  function rankWorkerWithFallback(candidates, criteria) {
    const ranked = rankWorkerCandidates(candidates, criteria);
    if (ranked.length) return ranked;
    return candidates.slice(0, MAX_RESULTS);
  }

  function absDetailUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("http") || u.startsWith("/")) return u;
    return new URL(u, global.location?.href || "").href;
  }

  function enrichCardContact(card, listing) {
    const attach = global.TasuAiContactInfo?.attachContactToCard;
    if (!attach || !listing) return card;
    return attach(card, listing, { detailUrl: card.detailUrl, kind: card.kind });
  }

  function businessListingToCard(item, navOpts) {
    const baseDetailUrl = absDetailUrl(getDetailUrl(item));
    const detailUrl = global.TasuDetailNav?.buildAiDetailUrl
      ? global.TasuDetailNav.buildAiDetailUrl(baseDetailUrl, navOpts || {})
      : baseDetailUrl;
    const price =
      item.budgetLabel || item.budgetText || item.main_price_text || "見積要相談";
    const rating =
      item.rating_average != null && item.rating_average !== ""
        ? `★ ${item.rating_average}`
        : item.boardTrustShort || item.trust_label || "—";
    const card = {
      kind: "business_service",
      id: String(item.id || item.demo_id || ""),
      title: item.company_name || item.title || "（事業者名未設定）",
      category: toDisplayLabel(item.categoryLabel || item.business_category, "業務サービス"),
      region: toDisplayLabel(item.service_area, DISPLAY_FALLBACK.region),
      price,
      rating,
      description: pickFeatures(item),
      detailUrl,
      estimateUrl: detailUrl ? `${detailUrl.split("#")[0]}#estimate` : "",
      consultUrl: detailUrl,
      chatUrl: detailUrl,
      applyUrl: "",
      purchaseUrl: "",
      raw: item,
    };
    return normalizeSearchCard(enrichCardContact(card, item));
  }

  function productCandidateToCard(item) {
    const detailUrl = absDetailUrl(item.detailUrl);
    const listing = item.listing || {};
    const card = {
      kind: item.source === "shop_store" ? "shop_product" : "product",
      id: String(listing?.id || item.product?.id || ""),
      title: item.productName || "商品",
      category: toDisplayLabel(item.category, "商品"),
      region: toDisplayLabel(item.regionDelivery, DISPLAY_FALLBACK.region),
      price: toDisplayLabel(item.price, DISPLAY_FALLBACK.price),
      rating: DISPLAY_FALLBACK.rating,
      description: toDisplayLabel(item.features, DISPLAY_FALLBACK.description),
      detailUrl,
      estimateUrl: "",
      consultUrl: detailUrl,
      chatUrl: detailUrl,
      applyUrl: "",
      purchaseUrl: detailUrl,
      shopName: item.shopName,
      shopDetailUrl: listing?.id
        ? absDetailUrl(`detail-shop-store.html?id=${encodeURIComponent(String(listing.id))}`)
        : "",
      raw: item,
    };
    return normalizeSearchCard(enrichCardContact(card, listing));
  }

  function shopFromProductCard(item) {
    const shopId = String(item.listing?.id || "").trim();
    const detailUrl = shopId
      ? absDetailUrl(`detail-shop-store.html?id=${encodeURIComponent(shopId)}`)
      : absDetailUrl("shop-store.html");
    const card = {
      kind: "shop",
      id: shopId,
      title: item.shopName || "店舗",
      category: toDisplayLabel(item.shopCategoryKey || item.category, "店舗・販売"),
      region: toDisplayLabel(item.regionDelivery, DISPLAY_FALLBACK.region),
      price: "店舗ページで確認",
      rating: DISPLAY_FALLBACK.rating,
      description: toDisplayLabel(item.features, DISPLAY_FALLBACK.description),
      detailUrl,
      estimateUrl: "",
      consultUrl: detailUrl,
      chatUrl: detailUrl,
      applyUrl: "",
      purchaseUrl: "",
      raw: item,
    };
    return normalizeSearchCard(enrichCardContact(card, item.listing || item.raw?.listing));
  }

  function jobCandidateToCard(item) {
    const detailUrl = absDetailUrl(item.detailUrl);
    const listing = item.listing || item;
    const card = {
      kind: "job",
      id: String(item.id || ""),
      title: item.title || "求人",
      category: toDisplayLabel(item.category, "求人"),
      region: toDisplayLabel(item.location, DISPLAY_FALLBACK.region),
      price: toDisplayLabel(item.salary, DISPLAY_FALLBACK.price),
      rating: toDisplayLabel(item.recruitStatus, DISPLAY_FALLBACK.rating),
      description: toDisplayLabel(item.recruitConditions, DISPLAY_FALLBACK.description),
      detailUrl,
      estimateUrl: "",
      consultUrl: detailUrl,
      chatUrl: detailUrl,
      applyUrl: detailUrl,
      purchaseUrl: "",
      raw: item,
    };
    return normalizeSearchCard(enrichCardContact(card, listing));
  }

  function skillCandidateToCard(item) {
    const detailUrl = absDetailUrl(item.detailUrl);
    const listing = item.listing || item;
    const card = {
      kind: "skill",
      id: String(item.id || ""),
      title: item.title || item.sellerName || "スキル",
      category: toDisplayLabel(item.category, "スキル"),
      region: toDisplayLabel(item.formatRegion || item.area, DISPLAY_FALLBACK.region),
      price: toDisplayLabel(item.price, DISPLAY_FALLBACK.price),
      rating: toDisplayLabel(item.ratingLine, DISPLAY_FALLBACK.rating),
      description: toDisplayLabel(item.features, DISPLAY_FALLBACK.description),
      detailUrl,
      estimateUrl: "",
      consultUrl: detailUrl,
      chatUrl: detailUrl,
      applyUrl: detailUrl,
      purchaseUrl: "",
      raw: item,
    };
    return normalizeSearchCard(enrichCardContact(card, listing));
  }

  function workerCandidateToCard(item) {
    const detailUrl = absDetailUrl(item.detailUrl);
    const listing = item.listing || item;
    const card = {
      kind: "worker",
      id: String(item.id || ""),
      title: item.workerName || item.title || "ワーカー",
      category: toDisplayLabel(item.taskCategory, "ワーカー"),
      region: toDisplayLabel(item.region, DISPLAY_FALLBACK.region),
      price: toDisplayLabel(item.price, DISPLAY_FALLBACK.price),
      rating: toDisplayLabel(item.ratingLine, DISPLAY_FALLBACK.rating),
      description: toDisplayLabel(item.features, DISPLAY_FALLBACK.description),
      connectSupported: Boolean(item.connectSupported),
      detailUrl,
      estimateUrl: "",
      consultUrl: detailUrl,
      chatUrl: detailUrl,
      applyUrl: detailUrl,
      purchaseUrl: "",
      raw: item,
    };
    return normalizeSearchCard(enrichCardContact(card, listing));
  }

  function makeCrossCtx(ctx) {
    return {
      ...ctx,
      crossSearch: true,
      relaxed: true,
    };
  }

  async function queryBusinessItems(ctx) {
    const crossCtx = makeCrossCtx(ctx);
    const criteria = extractBusinessCriteria(crossCtx);
    applyServiceProfile(criteria);
    if (ctx.intentHints?.serviceProfile && !criteria.serviceProfile) {
      criteria.serviceProfile = ctx.intentHints.serviceProfile;
    }
    if (ctx.intentHints?.subcategoryId) {
      criteria.subcategoryId = ctx.intentHints.subcategoryId;
      if (ctx.intentHints.categoryId) criteria.categoryId = ctx.intentHints.categoryId;
    } else if (ctx.intentHints?.categoryId && !criteria.categoryId) {
      criteria.categoryId = ctx.intentHints.categoryId;
    }
    if (ctx.intentHints?.minRating && !criteria.minRating) {
      criteria.minRating = ctx.intentHints.minRating;
    }
    if (ctx.searchIntent?.minRating && !criteria.minRating) {
      criteria.minRating = ctx.searchIntent.minRating;
    }
    ensureRelaxedCriteria(criteria);
    if (!hasMinimumCriteria(criteria) && criteria.text.length < 2) {
      return { items: [], criteria, insufficient: true };
    }
    if (!global.TasuBusinessListings?.fetchPublishedBusinessListings) {
      return { items: [], criteria, insufficient: false };
    }
      let items;
      try {
        items = await fetchBusinessListings(criteria);
        if (global.TasuBusinessBoardDemo?.getListings) {
          const demoCats = [criteria.categoryId, ""].filter(Boolean);
          const demoSeen = new Set();
          demoCats.forEach((cat) => {
            (global.TasuBusinessBoardDemo.getListings(cat) || []).forEach((row) => {
              const id = String(row.id || "");
              if (!id || demoSeen.has(id)) return;
              demoSeen.add(id);
              if (!items.some((item) => String(item.id || "") === id)) {
                items.push(row);
              }
            });
          });
        }
      } catch {
        return { items: [], criteria, insufficient: false };
      }
    const ranked = preferUserFacingRanked(rankListingsWithFallback(items, criteria));
    const searchQ = String(ctx.userText || ctx.text || criteria.text || "").trim();
    return {
      items: ranked.map((row) => businessListingToCard(row, { q: searchQ })),
      criteria,
      insufficient: false,
    };
  }

  async function queryProductItems(ctx) {
    const crossCtx = makeCrossCtx(ctx);
    const criteria = extractProductCriteria(crossCtx);
    ensureRelaxedCriteria(criteria);
    if (!hasMinimumProductCriteria(criteria) && criteria.text.length < 2) {
      return { items: [], criteria, insufficient: true };
    }
    let candidates;
    try {
      candidates = await fetchAllProductCandidates();
    } catch {
      return { items: [], criteria, insufficient: false };
    }
    const ranked = preferUserFacingRanked(rankProductWithFallback(candidates, criteria));
    return {
      items: ranked.map(productCandidateToCard),
      criteria,
      insufficient: false,
    };
  }

  async function queryShopItems(ctx) {
    const productResult = await queryProductItems(ctx);
    const seen = new Set();
    const shops = [];
    (productResult.items || []).forEach((item) => {
      const shopId = String(item.raw?.listing?.id || item.id || "").trim();
      if (!shopId || seen.has(shopId)) return;
      seen.add(shopId);
      shops.push(shopFromProductCard(item.raw));
    });
    return { items: shops, criteria: productResult.criteria, insufficient: productResult.insufficient };
  }

  async function queryJobItems(ctx) {
    const crossCtx = makeCrossCtx(ctx);
    const criteria = extractJobCriteria(crossCtx);
    if (!hasMinimumJobCriteria(criteria) && criteria.text?.length >= 2) {
      ensureRelaxedCriteria(criteria);
      if (!criteria.jobKeywords?.length) {
        criteria.jobKeywords = criteria.text
          .split(/[\s、。]+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2);
      }
    }
    if (!hasMinimumJobCriteria(criteria)) {
      return { items: [], criteria, insufficient: true };
    }
    if (!global.TasuListingStore?.fetchPublishedListings) {
      return { items: [], criteria, insufficient: false };
    }
    let candidates;
    try {
      candidates = await fetchPublishedJobListings();
    } catch {
      return { items: [], criteria, insufficient: false };
    }
    const ranked = preferUserFacingRanked(rankJobWithFallback(candidates, criteria));
    return {
      items: ranked.map(jobCandidateToCard),
      criteria,
      insufficient: false,
    };
  }

  async function querySkillItems(ctx) {
    const crossCtx = makeCrossCtx(ctx);
    const criteria = extractSkillCriteria(crossCtx);
    ensureRelaxedCriteria(criteria);
    if (!hasMinimumSkillCriteria(criteria) && criteria.text.length < 2) {
      return { items: [], criteria, insufficient: true };
    }
    if (!global.TasuListingStore?.fetchPublishedListings) {
      return { items: [], criteria, insufficient: false };
    }
    let candidates;
    try {
      candidates = await fetchPublishedSkillListings();
    } catch {
      return { items: [], criteria, insufficient: false };
    }
    const ranked = preferUserFacingRanked(rankSkillWithFallback(candidates, criteria));
    return {
      items: ranked.map(skillCandidateToCard),
      criteria,
      insufficient: false,
    };
  }

  async function queryWorkerItems(ctx) {
    const crossCtx = makeCrossCtx(ctx);
    const criteria = extractWorkerCriteria(crossCtx);
    ensureRelaxedCriteria(criteria);
    if (!hasMinimumWorkerCriteria(criteria) && criteria.text.length < 2) {
      return { items: [], criteria, insufficient: true };
    }
    if (!global.TasuListingStore?.fetchPublishedListings) {
      return { items: [], criteria, insufficient: false };
    }
    let candidates;
    try {
      candidates = await fetchPublishedWorkerListings();
      candidates = mergeConnectWorkerDemos(candidates, criteria);
    } catch {
      return { items: [], criteria, insufficient: false };
    }
    const ranked = preferUserFacingRanked(rankWorkerWithFallback(candidates, criteria));
    return {
      items: ranked.map(workerCandidateToCard),
      criteria,
      insufficient: false,
    };
  }

  async function searchFaqKnowledge(ctx) {
    const userText = combineUserText(ctx);
    if (!userText || userText.length < 2) {
      return buildAskMoreCriteria();
    }
    const Faq = global.TasuAiFaqKnowledge;
    if (!Faq?.search) return null;
    const result = Faq.search(userText);
    if (!(result?.hits || []).length) return null;
    return Faq.formatForAi(result);
  }

  async function searchFaqKnowledgeRich(ctx) {
    const userText = combineUserText(ctx);
    const Faq = global.TasuAiFaqKnowledge;
    if (!Faq?.search || !userText) return null;
    const result = Faq.search(userText);
    if (!(result?.hits || []).length) return null;
    return {
      plain: Faq.formatForAi(result),
      html: Faq.formatHtml(result),
    };
  }

  const api = {
    search,
    searchBusinessListings,
    searchWorkerListings,
    searchProductListings,
    searchJobListings,
    searchSkillListings,
    searchFaqKnowledge,
    searchFaqKnowledgeRich,
    queryBusinessItems,
    queryProductItems,
    queryShopItems,
    queryJobItems,
    querySkillItems,
    queryWorkerItems,
    businessListingToCard,
    productCandidateToCard,
    extractBusinessCriteria,
    rankListings,
    extractProductCriteria,
    rankProductCandidates,
    fetchAllProductCandidates,
    extractJobCriteria,
    rankJobCandidates,
    fetchPublishedJobListings,
    extractSkillCriteria,
    rankSkillCandidates,
    fetchPublishedSkillListings,
    extractWorkerCriteria,
    rankWorkerCandidates,
    fetchPublishedWorkerListings,
  };

  global.TasuAiSearch = api;
})(typeof window !== "undefined" ? window : globalThis);

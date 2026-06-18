/**
 * AI検索: 全フィールド重み付けマッチング
 * タイトル > カテゴリ > サービスメニュー/スキル > 詳細説明
 */
(function (global) {
  "use strict";

  const WEIGHTS = {
    title: 10,
    category: 8,
    subcategory: 7,
    serviceMenu: 7,
    skillList: 7,
    qualifications: 7,
    tags: 6,
    welcomeSkills: 6,
    jobContent: 5,
    selfIntro: 5,
    overview: 5,
    detail: 4,
  };

  function normText(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map(normText).filter(Boolean).join(" ");
    return String(value).trim();
  }

  function normalizeHaystack(text) {
    return normText(text).toLowerCase();
  }

  function parseTags(raw) {
    if (Array.isArray(raw)) return raw.map(normText).filter(Boolean);
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/[,、]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }

  function joinMenuItems(items) {
    if (!items) return "";
    if (typeof items === "string") return normText(items);
    if (!Array.isArray(items)) return normText(items);
    return items
      .map((item) => {
        if (!item || typeof item !== "object") return normText(item);
        return [
          item.title,
          item.name,
          item.label,
          item.description,
          item.scope,
          item.price,
          item.note,
        ]
          .filter(Boolean)
          .map(normText)
          .join(" ");
      })
      .join(" ");
  }

  function stripSearchNoise(text) {
    return String(text || "")
      .replace(
        /(探したい|探してる|探して|探す|したい|してる|欲しい|お願い|ください|できますか|できる人|の人|いる|います|はありますか|を教えて|教えて|相談|おすすめ|紹介|業者|スタッフ|募集)/g,
        " "
      )
      .replace(/[\s、。！？!?]+/g, " ")
      .trim();
  }

  function collectTerms(criteria, options) {
    const minLen = options?.minLen ?? 2;
    const terms = new Set();

    function addTerm(raw) {
      const t = normText(raw).toLowerCase();
      if (t.length >= minLen) terms.add(t);
    }

    function addFromText(text) {
      if (!text) return;
      const cleaned = stripSearchNoise(text);
      addTerm(cleaned);
      cleaned.split(/[\s、。・\/\(\)（）「」]+/).forEach((part) => {
        const w = part.trim().toLowerCase();
        if (w.length >= minLen) terms.add(w);
      });
    }

    [
      criteria?.keywords,
      criteria?.requestKeywords,
      criteria?.jobKeywords,
      criteria?.productKeywords,
    ].forEach((arr) => {
      if (Array.isArray(arr)) arr.forEach(addFromText);
    });

    addFromText(criteria?.requestContent);
    addFromText(criteria?.requestText);
    addFromText(criteria?.jobText);
    addFromText(criteria?.productText);

    if (terms.size === 0 && criteria?.text) {
      addFromText(criteria.text);
    }

    return [...terms];
  }

  function scoreFieldMatch(fieldGroups, terms) {
    if (!terms?.length || !fieldGroups) return 0;
    let score = 0;

    for (const term of terms) {
      if (!term || term.length < 2) continue;
      let bestWeight = 0;

      for (const [key, raw] of Object.entries(fieldGroups)) {
        const weight = WEIGHTS[key];
        if (!weight) continue;
        const hay = normalizeHaystack(raw);
        if (!hay || !hay.includes(term)) continue;
        if (weight > bestWeight) bestWeight = weight;
      }

      if (bestWeight > 0) score += bestWeight;
    }

    return score;
  }

  function scorePhraseBonus(fieldGroups, phrase, phraseWeight) {
    const weight = phraseWeight ?? 3;
    if (!phrase || phrase.length < 4 || !fieldGroups) return 0;
    const chunk = stripSearchNoise(phrase).slice(0, 28).toLowerCase();
    if (chunk.length < 4) return 0;

    const keys = [
      "title",
      "serviceMenu",
      "skillList",
      "qualifications",
      "welcomeSkills",
      "jobContent",
      "overview",
      "detail",
    ];
    for (let i = 0; i < keys.length; i += 1) {
      const hay = normalizeHaystack(fieldGroups[keys[i]]);
      if (hay && hay.includes(chunk)) return weight;
    }
    return 0;
  }

  function extractBusinessMenu(item) {
    const fd = item?.form_data && typeof item.form_data === "object" ? item.form_data : {};
    const extra = item.category_extra || fd.category_extra || {};
    const sources = [
      item.service_menu_items,
      fd.service_menu_items,
      item.business_service?.menu_items,
      fd.business_service?.menu_items,
      extra.cleaning?.cleaning_services,
      extra.repair?.repair_services,
    ];
    for (let i = 0; i < sources.length; i += 1) {
      const text = joinMenuItems(sources[i]);
      if (text) return text;
    }
    return "";
  }

  function buildBusinessServiceFields(item) {
    if (!item) return {};
    const fd = item.form_data && typeof item.form_data === "object" ? item.form_data : {};
    const subKey = String(item.business_subcategory || fd.business_subcategory || "").trim();
    const subLabel =
      global.TasuBusinessCategories?.getSubcategoryLabel?.(item.business_category, subKey) || "";
    const extra = item.category_extra || fd.category_extra || {};
    const tags = [
      ...parseTags(item.tags),
      ...parseTags(item.service_tags),
      ...(item.applicationConditions || []),
      ...(item.conditionBadges || []).map((b) => b.label),
    ];

    return {
      title: [item.company_name, item.title, fd.service_name, fd.company_name]
        .filter(Boolean)
        .join(" "),
      category: [
        item.categoryLabel,
        item.business_category,
        fd.business_category,
        fd.category_label,
      ]
        .filter(Boolean)
        .join(" "),
      subcategory: [subKey, subLabel, fd.business_subcategory_label].filter(Boolean).join(" "),
      serviceMenu: extractBusinessMenu(item),
      tags: tags.join(" "),
      qualifications: [item.license_info, item.licenseLine, fd.license_info, fd.qualifications]
        .filter(Boolean)
        .join(" "),
      overview: [
        item.serviceSummary,
        item.boardTrustShort,
        extra.cleaning?.cleaning_types,
        item.budgetText,
        item.budgetLabel,
      ]
        .filter(Boolean)
        .join(" "),
      detail: [
        item.description,
        fd.description,
        fd.service_detail,
        fd.detail_description,
        fd.overview,
        item.achievements,
        fd.achievements,
      ]
        .filter(Boolean)
        .join(" "),
      selfIntro: [fd.company_intro, fd.provider_bio, fd.self_introduction].filter(Boolean).join(" "),
    };
  }

  function buildSkillFields(candidate) {
    const listing = candidate?.listing || {};
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const tags = [...parseTags(listing.tags), ...parseTags(candidate?.tags)];

    return {
      title: [candidate?.title, fd.serviceName, fd.service_name, fd.title].filter(Boolean).join(" "),
      category: [candidate?.category, fd.skill_category, fd.category].filter(Boolean).join(" "),
      subcategory: [fd.skill_subcategory, fd.subcategory].filter(Boolean).join(" "),
      skillList: [
        fd.scope,
        fd.skills,
        fd.skill_list,
        fd.skill_items,
        fd.service_scope,
        candidate?.features,
        tags.join(" "),
      ]
        .filter(Boolean)
        .join(" "),
      tags: tags.join(" "),
      overview: [fd.overview, listing.serviceSummary, candidate?.formatRegion].filter(Boolean).join(" "),
      detail: [listing.description, fd.description, fd.detail, fd.service_detail].filter(Boolean).join(" "),
      selfIntro: [fd.provider_bio, fd.seller_bio, candidate?.sellerName].filter(Boolean).join(" "),
    };
  }

  function buildWorkerFields(candidate) {
    const norm = candidate?.norm || {};
    const listing = candidate?.listing || {};
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const tags = [...parseTags(listing.tags), ...parseTags(candidate?.tags)];

    return {
      title: [candidate?.title, candidate?.workerName, norm.displayName].filter(Boolean).join(" "),
      category: [candidate?.taskCategory, fd.workerCategory, fd.worker_category].filter(Boolean).join(" "),
      skillList: [
        norm.services,
        fd.services,
        fd.worker_services,
        candidate?.features,
        tags.join(" "),
      ]
        .filter(Boolean)
        .join(" "),
      qualifications: [
        candidate?.certifications,
        norm.certifications,
        fd.qualifications,
        fd.worker_certifications,
      ]
        .filter(Boolean)
        .join(" "),
      tags: tags.join(" "),
      selfIntro: [norm.profile, fd.worker_profile, fd.bio].filter(Boolean).join(" "),
      overview: [norm.notes, norm.experience, candidate?.experience, norm.availability].filter(Boolean).join(" "),
      detail: [listing.description, fd.description, fd.detail].filter(Boolean).join(" "),
    };
  }

  function buildJobFields(candidate) {
    const norm = candidate?.norm || {};
    const listing = candidate?.listing || {};
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const tags = [...parseTags(candidate?.tags), ...parseTags(norm.tags), ...parseTags(listing.tags)];

    return {
      title: [candidate?.title, norm.title, fd.job_title].filter(Boolean).join(" "),
      category: [candidate?.category, norm.category, listing.category, fd.jobCategory].filter(Boolean).join(" "),
      subcategory: [norm.subcategory, fd.job_subcategory].filter(Boolean).join(" "),
      jobContent: [
        norm.description,
        listing.description,
        norm.applicationRequirements,
        norm.requiredSkills,
        fd.job_description,
        fd.description,
        candidate?.recruitConditions,
      ]
        .filter(Boolean)
        .join(" "),
      welcomeSkills: [norm.welcomeSkills, listing.welcome_skills, fd.welcome_skills].filter(Boolean).join(" "),
      qualifications: [norm.applicationRequirements, norm.requiredSkills, listing.required_skills, fd.required_skills]
        .filter(Boolean)
        .join(" "),
      tags: tags.join(" "),
      overview: [norm.workStyle, candidate?.workStyle, norm.benefits, norm.workingHours].filter(Boolean).join(" "),
      detail: [norm.contractTerms, norm.applicationMethod, fd.detail].filter(Boolean).join(" "),
    };
  }

  function buildProductFields(candidate) {
    const listing = candidate?.listing || {};
    const product = candidate?.product || null;
    const norm = global.TasuProductListingFields?.normalizeProductListing?.(listing) || {};
    const fd = listing.form_data && typeof listing.form_data === "object" ? listing.form_data : {};
    const tags = [
      ...parseTags(norm.tags),
      ...parseTags(listing.tags),
      ...parseTags(candidate?.features),
      product?.tag,
      product?.category,
    ].filter(Boolean);

    return {
      title: [candidate?.productName, candidate?.shopName, norm.title, product?.title].filter(Boolean).join(" "),
      category: [candidate?.category, norm.category, product?.category, listing.categoryLabel].filter(Boolean).join(" "),
      subcategory: [norm.subcategory, product?.product_category, fd.subcategory].filter(Boolean).join(" "),
      tags: tags.join(" "),
      overview: [norm.spec, norm.deliveryMethod, candidate?.regionDelivery, product?.description?.slice?.(0, 80)]
        .filter(Boolean)
        .join(" "),
      detail: [
        norm.description,
        listing.description,
        listing.product_description,
        product?.description,
        fd.description,
        fd.product_description,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  function buildShopFields(shop, product) {
    const extra =
      shop?.form_data && typeof shop.form_data === "object"
        ? shop.form_data
        : shop?.category_extra || {};
    const fd = shop?.form_data && typeof shop.form_data === "object" ? shop.form_data : {};
    const tags = [
      ...parseTags(shop?.tags),
      ...parseTags(shop?.service_tags),
      product?.category,
    ].filter(Boolean);

    return {
      title: [shop?.company_name, shop?.title, extra.shop_name, fd.shop_name, product?.title]
        .filter(Boolean)
        .join(" "),
      category: [
        shop?.categoryLabel,
        shop?.business_category,
        extra.shop_store_category,
        fd.business_subcategory,
      ]
        .filter(Boolean)
        .join(" "),
      tags: tags.join(" "),
      overview: [shop?.service_area, extra.visit_area, extra.address, shop?.serviceSummary].filter(Boolean).join(" "),
      detail: [shop?.description, fd.description, fd.shop_description, product?.description].filter(Boolean).join(" "),
    };
  }

  global.TasuAiSearchFieldMatch = {
    WEIGHTS,
    collectTerms,
    scoreFieldMatch,
    scorePhraseBonus,
    buildBusinessServiceFields,
    buildSkillFields,
    buildWorkerFields,
    buildJobFields,
    buildProductFields,
    buildShopFields,
    joinMenuItems,
    normalizeHaystack,
    stripSearchNoise,
  };
})(typeof window !== "undefined" ? window : globalThis);
